const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

const exercises = JSON.parse(fs.readFileSync('./exercises.json', 'utf8'));

// ─── Grading helpers ──────────────────────────────────────────────────────────

const ALLOWED_LIBS = ['iostream', 'iomanip', 'cmath', 'string'];

function checkLibraries(code) {
  const includes = [...code.matchAll(/#include\s*[<"]([^>"]+)[>"]/g)];
  const forbidden = includes
    .map(m => m[1])
    .filter(lib => !ALLOWED_LIBS.includes(lib));
  return forbidden;
}

function checkComments(code) {
  // Remove strings to avoid false positives
  const stripped = code.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return /\/\/|\/\*/.test(stripped);
}

function checkReturn0(code) {
  return /return\s+0\s*;/.test(code);
}

function checkIndentation(code) {
  const lines = code.split('\n');
  let depth = 0;
  let issues = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trimEnd();
    const content = trimmed.trim();

    if (content === '' || content.startsWith('#')) {
      const opens = (trimmed.match(/\{/g) || []).length;
      const closes = (trimmed.match(/\}/g) || []).length;
      depth += opens - closes;
      if (depth < 0) depth = 0;
      continue;
    }

    const closes = (trimmed.match(/\}/g) || []).length;
    const opens = (trimmed.match(/\{/g) || []).length;

    // Only check lines inside a block
    if (depth > 0 && !content.startsWith('}')) {
      const indent = raw.match(/^(\s*)/)[1].length;
      if (indent === 0) issues++;
    }

    depth += opens - closes;
    if (depth < 0) depth = 0;
  }

  return issues;
}

function checkVariableNames(code) {
  // Strip comments and strings first
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');

  const pattern = /\b(?:int|float|double|char|bool|long|short)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:[;=,\[])/g;
  const bad = new Set();
  let m;

  while ((m = pattern.exec(stripped)) !== null) {
    const name = m[1];
    // Single-letter that is NOT a conventional loop/math var
    if (name.length === 1 && !['i', 'j', 'k', 'n', 'x', 'y', 'z', 'c', 'r'].includes(name)) {
      bad.add(name);
    }
  }
  return [...bad];
}

function checkVariableTypes(code, exercise) {
  if (!exercise.float_required) return false;
  // Exercise needs float/double but user only declared ints for result
  const hasFloat = /\b(float|double)\b/.test(code);
  return !hasFloat;
}

// ─── Compilation & execution ──────────────────────────────────────────────────

function findCompiler() {
  return new Promise(resolve => {
    exec('g++ --version', (err) => {
      if (!err) return resolve('g++');
      exec('g++.exe --version', (err2) => {
        if (!err2) return resolve('g++.exe');
        resolve(null);
      });
    });
  });
}

function compile(srcPath, binPath, compiler) {
  return new Promise(resolve => {
    exec(
      `"${compiler}" "${srcPath}" -o "${binPath}" -Wall 2>&1`,
      { timeout: 15000 },
      (err, stdout, stderr) => {
        resolve({
          success: !err,
          output: stdout || stderr || ''
        });
      }
    );
  });
}

function runBinary(binPath, input, timeoutMs = 5000) {
  return new Promise(resolve => {
    let output = '';
    let finished = false;

    const child = spawn(binPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { child.kill(); } catch (_) {}
        resolve({ success: false, output: 'TIMEOUT' });
      }
    }, timeoutMs);

    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });

    child.on('close', () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ success: true, output });
      }
    });

    child.on('error', () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ success: false, output: 'ERRO AO EXECUTAR' });
      }
    });

    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

// ─── Main grading function ────────────────────────────────────────────────────

