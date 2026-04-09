// just for restarting hte github pages
const HF_SPACE_URL = 'https://sumit989-ai-backend.hf.space';

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

function debugLog(location, message, data, hypothesisId, runId = 'pre-fix') {
  fetch('http://127.0.0.1:7374/ingest/dfece7be-4d02-467c-800a-cdc92e86d973',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'67ab23'},body:JSON.stringify({sessionId:'67ab23',runId,hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{});
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
    // #region agent log
    debugLog('app.js:analyze_click_start', 'Analyze clicked with payload meta', { codeLength: code.length, selectedLang }, 'H1');
    // #endregion
    const res = await fetch(getEndpoint('/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: selectedLang }),
    });

    console.log("RAW RESPONSE STATUS:", res.status);
    // #region agent log
    debugLog('app.js:after_fetch', 'Received analyze response', { status: res.status, contentType: res.headers.get('content-type') || null, ok: res.ok }, 'H1');
    // #endregion

    let data;
    try {
      data = await res.json();
    } catch (e) {
      let text = '';
      try {
        text = await res.text();
      } catch (_) {
        text = '[unreadable response body]';
      }
      // #region agent log
      debugLog('app.js:json_parse_failed', 'JSON parse failed; fallback text captured', { status: res.status, snippet: text.slice(0, 200) }, 'H2');
      // #endregion
      throw new Error(`Server returned non-JSON:\n${text.slice(0, 200)}`);
    }
    // #region agent log
    debugLog('app.js:json_parse_success', 'JSON parse succeeded', { hasErrorField: !!data?.error, hasFixedCodeField: !!data?.fixed_code }, 'H2');
    // #endregion

    if (!res.ok) {
      // #region agent log
      debugLog('app.js:non_ok_response', 'Non-OK response with parsed JSON', { status: res.status, error: data?.error || null }, 'H3');
      // #endregion
      throw new Error((data && data.error) || `Server error ${res.status}`);
    }

    renderResult(data);

  } catch (err) {
    // #region agent log
    debugLog('app.js:analyze_catch', 'Analyze request failed in catch', { message: err?.message || 'unknown error' }, 'H4');
    // #endregion
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
async function wakeUp() {
  for (let i = 0; i < 3; i++) {
    try {
      await fetch(getEndpoint('/health'), { method: 'GET' });
      // #region agent log
      debugLog('app.js:wakeup_success', 'Wake-up health check succeeded', { attempt: i + 1 }, 'H5');
      // #endregion
      return;
    } catch (_) {
      // #region agent log
      debugLog('app.js:wakeup_retry', 'Wake-up health check failed', { attempt: i + 1 }, 'H5');
      // #endregion
    }
  }
}

void wakeUp();
