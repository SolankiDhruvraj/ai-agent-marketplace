import * as parser from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

// Handle ESM/CJS interop for @babel/traverse
const traverse = (traverseModule && traverseModule.default && typeof traverseModule.default === 'function')
  ? traverseModule.default
  : ((traverseModule && typeof traverseModule === 'function') ? traverseModule : traverseModule?.default?.default);

const SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

let issueCounter = 1;

function normalizeFileStatus(status) {
  return status === 'removed' ? 'deleted' : status;
}

function shouldAnalyzeFile(file) {
  return normalizeFileStatus(file.status) !== 'deleted';
}

function getDiffLines(patch, prefix) {
  if (!patch) return [];
  const headerPrefix = prefix.repeat(3);
  return patch
    .split('\n')
    .filter((line) => line.startsWith(prefix) && !line.startsWith(headerPrefix))
    .map((line) => line.slice(1));
}

function getRelevantLines(file) {
  if (!shouldAnalyzeFile(file)) return [];
  const addedLines = getDiffLines(file.patch || '', '+');
  if (addedLines.length > 0) {
    return addedLines;
  }
  if (file.content) {
    return file.content.split('\n');
  }
  return [];
}

function getRelevantContent(file) {
  return getRelevantLines(file).join('\n').trim();
}

/**
 * Robust Babel AST Parser with tolerant fallback for TSX/JSX/ESNext.
 */
function parseAst(content, filename = '') {
  if (!content || !content.trim()) return null;
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const isJsx = filename.endsWith('.jsx') || filename.endsWith('.tsx');

  try {
    return parser.parse(content, {
      sourceType: 'unambiguous',
      errorRecovery: true,
      plugins: [
        isTypeScript ? 'typescript' : 'flow',
        ...(isJsx ? ['jsx'] : []),
        'asyncGenerators',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'nullishCoalescingOperator',
        'optionalChaining',
        'objectRestSpread',
        'topLevelAwait'
      ]
    });
  } catch (err) {
    // Tolerant fallback: wrap in async block if top-level syntax error
    try {
      return parser.parse(`async function __wrap() {\n${content}\n}`, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: ['typescript', 'jsx', 'optionalChaining', 'nullishCoalescingOperator']
      });
    } catch {
      return null;
    }
  }
}

/**
 * Extract clean snippet around a specific line number or node
 */
function extractAstSnippet(file, nodeOrLine, contextLines = 4) {
  const lines = getRelevantLines(file);
  if (!lines.length) return null;

  let targetLine = 1;
  if (typeof nodeOrLine === 'number') {
    targetLine = nodeOrLine;
  } else if (nodeOrLine && nodeOrLine.loc) {
    targetLine = nodeOrLine.loc.start.line;
  }

  const startIdx = Math.max(0, targetLine - 2);
  const endIdx = Math.min(lines.length, startIdx + contextLines);
  return lines.slice(startIdx, endIdx).join('\n').trim() || null;
}

/**
 * Generate a concrete code fix example for a given issue type.
 */
