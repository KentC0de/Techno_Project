const fs = require('fs');
const path = require('path');
const babel = require('@babel/parser');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const componentDirs = [
  path.resolve(__dirname, '../src/components'),
  path.resolve(__dirname, '../src/screens'),
];

const allFiles = componentDirs.flatMap((dir) => walk(dir));
let failures = 0;

console.log(`Checking ${allFiles.length} component and screen files for valid default exports...\n`);

allFiles.forEach((filePath) => {
  const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
  // Exempt barrel/index provider files if intended as named exports only
  if (relPath.endsWith('src\\components\\feedback\\index.js') || relPath.endsWith('src/components/feedback/index.js')) {
    return;
  }
  if (relPath.endsWith('src\\components\\GlobalErrorBoundary.js') || relPath.endsWith('src/components/GlobalErrorBoundary.js')) {
    return;
  }

  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = babel.parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
        'exportDefaultFrom',
      ],
    });
  } catch (err) {
    console.error(`❌ [PARSE ERROR] ${relPath}: ${err.message}`);
    failures++;
    return;
  }

  let defaultExportNode = null;
  ast.program.body.forEach((node) => {
    if (node.type === 'ExportDefaultDeclaration') {
      defaultExportNode = node.declaration;
    }
  });

  if (!defaultExportNode) {
    console.error(`❌ [MISSING DEFAULT EXPORT] ${relPath} does not have a default export.`);
    failures++;
    return;
  }

  // Verify default export is not a plain object literal (which causes 'expected string ... got object')
  if (defaultExportNode.type === 'ObjectExpression') {
    console.error(`❌ [INVALID DEFAULT EXPORT] ${relPath} exports an Object literal as default.`);
    failures++;
    return;
  }
});

if (failures === 0) {
  console.log(`✅ All ${allFiles.length} component/screen files have valid component default exports!`);
  process.exit(0);
} else {
  console.error(`\nFound ${failures} component export issue(s).`);
  process.exit(1);
}

