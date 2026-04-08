
const HF_SPACE_URL = 'https://sumit989-sumit.hf.space';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const codeInput      = document.getElementById('codeInput');
const analyzeBtn     = document.getElementById('analyzeBtn');
const outputSection  = document.getElementById('outputSection');
const errorEl        = document.getElementById('errorExplanation');
const fixedCodeEl    = document.getElementById('fixedCode');
const copyBtn        = document.getElementById('copyBtn');
const statusText     = document.getElementById('statusText');
const langRow        = document.getElementById('langRow');
const outputTitle    = document.getElementById('outputPanelTitle');

// ── State ─────────────────────────────────────────────────────────────────────
let selectedLang = 'python';

// ── Language selector ─────────────────────────────────────────────────────────
langRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.lang-btn');
  if (!btn) return;

  langRow.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedLang = btn.dataset.lang;
  codeInput.placeholder = `// paste your broken ${selectedLang} code here and hit ANALYZE...`;
});

// ── Resolve API endpoint ──────────────────────────────────────────────────────
function getEndpoint(path) {
  
  const base = HF_SPACE_URL;
  return `${base}${path}`;
}

// ── Main analyze flow ─────────────────────────────────────────────────────────
analyzeBtn.addEventListener('click', async () => {
  const code = codeInput.value.trim();

  if (!code) {
    shake(codeInput);
    return;
  }

  setLoading(true);
  hideOutput();

  try {
    const res = await fetch(getEndpoint('/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: selectedLang }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    renderResult(data);

  } catch (err) {
    renderResult({
      error: err.message || 'Something went wrong. Please try again.',
      fixed_code: '',
      language: selectedLang,
    });
  } finally {
    setLoading(false);
  }
});

// ── Render ─────────────────────────────────────────────────────────────────────
function renderResult(data) {
  errorEl.textContent      = data.error      || 'No explanation returned.';
  fixedCodeEl.textContent  = data.fixed_code || '// No fixed code returned.';
  outputTitle.textContent  = `result.json — ${data.language || selectedLang}`;
  statusText.textContent   = `analysis complete · ${new Date().toLocaleTimeString()}`;

  outputSection.classList.add('visible');
  outputSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideOutput() {
  outputSection.classList.remove('visible');
}

// ── Copy button ────────────────────────────────────────────────────────────────
copyBtn.addEventListener('click', () => {
  const text = fixedCodeEl.textContent;
  if (!text || text.startsWith('// No fixed')) return;

  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = 'copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'copy';
      copyBtn.classList.remove('copied');
    }, 2200);
  }).catch(() => {
    alert('Could not copy — please select and copy manually.');
  });
});

// ── Loading state ──────────────────────────────────────────────────────────────
function setLoading(on) {
  analyzeBtn.disabled = on;
  analyzeBtn.classList.toggle('loading', on);
}

// ── Shake animation for empty input ───────────────────────────────────────────
function shake(el) {
  el.style.transition = 'transform .07s ease';
  const steps = [6, -6, 4, -4, 2, -2, 0];
  let i = 0;
  const step = () => {
    if (i >= steps.length) { el.style.transform = ''; return; }
    el.style.transform = `translateX(${steps[i++]}px)`;
    setTimeout(step, 70);
  };
  step();
}

// ── Health-check on load (wakes up the HF space) ─────────────────────────────
(async () => {
  try {
    await fetch(getEndpoint('/health'), { method: 'GET' });
  } catch (_) {
    // silent — just wakes the space
  }
})();
