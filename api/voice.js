// api/voice.js — Complete Vercel API Endpoint
export default async function handler(req, res) {
  // 1. Configure Open Traffic Access (CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // 2. Read voice text from either a web link string (?text=...) or a JSON payload
  const text = req.query?.text || req.body?.text;
  
  if (!text) {
    return res.status(200).json({ reply: "I am connected, but I did not receive any text instructions." });
  }

  const cleanInput = text.toLowerCase().trim();
  let replyText = "";

  // 3. Static Keyword Routing Matrix
  if (cleanInput.includes("hours") || cleanInput.includes("open")) {
    replyText = "We are open Tuesday to Sunday from 12 p.m. to 10 p.m.";
  } else if (cleanInput.includes("book") || cleanInput.includes("reserve") || cleanInput.includes("table")) {
    replyText = "I can help you book a table. What date and time were you looking for?";
  } else if (cleanInput.includes("hello") || cleanInput.includes("hi") || cleanInput.includes("hey")) {
    replyText = "Hello! Welcome to Nanobooker. How can I help you today?";
  } else {
    // 4. Fallback to Gemini AI for General Processing
    if (process.env.GEMINI_API_KEY) {
      try {
        const systemPrompt = "You are Nova, a concise booking assistant. Respond in under two sentences. No markdown formatting symbols like asterisks.";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
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
          // Strip out markdown text wrappers so Siri doesn't spell them out
          replyText = rawText.replace(/[\*#_`]/g, "").trim();
        } else {
          replyText = "I am having trouble reaching the AI network right now.";
        }
      } catch (err) {
        replyText = "I encountered a connection error. Please try again.";
      }
    } else {
      replyText = "I heard you, but the Gemini API config key is missing from the server.";
    }
  }

  // 5. Send Clean Payload Object back to iPhone
  return res.status(200).json({ reply: replyText });
}
