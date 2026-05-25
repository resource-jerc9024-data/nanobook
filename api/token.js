// api/token.js — Vercel serverless function
// Generates a short-lived Gemini Live ephemeral token
// Your GEMINI_API_KEY never leaves the server

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  try {
    // Request ephemeral token from Google
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/ephemeralTokens?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-3.1-flash-live-preview",
          config: {
            responseModalities: ["AUDIO"],
            systemInstruction: {
              parts: [{
                text: process.env.SYSTEM_PROMPT ||
                  "You are a friendly voice booking assistant for Nanobooker. Help users book tables, check availability, and manage reservations. Be brief and conversational — this is a voice interface."
              }]
            }
          },
          ttlSeconds: 900 // 15 minutes
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("[token] Gemini error:", err);
      return res.status(502).json({ error: "Failed to get token from Gemini", detail: err });
    }

    const data = await response.json();
    return res.status(200).json({
      token: data.token,
      expires_in: 900,
      model: "gemini-3.1-flash-live-preview"
    });

  } catch (err) {
    console.error("[token] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
