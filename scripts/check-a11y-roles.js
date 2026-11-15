const fs = require('fs');
const path = require('path');
const babel = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const NATIVE_ROLES = new Set([
  'none',
  'button',
  'link',
  'search',
  'image',
  'keyboardkey',
  'text',
  'adjustable',
  'imagebutton',
  'header',
  'summary',
  'alert',
  'checkbox',
  'combobox',
  'menu',
  'menubar',
  'menuitem',
  'progressbar',
  'radio',
  'radiogroup',
  'scrollbar',
  'spinbutton',
  'switch',
  'tab',
  'tablist',
  'timer',
  'toolbar',
]);

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.expo')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.resolve(__dirname, '../src'));
let issues = 0;

console.log(`Scanning ${files.length} source files for invalid React Native accessibilityRole / role values...\n`);

files.forEach((file) => {
  // a11y.js itself declares NATIVE_ROLES and maps arbitrary roles, so skip checking its internal mappings
  if (file.endsWith('src\\utils\\a11y.js') || file.endsWith('src/utils/a11y.js')) return;

  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = babel.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'exportDefaultFrom'],
    });
  } catch (err) {
    console.error(`❌ Parse error in ${file}: ${err.message}`);
    issues++;
    return;
  }

  const relPath = path.relative(path.resolve(__dirname, '..'), file);

  traverse(ast, {
    JSXAttribute(p) {
      const attrName = p.node.name?.name;
      if (attrName === 'accessibilityRole' || attrName === 'role') {
        // Check if inside a Platform.OS === 'web' branch
        let parent = p.parentPath;
        let isWebOnly = false;
        while (parent) {
          if (parent.isIfStatement() || parent.isConditionalExpression()) {
            const test = parent.node.test;
            if (test && test.type === 'BinaryExpression') {
              const left = code.slice(test.left.start, test.left.end);
              const right = code.slice(test.right.start, test.right.end);
              if ((left.includes('Platform.OS') && right.includes('web')) ||
                  (right.includes('Platform.OS') && left.includes('web'))) {
                isWebOnly = true;
                break;
              }
            }
          }
          parent = parent.parentPath;
        }

        if (isWebOnly) return;

        const val = p.node.value;
        if (!val) return;

        if (val.type === 'StringLiteral') {
          const role = val.value;
          if (!NATIVE_ROLES.has(role)) {
            console.error(`❌ Invalid literal ${attrName}="${role}" at ${relPath}:${val.loc?.start?.line}`);
            issues++;
          }
        } else if (val.type === 'JSXExpressionContainer') {
          const expr = val.expression;
          if (expr.type === 'StringLiteral') {
            if (!NATIVE_ROLES.has(expr.value)) {
              console.error(`❌ Invalid ${attrName}={'${expr.value}'} at ${relPath}:${expr.loc?.start?.line}`);
              issues++;
            }
          } else if (expr.type === 'ConditionalExpression') {
            if (expr.consequent.type === 'StringLiteral' && !NATIVE_ROLES.has(expr.consequent.value)) {
              console.error(`❌ Invalid ${attrName} in ternary: '${expr.consequent.value}' at ${relPath}:${expr.consequent.loc?.start?.line}`);
              issues++;
            }
            if (expr.alternate.type === 'StringLiteral' && !NATIVE_ROLES.has(expr.alternate.value)) {
              console.error(`❌ Invalid ${attrName} in ternary: '${expr.alternate.value}' at ${relPath}:${expr.alternate.loc?.start?.line}`);
              issues++;
            }
          }
        }
      }
    },
  });
});

if (issues === 0) {
  console.log(`✅ All accessibilityRole / role props across the project are safe for Native Android and iOS!`);
  process.exit(0);
} else {
  console.error(`\nFound ${issues} invalid accessibilityRole / role value(s).`);
  process.exit(1);
}

