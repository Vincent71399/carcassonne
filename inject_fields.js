const fs = require('fs');

const fieldData = {
    'A': `[['top-0', 'top-1', 'top-2', 'right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']]`,
    'B': `[['top-0', 'top-1', 'top-2', 'right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-2', 'left-0', 'left-1', 'left-2']]`,
    'C': `[]`,
    'D': `[['right-0', 'left-2'], ['right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0']]`,
    'E': `[['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']]`,
    'F': `[['top-0', 'top-1', 'top-2', 'bottom-0', 'bottom-1', 'bottom-2']]`,
    'G': `[['right-0', 'right-1', 'right-2'], ['left-0', 'left-1', 'left-2']]`,
    'H': `[['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2']]`,
    'I': `[['bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']]`,
    'J': `[['bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']]`,
    'K': `[['right-0', 'bottom-2'], ['right-2', 'bottom-0']]`,
    'L': `[['right-0', 'bottom-2'], ['right-2', 'bottom-0']]`,
    'M': `[['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2']]`,
    'N': `[['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2']]`,
    'O': `[['bottom-0', 'bottom-1', 'bottom-2']]`,
    'P': `[['bottom-0', 'bottom-1', 'bottom-2']]`,
    'Q': `[['bottom-0', 'bottom-2']]`,
    'R': `[['bottom-0', 'bottom-1', 'bottom-2']]`,
    'S': `[['right-0', 'left-2'], ['right-2', 'bottom-0'], ['bottom-2', 'left-0']]`,
    'T': `[['right-0', 'right-1', 'right-2', 'bottom-0', 'left-2'], ['bottom-2', 'left-0']]`,
    'U': `[['top-0', 'left-2', 'left-1', 'left-0', 'bottom-2'], ['top-2', 'right-0', 'right-1', 'right-2', 'bottom-0']]`,
    'V': `[['top-0', 'top-1', 'top-2', 'right-0', 'right-1', 'right-2', 'bottom-0', 'left-2'], ['bottom-2', 'left-0']]`,
    'W': `[['top-0', 'top-1', 'top-2', 'right-0', 'left-2'], ['right-2', 'bottom-0'], ['bottom-2', 'left-0']]`,
    'X': `[['top-2', 'right-0'], ['right-2', 'bottom-0'], ['bottom-2', 'left-0'], ['left-2', 'top-0']]`
};

let content = fs.readFileSync('src/engine/tiles.ts', 'utf8');

for (const [id, fields] of Object.entries(fieldData)) {
    // Regex looks for: typeId: 'A' ... } followed by , or newline
    const rx = new RegExp("(typeId:\\s*'" + id + "'[\\s\\S]*?\\})(\\s*(,?\\n))", 'g');
    content = content.replace(rx, (match, p1, p2) => {
        if (p1.includes('fieldConnections:')) return match;
        // insert before the closing brace
        return p1.replace(/\s*}$/, ",\n        fieldConnections: " + fields + "\n    }") + p2;
    });
}

fs.writeFileSync('src/engine/tiles.ts', content);
console.log('Fields injected!');
