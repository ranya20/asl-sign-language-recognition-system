const API_BASE = "http://127.0.0.1:8000";

export async function predictFrame(dataUrl, sessionId = "react_user1") {
  const r = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, session_id: sessionId })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function translateText(text, source = "auto", target = "fr") {
  const r = await fetch(`${API_BASE}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source, target })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
