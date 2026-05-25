// api/voice.js — Vercel serverless function
// Fully self-contained to process Siri Shortcuts and Web Requests in a single hop.

export default async function handler(req, res) {
  // 1. Configure CORS policies
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, session_id } = req.body;
  if (!text) return res.status(400).json({ error: "Missing 'text' field in request body." });

  const cleanInput = text.toLowerCase().trim();

  // 2. Run your local structural hardcoded matchers
  let replyText = null;
  let intentName = "unknown";

  if (includes(cleanInput, ["hello", "hi", "hey", "good morning", "howdy"])) {
    intentName = "greeting";
    replyText = "Hello! Welcome to Nanobooker. I can help you book a table, check availability, or manage your reservations. What would you like to do?";
  } else if (includes(cleanInput, ["thank", "thanks", "cheers", "awesome"])) {
    intentName = "thanks";
    replyText = "You are very welcome! Let me know if you need anything else.";
  } else if (includes(cleanInput, ["forget", "reset", "clear", "start over"])) {
    intentName = "reset";
    replyText = "Done. I have cleared our conversation context. How can I help you today?";
  }

  // 3. Fallback to Gemini Server-Side if no manual intent matches
  if (!replyText) {
    if (!process.env.GEMINI_API_KEY) {
      intentName = "error_fallback";
      replyText = "I encountered a configuration issue. The developer has not added the Gemini API Key yet.";
    } else {
      intentName = "gemini_ai_reply";
      try {
        const systemPrompt = process.env.SYSTEM_PROMPT || "You are Nova, a friendly voice booking assistant for Nanobooker. Keep responses under two sentences and clean of markdown.";
        
        // Execute direct REST request to Gemini Flash
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

        if (!response.ok) throw new Error("Gemini API connection error");
        
        const data = await response.json();
        let rawAiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
        
        // Siri Voice Optimization: Strip out markdown symbols (*, #, _, `) so Siri doesn't literally pronounce them.
        replyText = rawAiText.replace(/[\*#_`]/g, "").trim();

      } catch (err) {
        console.error("[Gemini Fallback Error]:", err);
        replyText = "I'm having trouble reaching my database right now. Please try again shortly.";
      }
    }
  }

  console.log(`[Voice Pipeline] Input: "${text}" | Intent: ${intentName}`);
  
  // 4. Return structural payload matching Siri's dictionary parsing layout
  return res.status(200).json({
    reply: replyText,
    intent: intentName,
    session_id: session_id || "siri_mobile_session"
  });
}

// Micro-helper function for text keyword scanning
function includes(target, phrases) {
  return phrases.some(phrase => target.includes(phrase));
}