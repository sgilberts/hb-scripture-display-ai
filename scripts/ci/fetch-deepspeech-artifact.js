#!/usr/bin/env node
/* fetch-deepspeech-artifact.js
 * Downloads and extracts the latest DeepSpeech CI-built native binding artifact for this platform.
 *
 * Usage:
 *   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/ci/fetch-deepspeech-artifact.js
 *
 * If GITHUB_TOKEN is not set the script will skip (exit 0) so it is safe to run in postinstall.
 */

const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('child_process');

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.log('GITHUB_TOKEN not set — skipping artifact fetch (safe during postinstall).');
    return 0;
  }

  const repo = process.env.GITHUB_REPOSITORY || process.argv[2];
  if (!repo) {
    console.error('GITHUB_REPOSITORY not provided. Set env GITHUB_REPOSITORY=owner/repo or pass owner/repo as first arg.');
    return 2;
  }

  const workflowFile = process.env.WORKFLOW_FILE || 'build-deepspeech.yml';
  const apiBase = 'https://api.github.com';
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'hallelujahbeamer-fetch-deepspeech'
  };

  const platform = process.platform; // 'darwin'|'linux'|'win32'
  const arch = process.arch; // 'arm64'|'x64'
  let expectedNames = [];
  if (platform === 'linux') expectedNames.push('deepspeech-linux-x64.tgz');
  if (platform === 'win32') expectedNames.push('deepspeech-windows-x64.zip', 'deepspeech-windows-x64.tgz');
  if (platform === 'darwin') {
    if (arch === 'arm64') expectedNames.push('deepspeech-macos-arm64.tgz');
    expectedNames.push('deepspeech-macos-x64.tgz', 'deepspeech-macos-arm64.tgz');
  }
  expectedNames.push('deepspeech-linux-x64.tgz','deepspeech-macos-arm64.tgz','deepspeech-windows-x64.zip');

  // Helper fetch
  async function ghFetchJson(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API ${url} failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  // Get workflow
  let workflow;
  try {
    workflow = await ghFetchJson(`${apiBase}/repos/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}`);
  } catch (err) {
    console.error('Unable to find workflow:', err.message);
    return 3;
  }
  const workflow_id = workflow.id;
  // List runs
  const runsUrl = `${apiBase}/repos/${repo}/actions/workflows/${workflow_id}/runs?status=success&per_page=20`;
  const runsData = await ghFetchJson(runsUrl);
  const runs = runsData.workflow_runs || [];
  if (!runs.length) {
    console.error('No successful workflow runs found.');
    return 4;
  }

  // Iterate runs to find artifact matching expected name
  let chosenArtifact = null;
  let chosenRunId = null;
  for (const run of runs) {
    const artifactsUrl = `${apiBase}/repos/${repo}/actions/runs/${run.id}/artifacts`;
    const artifactsData = await ghFetchJson(artifactsUrl);
    const artifacts = artifactsData.artifacts || [];
    // find exact match first
    for (const name of expectedNames) {
      const found = artifacts.find(a => a.name === name);
      if (found) {
        chosenArtifact = found;
        chosenRunId = run.id;
        break;
      }
    }
    if (chosenArtifact) break;
    // fallback: find artifact whose name includes 'deepspeech'
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

  // Download artifact archive
  const downloadUrl = chosenArtifact.archive_download_url;
  const downloadRes = await fetch(downloadUrl, { headers });
  if (!downloadRes.ok) {
    throw new Error(`Artifact download failed: ${downloadRes.status} ${downloadRes.statusText}`);
  }
  const buffer = await downloadRes.arrayBuffer();
  const ext = chosenArtifact.name.endsWith('.zip') ? 'zip' : 'tgz';
  const tmpPath = path.join(os.tmpdir(), `deepspeech-artifact-${Date.now()}.${ext}`);
  await fs.writeFile(tmpPath, Buffer.from(buffer));
  console.log(`Saved artifact to ${tmpPath}`);

  const destDir = path.join(process.cwd(), 'node_modules', 'deepspeech', 'lib', 'binding');
  await fs.mkdir(destDir, { recursive: true });

  // Extract
  if (ext === 'tgz') {
    console.log('Extracting tgz to', destDir);
    const r = spawnSync('tar', ['-xzf', tmpPath, '-C', destDir], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error('tar failed with code', r.status);
      return 6;
    }
  } else { // zip
    console.log('Extracting zip to', destDir);
    const r = spawnSync('unzip', ['-o', tmpPath, '-d', destDir], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error('unzip failed with code', r.status);
      return 7;
    }
  }
  console.log('Extraction complete. You may need to run: npm rebuild deepspeech or npm run postinstall');
  return 0;
}

main().then(code => process.exit(code)).catch(err => { console.error('Error:', err); process.exit(10); });
