import CopilotKnowledgeChunk from "../models/CopilotKnowledgeChunk.js";
import { generateEmbedding } from "./copilotIngestion.js";

// Helper function to calculate cosine similarity between two vectors
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const retrieveRelevantHRContext = async (userQuery, userCompanyId = null, topK = 3) => {
  try {
    if (!userQuery || typeof userQuery !== "string") {
      return { retrievedDocs: [], formattedContext: "" };
    }

    const tenantCompanyId = userCompanyId ? userCompanyId.toString() : "global";

    // 1. Generate embedding for user query ONLY
    let queryEmbedding;
    try {
      queryEmbedding = await generateEmbedding(userQuery);
    } catch (err) {
      console.warn("⚠️ Query embedding generation fallback:", err.message);
      // Fallback: tenant-scoped keyword match
      const docs = await CopilotKnowledgeChunk.find({
        companyId: { $in: [tenantCompanyId, "global"] },
      }).lean();
      const matched = docs.filter((d) =>
        userQuery
          .toLowerCase()
          .split(" ")
          .some((w) => w.length > 3 && d.content.toLowerCase().includes(w))
      );
      const topDocs = (matched.length > 0 ? matched : docs).slice(0, topK);
      const formattedContext = topDocs
        .map((doc) => `--- POLICY: ${doc.title} ---\n${doc.content}`)
        .join("\n\n");
      return { retrievedDocs: topDocs, formattedContext };
    }

    // 2. Retrieve indexed embeddings scoped to the employee's tenant company OR global policies
    const chunks = await CopilotKnowledgeChunk.find({
      companyId: { $in: [tenantCompanyId, "global"] },
    }).lean();

    if (!chunks || chunks.length === 0) {
      return { retrievedDocs: [], formattedContext: "" };
    }

    // 3. Compute Vector Cosine Similarity
    const scoredChunks = chunks.map((chunk) => {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      return { ...chunk, similarityScore: score };
    });

    // 4. Sort descending and pick top K
    scoredChunks.sort((a, b) => b.similarityScore - a.similarityScore);
    const topMatches = scoredChunks.slice(0, topK);

    const formattedContext = topMatches
      .map(
        (doc) =>
          `--- RELEVANT HR POLICY: ${doc.title} (Relevance: ${(doc.similarityScore * 100).toFixed(1)}%) ---\n${doc.content}`
      )
      .join("\n\n");

    return {
      retrievedDocs: topMatches.map((m) => ({
        title: m.title,
        category: m.category,
        score: m.similarityScore,
      })),
      formattedContext,
    };
  } catch (error) {
    console.error("❌ RAG Retrieval Error:", error.message);
    return { retrievedDocs: [], formattedContext: "" };
  }
};