function generateFixCode(type, snippet) {
  const s = (snippet || '').trim();

  switch (type) {
    case 'POTENTIAL_NULL_UNDEFINED_ACCESS': {
      if (!s) {
        return `// Before (unsafe)\nconst value = obj.property;\n\n// After (safe)\nconst value = obj?.property;`;
      }
      return `// Before\n${s}\n\n// After (optional chaining)\n${s.replace(/([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)/g, '$1?.$2')}`;
    }

    case 'OFF_BY_ONE_LOOP_BOUND': {
      if (!s) {
        return `// Before (off-by-one)\nfor (let i = 0; i <= arr.length; i++) {}\n\n// After\nfor (let i = 0; i < arr.length; i++) {}`;
      }
      return `// Before\n${s}\n\n// After\n${s.replace(/<=/g, '<')}`;
    }

    case 'UNHANDLED_PROMISE': {
      if (!s) {
        return `// Before\nfetch(url).then(res => process(res));\n\n// After\nfetch(url)\n  .then(res => process(res))\n  .catch(err => console.error('Error:', err));`;
      }
      return `// Before\n${s}\n\n// After\n${s}\n  .catch(err => console.error('Error:', err));`;
    }

    case 'UNSAFE_EVAL': {
      return `// Before (dangerous)\neval(userInput);\n\n// After (safe alternatives)\nconst data = JSON.parse(userInput);  // for JSON\n// OR use an explicit function lookup map`;
    }

    case 'COMMAND_INJECTION_RISK': {
      return `// Before (vulnerable)\nimport { exec } from 'child_process';\nexec(\`ls \${userInput}\`);\n\n// After (argument array — no shell)\nimport { execFile } from 'child_process';\nexecFile('ls', [sanitizedPath], (err, stdout) => {\n  if (err) throw err;\n  console.log(stdout);\n});`;
    }

    case 'SQL_INJECTION_RISK': {
      return `// Before (vulnerable)\ndb.query(\`SELECT * FROM users WHERE id = \${userId}\`);\n\n// After (parameterized)\ndb.query('SELECT * FROM users WHERE id = $1', [userId]);`;
    }

    case 'HARDCODED_SECRET': {
      return `// Before (never commit secrets)\nconst apiKey = 'sk-abc123secret';\n\n// After\nconst apiKey = process.env.API_KEY;\nif (!apiKey) throw new Error('API_KEY env var is not set');`;
    }

    case 'XSS_RISK': {
      return `// Before (XSS risk)\nelement.innerHTML = req.body.userContent;\n\n// After — use textContent for plain text\nelement.textContent = req.body.userContent;\n\n// OR sanitize if HTML is needed\nimport DOMPurify from 'dompurify';\nelement.innerHTML = DOMPurify.sanitize(req.body.userContent);`;
    }

    case 'DEEP_NESTED_LOOPS': {
      return `// Before (O(n³))\nfor (const a of listA)\n  for (const b of listB)\n    for (const c of listC)\n      process(a, b, c);\n\n// After — use a Set/Map to flatten\nconst bSet = new Set(listB.map(b => b.id));\nfor (const a of listA)\n  for (const c of listC)\n    if (bSet.has(c.bId)) process(a, c);`;
    }

    case 'BLOCKING_CALL_IN_LOOP': {
      return `// Before (blocking per item)\nfor (const item of items) {\n  const data = fs.readFileSync(item.path);\n  process(data);\n}\n\n// After (batch async)\nconst buffers = await Promise.all(\n  items.map(item => fs.promises.readFile(item.path))\n);\nbuffers.forEach(data => process(data));`;
    }

    case 'LARGE_FUNCTION': {
      return `// Before: one large function (100+ lines)\n// After: small focused helpers\nfunction validate(data) { /* … */ }\nfunction transform(data) { /* … */ }\nfunction persist(result) { /* … */ }`;
    }

    case 'DEEP_NESTING': {
      return `// Before (deeply nested)\nif (a) {\n  if (b) {\n    if (c) { doWork(); }\n  }\n}\n\n// After (early returns)\nif (!a) return;\nif (!b) return;\nif (!c) return;\ndoWork();`;
    }

    case 'MANY_FUNCTION_PARAMETERS': {
      return `// Before\nfunction createUser(name, email, age, role, status) { /* … */ }\n\n// After (options object)\nfunction createUser({ name, email, age, role, status }) { /* … */ }`;
    }

    case 'HIGH_CYCLOMATIC_COMPLEXITY': {
      return `// Before (many branches)\n// After (strategy/lookup map)\nconst handlers = { A: handleA, B: handleB };\nconst fn = handlers[type] || defaultHandler;\nreturn fn();`;
    }

    case 'DEPENDENCY_CHANGES': {
      return `# Run before merging:\nnpm audit --audit-level=high\n# Or Snyk:\nnpx snyk test`;
    }

    case 'MISSING_INPUT_VALIDATION': {
      return `import { z } from 'zod';\nconst schema = z.object({ id: z.string(), email: z.string().email() });\nconst parsed = schema.safeParse(req.body);\nif (!parsed.success) return res.status(400).json(parsed.error);`;
    }

    case 'MISSING_TRY_CATCH': {
      if (!s) {
        return `// Before\nasync function load(url) {\n  const res = await fetch(url);\n  return res.json();\n}\n\n// After\nasync function load(url) {\n  try {\n    const res = await fetch(url);\n    return await res.json();\n  } catch (err) {\n    console.error('load() failed:', err);\n    throw err;\n  }\n}`;
      }
      return `try {\n  ${s}\n} catch (err) {\n  console.error('Operation failed:', err);\n  throw err;\n}`;
    }

    case 'SILENT_CATCH': {
      return `// Before\ntry { riskyOp(); } catch () {}\n\n// After\ntry {\n  riskyOp();\n} catch (err) {\n  console.error('riskyOp failed:', err);\n}`;
    }

    case 'CODE_DUPLICATION': {
      return `// Before (duplicated logic)\nfunction calcTaxA(p) { return p * 0.18; }\nfunction calcTaxB(a) { return a * 0.18; }\n\n// After (reusable function)\nconst calcTax = (val, rate = 0.18) => val * rate;`;
    }

    default:
      return s ? `// Detected code:\n${s}\n\n// TODO: apply fix for ${type}` : null;
  }
}

