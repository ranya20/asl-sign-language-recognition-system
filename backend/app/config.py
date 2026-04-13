from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "asl_sign_model.keras"
ENCODER_PATH = BASE_DIR / "models" / "label_encoder.pkl"

# Image preprocessing
IMG_SIZE = 64

# Translation (NO LLM) - LibreTranslate is recommended (self-host or public endpoint)
# If you don't want translation now, you can keep it empty.
LIBRETRANSLATE_URL = "http://localhost:5000/translate"  # change if needed
# ===================== OPENROUTER CONFIG =====================

# ⚠️ Colle ICI ta clé OpenRouter (exactement comme dans ton autre projet)
OPENROUTER_API_KEY = "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"

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Modèle recommandé pour traduction (rapide + stable)
OPENROUTER_MODEL = "mistralai/mistral-7b-instruct"

# (Optionnel mais conseillé)
APP_URL = "http://localhost:5173"
APP_TITLE = "ASL Translator"
