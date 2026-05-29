CI artifacts for prebuilt DeepSpeech native bindings

What was added:
- .github/workflows/build-deepspeech.yml : GitHub Actions workflow that attempts to rebuild the deepspeech native binding for Linux, macOS and Windows and uploads the resulting binding bundle as an artifact.

How to use:
1. Trigger the workflow from the Actions UI (Actions -> Build DeepSpeech -> Run workflow).
2. When the run finishes, download the artifact(s) from the run's Artifacts section.
3. Extract the artifact into your project's node_modules/deepspeech/lib/binding/v0.9.3 directory so the runtime can locate the compiled deepspeech.node. Example:
   tar xzf deepspeech-macos-arm64.tgz -C node_modules/deepspeech/lib/binding/

Notes & caveats:
- Building DeepSpeech from source is resource-heavy and may fail on GitHub-hosted runners for macOS depending on available disk/CPU. For macOS arm64 you may need a self-hosted Apple Silicon runner labeled 'macos-arm64'.
- Artifacts are uploaded to the workflow run; manual download is the simplest approach. If you want an automated download step, I can add a script that uses the GitHub API to pull the latest artifact.
- After placing the prebuilt binding into node_modules, run npm rebuild or electron-rebuild if necessary.

If you'd like, I can also add a script to automatically fetch the latest artifact from Actions using a GITHUB_TOKEN and place it into node_modules.