function makeIssue(partial) {
  const base = {
    id: `ISSUE_${issueCounter++}`,
    severity: SEVERITY.LOW,
    codeSnippet: null,
    ...partial
  };

  if (!Object.prototype.hasOwnProperty.call(partial, 'fixCode')) {
    base.fixCode = generateFixCode(base.type, base.codeSnippet);
  }

  return base;
}

// Known global & framework objects that shouldn't be flagged for property dereference
const SAFE_ROOT_OBJECTS = new Set([
  'console', 'Math', 'Object', 'Array', 'JSON', 'Promise', 'Error',
  'Symbol', 'Number', 'String', 'Boolean', 'Date', 'RegExp', 'Map',
  'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'Intl', 'globalThis',
  'process', 'module', 'exports', 'require', 'Buffer', '__dirname', '__filename',
  'fs', 'path', 'http', 'https', 'url', 'os', 'crypto', 'stream', 'events',
  'child_process', 'util', 'querystring', 'readline',
  'app', 'router', 'express', 'req', 'res', 'next', 'server',
  'prisma', 'db', 'sequelize', 'mongoose', 'knex', 'redis',
  'octokit', 'axios', 'fetch', 'graphql', 'apollo',
  'describe', 'it', 'test', 'expect', 'jest', 'vi', 'beforeEach', 'afterEach'
]);

/**
 * 1. AST-Based Bug & Logic Detector
 */
function detectBugAndLogicIssues(file) {
  const issues = [];
  const analyzableContent = getRelevantContent(file);
  if (!analyzableContent) return issues;

  const ast = parseAst(analyzableContent, file.filename);
  if (!ast) return issues;

  let nullDerefReported = false;
  let unhandledPromiseReported = false;
  let offByOneReported = false;

  traverse(ast, {
    // AST Check: MemberExpression deep chains without optional chaining
    MemberExpression(path) {
      if (nullDerefReported) return;
      if (path.node.optional) return;

      // Check if this is a chained member expression: a.b.c
      if (t.isMemberExpression(path.node.object) && !path.node.object.optional) {
        // Find root object
        let current = path.node.object;
        while (t.isMemberExpression(current)) {
          current = current.object;
        }

        if (t.isIdentifier(current) && !SAFE_ROOT_OBJECTS.has(current.name)) {
          nullDerefReported = true;
          const snippet = extractAstSnippet(file, path.node);
          issues.push(
            makeIssue({
              category: 'BUG_LOGIC',
              type: 'POTENTIAL_NULL_UNDEFINED_ACCESS',
              severity: SEVERITY.MEDIUM,
              file: file.filename,
              message: `Potential null/undefined dereference on chained property '${current.name}.${path.node.property.name || 'property'}'.`,
              suggestion: 'Use optional chaining (obj?.prop) or explicit guard checks.',
              codeSnippet: snippet
            })
          );
        }
      }
    },

    // AST Check: Loop boundary <= array.length
    ForStatement(path) {
      if (offByOneReported) return;
      const test = path.node.test;
      if (t.isBinaryExpression(test, { operator: '<=' })) {
        if (
          t.isMemberExpression(test.right) &&
          t.isIdentifier(test.right.property, { name: 'length' })
        ) {
          offByOneReported = true;
          issues.push(
            makeIssue({
              category: 'BUG_LOGIC',
              type: 'OFF_BY_ONE_LOOP_BOUND',
              severity: SEVERITY.MEDIUM,
              file: file.filename,
              message: 'Loop condition uses <= length and may be off-by-one and access out-of-bounds.',
              suggestion: 'Use < length instead of <= length for zero-based arrays.',
              codeSnippet: extractAstSnippet(file, path.node)
            })
          );
        }
      }
    },

    // AST Check: Promise .then() without .catch()
    CallExpression(path) {
      if (unhandledPromiseReported) return;
      const callee = path.node.callee;
      if (t.isMemberExpression(callee) && t.isIdentifier(callee.property, { name: 'then' })) {
        // Check if parent call is .catch()
        const parent = path.parentPath?.node;
        const hasCatchChained =
          t.isMemberExpression(parent?.callee) &&
          t.isIdentifier(parent.callee.property, { name: 'catch' });

        if (!hasCatchChained) {
          unhandledPromiseReported = true;
          issues.push(
            makeIssue({
              category: 'BUG_LOGIC',
              type: 'UNHANDLED_PROMISE',
              severity: SEVERITY.MEDIUM,
              file: file.filename,
              message: 'Promise chain uses .then() without an attached .catch(). Rejections may be unhandled.',
              suggestion: 'Add a .catch() handler or use try/catch with async/await.',
              codeSnippet: extractAstSnippet(file, path.node)
            })
          );
        }
      }
    }
  });

  return issues;
}

