import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { ingestDocument } from "./ingest.js";
import { answerQuestion } from "./query.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Allow any origin during development; tighten for production by setting
// the CORS_ORIGIN env var to your Vercel URL.
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.mimetype === "text/plain") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and plain-text (.txt) files are supported."));
    }
  },
});

// ── /upload ────────────────────────────────────────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded." });
    }

    const { buffer, mimetype, originalname } = req.file;
    console.log(`Ingesting "${originalname}" (${mimetype})`);

    const chunkCount = await ingestDocument(buffer, mimetype, originalname);

    res.json({
      message: "Document processed successfully.",
      fileName: originalname,
      chunks: chunkCount,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── /chat ──────────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  try {
    const { question, fileName } = req.body;

    if (!question || typeof question !== "string" || question.trim() === "") {
      return res.status(400).json({ error: "`question` is required." });
    }
    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({ error: "`fileName` is required." });
    }

    const answer = await answerQuestion(question.trim(), fileName);
    res.json({ answer });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── health ─────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Docutalk backend running on http://localhost:${PORT}`);
});
