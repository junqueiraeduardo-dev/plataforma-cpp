/* ── State ─────────────────────────────────────────────────────────────────── */
let exercises = [];
let currentExercise = null;
let editor = null;
const scores = JSON.parse(localStorage.getItem('cpp_scores') || '{}');

/* ── Init ──────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initEditor();
  await loadExercises();
  bindEvents();

  // Open first exercise by default
  if (exercises.length) selectExercise(exercises[0].id);
});

/* ── CodeMirror editor ─────────────────────────────────────────────────────── */
function initEditor() {
  editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
    mode: 'text/x-c++src',
    theme: 'dracula',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    lineWrapping: false,
    extraKeys: {
      Tab: cm => cm.execCommand('indentMore'),
      'Shift-Tab': cm => cm.execCommand('indentLess')
    }
  });

  // Make editor fill its container
  editor.setSize('100%', '100%');
}

/* ── Load exercises ────────────────────────────────────────────────────────── */
async function loadExercises() {
  const res = await fetch('/api/exercises');
  exercises = await res.json();
  renderSidebar();
}

function renderSidebar() {
  const nav = document.getElementById('exercise-list');
  nav.innerHTML = '';
  exercises.forEach((ex, idx) => {
    const btn = document.createElement('button');
    btn.className = 'ex-item';
    btn.dataset.id = ex.id;

    const savedScore = scores[ex.id];
    const scoreHtml = savedScore !== undefined
      ? `<span class="ex-score ${scoreClass(savedScore)}">${savedScore.toFixed(1)}</span>`
      : '';

    btn.innerHTML = `
      <span class="ex-num">${idx + 1}</span>
      <div class="ex-info">
        <div class="ex-name">${ex.title}</div>
        <div class="ex-diff diff-${ex.difficulty}">${ex.difficulty}</div>
      </div>
      ${scoreHtml}
    `;
    btn.addEventListener('click', () => selectExercise(ex.id));
    nav.appendChild(btn);
  });
}

function scoreClass(score) {
  if (score >= 9)  return 'perfect';
  if (score >= 6)  return 'good';
  return 'bad';
}

/* ── Select exercise ───────────────────────────────────────────────────────── */
async function selectExercise(id) {
  const res = await fetch(`/api/exercises/${id}`);
  currentExercise = await res.json();

  // Highlight sidebar item
  document.querySelectorAll('.ex-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id);
  });

  // Topbar
  document.getElementById('topbar-title').textContent = currentExercise.title;
  const diffBadge = document.getElementById('topbar-difficulty');
  diffBadge.textContent = currentExercise.difficulty;
  diffBadge.className = `badge ${currentExercise.difficulty}`;

  // Description
  document.getElementById('exercise-description').innerHTML =
    marked.parse(currentExercise.description);

  // Hints
  const hintsList = document.getElementById('hints-list');
  hintsList.innerHTML = currentExercise.hints
    .map(h => `<li>💡 ${h}</li>`)
    .join('');

  // Restore saved code or use starter
  const savedCode = localStorage.getItem(`cpp_code_${id}`);
  editor.setValue(savedCode || currentExercise.starter_code);
  editor.clearHistory();

  // Enable grade button
  document.getElementById('grade-btn').disabled = false;

  // Reset results panel
  showPlaceholder();

  // Switch to description tab
  switchTab('description');
}

/* ── Reset code ────────────────────────────────────────────────────────────── */
function resetCode() {
  if (!currentExercise) return;
  if (confirm('Restaurar o código inicial? Seu código atual será perdido.')) {
    editor.setValue(currentExercise.starter_code);
    localStorage.removeItem(`cpp_code_${currentExercise.id}`);
  }
}

/* ── Grade ─────────────────────────────────────────────────────────────────── */
async function gradeCode() {
  if (!currentExercise) return;

  const code = editor.getValue();
  localStorage.setItem(`cpp_code_${currentExercise.id}`, code);

  setGrading(true);
  showPlaceholder();

  try {
    const res = await fetch('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, exerciseId: currentExercise.id })
    });

    const data = await res.json();
    if (data.error) { alert('Erro: ' + data.error); return; }

    renderResults(data);
    saveScore(currentExercise.id, data.score);

  } catch (e) {
    alert('Erro de conexão com o servidor.');
  } finally {
    setGrading(false);
  }
}

function setGrading(loading) {
  const btn  = document.getElementById('grade-btn');
  const text = document.getElementById('grade-btn-text');
  const spin = document.getElementById('grade-spinner');
  btn.disabled = loading;
  text.classList.toggle('hidden', loading);
  spin.classList.toggle('hidden', !loading);
}

