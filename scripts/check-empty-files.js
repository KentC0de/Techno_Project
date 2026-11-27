const fs = require('fs');
const path = require('path');

const roots = ['src', 'scripts'];
const empty = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (stat.size === 0) empty.push(full);
  }
}

roots.forEach((r) => fs.existsSync(r) && walk(r));

if (empty.length > 0) {
  console.error('Empty (0-byte) files found:\n' + empty.join('\n'));
  process.exit(1);
}
console.log('No empty files.');
