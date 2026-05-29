#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

async function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    const keytar = require('keytar');
    const t = await keytar.getPassword('hallelujahbeamer', 'githubArtifactToken');
    if (t) return t;
  } catch (err) {
    // ignore
  }
  return null;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchJson(url, token) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'hallelujahbeamer-monitor' };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(()=>'<no body>');
    throw new Error(`Fetch ${url} failed: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function downloadArtifactZip(url, token, destPath) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream', 'User-Agent': 'hallelujahbeamer-monitor' } });
  if (!res.ok) throw new Error(`Artifact download failed: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  await fs.writeFile(destPath, Buffer.from(ab));
  return destPath;
}

async function findFileWithExt(dir, exts) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const found = await findFileWithExt(p, exts);
      if (found) return found;
    } else if (e.isFile()) {
      for (const ext of exts) if (e.name.endsWith(ext)) return p;
    }
  }
  return null;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY || process.argv[2] || 'sgilberts/hb-scripture-display-ai';
  const runId = process.env.RUN_ID || process.argv[3] || '26632172755';
  const token = await getToken();
  if (!token) { console.error('No GitHub token found. Set GITHUB_TOKEN or store a token with npm run set-github-artifact-token.'); process.exit(1); }

  console.log(`Monitoring run ${runId} in repo ${repo}`);

  let attempts = 0;
  const maxAttempts = 480; // ~2 hours with 15s sleep
  while (true) {
    attempts++;
    try {
      const run = await fetchJson(`https://api.github.com/repos/${repo}/actions/runs/${runId}`, token);
      console.log(new Date().toISOString(), 'status:', run.status, run.conclusion ? `conclusion: ${run.conclusion}` : '');
      if (run.status === 'completed') {
        console.log('Run completed. conclusion:', run.conclusion);
        break;
      }
    } catch (err) {
      const m = String(err && err.message ? err.message : err);
      console.error('Error fetching run status:', m);
      if (m.includes('404')) { console.error('Run not found. Aborting.'); process.exit(2); }
    }
    if (attempts > maxAttempts) { console.error('Timeout waiting for run to complete'); process.exit(3); }
    await sleep(15000);
  }

  try {
    const artifactsResp = await fetchJson(`https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts`, token);
    if (!artifactsResp.artifacts || artifactsResp.artifacts.length === 0) {
      console.log('No artifacts found for this run.');
      process.exit(0);
    }
    console.log(`Found ${artifactsResp.artifacts.length} artifacts. Downloading...`);

    const destDir = path.join(process.cwd(), 'node_modules', 'deepspeech', 'lib', 'binding');
    await fs.mkdir(destDir, { recursive: true });

    for (const art of artifactsResp.artifacts) {
      console.log(`Downloading artifact ${art.name} (id ${art.id}) ...`);
      const zipPath = path.join(os.tmpdir(), `artifact-${art.id}.zip`);
      await downloadArtifactZip(art.archive_download_url, token, zipPath);
      const tmpDir = path.join(os.tmpdir(), `artifact-${art.id}`);
      if (!fsSync.existsSync(tmpDir)) await fs.mkdir(tmpDir, { recursive: true });
      console.log('Unzipping artifact to', tmpDir);
      const unzip = spawnSync('unzip', ['-o', zipPath, '-d', tmpDir], { stdio: 'inherit' });
      if (unzip.status !== 0) {
        console.warn('unzip failed or not available; continuing to search for inner archives...');
      }

      const inner = await findFileWithExt(tmpDir, ['.tgz', '.tar.gz']);
      if (inner) {
        console.log('Found inner archive:', inner, 'Extracting to', destDir);
        const tarRes = spawnSync('tar', ['-xzf', inner, '-C', destDir], { stdio: 'inherit' });
        if (tarRes.status !== 0) throw new Error('tar extraction failed');
      } else {
        const candidate = path.join(tmpDir, 'v0.9.3');
        if (fsSync.existsSync(candidate)) {
          console.log('Copying v0.9.3 directory to binding folder');
          const cpRes = spawnSync('sh', ['-lc', `cp -R "${candidate}" "${destDir}/"`], { stdio: 'inherit' });
          if (cpRes.status !== 0) throw new Error('copy failed');
        } else {
          console.log('No inner tgz or v0.9.3 directory; copying unpacked files into binding folder');
          const cpRes = spawnSync('sh', ['-lc', `cp -R "${tmpDir}"/* "${destDir}/"`], { stdio: 'inherit' });
          if (cpRes.status !== 0) throw new Error('copy failed (fallback)');
        }
      }
      console.log(`Artifact ${art.name} processed.`);
    }

    console.log('Running npm rebuild deepspeech...');
    let res = spawnSync('npm', ['rebuild', 'deepspeech'], { stdio: 'inherit' });
    if (res.status !== 0) console.warn('npm rebuild deepspeech exited with code', res.status);

    console.log('Running npx electron-rebuild -f -w deepspeech ...');
    res = spawnSync('npx', ['electron-rebuild', '-f', '-w', 'deepspeech'], { stdio: 'inherit' });
    if (res.status !== 0) console.warn('electron-rebuild exited with code', res.status);

    console.log('Testing require("deepspeech") ...');
    res = spawnSync('node', ['-e', "try{ const ds=require('deepspeech'); console.log('Loaded deepspeech.Model type:', typeof ds.Model); }catch(e){ console.error('Require failed:', e && e.message || e); process.exit(2); }"], { stdio: 'inherit' });
    if (res.status === 0) {
      console.log('DeepSpeech native binding installed successfully.');
    } else {
      console.error('DeepSpeech require test failed (non-zero exit).');
      process.exit(6);
    }

  } catch (err) {
    console.error('Error processing artifacts:', err && err.message ? err.message : err);
    process.exit(5);
  }

  console.log('Done.');
}

main().catch(err => { console.error('Unhandled error:', err); process.exit(99); });
