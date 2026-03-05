import re

field_data = {
    'A': "[['top-0', 'top-1', 'top-2', 'right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']]",
    'B': "[['top-0', 'top-1', 'top-2', 'right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-2', 'left-0', 'left-1', 'left-2']]",
    'C': "[]",
    'D': "[['right-0', 'left-2'], ['right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0']]",
    'E': "[['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']]",
    'F': "[['top-0', 'top-1', 'top-2', 'bottom-0', 'bottom-1', 'bottom-2']]",
    'G': "[['right-0', 'right-1', 'right-2'], ['left-0', 'left-1', 'left-2']]",
    'H': "[['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2']]",
    'I': "[['bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']]",
    'J': "[['bottom-0', 'bottom-1', 'bottom-2', 'left-0', 'left-1', 'left-2']]",
    'K': "[['right-0', 'bottom-2'], ['right-2', 'bottom-0']]",
    'L': "[['right-0', 'bottom-2'], ['right-2', 'bottom-0']]",
    'M': "[['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2']]",
    'N': "[['right-0', 'right-1', 'right-2', 'bottom-0', 'bottom-1', 'bottom-2']]",
    'O': "[['bottom-0', 'bottom-1', 'bottom-2']]",
    'P': "[['bottom-0', 'bottom-1', 'bottom-2']]",
    'Q': "[['bottom-0', 'bottom-2']]",
    'R': "[['bottom-0', 'bottom-1', 'bottom-2']]",
    'S': "[['right-0', 'left-2'], ['right-2', 'bottom-0'], ['bottom-2', 'left-0']]",
    'T': "[['right-0', 'right-1', 'right-2', 'bottom-0', 'left-2'], ['bottom-2', 'left-0']]",
    'U': "[['top-0', 'left-2', 'left-1', 'left-0', 'bottom-2'], ['top-2', 'right-0', 'right-1', 'right-2', 'bottom-0']]",
    'V': "[['top-0', 'top-1', 'top-2', 'right-0', 'right-1', 'right-2', 'bottom-0', 'left-2'], ['bottom-2', 'left-0']]",
    'W': "[['top-0', 'top-1', 'top-2', 'right-0', 'left-2'], ['right-2', 'bottom-0'], ['bottom-2', 'left-0']]",
    'X': "[['top-2', 'right-0'], ['right-2', 'bottom-0'], ['bottom-2', 'left-0'], ['left-2', 'top-0']]"
}

with open('src/engine/tiles.ts', 'r', encoding='utf-8') as f:
    content = f.read()

for tid, fields in field_data.items():
    # Find the block for this tile
    pattern = r"(typeId:\s*'" + tid + r"'[\s\S]*?\})(\s*(,|\]))"
    
    def repl(m):
        block = m.group(1)
        suffix = m.group(2)
        if 'fieldConnections:' in block:
            return m.group(0)
        
        # Insert before the last closing brace
        block = re.sub(r'\s*\}$', f',\\n        fieldConnections: {fields}\\n    }}', block)
        return block + suffix

    content = re.sub(pattern, repl, content)

with open('src/engine/tiles.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fields injected via Python!")
