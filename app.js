//app.js

const HF_SPACE_URL = 'https://sumit989-ai-backend.hf.space';
//testing beackend
//const HF_SPACE_URL = 'https://sumit989-test-run-before-deploying.hf.space'; 

function getEndpoint(path) {
    const isGitHubPages = window.location.hostname.includes('github.io');
    const base = isGitHubPages ? HF_SPACE_URL : '';
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${normalizedBase}${path}`;
}

async function wakeUp() {
    const delays = [0, 2000, 4000];
    for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(getEndpoint('/health'), { signal: controller.signal });
            clearTimeout(tid);
            if (res.ok) {
                console.log('[CodeRescue] Backend awake.');
                return;
            }
            console.warn(`[CodeRescue] Wake-up attempt ${i + 1}: status ${res.status}`);
        } catch (err) {
            console.warn(`[CodeRescue] Wake-up attempt ${i + 1} failed:`, err.message);
        }
    }
    console.warn('[CodeRescue] Could not reach backend after 3 attempts.');
}
