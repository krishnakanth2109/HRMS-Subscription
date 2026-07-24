import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

/**
 * AI Service to generate HR documents using Gemini
 */
export const generateHRDocument = async ({ letterType, employeeData, companyName }) => {
  const apiKeys = [
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY
  ].filter(key => !!key);

  if (apiKeys.length === 0) {
    throw new Error("Gemini API key is not configured");
  }

  const { name, designation, department, joining_date, compensation, employment_type } = employeeData;
  const jDate = joining_date ? new Date(joining_date).toLocaleDateString("en-IN") : "N/A";

  const getPrompt = (type) => {
    const baseContext = `
      Employee Name: ${name}
      Designation: ${designation}
      Department: ${department}
      Company Name: ${companyName}
      Joining Date: ${jDate}
      Employment Type: ${employment_type || "Full Time"}
      CTC: ${compensation?.ctc || 0}
    `;

    const instructions = `
      STRICT RULES:
      1. FORMAT: Return ONLY the body content as valid HTML.
      2. STYLING: Use inline CSS. Keep font-family as 'Arial' or 'Helvetica'. Font size 14px.
      3. LENGTH: The content MUST be concise (around 2 to 3 professional paragraphs). The goal is to ensure the ENTIRE document, including headers, signature, and any annexure, fits on a SINGLE A4 page.
      4. DO NOT include: Date header, "To/Dear" salutation, or "Sincerely" signature block. I will add those.
      5. CONTENT: Focus on the specific ${type} details. Use highly professional and formal HR language.
      6. NO MARKDOWN: Do not wrap in \`\`\`html or anything. Just raw HTML.
    `;

    switch (type) {
      case "Offer Letter":
        return `
          ${baseContext}
          Task: Write a professional Offer Letter body.
          Include: Welcome message, role confirmation, reporting details, and a brief mention of growth opportunities.
          ${instructions}
        `;
      case "Internship Letter":
        return `
          ${baseContext}
          Task: Write a professional Internship Appointment Letter body.
          Include: Duration of internship, stipend (if CTC > 0), learning objectives, reporting manager, and confidentiality clause.
          ${instructions}
        `;
      case "Appraisal Letter":
        return `
          ${baseContext}
          Task: Write a professional Salary Revision/Appraisal Letter body.
          Include: Recognition of performance, mention of the new CTC (${compensation?.ctc || "as discussed"}), effective date, and encouragement for future contributions.
          ${instructions}
        `;
      case "Experience Letter":
        return `
          ${baseContext}
          Task: Write a professional Experience Certificate / Letter body.
          Include: Duration of service, key responsibilities handled, praise for character and work ethic, and best wishes for future endeavors.
          ${instructions}
        `;
      case "Relieving Letter":
        return `
          ${baseContext}
          Task: Write a professional Relieving Letter body.
          Include: Confirmation of resignation acceptance, last working day (${jDate}), confirmation that all company assets are returned and no dues remain.
          ${instructions}
        `;
      default:
        return `
          ${baseContext}
          Task: Write a professional HR document for ${type}.
          ${instructions}
        `;
    }
  };

  let lastError = null;
  for (const apiKey of apiKeys) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-flash-latest",
        generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
      });

      const result = await model.generateContent(getPrompt(letterType));
      let text = result.response.text().trim();
      
      // Sanitize
      if (text.startsWith("```")) {
        text = text.replace(/```[a-z]*\n?|```/g, "").trim();
      }
      
      return text;
    } catch (error) {
      lastError = error;
      console.warn(`Gemini API Error with key... switching...`, error.message);
      continue;
    }
  }

  throw lastError || new Error("Failed to generate HR document with AI");
};
