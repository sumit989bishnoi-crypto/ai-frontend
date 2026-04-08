import os
from openai import OpenAI

# Environment variables
API_BASE_URL = os.getenv("API_BASE_URL", "https://api-inference.huggingface.co/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "meta-llama/Llama-3-8b-instruct")
HF_TOKEN = os.getenv("HF_TOKEN")

# OpenAI-style client (IMPORTANT)
client = OpenAI(
    base_url=API_BASE_URL,
    api_key=HF_TOKEN
)

def solve(task):
    print("START")
    print("STEP: Received input")

    prompt = f"Fix this code and explain errors:\n{task}"

    print("STEP: Sending request to model")

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    print("STEP: Processing response")

    output = response.choices[0].message.content

    print("END")

    return output


# For testing locally
if _name_ == "_main_":
    user_input = input("Enter your broken code:\n")
    result = solve(user_input)
    print("\n=== FIXED CODE ===\n")
    print(result)
