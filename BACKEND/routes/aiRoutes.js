import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

router.post("/optimize-reason", async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: "Reason is required" });
    }

    // List of keys to try in order
    const apiKeys = [
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY // Fallback to original if exists
    ].filter(key => !!key); // Remove undefined/null keys

    if (apiKeys.length === 0) {
      console.error("No Gemini API keys found in environment variables");
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    let lastError = null;
    let optimizedText = null;

    // Try each key until one works or we run out
    for (const apiKey of apiKeys) {
      try {
        console.log(`Attempting with Gemini API key starting with: ${apiKey.substring(0, 10)}...`);
        
        const genAI = new GoogleGenerativeAI(apiKey);
        // Using Gemini Flash Latest to avoid 0-limit quota restrictions on their keys
        const model = genAI.getGenerativeModel({ 
          model: "gemini-flash-latest",
          generationConfig: {
            maxOutputTokens: 600, 
            temperature: 0.7,
          }
        });

        const prompt = `Professionalize and optimize this HRMS leave reason. Keep it extremely concise, just 1 or 2 short sentences.
IMPORTANT RULES:
1. ONLY output the pure reason. 
2. DO NOT use introductory filler phrases like "The purpose of this leave is to", "I am writing to request", or "This request is necessitated by". 
3. Jump IMMEDIATELY into the action or event (e.g., "Attending the wedding ceremony of a close friend.", "Recovering from a severe viral infection.").
4. Provide a clear, professional explanation based on the user's input without changing the core meaning.
5. You MUST strictly ensure the very last character of your output is a full stop ".". DO NOT leave it hanging.

User Input Reason: "${reason}"

Return ONLY the optimized text. No quotes, no markdown.`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        optimizedText = response.text().trim();
        
        // Success! Break out of the loop
        break;
      } catch (error) {
        lastError = error;
        const errorMessage = error?.message || "";
        
        // Check if it's a rate limit or quota error (429)
        if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("limit")) {
          console.warn(`Key starting with ${apiKey.substring(0, 10)} hit rate limit. Trying next key...`);
          continue; // Try next key
        } else {
          // If it's another type of error, we might want to stop or continue. 
          // For reliability, let's try the next key for any AI error.
          console.error(`Error with key starting with ${apiKey.substring(0, 10)}:`, errorMessage);
          continue;
        }
      }
    }

    if (!optimizedText) {
      throw lastError || new Error("Failed to generate content with all available keys");
    }

    // Strip markdown if added by Gemini
    if (optimizedText.startsWith("```")) {
        optimizedText = optimizedText.replace(/```[a-z]*\n?|```/g, "").trim();
    }
    
    // Remove surrounding quotes if present
    if ((optimizedText.startsWith('"') && optimizedText.endsWith('"')) || 
        (optimizedText.startsWith("'") && optimizedText.endsWith("'"))) {
      optimizedText = optimizedText.slice(1, -1);
    }

    console.log("Optimized reason:", optimizedText);
    res.json({ optimizedReason: optimizedText });
  } catch (error) {
    console.error("Final Error after trying all keys:", error?.message || error);
    res.status(500).json({ error: error?.message || "Failed to optimize reason after multiple attempts" });
  }
});

router.post("/generate-announcement", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const apiKeys = [
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY
    ].filter(key => !!key);

    if (apiKeys.length === 0) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    let optimizedText = null;
    let lastError = null;

    for (const apiKey of apiKeys) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-flash-latest",
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
          }
        });

        const prompt = `Act as an expert HR Communications Manager. Your goal is to write a concise, high-impact, and professional announcement description based on the title provided.

        Title: "${title}"

        STRICT GUIDELINES:
        1. LENGTH: Write exactly 4 to 5 impactful sentences (approximately 60-100 words). Do not write more.
        2. CONTENT: Clearly communicate the core message of the announcement with a professional and welcoming tone.
        3. COMPLETION: Ensure the message is fully completed. Never stop in the middle of a sentence.
        4. NO PLACEHOLDERS: Do not use placeholders like [Company Name], [Date], or any bracketed text.
        5. FORMAT: Return ONLY the description text. No headers, signatures, or subject lines.
        6. PUNCTUATION: You MUST strictly end the entire description with a full stop ".".
        7. No markdown, no quotes.

        Ensure the result is a perfectly finished 4-5 line professional announcement.`;

        const result = await model.generateContent(prompt);
        optimizedText = result.response.text().trim();
        break;
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (!optimizedText) {
      throw lastError || new Error("Failed to generate announcement");
    }

    // Strip markdown if added by Gemini
    if (optimizedText.startsWith("```")) {
      optimizedText = optimizedText.replace(/```[a-z]*\n?|```/g, "").trim();
    }

    // ✅ FORCE FULL STOP: Ensue the description ALWAYS ends with a period "."
    if (!optimizedText.endsWith(".") && !optimizedText.endsWith("!") && !optimizedText.endsWith("?")) {
      optimizedText = optimizedText + ".";
    }

    res.json({ description: optimizedText });
  } catch (error) {
    console.error("Announcement Generation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
