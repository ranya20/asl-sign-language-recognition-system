import requests
from .config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    OPENROUTER_MODEL,
    APP_URL,
    APP_TITLE,
)

def translate_text(text: str, source: str = "auto", target: str = "fr") -> str:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is missing")

    url = f"{OPENROUTER_BASE_URL}/chat/completions"

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",

        # Recommandé par OpenRouter
        "HTTP-Referer": APP_URL,
        "X-Title": APP_TITLE,
    }

    # Prompt SIMPLE = traduction seulement
    system_prompt = (
        "You are a translation engine. "
        "Translate the user's text to the target language. "
        "Return ONLY the translated text. "
        "No explanation, no quotes."
    )

    user_prompt = f"""
Source language: {source}
Target language: {target}
Text:
{text}
""".strip()

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 800,
    }

    response = requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=30,
    )

    response.raise_for_status()
    data = response.json()

    return data["choices"][0]["message"]["content"].strip()
