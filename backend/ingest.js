import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION;
const VECTOR_SIZE = 3072;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Use the internal implementation file to avoid pdf-parse's auto-test runner
// which breaks in Node v26
function getPdfParser() {
  try {
    return require("pdf-parse/lib/pdf-parse.js");
  } catch {
    return require("pdf-parse");
  }
}

export async function extractText(buffer, mimetype) {
  if (mimetype === "application/pdf") {
    const pdfParse = getPdfParser();
    const data = await pdfParse(buffer);
    return data.text;
  }
  return buffer.toString("utf-8");
}

export function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  const step = chunkSize - overlap;
  let start = 0;

  // Normalise whitespace so chunks are dense
  const normalised = text.replace(/\s+/g, " ").trim();

  while (start < normalised.length) {
    const end = Math.min(start + chunkSize, normalised.length);
    const chunk = normalised.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (end === normalised.length) break;
    start += step;
  }
  return chunks;
}

async function embedText(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: [text],
  });
  return response.embeddings[0].values;
}

async function ensureCollection() {
  const checkRes = await fetch(
    `${QDRANT_URL}/collections/${QDRANT_COLLECTION}`,
    { headers: { "api-key": QDRANT_API_KEY } },
  );

  if (checkRes.status === 404) {
    const createRes = await fetch(
      `${QDRANT_URL}/collections/${QDRANT_COLLECTION}`,
      {
        method: "PUT",
        headers: {
          "api-key": QDRANT_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vectors: { size: VECTOR_SIZE, distance: "Cosine" },
        }),
      },
    );
    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`Failed to create Qdrant collection: ${body}`);
    }
    console.log(`Collection "${QDRANT_COLLECTION}" created.`);

    // Create a keyword index on fileName so filter queries work
    const indexRes = await fetch(
      `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/index`,
      {
        method: "PUT",
        headers: {
          "api-key": QDRANT_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          field_name: "fileName",
          field_schema: "keyword",
        }),
      },
    );
    if (!indexRes.ok) {
      const body = await indexRes.text();
      throw new Error(`Failed to create fileName index: ${body}`);
    }
    console.log('Payload index on "fileName" created.');
  }
}

export async function ingestDocument(buffer, mimetype, fileName) {
  const text = await extractText(buffer, mimetype);
  if (!text || text.trim().length === 0) {
    throw new Error("Could not extract any text from the document.");
  }

  const chunks = chunkText(text);
  console.log(`Extracted ${chunks.length} chunks from "${fileName}"`);

  await ensureCollection();

  // Embed and upsert in batches to stay within API limits
  const BATCH_SIZE = 20;
  const points = [];

  for (let i = 0; i < chunks.length; i++) {
    const vector = await embedText(chunks[i]);
    points.push({
      id: randomUUID(),
      vector,
      payload: { text: chunks[i], fileName },
    });

    if (points.length === BATCH_SIZE || i === chunks.length - 1) {
      const upsertRes = await fetch(
        `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points`,
        {
          method: "PUT",
          headers: {
            "api-key": QDRANT_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ points: [...points] }),
        },
      );
      if (!upsertRes.ok) {
        const body = await upsertRes.text();
        throw new Error(`Qdrant upsert failed: ${body}`);
      }
      console.log(`Upserted batch up to chunk ${i + 1}/${chunks.length}`);
      points.length = 0;
    }
  }

  return chunks.length;
}
