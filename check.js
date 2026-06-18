const fs = require('fs');
const code = fs.readFileSync('src/renderer/components/ControlPanel.tsx', 'utf8');
const lines = code.split('\n');

let stack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // A simplistic regex to find opening tags.
  // We assume no JSX in strings for our tags.
  const openTags = [...line.matchAll(/<(div|section|main|footer|aside|header)[^>]*?(?<!\/)>/g)];
  for (const m of openTags) {
    stack.push({ tag: m[1], line: i + 1 });
  }
  
  const closeTags = [...line.matchAll(/<\/(div|section|main|footer|aside|header)>/g)];
  for (const m of closeTags) {
    const top = stack[stack.length - 1];
    if (top && top.tag === m[1]) {
      stack.pop();
    } else {
      console.log(`MISMATCH at line ${i + 1}: expected </${top ? top.tag : 'NONE'}> (from line ${top ? top.line : 'NONE'}), found </${m[1]}>`);
      // We'll pop until we find a match, or just ignore. Let's just ignore to see the first failure.
      if (top) stack.pop();
    }
  }
}
console.log('UNCLOSED:', stack);
