import os
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai

# Load env
load_dotenv()

app = Flask(__name__)
CORS(app, origins=os.getenv("ALLOWED_ORIGINS", "*").split(","))

# ── Gemini client ─────────────────────────────────────────
try:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set")
    client = genai.Client(api_key=api_key)
except Exception as e:
    client = None
    print(f"[WARN] Failed to initialize GenAI client: {e}")

SUPPORTED_LANGUAGES = [
    "python", "javascript", "typescript", "java", "c", "cpp",
    "csharp", "go", "rust", "php", "ruby", "swift", "kotlin", "bash"
]

# ── Routes ───────────────────────────────────────────────

@app.route("/")
def index():
    return jsonify({
        "name": "CodeRescue API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "GET  /":          "API info",
            "GET  /health":    "Health check",
            "GET  /languages": "Supported languages",
            "POST /analyze":   "Analyze and fix code",
            "POST /openenv/reset": "Reset environment"
        }
    })


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_ready": client is not None
    })


@app.route("/languages")
def languages():
    return jsonify({"languages": SUPPORTED_LANGUAGES})


# 🔥 MAIN AI ROUTE (FIXED)
@app.route("/analyze", methods=["POST"])
def analyze_code():
    if not client:
        return jsonify({
            "error": "API client not initialized.",
            "fixed_code": "",
            "language": ""
        }), 500

    data = request.get_json(silent=True)

    if not data or not data.get("code", "").strip():
        return jsonify({
            "error": "No code provided",
            "fixed_code": "",
            "language": ""
        }), 400

    user_code = data["code"].strip()
    language = data.get("language", "python").lower()

    if language not in SUPPORTED_LANGUAGES:
        language = "python"

    # 🔥 Prompt
    prompt = f"""
You are an expert software engineer.

Fix this {language} code and explain errors briefly.

Code:
{user_code}

Respond in JSON:
{{
  "explanation": "...",
  "fixed_code": "...",
  "language": "{language}"
}}
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        raw = response.text.strip()

        # Clean markdown if any
        raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            result = json.loads(raw)
        except:
            return jsonify({
                "error": "AI formatting issue",
                "fixed_code": raw,
                "language": language
            }), 500

        return jsonify({
            "error": result.get("explanation", ""),
            "fixed_code": result.get("fixed_code", ""),
            "language": result.get("language", language)
        })

    except Exception as e:
        return jsonify({
            "error": str(e),
            "fixed_code": "",
            "language": language
        }), 500


# ✅ REQUIRED FOR HACKATHON (FIXED)
@app.route("/openenv/reset", methods=["POST"])
def openenv_reset():
    return jsonify({
        "status": "success",
        "message": "Environment reset"
    })


# ── Entry ────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port)
