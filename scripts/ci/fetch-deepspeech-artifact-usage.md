fetch-deepspeech-artifact usage

This helper script downloads prebuilt DeepSpeech native bindings produced by the CI workflow (.github/workflows/build-deepspeech.yml) and extracts them into node_modules/deepspeech/lib/binding.

Requirements
- A GitHub token with repo access (GITHUB_TOKEN environment variable or GH_TOKEN).
- The repository slug (owner/repo) in GITHUB_REPOSITORY or as the first CLI arg.

Quick run (example):

  GITHUB_TOKEN=ghp_xxx GITHUB_REPOSITORY=owner/repo npm run fetch-deepspeech-artifact

Notes
- If GITHUB_TOKEN is not set the script will skip and exit 0 (this makes it safe to include in postinstall hooks).
- The script expects the workflow name build-deepspeech.yml. Use WORKFLOW_FILE env to override.
- After extraction you may need to run `npm rebuild deepspeech` or `npm run postinstall` to ensure native module is compatible with Electron.

If you'd like, I can add an automated step that pulls the artifact from the Actions run directly into CI or your build server instead of running it locally.