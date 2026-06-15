const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'renderer', 'components', 'ControlPanel.tsx');

try {
    const code = fs.readFileSync(filePath, 'utf-8');
    const lines = code.split('\n');
    
    // The commented block starts roughly around line 2343 and ends around 3383
    // We'll look for the start signature and end signature to be safe.
    
    const startSig = '        {false && settingsDialogInputId !== null && (() => {';
    const endSig = '        })()}';
    
    let startIndex = -1;
    let endIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
        if (startIndex === -1 && lines[i] === startSig) {
            startIndex = i;
        } else if (startIndex !== -1 && endIndex === -1 && lines[i] === endSig) {
            // Find the closest closing tag for the closure
            endIndex = i;
            break;
        }
    }
    
    if (startIndex !== -1 && endIndex !== -1) {
        lines.splice(startIndex, endIndex - startIndex + 1);
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        console.log('Successfully removed the unnecessary 1040 lines of old input settings code from ControlPanel.tsx.');
    } else {
        console.log('Could not automatically find the exact lines to remove. They might have been altered or already removed.');
    }
} catch (error) {
    console.error('Error during cleanup:', error);
}
