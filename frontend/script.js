// ── Config ─────────────────────────────────────────────────────────────────
// Change this to your Render backend URL after deployment.
// For local dev, leave it as http://localhost:3000
const BACKEND_URL =
  // empty string = file:// protocol (opened directly); also covers localhost
  window.location.hostname === "" ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3001"
    : "https://docutalk-backend.onrender.com";

// ── State ──────────────────────────────────────────────────────────────────
let currentFileName = null;
let isLoading = false;

// ── DOM refs ───────────────────────────────────────────────────────────────
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const uploadStatus = document.getElementById("uploadStatus");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const docInfo = document.getElementById("docInfo");
const docName = document.getElementById("docName");
const messages = document.getElementById("messages");
const emptyState = document.getElementById("emptyState");
const questionInput = document.getElementById("questionInput");
const sendBtn = document.getElementById("sendBtn");

// ── Upload ─────────────────────────────────────────────────────────────────
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleUpload(fileInput.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("drag-over"),
);
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleUpload(file);
});

function setUploadStatus(icon, text, show = true) {
  statusIcon.textContent = icon;
  statusText.textContent = text;
  uploadStatus.hidden = !show;
}

async function handleUpload(file) {
  const allowed = ["application/pdf", "text/plain"];
  if (!allowed.includes(file.type)) {
    setUploadStatus("⚠️", "Only PDF and .txt files are supported.");
    return;
  }

  setUploadStatus("⏳", `Processing "${file.name}"…`);
  docInfo.hidden = true;
  disableChat();

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${BACKEND_URL}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Upload failed");

    setUploadStatus("✅", `Ready — ${data.chunks} chunks indexed.`);
    currentFileName = data.fileName;
    docName.textContent = data.fileName;
    docInfo.hidden = false;
    enableChat();
  } catch (err) {
    setUploadStatus("❌", `Error: ${err.message}`);
  }
}

// ── Chat ───────────────────────────────────────────────────────────────────
function enableChat() {
  questionInput.disabled = false;
  questionInput.focus();
  updateSendBtn();
}

function disableChat() {
  questionInput.disabled = true;
  sendBtn.disabled = true;
}

function updateSendBtn() {
  sendBtn.disabled =
    questionInput.disabled || questionInput.value.trim() === "" || isLoading;
}

questionInput.addEventListener("input", () => {
  // Auto-grow
  questionInput.style.height = "auto";
  questionInput.style.height = `${questionInput.scrollHeight}px`;
  updateSendBtn();
});

questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

function appendMessage(role, text, isError = false) {
  emptyState.style.display = "none";

  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "Docutalk";

  const bubble = document.createElement("div");
  bubble.className = `bubble${isError ? " error" : ""}`;
  bubble.textContent = text;

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return wrapper;
}

function showTyping() {
  emptyState.style.display = "none";

  const wrapper = document.createElement("div");
  wrapper.className = "message ai";
  wrapper.id = "typingIndicator";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = "Docutalk";

  const bubble = document.createElement("div");
  bubble.className = "typing-bubble";
  bubble.innerHTML = "<span></span><span></span><span></span>";

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) indicator.remove();
}

async function sendMessage() {
  const question = questionInput.value.trim();
  if (!question || isLoading || !currentFileName) return;

  isLoading = true;
  updateSendBtn();

  questionInput.value = "";
  questionInput.style.height = "auto";

  appendMessage("user", question);
  showTyping();

  try {
    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, fileName: currentFileName }),
    });
    const data = await res.json();

    removeTyping();

    if (!res.ok) throw new Error(data.error || "Something went wrong");

    appendMessage("ai", data.answer);
  } catch (err) {
    removeTyping();
    appendMessage("ai", `Error: ${err.message}`, true);
  } finally {
    isLoading = false;
    updateSendBtn();
    questionInput.focus();
  }
}