/**
 * 2. AST-Based Security Detector
 */
function detectSecurityIssues(file) {
  const issues = [];
  const analyzableContent = getRelevantContent(file);
  if (!analyzableContent) return issues;

  const ast = parseAst(analyzableContent, file.filename);
  if (!ast) return issues;

  traverse(ast, {
    // AST Check: eval() call
    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee, { name: 'eval' })) {
        issues.push(
          makeIssue({
            category: 'SECURITY',
            type: 'UNSAFE_EVAL',
            severity: SEVERITY.HIGH,
            file: file.filename,
            message: 'Direct invocation of eval() is dangerous and leads to remote code execution.',
            suggestion: 'Avoid eval(). Use JSON.parse or strict function lookups.',
            codeSnippet: extractAstSnippet(file, path.node)
          })
        );
      }

      // AST Check: child_process (exec, spawn, execFile)
      if (t.isIdentifier(callee) && ['exec', 'spawn', 'execFile'].includes(callee.name)) {
        issues.push(
          makeIssue({
            category: 'SECURITY',
            type: 'COMMAND_INJECTION_RISK',
            severity: SEVERITY.HIGH,
            file: file.filename,
            message: `Use of ${callee.name} with dynamic input can lead to command injection.`,
            suggestion: 'Avoid shell string interpolation. Use argument arrays and validate input.',
            codeSnippet: extractAstSnippet(file, path.node)
          })
        );
      }

      // AST Check: SQL injection via template literals in query calls
      if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.property) &&
        ['query', 'execute', 'raw'].includes(callee.property.name)
      ) {
        const firstArg = path.node.arguments[0];
        if (t.isTemplateLiteral(firstArg) && firstArg.expressions.length > 0) {
          issues.push(
            makeIssue({
              category: 'SECURITY',
              type: 'SQL_INJECTION_RISK',
              severity: SEVERITY.HIGH,
              file: file.filename,
              message: 'SQL query constructed via interpolated template literal with dynamic variables.',
              suggestion: 'Use parameterized queries ($1, ? placeholder) or ORM query builders.',
              codeSnippet: extractAstSnippet(file, path.node)
            })
          );
        }
      }
    },

    // AST Check: Hardcoded secrets in variable assignments
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id) && t.isStringLiteral(path.node.init)) {
        const varName = path.node.id.name.toLowerCase();
        const value = path.node.init.value;
        const isSecretName = ['secret', 'password', 'token', 'apikey', 'private_key'].some(s => varName.includes(s));
        if (isSecretName && value.length >= 10 && !value.startsWith('process.env')) {
          issues.push(
            makeIssue({
              category: 'SECURITY',
              type: 'HARDCODED_SECRET',
              severity: SEVERITY.HIGH,
              file: file.filename,
              message: `High risk: Potential hardcoded secret or token found in '${path.node.id.name}'.`,
              suggestion: 'Extract secrets to environment variables (.env) or secret manager vaults.',
              codeSnippet: extractAstSnippet(file, path.node)
            })
          );
        }
      }
    },

    // AST Check: Assignment to innerHTML
    AssignmentExpression(path) {
      if (
        t.isMemberExpression(path.node.left) &&
        t.isIdentifier(path.node.left.property, { name: 'innerHTML' })
      ) {
        issues.push(
          makeIssue({
            category: 'SECURITY',
            type: 'XSS_RISK',
            severity: SEVERITY.HIGH,
            file: file.filename,
            message: 'Direct assignment to innerHTML with unescaped input leads to Cross-Site Scripting (XSS).',
            suggestion: 'Use textContent or sanitize HTML via DOMPurify before assigning.',
            codeSnippet: extractAstSnippet(file, path.node)
          })
        );
      }
    }
  });

  return issues;
}

