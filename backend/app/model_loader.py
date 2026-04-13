from tensorflow.keras.models import load_model
import joblib
from .config import MODEL_PATH, ENCODER_PATH

class ASLModelBundle:
    def __init__(self):
        self.model = None
        self.encoder = None

    def load(self):
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
        if not ENCODER_PATH.exists():
            raise FileNotFoundError(f"Encoder not found: {ENCODER_PATH}")

        self.model = load_model(str(MODEL_PATH))
        self.encoder = joblib.load(str(ENCODER_PATH))

bundle = ASLModelBundle()
