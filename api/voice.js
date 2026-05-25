// api/voice.js — Vercel serverless function
export default async function handler(req, res) {
  // 1. Handle Security & CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // 2. Read input from either a POST body OR a simple GET web link parameter
  const text = req.body?.text || req.query?.text;
  const session_id = req.body?.session_id || req.query?.session_id || "siri_session";

  if (!text) return res.status(400).json({ error: "Missing text parameter." });

  const cleanInput = text.toLowerCase().trim();
  let replyText = "";

  // 3. Simple Keyword Matcher Rules
  if (cleanInput.includes("hours") || cleanInput.includes("open")) {
    replyText = "We are open Tuesday to Sunday from 12pm to 10pm.";
  } else if (cleanInput.includes("book") || cleanInput.includes("reserve")) {
    replyText = "I can absolutely help you book a table. What date and time were you thinking?";
  } else if (cleanInput.includes("hello") || cleanInput.includes("hi")) {
    replyText = "Hello! Welcome to Nanobooker. How can I help you today?";
  } else {
    // 4. Fallback to Gemini if no keywords match
    if (process.env.GEMINI_API_KEY) {
      try {
        const systemPrompt = "You are Nova, a concise booking assistant. Respond in under two sentences. No markdown formatting symbols.";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: cleanInput }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { maxOutputTokens: 100 }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          replyText = rawText.replace(/[\*#_`]/g, "").trim();
        } else {
          replyText = "I am having trouble reaching the AI network.";
        }
      } catch (err) {
        replyText = "An error occurred while communicating with the server.";
      }
    } else {
      replyText = "I heard you, but the Gemini API Key is missing from the server environment.";
    }
  }

  // 5. Send clean JSON response back to Siri
  return res.status(200).json({ reply: replyText });
}
