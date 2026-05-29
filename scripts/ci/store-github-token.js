#!/usr/bin/env node
// Store GitHub artifact token securely in OS keychain using keytar
// Usage:
//   GITHUB_TOKEN=ghp_xxx node scripts/ci/store-github-token.js
// or
//   node scripts/ci/store-github-token.js ghp_xxx

const keytar = require('keytar');

const token = process.env.GITHUB_TOKEN || process.argv[2];
if (!token) {
  console.error('Missing token. Provide via GITHUB_TOKEN env or as first argument:');
  console.error('  GITHUB_TOKEN=ghp_xxx node scripts/ci/store-github-token.js');
  console.error('  node scripts/ci/store-github-token.js ghp_xxx');
  process.exit(1);
}

(async () => {
  try {
    await keytar.setPassword('hallelujahbeamer', 'githubArtifactToken', token);
    console.log('Stored GitHub artifact token in OS keychain (service="hallelujahbeamer", account="githubArtifactToken").');
    console.log('You can now run: npm run auto-fetch-deepspeech-artifact  (ensure GITHUB_REPOSITORY is set)');
    process.exit(0);
  } catch (err) {
    console.error('Failed to store token:', err && err.message ? err.message : String(err));
    process.exit(2);
  }
})();
