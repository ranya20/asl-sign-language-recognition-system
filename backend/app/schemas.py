from pydantic import BaseModel, Field

class PredictRequest(BaseModel):
    image: str = Field(..., description="Base64 DataURL (e.g. data:image/jpeg;base64,...)")
    session_id: str | None = None

class PredictResponse(BaseModel):
    label: str
    confidence: float
    probs_top5: list[dict]

class TranslateRequest(BaseModel):
    text: str
    source: str = "auto"  # auto / en / fr / ar ...
    target: str = "fr"

class TranslateResponse(BaseModel):
    translated_text: str