/* ── Render results ────────────────────────────────────────────────────────── */
function renderResults(data) {
  const { score, deductions, compilationOutput, testResults, staticFeedback } = data;

  // Show results container
  document.getElementById('results-placeholder').classList.add('hidden');
  const results = document.getElementById('results');
  results.classList.remove('hidden');

  // Score circle
  const circle = document.getElementById('score-circle');
  const valueEl = document.getElementById('score-value');
  circle.className = 'score-circle ' + scoreClass(score);
  valueEl.textContent = score % 1 === 0 ? score : score.toFixed(1);

  // Status text
  let status = '';
  if (score === 10)    status = '🏆 Perfeito! Parabéns!';
  else if (score >= 7) status = '👍 Bom trabalho!';
  else if (score >= 5) status = '📚 Continue praticando.';
  else                 status = '❌ Revise seu código.';
  document.getElementById('score-status').textContent = status;

  // Deductions
  const dedList = document.getElementById('deductions-list');
  dedList.innerHTML = '';
  if (deductions.length === 0) {
    dedList.innerHTML = '<li class="all-good">✅ Nenhuma dedução! Código perfeito.</li>';
  } else {
    deductions.forEach(d => {
      const li = document.createElement('li');
      li.className = 'deduction-item';
      li.innerHTML = `
        <div class="deduction-info">
          <div class="deduction-rule">${d.rule}</div>
          <div class="deduction-detail">${d.detail}</div>
        </div>
        <div class="deduction-pts">${d.points} pt${Math.abs(d.points) !== 1 ? 's' : ''}</div>
      `;
      dedList.appendChild(li);
    });
  }

  // Test cases
  const testsDiv = document.getElementById('test-results');
  testsDiv.innerHTML = '';
  const testsSection = document.getElementById('tests-section');

  if (testResults && testResults.length > 0) {
    testsSection.classList.remove('hidden');
    testResults.forEach((tc, i) => {
      const div = document.createElement('div');
      div.className = 'test-case';
      const passClass = tc.passed ? 'pass' : 'fail';
      const passIcon  = tc.passed ? '✅' : '❌';
      const inputHtml = tc.input
        ? `<div class="label">Entrada</div><pre>${escHtml(tc.input)}</pre>`
        : '';
      div.innerHTML = `
        <div class="test-header ${passClass}" data-idx="${i}">
          <span class="test-status ${passClass}">${passIcon} ${tc.passed ? 'Passou' : 'Falhou'}</span>
          <span class="test-desc">${tc.description}</span>
          <span class="test-toggle">▼</span>
        </div>
        <div class="test-body" id="test-body-${i}">
          ${inputHtml}
          <div class="label">Saída esperada</div>
          <pre>${escHtml(tc.expected)}</pre>
          <div class="label">Sua saída</div>
          <pre>${escHtml(tc.actual || '(sem saída)')}</pre>
        </div>
      `;
      testsDiv.appendChild(div);

      // Toggle collapse
      div.querySelector('.test-header').addEventListener('click', () => {
        const body = document.getElementById(`test-body-${i}`);
        body.classList.toggle('open');
        div.querySelector('.test-toggle').textContent =
          body.classList.contains('open') ? '▲' : '▼';
      });

      // Auto-open failed tests
      if (!tc.passed) {
        document.getElementById(`test-body-${i}`).classList.add('open');
        div.querySelector('.test-toggle').textContent = '▲';
      }
    });
  } else {
    testsSection.classList.add('hidden');
  }

  // Compilation output
  const compSection = document.getElementById('compilation-section');
  if (compilationOutput && compilationOutput.trim()) {
    compSection.classList.remove('hidden');
    document.getElementById('compilation-output').textContent = compilationOutput;
  } else {
    compSection.classList.add('hidden');
  }

  // Static feedback
  const staticSection = document.getElementById('static-section');
  const staticList = document.getElementById('static-list');
  if (staticFeedback && staticFeedback.length > 0) {
    staticSection.classList.remove('hidden');
    staticList.innerHTML = staticFeedback.map(f => `<li>${f}</li>`).join('');
  } else {
    staticSection.classList.add('hidden');
  }
}

function showPlaceholder() {
  document.getElementById('results-placeholder').classList.remove('hidden');
  document.getElementById('results').classList.add('hidden');
}

/* ── Save score ────────────────────────────────────────────────────────────── */
function saveScore(id, score) {
  const prev = scores[id];
  if (prev === undefined || score > prev) {
    scores[id] = score;
    localStorage.setItem('cpp_scores', JSON.stringify(scores));
    renderSidebar();
    // Re-highlight active
    document.querySelectorAll('.ex-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === id);
    });
  }
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name)
  );
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === `tab-${name}`)
  );
}

/* ── Bind events ───────────────────────────────────────────────────────────── */
function bindEvents() {
  document.getElementById('grade-btn').addEventListener('click', gradeCode);
  document.getElementById('reset-btn').addEventListener('click', resetCode);

  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('main').classList.toggle('full');
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Criteria modal
  document.getElementById('criteria-toggle').addEventListener('click', () =>
    document.getElementById('criteria-modal').classList.remove('hidden')
  );
  document.getElementById('criteria-close').addEventListener('click', () =>
    document.getElementById('criteria-modal').classList.add('hidden')
  );
  document.getElementById('criteria-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('criteria-modal'))
      document.getElementById('criteria-modal').classList.add('hidden');
  });

  // Copy code
  document.getElementById('copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(editor.getValue())
      .then(() => {
        const btn = document.getElementById('copy-btn');
        btn.textContent = '✅';
        setTimeout(() => { btn.textContent = '📋'; }, 1200);
      });
  });

  // Keyboard shortcut: Ctrl+Enter to grade
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      gradeCode();
    }
  });
}

/* ── Utils ─────────────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
