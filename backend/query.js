import { GoogleGenAI } from "@google/genai";

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function embedText(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: [text],
  });
  return response.embeddings[0].values;
}

async function searchQdrant(vector, fileName, limit = 5) {
  const res = await fetch(
    `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/search`,
    {
      method: "POST",
      headers: {
        "api-key": QDRANT_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vector,
        limit,
        with_payload: true,
        filter: {
          must: [{ key: "fileName", match: { value: fileName } }],
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Qdrant search failed: ${body}`);
  }

  const data = await res.json();
  return data.result.map((r) => r.payload.text);
}

export async function answerQuestion(question, fileName) {
  const questionVector = await embedText(question);
  const chunks = await searchQdrant(questionVector, fileName);

  if (chunks.length === 0) {
    return "I couldn't find any relevant content in the document to answer your question.";
  }

  const context = chunks.join("\n\n---\n\n");

  const prompt = `You are a precise document assistant. Your ONLY job is to answer questions using the document excerpts provided below. Follow these rules strictly:

1. Only use information from the document excerpts — never from your general knowledge.
2. If the answer is not in the excerpts, say exactly: "I couldn't find that information in the document."
3. Quote or closely paraphrase the document when possible.
4. Be concise and direct.

Document excerpts:
"""
${context}
"""

Question: ${question}

Answer:`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });

  return response.text;
}
