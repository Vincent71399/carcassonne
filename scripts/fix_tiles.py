import re
import os

# Get path relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TILES_TS = os.path.join(SCRIPT_DIR, '..', 'src', 'engine', 'tiles.ts')

with open(TILES_TS, 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Remove all injected fieldConnections inside the edges object
content = re.sub(r',?\s*fieldConnections:\s*\[\[.*?\]\]', '', content)

# Step 2: Inject them correctly.
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

# The objects are indented by 4 spaces and end with '    },' or '    }'
for tid, fields in field_data.items():
    # Match from typeId: '...' down to the first '\n    },' or '\n    }'
    pattern = r"(typeId:\s*['\"]" + tid + r"['\"][\s\S]*?)(\n    \},?)"
    
    def repl(m):
        block = m.group(1)
        suffix = m.group(2)
        return block + f",\n        fieldConnections: {fields}" + suffix

    content = re.sub(pattern, repl, content)

with open(TILES_TS, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Tiles fixed and re-injected in {TILES_TS}!")