async function gradeSubmission(code, exerciseId) {
  const exercise = exercises.find(e => e.id === exerciseId);
  if (!exercise) return { error: 'Exercício não encontrado' };

  const result = {
    score: 10,
    deductions: [],
    compilationOutput: '',
    testResults: [],
    staticFeedback: []
  };

  // 9. Forbidden libraries (checked before compilation)
  const forbidden = checkLibraries(code);
  if (forbidden.length > 0) {
    result.score -= 10;
    result.deductions.push({
      rule: 'Bibliotecas proibidas',
      detail: `Uso de: ${forbidden.join(', ')}. Permitidas: ${ALLOWED_LIBS.join(', ')}`,
      points: -10
    });
  }

  // Static checks (always run)
  if (!checkReturn0(code)) {
    result.score -= 0.5;
    result.deductions.push({ rule: 'Falta de return 0;', detail: 'A função main() deve encerrar com return 0;', points: -0.5 });
  }

  const indentIssues = checkIndentation(code);
  if (indentIssues > 0) {
    result.score -= 0.5;
    result.deductions.push({
      rule: 'Erros de indentação',
      detail: `${indentIssues} linha(s) dentro de bloco sem indentação.`,
      points: -0.5
    });
  }

  const badVars = checkVariableNames(code);
  if (badVars.length > 0) {
    result.score -= 0.5;
    result.deductions.push({
      rule: 'Nomes de variáveis inadequados',
      detail: `Variável(is) com nome ruim: ${badVars.join(', ')}. Use nomes descritivos.`,
      points: -0.5
    });
  }

  if (checkVariableTypes(code, exercise)) {
    result.score -= 1;
    result.deductions.push({
      rule: 'Tipo de variável errado',
      detail: 'Este exercício requer float ou double para resultados decimais, mas nenhum foi declarado.',
      points: -1
    });
  }

  // Compilation
  const compiler = await findCompiler();
  if (!compiler) {
    result.staticFeedback.push('⚠️ Compilador g++ não encontrado. Apenas análise estática foi realizada.');
    result.score = Math.max(0, result.score);
    return result;
  }

  const tmpId = crypto.randomBytes(8).toString('hex');
  const tmpDir = os.tmpdir();
  const srcPath = path.join(tmpDir, `cpp_${tmpId}.cpp`);
  const binPath = path.join(tmpDir, `cpp_${tmpId}${os.platform() === 'win32' ? '.exe' : ''}`);

  fs.writeFileSync(srcPath, code, 'utf8');

  const compilationResult = await compile(srcPath, binPath, compiler);
  result.compilationOutput = compilationResult.output;

  if (!compilationResult.success) {
    result.score -= 10;
    result.deductions.push({
      rule: 'Programa não compila',
      detail: 'Verifique os erros de compilação abaixo.',
      points: -10
    });
    cleanup(srcPath, binPath);
    result.score = Math.max(0, result.score);
    return result;
  }

  // Run test cases
  let passedTests = 0;
  for (const tc of exercise.test_cases) {
    const run = await runBinary(binPath, tc.input || '');
    const actual = normalizeOutput(run.output);
    const expected = normalizeOutput(tc.expected_output);
    const passed = actual === expected;
    if (passed) passedTests++;
    result.testResults.push({
      description: tc.description,
      input: tc.input,
      expected: tc.expected_output,
      actual: run.output,
      passed
    });
  }

  // Logic scoring
  const total = exercise.test_cases.length;
  const ratio = passedTests / total;

  if (ratio === 1) {
    // All pass — no deduction
  } else if (ratio >= 0.5) {
    result.score -= 2;
    result.deductions.push({
      rule: 'Erros simples de lógica',
      detail: `${passedTests}/${total} casos de teste passaram.`,
      points: -2
    });
  } else {
    result.score -= 10;
    result.deductions.push({
      rule: 'Erros graves de lógica',
      detail: `Apenas ${passedTests}/${total} casos de teste passaram.`,
      points: -10
    });
  }

  cleanup(srcPath, binPath);
  result.score = Math.max(0, result.score);
  return result;
}

function normalizeOutput(str) {
  return (str || '').replace(/\r\n/g, '\n').trim();
}

function cleanup(...paths) {
  for (const p of paths) {
    try { fs.unlinkSync(p); } catch (_) {}
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/exercises', (req, res) => {
  res.json(exercises.map(e => ({
    id: e.id,
    title: e.title,
    difficulty: e.difficulty,
    topics: e.topics
  })));
});

app.get('/api/exercises/:id', (req, res) => {
  const ex = exercises.find(e => e.id === req.params.id);
  if (!ex) return res.status(404).json({ error: 'Não encontrado' });
  res.json(ex);
});

app.post('/api/grade', async (req, res) => {
  try {
    const { code, exerciseId } = req.body;
    if (!code || !exerciseId) return res.status(400).json({ error: 'Dados incompletos' });
    const result = await gradeSubmission(code, exerciseId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno ao corrigir' });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Plataforma rodando em http://localhost:${PORT}`));
