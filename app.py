import os
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai


load_dotenv()

app = Flask(__name__)
CORS(app, origins=os.getenv("ALLOWED_ORIGINS", "*").split(","))

# ── Gemini client ─────────────────────────────────────────────────────────────
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

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    """API info — no HTML, pure JSON."""
    return jsonify({
        "name": "CodeRescue API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "GET  /":          "API info (this response)",
            "GET  /health":    "Health check",
            "GET  /languages": "Supported languages",
            "POST /analyze":   "Analyze and fix code"
        }
    })

@app.route("/health")
def health():
    """Health-check — useful for HF Space wake-up probes."""
    return jsonify({
        "status": "ok",
        "model_ready": client is not None
    })

@app.route("/languages")
def languages():
    """Returns the list of languages /analyze accepts."""
    return jsonify({"languages": SUPPORTED_LANGUAGES})

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

    # 👉 keep your Gemini logic HERE (inside this function)
    return jsonify({
        "error": "ok",
        "fixed_code": "demo",
        "language": "python"
    })


@app.route("/openenv/reset", methods=["POST"])
def openenv_reset():
    return jsonify({
        "status": "success",
        "message": "Environment reset"
    })
    
    user_code = data["code"].strip()
    language  = data.get("language", "python").lower()
    
    if language not in SUPPORTED_LANGUAGES:
        language = "python"  # safe fallback
    
    # Build prompt
    prompt = f"""You are an expert software engineer doing a precise code review.Analyze the following {language} code:```{language}{user_code}```Tasks:1. Identify every bug or error (syntax, logic, runtime).2. Explain each issue clearly in 1-2 sentences total.3. Provide the complete, corrected code.Respond ONLY with a valid JSON object — no markdown fences, no preamble:{{  "explanation": "<concise explanation of what was wrong>",  "fixed_code": "<full corrected source code>",  "language": "{language}"}}"""
    
    # Call Gemini with retry and fallback
    MAX_RETRIES = 3
    response = None
    
    for attempt in range(MAX_RETRIES):
        try:
            # Try primary model first
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            raw = response.text.strip()
            break  # Success, exit retry loop
            
        except Exception as e:
            error_str = str(e)
            # Check if it's a 503 error and we have retries left
            if "503" in error_str and attempt < MAX_RETRIES - 1:
                print(f"[WARN] 503 error on attempt {attempt + 1}/{MAX_RETRIES}, retrying in 2 seconds...")
                time.sleep(2)  # wait and retry
                continue
            # If it's not 503 or we're out of retries, try fallback model
            else:
                print(f"[INFO] Primary model failed with: {error_str}, trying fallback model...")
                try:
                    # Try fallback model
                    response = client.models.generate_content(
                        model="gemini-1.5-flash",
                        contents=prompt,
                    )
                    raw = response.text.strip()
                    break  # Success with fallback
                except Exception as fallback_error:
                    # If fallback also fails, raise the original error
                    print(f"[ERROR] Fallback model also failed: {fallback_error}")
                    if attempt == MAX_RETRIES - 1:
                        raise e  # Raise original error after all attempts
                    continue
    
    # Process response
    try:
        # Strip accidental markdown fences
        raw = raw.strip()
        for fence in ("```json", "```"):
            if raw.startswith(fence):
                raw = raw[len(fence):]
        if raw.endswith("```"):
            raw = raw[:-3]
        
        try:
            result = json.loads(raw.strip())
        except json.JSONDecodeError:
            return jsonify({
                "error": "AI response formatting failed. Try again.",
                "fixed_code": raw,
                "language": language
            }), 500
        
        return jsonify({
            "error":      result.get("explanation", "No explanation returned."),
            "fixed_code": result.get("fixed_code", ""),
            "language":   result.get("language", language)
        })
    except Exception as e:
        print(f"[ERROR] Gemini call failed: {e}")
        return jsonify({
            "error":      f"Analysis failed: {str(e)}",
            "fixed_code": "",
            "language":   language
        }), 500

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")