/**
 * 3. AST-Based Performance Detector
 */
function detectPerformanceIssues(file) {
  const issues = [];
  const analyzableContent = getRelevantContent(file);
  if (!analyzableContent) return issues;

  const ast = parseAst(analyzableContent, file.filename);
  if (!ast) return issues;

  traverse(ast, {
    // AST Check: Nested loops (3 levels deep = O(n³))
    ForStatement(path) {
      checkNestedLoop(path, file, issues);
    },
    ForOfStatement(path) {
      checkNestedLoop(path, file, issues);
    },
    WhileStatement(path) {
      checkNestedLoop(path, file, issues);
    },

    // AST Check: Synchronous file operations or await inside loops
    CallExpression(path) {
      const callee = path.node.callee;
      const isSyncFs =
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.property) &&
        ['readFileSync', 'writeFileSync', 'execSync'].includes(callee.property.name);

      if (isSyncFs) {
        const inLoop = Boolean(
          path.findParent(p => p.isFor() || p.isWhile() || p.isDoWhile())
        );
        if (inLoop) {
          issues.push(
            makeIssue({
              category: 'PERFORMANCE',
              type: 'BLOCKING_CALL_IN_LOOP',
              severity: SEVERITY.HIGH,
              file: file.filename,
              message: `Synchronous I/O operation (${callee.property.name}) called inside an iterative loop.`,
              suggestion: 'Batch operations outside the loop or switch to async Promise.all.',
              codeSnippet: extractAstSnippet(file, path.node)
            })
          );
        }
      }
    }
  });

  return issues;
}

function checkNestedLoop(path, file, issues) {
  let depth = 0;
  let current = path;
  while (current) {
    if (
      current.isFor?.() ||
      current.isWhile?.() ||
      current.isDoWhileStatement?.() ||
      current.isForStatement?.() ||
      current.isForOfStatement?.() ||
      current.isForInStatement?.() ||
      current.isWhileStatement?.()
    ) {
      depth++;
    }
    current = current.parentPath;
  }
  if (depth >= 3) {
    issues.push(
      makeIssue({
        category: 'PERFORMANCE',
        type: 'DEEP_NESTED_LOOPS',
        severity: SEVERITY.MEDIUM,
        file: file.filename,
        message: `High algorithmic complexity: nested loop at depth ${depth} detected.`,
        suggestion: 'Flatten nested loops using HashMaps or Sets to achieve O(n) lookup time.',
        codeSnippet: extractAstSnippet(file, path.node)
      })
    );
  }
}

/**
 * 4. AST-Based Code Smells Detector
 */
function detectCodeSmells(file) {
  const issues = [];
  const analyzableContent = getRelevantContent(file);
  if (!analyzableContent) return issues;

  const ast = parseAst(analyzableContent, file.filename);
  if (!ast) return issues;

  traverse(ast, {
    // AST Check: Functions exceeding length threshold or parameter limit
    Function(path) {
      // 1. Parameter count
      if (path.node.params && path.node.params.length > 5) {
        issues.push(
          makeIssue({
            category: 'CODE_SMELL',
            type: 'MANY_FUNCTION_PARAMETERS',
            severity: SEVERITY.LOW,
            file: file.filename,
            message: `Function defines ${path.node.params.length} parameters, which reduces clarity and maintainability.`,
            suggestion: 'Refactor arguments into a single structured options object.',
            codeSnippet: extractAstSnippet(file, path.node)
          })
        );
      }

      // 2. Large function body
      if (path.node.loc) {
        const lineCount = path.node.loc.end.line - path.node.loc.start.line;
        if (lineCount > 60) {
          issues.push(
            makeIssue({
              category: 'CODE_SMELL',
              type: 'LARGE_FUNCTION',
              severity: SEVERITY.MEDIUM,
              file: file.filename,
              message: `Function is too large (${lineCount} lines). Violates Single Responsibility Principle.`,
              suggestion: 'Extract distinct sub-tasks into modular helper functions.',
              codeSnippet: extractAstSnippet(file, path.node)
            })
          );
        }
      }

      // 3. Deep block nesting inside function
      let maxNesting = 0;
      path.traverse({
        BlockStatement(blockPath) {
          let nest = 0;
          let p = blockPath;
          while (p && p !== path) {
            if (p.isBlockStatement()) nest++;
            p = p.parentPath;
          }
          if (nest > maxNesting) maxNesting = nest;
        }
      });

      if (maxNesting >= 4) {
        issues.push(
          makeIssue({
            category: 'CODE_SMELL',
            type: 'DEEP_NESTING',
            severity: SEVERITY.MEDIUM,
            file: file.filename,
            message: `Control flow has deep nesting depth (${maxNesting} levels).`,
            suggestion: 'Use guard clauses and early returns to flatten nested conditions.',
            codeSnippet: extractAstSnippet(file, path.node)
          })
        );
      }
    }
  });

  return issues;
}

