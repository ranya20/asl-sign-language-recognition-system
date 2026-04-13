import base64
import numpy as np
import cv2
from .config import IMG_SIZE

def decode_dataurl_to_bgr(data_url: str) -> np.ndarray:
    """
    Accepts 'data:image/jpeg;base64,...' or raw base64.
    Returns BGR image (OpenCV).
    """
    if "," in data_url:
        _, b64 = data_url.split(",", 1)
    else:
        b64 = data_url

    img_bytes = base64.b64decode(b64)
    img_arr = np.frombuffer(img_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Invalid image data (cannot decode).")
    return bgr

def preprocess_for_model(bgr: np.ndarray) -> np.ndarray:
    """
    Matches your training pipeline:
    - grayscale
    - resize to 64x64
    - normalize [0..1]
    - shape: (1, 64, 64, 1)
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    norm = resized.astype("float32") / 255.0
    x = np.expand_dims(norm, axis=(0, -1))  # (1,64,64,1)
    return x
