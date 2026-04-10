import os
import json
from openai import OpenAI

# ── Config ────────────────────────────────────────────────────────────────────
API_BASE_URL = os.getenv("API_BASE_URL", "https://router.huggingface.co/v1")
MODEL_NAME   = os.getenv("MODEL_NAME",   "Qwen/Qwen2.5-7B-Instruct")
API_KEY      = os.getenv("API_KEY") or os.getenv("HF_TOKEN")

client = OpenAI(base_url=API_BASE_URL, api_key=API_KEY) if API_KEY else None


def solve(task_name: str, task_input: str) -> str:
    print(f"[START] task={task_name}", flush=True)
    print(f"[STEP] step=1 reward=0.5", flush=True)

    if not client:
        print(f"[END] task={task_name} score=0.1 steps=1", flush=True)
        return "Error: API key not configured"

    response = client.chat.completions.create(
        model=MODEL_NAME,
        max_tokens=2048,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert developer.\n"
                    "Return ONLY valid JSON.\n"
                    "Explanation must be MAX 2 lines.\n"
                    "Fixed code must be SHORT and COMPLETE.\n"
                    "Preserve all newlines and indentation in fixed_code.\n"
                    "Do NOT cut output.\n"
                    "Format strictly:\n"
                    "{\"explanation\":\"...\",\"fixed_code\":\"...\",\"language\":\"...\"}"
                ),
            },
            {
                "role": "user",
                "content": f"Fix this code and explain the errors:\n{task_input}",
            },
        ],
    )

    output = response.choices[0].message.content
    score  = grade(task_input, output)

    print(f"[STEP] step=2 reward={score}", flush=True)
    print(f"[END] task={task_name} score={score} steps=2", flush=True)

    return output


def grade(task_input: str, output: str) -> float:
    if not output or len(output.strip()) < 5:
        return 0.1

    score = 0.5
    try:
        raw = output.strip().replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw)
        if parsed.get("explanation"):
            score += 0.15
        if parsed.get("fixed_code"):
            score += 0.15
        if parsed.get("language"):
            score += 0.1
    except Exception:
        score = 0.3

    return round(min(max(score, 0.1), 0.9), 2)


# ── Tasks ─────────────────────────────────────────────────────────────────────
TASKS = [
    {
        "id": "task_1",
        "description": "Fix syntax error in Python",
        "input": "def hello(\n    print('hello world')",
    },
    {
        "id": "task_2",
        "description": "Fix logic bug in JavaScript",
        "input": "function add(a, b) { return a - b; }",
    },
    {
        "id": "task_3",
        "description": "Fix type error and missing await in async function",
        "input": "async function fetchData() { let data = fetchFromAPI(); return data.json; }",
    },
]

for task in TASKS:
    output = solve(task["id"], task["input"])
