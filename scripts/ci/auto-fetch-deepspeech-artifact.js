#!/usr/bin/env node
/* auto-fetch-deepspeech-artifact.js
 * Attempts to fetch the latest DeepSpeech CI-built artifact from GitHub Actions.
 * Token lookup order: GITHUB_TOKEN env, GH_TOKEN env, keytar stored token (service=hallelujahbeamer, account=githubArtifactToken).
 * Usage:
 *   GITHUB_REPOSITORY=owner/repo node scripts/ci/auto-fetch-deepspeech-artifact.js
 */

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
    const token = await keytar.getPassword('hallelujahbeamer', 'githubArtifactToken');
    if (token) return token;
  } catch (err) {
    // keytar might not be available in some CI environments; ignore
  }
  return null;
}

async function ghFetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${url} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  const token = await getToken();
  if (!token) {
    console.log('No GitHub token found (GITHUB_TOKEN, GH_TOKEN, or stored key). Skipping artifact fetch.');
    console.log('To install a token locally run: node scripts/ci/store-github-token.js <token>');
    return 0; // non-fatal for postinstall
  }

  const repo = process.env.GITHUB_REPOSITORY || process.argv[2];
  if (!repo) {
    console.error('GITHUB_REPOSITORY not set. Please set env var GITHUB_REPOSITORY=owner/repo');
    return 2;
  }

  const workflowFile = process.env.WORKFLOW_FILE || 'build-deepspeech.yml';
  const apiBase = 'https://api.github.com';
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'hallelujahbeamer-auto-fetch'
  };

  const platform = process.platform; // 'darwin'|'linux'|'win32'
  const arch = process.arch; // 'arm64'|'x64'
  const expectedNames = [];
  if (platform === 'linux') expectedNames.push('deepspeech-linux-x64.tgz');
  if (platform === 'win32') expectedNames.push('deepspeech-windows-x64.zip', 'deepspeech-windows-x64.tgz');
  if (platform === 'darwin') {
    if (arch === 'arm64') expectedNames.push('deepspeech-macos-arm64.tgz');
    expectedNames.push('deepspeech-macos-x64.tgz', 'deepspeech-macos-arm64.tgz');
  }
  expectedNames.push('deepspeech-linux-x64.tgz','deepspeech-macos-arm64.tgz','deepspeech-windows-x64.zip');

  try {
    const workflowUrl = `${apiBase}/repos/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}`;
    const workflow = await ghFetchJson(workflowUrl, headers);
    const workflow_id = workflow.id;

    const runsUrl = `${apiBase}/repos/${repo}/actions/workflows/${workflow_id}/runs?status=success&per_page=20`;
    const runsData = await ghFetchJson(runsUrl, headers);
    const runs = runsData.workflow_runs || [];
    if (!runs.length) {
      console.error('No successful workflow runs found.');
      return 4;
    }

    let chosenArtifact = null;
    let chosenRunId = null;

    for (const run of runs) {
      const artifactsUrl = `${apiBase}/repos/${repo}/actions/runs/${run.id}/artifacts`;
      const artifactsData = await ghFetchJson(artifactsUrl, headers);
      const artifacts = artifactsData.artifacts || [];

      for (const name of expectedNames) {
        const found = artifacts.find(a => a.name === name);
        if (found) {
          chosenArtifact = found;
          chosenRunId = run.id;
          break;
        }
      }
      if (chosenArtifact) break;

      const fallback = artifacts.find(a => a.name && a.name.toLowerCase().includes('deepspeech'));
      if (fallback) {
        chosenArtifact = fallback;
        chosenRunId = run.id;
        break;
      }
    }

    if (!chosenArtifact) {
      console.error('No deepspeech artifact found in recent runs.');
      return 5;
    }

    console.log(`Found artifact ${chosenArtifact.name} from run ${chosenRunId} (id ${chosenArtifact.id})`);

    const downloadUrl = chosenArtifact.archive_download_url;
    const downloadRes = await fetch(downloadUrl, { headers });
    if (!downloadRes.ok) throw new Error(`Artifact download failed: ${downloadRes.status} ${downloadRes.statusText}`);
    const buffer = await downloadRes.arrayBuffer();
    const ext = chosenArtifact.name.endsWith('.zip') ? 'zip' : 'tgz';
    const tmpPath = path.join(os.tmpdir(), `deepspeech-artifact-${Date.now()}.${ext}`);
    await fs.writeFile(tmpPath, Buffer.from(buffer));
    console.log(`Saved artifact to ${tmpPath}`);

    const destDir = path.join(process.cwd(), 'node_modules', 'deepspeech', 'lib', 'binding');
    await fs.mkdir(destDir, { recursive: true });

    if (ext === 'tgz') {
      console.log('Extracting tgz to', destDir);
      const r = spawnSync('tar', ['-xzf', tmpPath, '-C', destDir], { stdio: 'inherit' });
      if (r.status !== 0) {
        console.error('tar failed with code', r.status);
        return 6;
      }
    } else {
      console.log('Extracting zip to', destDir);
      const r = spawnSync('unzip', ['-o', tmpPath, '-d', destDir], { stdio: 'inherit' });
      if (r.status !== 0) {
        console.error('unzip failed with code', r.status);
        return 7;
      }
    }

    console.log('Extraction complete. Run `npm rebuild deepspeech` if necessary.');
    return 0;
  } catch (err) {
    console.error('Error fetching artifact:', err && err.message ? err.message : err);
    return 10;
  }
}

main().then(code => process.exit(code)).catch(err => { console.error('Unhandled error:', err); process.exit(11); });