/**
 * 5. AST-Based Cyclomatic Complexity Analyzer
 */
function detectCyclomaticComplexity(file) {
  const issues = [];
  const analyzableContent = getRelevantContent(file);
  if (!analyzableContent) return issues;

  const ast = parseAst(analyzableContent, file.filename);
  if (!ast) return issues;

  traverse(ast, {
    Function(path) {
      let complexity = 1;
      path.traverse({
        IfStatement() { complexity++; },
        ForStatement() { complexity++; },
        ForInStatement() { complexity++; },
        ForOfStatement() { complexity++; },
        WhileStatement() { complexity++; },
        DoWhileStatement() { complexity++; },
        SwitchCase(casePath) { if (casePath.node.test) complexity++; },
        CatchClause() { complexity++; },
        ConditionalExpression() { complexity++; },
        LogicalExpression() { complexity++; }
      });

      if (complexity > 12) {
        const funcName = path.node.id ? path.node.id.name : 'anonymous function';
        issues.push(
          makeIssue({
            category: 'COMPLEXITY',
            type: 'HIGH_CYCLOMATIC_COMPLEXITY',
            severity: SEVERITY.MEDIUM,
            file: file.filename,
            message: `High cyclomatic complexity (${complexity}) in '${funcName}'.`,
            suggestion: 'Decompose branching paths into smaller methods or lookup tables.',
            codeSnippet: extractAstSnippet(file, path.node)
          })
        );
      }
    }
  });

  return issues;
}

/**
 * 6. Dependency Vulnerabilities Detector
 */
function detectDependencyVulnerabilities(file) {
  const issues = [];
  if (!shouldAnalyzeFile(file)) return issues;

  if (
    file.filename.endsWith('package.json') ||
    file.filename.endsWith('package-lock.json') ||
    file.filename.endsWith('pnpm-lock.yaml')
  ) {
    issues.push(
      makeIssue({
        category: 'DEPENDENCY',
        type: 'DEPENDENCY_CHANGES',
        severity: SEVERITY.MEDIUM,
        file: file.filename,
        message: 'Dependencies changed in this PR. Vulnerability scanners (npm audit, Snyk) required.',
        suggestion: 'Verify clean audit output with zero HIGH or CRITICAL CVE advisories.'
      })
    );
  }

  return issues;
}

/**
 * 7. AST-Based Input Validation Detector
 */
function detectInputValidationIssues(file) {
  const issues = [];
  const analyzableContent = getRelevantContent(file);
  if (!analyzableContent) return issues;

  const ast = parseAst(analyzableContent, file.filename);
  if (!ast) return issues;

  let usesReqPayload = false;
  let hasValidationLibrary = false;
  let targetNode = null;

  traverse(ast, {
    ImportDeclaration(path) {
      const src = path.node.source.value.toLowerCase();
      if (['zod', 'joi', 'yup', 'celebrate', 'express-validator'].some(lib => src.includes(lib))) {
        hasValidationLibrary = true;
      }
    },
    MemberExpression(path) {
      if (
        t.isIdentifier(path.node.object, { name: 'req' }) &&
        t.isIdentifier(path.node.property) &&
        ['body', 'query', 'params'].includes(path.node.property.name)
      ) {
        usesReqPayload = true;
        if (!targetNode) targetNode = path.node;
      }
    }
  });

  if (usesReqPayload && !hasValidationLibrary) {
    issues.push(
      makeIssue({
        category: 'INPUT_VALIDATION',
        type: 'MISSING_INPUT_VALIDATION',
        severity: SEVERITY.MEDIUM,
        file: file.filename,
        message: 'HTTP request parameters (req.body/query/params) accessed without schema validation schema.',
        suggestion: 'Validate incoming untrusted inputs using Zod or Joi schemas before processing.',
        codeSnippet: extractAstSnippet(file, targetNode)
      })
    );
  }

  return issues;
}

