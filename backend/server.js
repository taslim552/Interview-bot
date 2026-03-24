// backend/server.js
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

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}

const allowedOrigins = new Set([
  normalizeOrigin(frontendOrigin),
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
      const normalizedOrigin = normalizeOrigin(origin);
      const isVercelAppOrigin = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin);

      if (!origin || allowedOrigins.has(normalizedOrigin) || isVercelAppOrigin) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${normalizedOrigin}`));
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

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function computeAnswerMetrics(question, answer, sentiment, relevance) {
  const answerText = (answer || "").toLowerCase();
  const questionText = (question || "").toLowerCase();

  const answerWords = answerText.match(/[a-z0-9+#.-]+/g) || [];
  const questionWords = questionText.match(/[a-z0-9+#.-]+/g) || [];
  const sentenceCount = Math.max(1, (answer || "").split(/[.!?]+/).filter((part) => part.trim()).length);

  const stopWords = new Set(natural.stopwords);
  const questionTerms = new Set(questionWords.filter((word) => word.length > 2 && !stopWords.has(word)));
  const answerTerms = new Set(answerWords.filter((word) => word.length > 2 && !stopWords.has(word)));

  const overlapCount = [...questionTerms].filter((term) => answerTerms.has(term)).length;
  const overlapRatio = questionTerms.size ? overlapCount / questionTerms.size : 0;

  const technicalTermPattern = /(api|architecture|database|sql|nosql|cache|redis|docker|kubernetes|microservice|java|python|node|react|aws|azure|gcp|thread|async|queue|latency|throughput|scalable|optimization|security|testing|ci|cd)/g;
  const actionVerbPattern = /(built|designed|implemented|optimized|debugged|solved|reduced|improved|deployed|integrated|led|refactored|measured|automated)/g;
  const resultPattern = /(improved|reduced|increased|decreased|faster|slower|latency|uptime|downtime|error rate|throughput|performance|cost)/g;
  const uncertaintyPattern = /(maybe|probably|i think|not sure|perhaps|kind of|sort of)/g;
  const fillerPattern = /\b(um|uh|hmm|like)\b/g;

  const technicalMatches = answerText.match(technicalTermPattern) || [];
  const actionMatches = answerText.match(actionVerbPattern) || [];
  const resultMatches = answerText.match(resultPattern) || [];
  const uncertaintyMatches = answerText.match(uncertaintyPattern) || [];
  const fillerMatches = answerText.match(fillerPattern) || [];
  const numericEvidenceCount = (answerText.match(/\b\d+(?:\.\d+)?%?\b/g) || []).length;

  const wordCount = answerWords.length;
  const lengthScore = Math.min(1, wordCount / 80);
  const structureScore = Math.min(1, sentenceCount / 4);
  const technicalSignal = Math.min(1, (technicalMatches.length + numericEvidenceCount) / 7);
  const actionSignal = Math.min(1, actionMatches.length / 4);
  const resultSignal = Math.min(1, (resultMatches.length + numericEvidenceCount) / 5);

  const hesitationRatio = (uncertaintyMatches.length + fillerMatches.length) / Math.max(1, wordCount / 6);
  const confidencePenalty = Math.min(0.45, hesitationRatio * 0.25);

  const technicalDepth = clampScore(Math.round((relevance * 0.6 + overlapRatio * 0.2 + technicalSignal * 0.2) * 100), 10, 98);
  const communication = clampScore(
    Math.round(
      (0.4 * lengthScore + 0.3 * structureScore + 0.3 * Math.max(0, (sentiment.pos || 0) + (sentiment.neu || 0) * 0.7)) *
        (1 - confidencePenalty) *
        100
    ),
    20,
    98
  );
  const confidence = clampScore(
    Math.round((0.35 * actionSignal + 0.35 * resultSignal + 0.3 * Math.max(0, relevance)) * (1 - confidencePenalty) * 100),
    15,
    98
  );
  const problemSolving = clampScore(
    Math.round((0.5 * relevance + 0.2 * overlapRatio + 0.15 * actionSignal + 0.15 * resultSignal) * 100),
    10,
    98
  );

  return {
    technicalDepth,
    communication,
    confidence,
    problemSolving
  };
}

async function generateFinalFeedback(qaPairs) {
  const formatAsBullets = (rawText) => {
    const cleanedLines = String(rawText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[-*•\u2022\d.)\s]+/, "").trim())
      .filter(Boolean);

    const normalizedLines = cleanedLines.length
      ? cleanedLines
      : String(rawText || "")
          .split(/(?<=[.!?])\s+/)
          .map((line) => line.trim())
          .filter((line) => line.length > 10);

    return normalizedLines.slice(0, 8).map((line) => `- ${line}`).join("\n");
  };

  if (!geminiModel) {
    return [
      "- Good effort and consistent interview flow.",
      "- Keep answers concise and structured using situation-action-result format.",
      "- Add measurable outcomes (numbers, percentages, impact).",
      "- Mention technical trade-offs behind your decisions.",
      "- Use specific project examples to strengthen credibility."
    ].join("\n");
  }

  const interviewText = qaPairs
    .map((qa, index) => `Q${index + 1}: ${qa.question}\nA${index + 1}: ${qa.answer}`)
    .join("\n\n");

  const prompt = [
    "Evaluate this interview performance.",
    "Give concise feedback in 5-8 bullet points.",
    "Cover strengths, weaknesses, and specific improvements.",
    "Return only bullet points, one per line, starting each line with '- '.",
    interviewText
  ].join("\n\n");

  try {
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text() || "";
    return formatAsBullets(text || "No feedback generated.");
  } catch (error) {
    console.error("Gemini feedback generation failed:", error.message);
    return [
      "- Interview complete with steady progress across questions.",
      "- Improve clarity by keeping each answer focused.",
      "- Add more concrete project examples and measurable impact.",
      "- Explain technical reasoning and trade-off decisions more explicitly."
    ].join("\n");
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", api: "interview-bot-backend" });
});

app.get("/", (_req, res) => {
  res.json({
    message: "Interview bot backend is running.",
    health: "/health"
  });
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
    const sentiment = {
      pos: Number(pos),
      neg: Number(neg),
      neu: Number(neu)
    };
    const metrics = computeAnswerMetrics(question, answer, sentiment, score);

    return res.json({
      sentiment,
      score,
      metrics
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
