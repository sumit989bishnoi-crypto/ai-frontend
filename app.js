/**
 * CodeRescue — app.js
 * Handles language selection, API calls, and result rendering.
 *
 * HOW TO DEPLOY:
 *   1. Set HF_SPACE_URL below to your Hugging Face Space URL.
 *   2. Push index.html + app.js to GitHub → enable Pages.
 */

const HF_SPACE_URL = 'https://sumit989-ai-backend.hf.space';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const codeInput = document.getElementById('codeInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const outputSection = document.getElementById('outputSection');
const errorEl = document.getElementById('errorExplanation');
const fixedCodeEl = document.getElementById('fixedCode');
const copyBtn = document.getElementById('copyBtn');
const statusText = document.getElementById('statusText');
const langRow = document.getElementById('langRow');
const outputTitle = document.getElementById('outputPanelTitle');

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
    const isGitHubPages = window.location.hostname.includes('github.io');
    const base = isGitHubPages ? HF_SPACE_URL : '';
    // Ensure no double slashes or trailing slash issues
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${normalizedBase}${path}`;
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
        console.log("Sending request to:", getEndpoint('/analyze'));
        const res = await fetch(getEndpoint('/analyze'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, language: selectedLang }),
        });

        console.log("RAW RESPONSE STATUS:", res.status);

        let data;
        let responseText = "";
        try {
            responseText = await res.text();
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Server returned non-JSON response (${res.status}):\n\n` + responseText.slice(0, 200));
        }

        if (!res.ok) {
            throw new Error((data && data.error) || `Server error ${res.status}`);
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
    errorEl.textContent = data.error || 'No explanation returned.';
    fixedCodeEl.textContent = data.fixed_code || '// No fixed code returned.';
    outputTitle.textContent = `result.json — ${data.language || selectedLang}`;
    statusText.textContent = `analysis complete · ${new Date().toLocaleTimeString()}`;

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
            await fetch(getEndpoint('/health'));
            console.log("Health check success");
            return;
        } catch (err) {
            console.warn(`Wake up attempt ${i + 1} failed:`, err);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}

wakeUp();
