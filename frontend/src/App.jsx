import React, { useEffect, useMemo, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { predictFrame, translateText } from "./api";

const SESSION_ID = "react_user1";

/** Connexions EXACTES comme notebook */
const CONNECTIONS = [
  [0, 1, 2, 3, 4],      // pouce
  [5, 6, 7, 8],         // index
  [9, 10, 11, 12],      // majeur
  [13, 14, 15, 16],     // annulaire
  [17, 18, 19, 20],     // auriculaire
  [5, 9], [9, 13], [13, 17], [0, 5], [0, 17]  // paume
];

function speakText(text, lang = "fr-FR", rate = 1) {
  if (!window.speechSynthesis) {
    alert("SpeechSynthesis not supported in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

// ✅ NEW: stop voice helper
function stopSpeak() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// ✅ NEW: map targetLang -> TTS locale
function langToTtsLocale(targetLang) {
  switch (targetLang) {
    case "fr": return "fr-FR";
    case "en": return "en-US";
    case "ar": return "ar-SA";
    case "es": return "es-ES";
    default: return "fr-FR";
  }
}

/**
 * Dessine le squelette sur fond blanc 400x400 exactement comme ton notebook :
 * - lignes vertes épaisseur 3
 * - points rouges radius 2
 * Retourne un DataURL PNG (64x64) prêt pour le modèle.
 */
function buildSkeletonDataURL({ landmarks, mirror }) {
  // canvas 400x400 (comme notebook)
  const base = document.createElement("canvas");
  base.width = 400;
  base.height = 400;
  const bctx = base.getContext("2d");

  // fond blanc
  bctx.fillStyle = "white";
  bctx.fillRect(0, 0, 400, 400);

  // copier landmarks + option mirror (notebook flipType=True)
  const lms = landmarks.map((p) => ({
    x: mirror ? (1 - p.x) : p.x,
    y: p.y
  }));

  // bbox normalisée
  const xs = lms.map(p => p.x);
  const ys = lms.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const bw = Math.max(1e-6, maxX - minX);
  const bh = Math.max(1e-6, maxY - minY);

  // on reproduit l'idée du notebook : centrer la main dans 400 avec un "offset"
  const margin = 30; // proche de ce que fait le notebook avec os/os1 -15
  const scale = Math.min((400 - margin) / bw, (400 - margin) / bh);
  const offX = (400 - bw * scale) / 2;
  const offY = (400 - bh * scale) / 2;

  // convertir en pixels 400x400
  const pts = lms.map((p) => {
    const px = (p.x - minX) * scale + offX;
    const py = (p.y - minY) * scale + offY;
    return { x: px, y: py };
  });

  // lignes vertes épaisseur 3 (comme cv2.line(...,(0,255,0),3))
  bctx.strokeStyle = "rgb(0,255,0)";
  bctx.lineWidth = 3;
  bctx.lineCap = "round";

  for (const conn of CONNECTIONS) {
    for (let i = 0; i < conn.length - 1; i++) {
      const a = pts[conn[i]];
      const c = pts[conn[i + 1]];
      bctx.beginPath();
      bctx.moveTo(a.x, a.y);
      bctx.lineTo(c.x, c.y);
      bctx.stroke();
    }
  }

  // points rouges radius 2 (comme cv2.circle(...,2,(0,0,255),1))
  bctx.fillStyle = "rgb(255,0,0)";
  for (let i = 0; i < pts.length; i++) {
    bctx.beginPath();
    bctx.arc(pts[i].x, pts[i].y, 2, 0, Math.PI * 2);
    bctx.fill();
  }

  // resize 64x64 (comme notebook cv2.resize(white,(64,64)))
  const small = document.createElement("canvas");
  small.width = 64;
  small.height = 64;
  const sctx = small.getContext("2d");
  sctx.drawImage(base, 0, 0, 64, 64);

  // PNG (sans artefacts)
  return small.toDataURL("image/png");
}

// ===== ICONS COMPONENTS =====
const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const TextIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/>
    <rect x="14" y="4" width="4" height="16"/>
  </svg>
);

const MirrorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/>
    <line x1="12" y1="2" x2="12" y2="22"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const SpaceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h16"/>
    <path d="M12 4v16"/>
  </svg>
);

const DeleteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

const ClearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

const TranslateIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 8l6 6"/>
    <path d="M4 14l6-6 2-3 2 3 6 6"/>
    <path d="M2 5h12"/>
    <path d="M7 2h1"/>
    <path d="M22 22l-5-10-5 10"/>
    <path d="M14 18h6"/>
  </svg>
);

const VolumeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

const StopIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  </svg>
);

const HintIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

