# Docutalk

A RAG-powered web app that lets you upload any document and have a conversation with it — powered by Gemini and Qdrant.

## What it does

- Upload a PDF or plain text file
- The system chunks, embeds, and indexes the document into a vector database
- Ask natural language questions about the document
- Get answers grounded strictly in the document's content — not from the AI's general knowledge

## Tech Stack

- **Backend:** Node.js, Express
- **LLM & Embeddings:** Google Gemini
- **Vector Database:** Qdrant Cloud
- **Frontend:** HTML, CSS, Vanilla JS

## Project Structure

```
docutalk/
├── backend/
│   ├── index.js      — Express server
│   ├── ingest.js     — Chunking, embedding, storing in Qdrant
│   ├── query.js      — Retrieval and answer generation
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## Environment Variables

Create a `.env` file inside the `backend` folder:

```
GEMINI_API_KEY=your_gemini_api_key
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION=docutalk
PORT=3001
```

## Running Locally

```bash
cd backend
npm install
node index.js
```

Then open `frontend/index.html` in your browser.

## Deployment

- Backend deployed on [Render](https://render.com)
- Frontend deployed on [Vercel](https://vercel.com)
