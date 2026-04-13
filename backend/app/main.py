from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import numpy as np

from .schemas import PredictRequest, PredictResponse, TranslateRequest, TranslateResponse
from .utils_image import decode_dataurl_to_bgr, preprocess_for_model
from .model_loader import bundle
from .services_translate import translate_text

app = FastAPI(title="ASL API", version="1.0")

# CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    bundle.load()

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    try:
        bgr = decode_dataurl_to_bgr(req.image)
        x = preprocess_for_model(bgr)  # (1,64,64,1)

        probs = bundle.model.predict(x, verbose=0)[0]  # (num_classes,)
        idx = int(np.argmax(probs))
        conf = float(probs[idx])

        label = bundle.encoder.inverse_transform([idx])[0]

        # top-5
        top5_idx = np.argsort(probs)[-5:][::-1]
        probs_top5 = [
            {"label": str(bundle.encoder.inverse_transform([int(i)])[0]), "prob": float(probs[int(i)])}
            for i in top5_idx
        ]

        return PredictResponse(label=str(label), confidence=conf, probs_top5=probs_top5)

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest):
    try:
        translated = translate_text(req.text, req.source, req.target)
        return TranslateResponse(translated_text=translated)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
