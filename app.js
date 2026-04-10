/**
 * CodeRescue — app.js
 * Provides getEndpoint() and wakeUp() used by index.html.
 *
 * HOW TO DEPLOY:
 *   1. Set HF_SPACE_URL below to your Hugging Face Space URL.
 *   2. Push index.html + app.js to GitHub → enable Pages.
 */

const HF_SPACE_URL = 'https://sumit989-ai-backend.hf.space';

// Resolve full API URL — uses HF Space on GitHub Pages, relative path locally
function getEndpoint(path) {
    const isGitHubPages = window.location.hostname.includes('github.io');
    const base = isGitHubPages ? HF_SPACE_URL : '';
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${normalizedBase}${path}`;
}

// Wake up the HF Space on page load (prevents cold-start delay on first request)
async function wakeUp() {
    for (let i = 0; i < 3; i++) {
        try {
            await fetch(getEndpoint('/health'));
            console.log('[CodeRescue] Backend awake.');
            return;
        } catch (err) {
            console.warn(`[CodeRescue] Wake-up attempt ${i + 1} failed:`, err);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    console.warn('[CodeRescue] Could not reach backend after 3 attempts.');
}
