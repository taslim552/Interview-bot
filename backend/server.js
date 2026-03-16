const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const dotenv = require("dotenv");
const Sentiment = require("sentiment");
const natural = require("natural");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
const upload = multer();
const sentimentAnalyzer = new Sentiment();

const port = Number(process.env.PORT || 5000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModelName = process.env.GEMINI_MODEL || "gemini-flash-latest";
const mongoUri = process.env.MONGO_URI;

const allowedOrigins = new Set([
  frontendOrigin,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
]);

let geminiModel = null;
if (geminiApiKey) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  geminiModel = genAI.getGenerativeModel({ model: geminiModelName });
  console.log(`Using Gemini model: ${geminiModelName}`);
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (no Origin header) and known local dev frontend origins.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json({ limit: "2mb" }));

const interviewSchema = new mongoose.Schema(
  {
    qaPairs: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true }
      }
    ],
    feedback: { type: String, required: true }
  },
  { timestamps: true }
);

const Interview = mongoose.models.Interview || mongoose.model("Interview", interviewSchema);

if (mongoUri) {
  mongoose
    .connect(mongoUri)
    .then(() => console.log("MongoDB connected"))
    .catch((error) => console.error("MongoDB connection failed:", error.message));
} else {
  console.log("MONGO_URI is not set. Running without database persistence.");
}

function fallbackQuestions() {
  return [
    "Introduce yourself.",
    "Tell me about a project you are proud of.",
    "How do you handle tight deadlines?",
    "Describe a challenging bug you fixed.",
    "How do you approach learning a new technology?",
    "Tell me about a time you worked in a team.",
    "How do you prioritize your tasks?",
    "Explain a technical concept to a non-technical person.",
    "What are your strengths and weaknesses?",
    "Why should we hire you?"
  ];
}

function extractKeywords(text) {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize((text || "").toLowerCase());
  const stopWords = new Set(natural.stopwords);
  const freq = new Map();

  for (const word of words) {
    if (!/^[a-z][a-z0-9+#.-]{2,}$/i.test(word)) {
      continue;
    }
    if (stopWords.has(word)) {
      continue;
    }
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

async function generateQuestionsFromGemini(keywords) {
  if (!geminiModel) {
    return fallbackQuestions();
  }

  const prompt = [
    "Generate exactly 10 interview questions as a plain numbered list.",
    "No intro text, no headings.",
    `Focus on these resume keywords: ${keywords.join(", ")}`
  ].join("\n");

  try {
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text() || "";
    const parsed = text
      .split("\n")
      .map((line) => line.replace(/^\s*[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 10);

    if (parsed.length >= 6) {
      return parsed;
    }

    return fallbackQuestions();
  } catch (error) {
    console.error("Gemini question generation failed:", error.message);
    return fallbackQuestions();
  }
}

function relevanceScore(question, answer) {
  const tfidf = new natural.TfIdf();
  tfidf.addDocument(question || "");
  tfidf.addDocument(answer || "");

  const terms = new Set([
    ...((question || "").toLowerCase().match(/[a-z0-9+#.-]+/g) || []),
    ...((answer || "").toLowerCase().match(/[a-z0-9+#.-]+/g) || [])
  ]);

  let dot = 0;
  let qNorm = 0;
  let aNorm = 0;

  for (const term of terms) {
    const q = tfidf.tfidf(term, 0);
    const a = tfidf.tfidf(term, 1);
    dot += q * a;
    qNorm += q * q;
    aNorm += a * a;
  }

  if (qNorm === 0 || aNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(qNorm) * Math.sqrt(aNorm));
}

async function generateFinalFeedback(qaPairs) {
  if (!geminiModel) {
    return "Good effort. Keep improving clarity, examples, and structure in your answers.";
  }

  const interviewText = qaPairs
    .map((qa, index) => `Q${index + 1}: ${qa.question}\nA${index + 1}: ${qa.answer}`)
    .join("\n\n");

  const prompt = [
    "Evaluate this interview performance.",
    "Give concise feedback in 5-8 bullet points.",
    "Cover strengths, weaknesses, and specific improvements.",
    interviewText
  ].join("\n\n");

  try {
    const result = await geminiModel.generateContent(prompt);
    return result.response.text() || "No feedback generated.";
  } catch (error) {
    console.error("Gemini feedback generation failed:", error.message);
    return "Interview complete. Work on concise answers with specific project examples.";
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", api: "interview-bot-backend" });
});

app.post("/upload_resume", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Resume PDF file is required." });
    }

    const parsedPdf = await pdfParse(req.file.buffer);
    const resumeText = parsedPdf.text || "";
    const keywords = extractKeywords(resumeText);
    const questions = await generateQuestionsFromGemini(keywords);

    return res.json({ keywords, questions });
  } catch (error) {
    console.error("upload_resume error:", error.message);
    return res.status(500).json({ error: "Failed to process resume." });
  }
});

app.post("/submit_answer", (req, res) => {
  try {
    const { question, answer } = req.body || {};
    if (!question || !answer) {
      return res.status(400).json({ error: "question and answer are required." });
    }

    const sent = sentimentAnalyzer.analyze(answer);
    const total = Math.max(1, sent.tokens?.length || 1);
    const pos = Number(Math.max(0, sent.score) / total).toFixed(2);
    const neg = Number(Math.max(0, -sent.score) / total).toFixed(2);
    const neu = Number(Math.max(0, 1 - Number(pos) - Number(neg))).toFixed(2);

    const score = relevanceScore(question, answer);

    return res.json({
      sentiment: {
        pos: Number(pos),
        neg: Number(neg),
        neu: Number(neu)
      },
      score
    });
  } catch (error) {
    console.error("submit_answer error:", error.message);
    return res.status(500).json({ error: "Failed to evaluate answer." });
  }
});

app.post("/final_feedback", async (req, res) => {
  try {
    const qaPairs = Array.isArray(req.body?.qa_pairs) ? req.body.qa_pairs : [];
    if (qaPairs.length === 0) {
      return res.status(400).json({ error: "qa_pairs is required." });
    }

    const feedback = await generateFinalFeedback(qaPairs);

    if (mongoose.connection.readyState === 1) {
      await Interview.create({ qaPairs, feedback });
    }

    return res.json({ feedback });
  } catch (error) {
    console.error("final_feedback error:", error.message);
    return res.status(500).json({ error: "Failed to generate final feedback." });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