export default function App() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [mirror, setMirror] = useState(true);

  const [status, setStatus] = useState("Idle");
  const [prediction, setPrediction] = useState({ label: "-", confidence: 0 });

  // phrase (ajout manuel)
  const [text, setText] = useState("");
  const [translated, setTranslated] = useState("");
  const [targetLang, setTargetLang] = useState("fr");

  // anti-freeze (ne jamais await dans onResults)
  const inflightRef = useRef(false);
  const lastSentRef = useRef(0);

  const hands = useMemo(() => {
    const h = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    h.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    return h;
  }, []);

  // overlay size
  useEffect(() => {
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.width = 640;
      overlay.height = 480;
    }
  }, []);

  // actions texte
  const addPredictedLetter = () => {
    const l = prediction.label;
    if (!l || l === "-") return;
    setText((t) => t + l);
  };
  const addSpace = () => setText((t) => (t.endsWith(" ") || t.length === 0 ? t : t + " "));
  const deleteLastLetter = () => setText((t) => t.slice(0, -1));
  const deleteLastWord = () =>
    setText((t) => t.replace(/\s*\S+\s*$/, (m) => (m.includes(" ") ? " " : "")));
  const clearAll = () => {
    setText("");
    setTranslated("");
  };

  const doTranslate = async () => {
    try {
      setStatus("Translating...");
      const res = await translateText(text, "auto", targetLang);
      setTranslated(res.translated_text || "");
      setStatus("OK");
    } catch {
      setStatus("Translation error");
    }
  };

  useEffect(() => {
    if (!running) return;

    let camera = null;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const ctx = overlay.getContext("2d");

    const stopTracks = () => {
      const v = videoRef.current;
      if (v?.srcObject) {
        try {
          v.srcObject.getTracks().forEach((t) => t.stop());
        } catch {}
        v.srcObject = null;
      }
    };

    const onResults = (results) => {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.drawImage(results.image, 0, 0, overlay.width, overlay.height);

      if (!results.multiHandLandmarks?.length) {
        setStatus("No hand detected");
        return;
      }

      // landmarks mediapipe (21 points)
      const landmarks = results.multiHandLandmarks[0];

      // afficher squelette sur overlay (optionnel visuel)
      // (on trace simplement les connexions)
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,255,0,0.7)";
      for (const conn of CONNECTIONS) {
        for (let i = 0; i < conn.length - 1; i++) {
          const a = landmarks[conn[i]];
          const b = landmarks[conn[i + 1]];
          const ax = (mirror ? (1 - a.x) : a.x) * overlay.width;
          const ay = a.y * overlay.height;
          const bx = (mirror ? (1 - b.x) : b.x) * overlay.width;
          const by = b.y * overlay.height;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }

      // ✅ Créer exactement l'image "white skeleton" 64x64 comme notebook
      const dataUrl = buildSkeletonDataURL({ landmarks, mirror });

      // ---- appel backend non bloquant (anti-freeze) ----
      const now = Date.now();
      if (now - lastSentRef.current < 120) return; // ~8fps
      if (inflightRef.current) return;

      lastSentRef.current = now;
      inflightRef.current = true;
      setStatus("Predicting...");

      (async () => {
        try {
          const res = await predictFrame(dataUrl, SESSION_ID);
          setPrediction({ label: res.label, confidence: res.confidence });
          setStatus("OK");
        } catch {
          setStatus("Backend error");
        } finally {
          inflightRef.current = false;
        }
      })();
    };

    hands.onResults(onResults);

    camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 640,
      height: 480,
    });

    camera.start();
    setStatus("Camera started");

    return () => {
      try { camera?.stop(); } catch {}
      stopTracks();
      inflightRef.current = false;
      lastSentRef.current = 0;
      setStatus("Stopped");
    };
  }, [running, hands, mirror]);

  const mirrorClass = mirror ? "mirror" : "";

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <div className="logo"></div>
          <div className="logo-text">
            <h1 className="site-name">SignSense AI</h1>
            <p className="site-tagline">Real-time Sign Language Recognition</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="status-indicator">
            <div className={`status-dot ${status === "OK" ? "active" : ""}`}></div>
            <span className="status-text">{status}</span>
          </div>
          
          <div className="action-buttons">
            <button 
              className={`btn ${running ? "btn-primary active" : "btn-primary"}`} 
              onClick={() => setRunning((v) => !v)}
            >
              <span className="btn-icon">
                {running ? <PauseIcon /> : <PlayIcon />}
              </span>
              {running ? "Stop Camera" : "Start Camera"}
            </button>
            <button 
              className={`btn btn-secondary ${mirror ? "active" : ""}`} 
              onClick={() => setMirror((v) => !v)}
            >
              <span className="btn-icon">
                <MirrorIcon />
              </span>
              Mirror: {mirror ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* DEUX COLONNES CÔTE À CÔTE */}
        <div className="two-column-layout">
          
          {/* COLONNE GAUCHE - CAMÉRA (55%) */}
          <div className="left-column">
            <div className="card camera-card">
              <div className="card-header">
                <h2 className="card-title">
                  <span className="icon"><CameraIcon /></span> Camera Feed
                </h2>
                <div className="prediction-display">
                  <div className="prediction-label">Current Letter:</div>
                  <div className="prediction-value">
                    <span className="letter">{prediction.label}</span>
                    <span className="confidence">
                      {Math.round(prediction.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              </div>

              <div className={`camera-container ${mirrorClass}`}>
                <div className="camera-wrapper">
                  <video ref={videoRef} className="video-feed" autoPlay playsInline muted />
                  <canvas ref={overlayRef} className="overlay-canvas" />
                  <div className="camera-border"></div>
                </div>
              </div>

              <div className="card-actions">
                <button className="btn btn-success" onClick={addPredictedLetter}>
                  <span className="btn-icon"><CheckIcon /></span> Add "{prediction.label}" to Text
                </button>
                <button className="btn btn-outline" onClick={addSpace}>
                  <span className="btn-icon"><SpaceIcon /></span> Add Space
                </button>
              </div>

              <div className="card-hint">
                <div className="hint-icon"><HintIcon /></div>
                <p>Click "Add" to manually insert the recognized letter into the text below</p>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE - FONCTIONNALITÉS (45%) */}
          <div className="right-column">
            {/* Carte 1 : Text Builder */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <span className="icon"><TextIcon /></span> Text Builder
                </h2>
              </div>

              <div className="text-input-section">
                <label className="input-label">Your Text (ASL → Text)</label>
                <textarea
                  className="text-input glass-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Your text will appear here as you add letters..."
                  rows={5}
                />
              </div>

              <div className="button-group">
                <div className="button-row">
                  <button className="btn btn-outline" onClick={deleteLastLetter}>
                    <span className="btn-icon"><DeleteIcon /></span> Delete Letter
                  </button>
                  <button className="btn btn-outline" onClick={deleteLastWord}>
                    <span className="btn-icon"><ClearIcon /></span> Delete Word
                  </button>
                  <button className="btn btn-danger" onClick={clearAll}>
                    <span className="btn-icon"><ClearIcon /></span> Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Carte 2 : Translation & Voice */}
            <div className="card">
              <div className="text-input-section">
                <label className="input-label">Translation</label>
                <div className="translation-controls">
                  <select 
                    className="select-input glass-input" 
                    value={targetLang} 
                    onChange={(e) => setTargetLang(e.target.value)}
                  >
                    <option value="fr">🇫🇷 French</option>
                    <option value="en">🇺🇸 English</option>
                    <option value="ar">🇸🇦 Arabic</option>
                    <option value="es">🇪🇸 Spanish</option>
                  </select>
                  <button className="btn btn-secondary" onClick={doTranslate}>
                    <span className="btn-icon"><TranslateIcon /></span> Translate
                  </button>
                </div>
                
                <textarea
                  className="text-input glass-input"
                  value={translated}
                  onChange={(e) => setTranslated(e.target.value)}
                  placeholder="Translation will appear here..."
                  rows={4}
                />
              </div>

              <div className="button-group">
                <div className="button-row">
                  <button className="btn btn-voice" onClick={() => speakText(text, "fr-FR", 1)}>
                    <span className="btn-icon"><VolumeIcon /></span> Read (FR)
                  </button>
                  <button className="btn btn-voice" onClick={() => speakText(text, "en-US", 1)}>
                    <span className="btn-icon"><VolumeIcon /></span> Read (EN)
                  </button>
                  <button className="btn btn-voice" onClick={() => speakText(text, "ar-SA", 1)}>
                    <span className="btn-icon"><VolumeIcon /></span> Read (AR)
                  </button>
                  <button className="btn btn-outline" onClick={stopSpeak}>
                    <span className="btn-icon"><StopIcon /></span> Stop
                  </button>
                </div>
                
                <button
                  className="btn btn-primary"
                  onClick={() => speakText(translated, langToTtsLocale(targetLang), 1)}
                  disabled={!translated}
                >
                  <span className="btn-icon"><VolumeIcon /></span> Read Translation
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p className="footer-text">
          SignSense AI • Real-time hand tracking with MediaPipe • Built with React
        </p>
      </footer>
    </div>
  );
}