/**
 * 8. AST-Based Error Handling Detector
 */
function detectErrorHandlingIssues(file) {
  const issues = [];
  const analyzableContent = getRelevantContent(file);
  if (!analyzableContent) return issues;

  const ast = parseAst(analyzableContent, file.filename);
  if (!ast) return issues;

  traverse(ast, {
    // AST Check: Async function with await but no try-catch
    Function(path) {
      if (!path.node.async) return;
      let hasAwait = false;
      let hasTryCatch = false;

      path.traverse({
        AwaitExpression() { hasAwait = true; },
        TryStatement() { hasTryCatch = true; }
      });

      if (hasAwait && !hasTryCatch) {
        issues.push(
          makeIssue({
            category: 'ERROR_HANDLING',
            type: 'MISSING_TRY_CATCH',
            severity: SEVERITY.MEDIUM,
            file: file.filename,
            message: 'Async function contains await operations without error-handling try/catch blocks.',
            suggestion: 'Wrap network or database awaits with try/catch to properly manage rejections.',
            codeSnippet: extractAstSnippet(file, path.node)
          })
        );
      }
    },

    // AST Check: Empty or silent catch blocks
    CatchClause(path) {
      const body = path.node.body.body;
      if (!body || body.length === 0) {
        issues.push(
          makeIssue({
            category: 'ERROR_HANDLING',
            type: 'SILENT_CATCH',
            severity: SEVERITY.LOW,
            file: file.filename,
            message: 'Empty catch clause silently swallows caught exceptions.',
            suggestion: 'Log the caught error or throw a typed application domain exception.',
            codeSnippet: extractAstSnippet(file, path.node)
          })
        );
      }
    }
  });

  return issues;
}

/**
 * 9. Code Duplication Detector (Deterministic Hash-Based)
 */
function detectCodeDuplication(files) {
  const issues = [];
  const minLines = 5;
  const chunkMap = new Map();

  files.forEach((file) => {
    if (!shouldAnalyzeFile(file)) return;
    const lines = getRelevantLines(file)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('*'));

    for (let i = 0; i <= lines.length - minLines; i++) {
      const chunk = lines.slice(i, i + minLines).join('\n');
      if (chunk.length < 50) continue;

      if (chunkMap.has(chunk)) {
        const original = chunkMap.get(chunk);
        if (original.file !== file.filename) {
          issues.push(
            makeIssue({
              category: 'CODE_DUPLICATION',
              type: 'CODE_DUPLICATION',
              severity: SEVERITY.LOW,
              file: file.filename,
              message: `Duplicate code block found in '${file.filename}' matching logic from '${original.file}'.`,
              suggestion: 'Extract repeated functionality into a common shared utility module.',
              codeSnippet: chunk
            })
          );
          return;
        }
      } else {
        chunkMap.set(chunk, { file: file.filename, line: i });
      }
    }
  });

  return issues;
}

/**
 * Master Runner executing all analyses across PR files
 */
export function runAllAnalyses(files) {
  const perFileIssues = [];

  files.forEach((file) => {
    perFileIssues.push(
      ...detectBugAndLogicIssues(file),
      ...detectSecurityIssues(file),
      ...detectPerformanceIssues(file),
      ...detectCodeSmells(file),
      ...detectCyclomaticComplexity(file),
      ...detectDependencyVulnerabilities(file),
      ...detectInputValidationIssues(file),
      ...detectErrorHandlingIssues(file)
    );
  });

  const duplicationIssues = detectCodeDuplication(files);
  const allIssues = [...perFileIssues, ...duplicationIssues];

  const severityCounts = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  };
  const filesAffected = new Set();

  allIssues.forEach((issue) => {
    if (issue.severity && severityCounts[issue.severity] !== undefined) {
      severityCounts[issue.severity]++;
    }
    if (issue.file) {
      filesAffected.add(issue.file);
    }
  });

  const riskScore =
    severityCounts.HIGH * 5 +
    severityCounts.MEDIUM * 2 +
    severityCounts.LOW * 1;

  return {
    issues: allIssues,
    summary: {
      totalIssues: allIssues.length,
      severityDistribution: severityCounts,
      filesAffected: Array.from(filesAffected),
      riskScore
    }
  };
}
