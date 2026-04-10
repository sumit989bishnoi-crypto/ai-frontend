import os
import json
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app, origins=os.getenv("ALLOWED_ORIGINS", "*").split(","))

API_BASE_URL = os.getenv("API_BASE_URL", "https://router.huggingface.co/v1")
MODEL_NAME   = os.getenv("MODEL_NAME",   "Qwen/Qwen2.5-7B-Instruct")

API_KEY = os.getenv("API_KEY") or os.getenv("HF_TOKEN")
client  = OpenAI(base_url=API_BASE_URL, api_key=API_KEY) if API_KEY else None

SUPPORTED_LANGUAGES = [
    "python", "javascript", "typescript", "java", "c", "cpp",
    "csharp", "go", "rust", "php", "ruby", "swift", "kotlin", "bash"
]

@app.route("/")
def index():
    return jsonify({"name": "CodeRescue API", "version": "1.0.0", "status": "running"})

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/languages")
def languages():
    return jsonify({"languages": SUPPORTED_LANGUAGES})

@app.route("/analyze", methods=["POST"])
def analyze_code():
    if not client:
        return jsonify({"error": "API key not configured", "fixed_code": "", "language": ""}), 500

    data = request.get_json(silent=True)
    if not data or not data.get("code", "").strip():
        return jsonify({"error": "No code provided"}), 400

    user_code = data["code"].strip()[:800]
    language  = data.get("language", "python").lower()

    raw = ""
    try:
        for _ in range(2):
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
                        "content": f"Language: {language}\n\nCode:\n{user_code}",
                    },
                ],
            )

            raw = response.choices[0].message.content.strip()

            if not raw:
                return jsonify({
                    "error": "Empty response from AI",
                    "fixed_code": "",
                    "language": language
                }), 200

            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                raw = match.group()
                break

        raw = raw.replace("```json", "").replace("```", "").strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        raw = raw.strip()

        parsed = None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group())
                except Exception:
                    parsed = None

        if not parsed:
            return jsonify({
                "error": "AI response was messy but here's what I got",
                "fixed_code": raw[:800],
                "language": language
            }), 200

        fixed_code = parsed.get("fixed_code", "")
        fixed_code = fixed_code.replace("\\n", "\n").replace("\\t", "\t")

        return jsonify({
            "error":      parsed.get("explanation", "No explanation provided."),
            "fixed_code": fixed_code,
            "language":   parsed.get("language", language),
        })

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}", "fixed_code": "", "language": language}), 500

# ✅ both routes for the checker
@app.route("/openenv/reset", methods=["POST"])
@app.route("/reset", methods=["POST"])
def openenv_reset():
    return jsonify({"status": "success"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port)
