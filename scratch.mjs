import esbuild from 'esbuild';
import fs from 'fs';

async function check() {
  try {
    const code = fs.readFileSync('/Users/sam/hallelujahbeamer/src/renderer/components/ThemeDesigner.tsx', 'utf8');
    const result = await esbuild.transform(code, {
      loader: 'tsx',
      jsx: 'automatic'
    });
    console.log("SUCCESS. No parse errors.");
  } catch (err) {
    console.error("PARSE ERROR:", err);
  }
}
check();
