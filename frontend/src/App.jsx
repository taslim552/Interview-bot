// frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  Bot,
  CircleCheck,
  Clock3,
  FileUp,
  Mic,
  MoveRight,
  Rocket,
  Sparkles,
  Volume2,
  WandSparkles
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function speakText(text) {
  if (!text || !("speechSynthesis" in window)) {
    return;
  }
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(msg);
}

function startListening(onResult, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError("Speech recognition is not supported in this browser.");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    onResult(transcript);
  };
  recognition.onerror = (event) => {
    onError(event.error || "Speech recognition failed.");
  };
  recognition.start();
}

async function uploadResume(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/upload_resume`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    const message = await response
      .json()
      .then((data) => data?.error || "Resume upload failed.")
      .catch(() => "Resume upload failed.");
    throw new Error(message);
  }
  return response.json();
}

async function submitAnswer(payload) {
  const response = await fetch(`${API_BASE}/submit_answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const message = await response
      .json()
      .then((data) => data?.error || "Failed to submit answer.")
      .catch(() => "Failed to submit answer.");
    throw new Error(message);
  }
  return response.json();
}

async function getFinalFeedback(qaPairs) {
  const response = await fetch(`${API_BASE}/final_feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qa_pairs: qaPairs })
  });
  if (!response.ok) {
    const message = await response
      .json()
      .then((data) => data?.error || "Failed to generate final feedback.")
      .catch(() => "Failed to generate final feedback.");
    throw new Error(message);
  }
  return response.json();
}

function useTypedQuestion(text, speed = 24) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!text) {
      setTyped("");
      return undefined;
    }
    let index = 0;
    setTyped("");
    const timer = setInterval(() => {
      index += 1;
      setTyped(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return typed;
}

function BackgroundDecor() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-noise" />
      <div className="shape-float pointer-events-none fixed left-[-80px] top-16 h-60 w-60 rounded-full bg-accent-500/15 blur-3xl" />
      <div className="shape-float pointer-events-none fixed right-[-60px] top-1/3 h-72 w-72 rounded-full bg-sky-300/10 blur-3xl [animation-delay:1.5s]" />
      <div className="shape-float pointer-events-none fixed bottom-[-90px] left-1/3 h-72 w-72 rounded-full bg-indigo-300/10 blur-3xl [animation-delay:3s]" />
    </>
  );
}

function UploadView({ file, setFile, loading, uploadProgress, error, onSubmit }) {
  const dropzone = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles?.length) {
        setFile(acceptedFiles[0]);
      }
    }
  });

  return (
    <motion.form
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onSubmit={onSubmit}
      className="glass-card relative mx-auto w-full max-w-3xl overflow-hidden p-6 md:p-10"
    >
      <div className="absolute right-6 top-6 chip">
        <Sparkles size={14} />
        AI Interview Ready
      </div>

      <div className="mb-8 flex items-start gap-4">
        <div className="rounded-2xl bg-accent-500/15 p-3 text-accent-400">
          <Bot size={28} />
        </div>
        <div>
          <h1 className="font-sans text-3xl font-bold text-white md:text-4xl">Launch Your Technical Interview</h1>
          <p className="mt-2 max-w-xl text-sm text-slatepro-300 md:text-base">
            Drop your resume and get tailored AI-generated questions with realtime evaluation and final coaching insights.
          </p>
        </div>
      </div>

      <div
        {...dropzone.getRootProps()}
        className={`group relative rounded-2xl border border-dashed p-8 transition-all duration-200 md:p-12 ${
          dropzone.isDragActive
            ? "border-accent-400 bg-accent-500/10 shadow-glow"
            : "border-slatepro-400/30 bg-navy-900/60 hover:border-accent-400/60 hover:bg-navy-800/70"
        }`}
      >
        <input {...dropzone.getInputProps()} />

        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/20 text-accent-400"
        >
          <FileUp size={28} />
        </motion.div>

        <p className="text-center text-lg font-semibold text-white">
          {dropzone.isDragActive ? "Drop resume to upload" : "Drag and drop your PDF resume"}
        </p>
        <p className="mt-2 text-center text-sm text-slatepro-300">or click to browse and upload</p>

        {file && (
          <div className="mx-auto mt-5 w-fit rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-sm text-emerald-300">
            Selected: {file.name}
          </div>
        )}
      </div>

      <div className="mt-7 space-y-3">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slatepro-300">
          <span>Upload Progress</span>
          <span>{uploadProgress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-700/40">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-400 to-blue-300"
            initial={{ width: 0 }}
            animate={{ width: `${uploadProgress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Building Interview Plan..." : "Generate Interview"}
          <MoveRight size={16} />
        </motion.button>
        <span className="text-xs text-slatepro-400">PDF only. Your resume is used only for interview generation.</span>
      </div>

      {error && <p className="mt-4 rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
    </motion.form>
  );
}

function InterviewView({
  questionIndex,
  totalQuestions,
  currentQuestion,
  answer,
  setAnswer,
  latestEvaluation,
  elapsedSeconds,
  loading,
  error,
  onSubmit,
  onReadQuestion,
  onVoiceAnswer
}) {
  const typedQuestion = useTypedQuestion(currentQuestion);
  const progress = clamp(((questionIndex + 1) / Math.max(1, totalQuestions)) * 100, 0, 100);

  return (
    <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card mx-auto w-full max-w-4xl p-6 md:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="chip">
            <Rocket size={14} />
            Question {questionIndex + 1} of {totalQuestions}
          </p>
          <h2 className="mt-3 font-sans text-2xl font-bold text-white md:text-3xl">Live Technical Interview</h2>
        </div>
        <div className="chip">
          <Clock3 size={14} />
          {Math.floor(elapsedSeconds / 60)
            .toString()
            .padStart(2, "0")}
          :{(elapsedSeconds % 60).toString().padStart(2, "0")}
        </div>
      </div>

      <div className="mb-7 h-2 overflow-hidden rounded-full bg-slate-700/50">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent-500 to-sky-300"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <motion.div layout className="rounded-2xl border border-accent-400/30 bg-accent-500/10 p-5 shadow-glow">
        <p className="text-lg font-semibold leading-relaxed text-white md:text-xl">
          {typedQuestion}
          <span className="ml-1 inline-block h-5 w-[2px] animate-pulse bg-accent-300 align-middle" />
        </p>
      </motion.div>

      <div className="mt-5 flex flex-wrap gap-3">
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} type="button" className="btn-secondary" onClick={onReadQuestion} disabled={loading}>
          <Volume2 size={16} />
          Read Question
        </motion.button>
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} type="button" className="btn-secondary" onClick={onVoiceAnswer} disabled={loading}>
          <Mic size={16} />
          Voice Answer
        </motion.button>
      </div>

      <div className="mt-5 space-y-3">
        <textarea
          rows={6}
          className="input-glow"
          placeholder="Craft a confident technical answer with concrete examples..."
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={loading}
        />

        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} type="button" className="btn-primary" onClick={onSubmit} disabled={loading}>
          {loading ? "Evaluating Response..." : "Submit Answer"}
          <WandSparkles size={16} />
        </motion.button>
      </div>

      {latestEvaluation && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-slatepro-400/20 bg-navy-900/60 p-4">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slatepro-300">Realtime Evaluation</p>
          <div className="grid gap-3 text-sm text-slatepro-200 md:grid-cols-2">
            <p>Positive Sentiment: {(latestEvaluation.sentiment?.pos ?? 0).toFixed(2)}</p>
            <p>Neutral Sentiment: {(latestEvaluation.sentiment?.neu ?? 0).toFixed(2)}</p>
            <p>Negative Sentiment: {(latestEvaluation.sentiment?.neg ?? 0).toFixed(2)}</p>
            <p>Relevance Score: {(latestEvaluation.score ?? 0).toFixed(2)}</p>
          </div>
        </motion.div>
      )}

      {error && <p className="mt-4 rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
    </motion.section>
  );
}

function FeedbackView({ feedback, evaluations, qaPairs, onRestart }) {
  const analytics = useMemo(() => {
    if (!evaluations.length) {
      return [
        { name: "Technical Depth", value: 0 },
        { name: "Communication", value: 0 },
        { name: "Confidence", value: 0 },
        { name: "Problem Solving", value: 0 }
      ];
    }

    const avgTechnicalDepth =
      evaluations.reduce((acc, item) => acc + (item.metrics?.technicalDepth ?? 0), 0) / evaluations.length;
    const avgCommunication =
      evaluations.reduce((acc, item) => acc + (item.metrics?.communication ?? 0), 0) / evaluations.length;
    const avgConfidence = evaluations.reduce((acc, item) => acc + (item.metrics?.confidence ?? 0), 0) / evaluations.length;
    const avgProblemSolving =
      evaluations.reduce((acc, item) => acc + (item.metrics?.problemSolving ?? 0), 0) / evaluations.length;

    return [
      { name: "Technical Depth", value: clamp(Math.round(avgTechnicalDepth), 0, 98) },
      { name: "Communication", value: clamp(Math.round(avgCommunication), 0, 98) },
      { name: "Confidence", value: clamp(Math.round(avgConfidence), 0, 98) },
      { name: "Problem Solving", value: clamp(Math.round(avgProblemSolving), 0, 98) }
    ];
  }, [evaluations]);

  const overall = Math.round(analytics.reduce((acc, item) => acc + item.value, 0) / analytics.length);
  const feedbackLines = useMemo(
    () =>
      (feedback || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "").replace(/\*/g, "")),
    [feedback]
  );

  return (
    <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card mx-auto w-full max-w-4xl p-6 md:p-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="chip">
            <CircleCheck size={14} />
            Interview Complete
          </p>
            <h2 className="mt-3 font-sans text-2xl font-bold text-white md:text-3xl">Performance Report</h2>
          <p className="mt-2 text-sm text-slatepro-300">Review your interview analytics and targeted coaching feedback.</p>
            <p className="mt-1 text-xs text-slatepro-400">All scores are calculated from your submitted answers in this session.</p>
        </div>
        <div className="rounded-2xl border border-accent-400/35 bg-accent-500/10 px-6 py-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slatepro-300">Overall Score</p>
          <p className="font-sans text-4xl font-bold text-white">{overall}%</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {analytics.map((item, index) => (
          <motion.div key={item.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }} className="rounded-2xl border border-slatepro-400/20 bg-navy-900/65 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-slatepro-200">{item.name}</span>
              <span className="text-slatepro-300">{item.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-700/60">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent-500 to-sky-300"
                initial={{ width: 0 }}
                animate={{ width: `${item.value}%` }}
                transition={{ duration: 0.55, delay: 0.1 + index * 0.08 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <CircleCheck size={16} />
            Strength Signals
          </p>
          <ul className="space-y-1 text-sm text-emerald-100/90">
            <li>Consistent structure in responses</li>
            <li>Good relevance to technical questions</li>
            <li>Clear communication in concise format</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
            <Sparkles size={16} />
            Improvement Focus
          </p>
          <ul className="space-y-1 text-sm text-amber-100/90">
            <li>Add measurable impact in examples</li>
            <li>Expand on trade-off decisions</li>
          </ul>
        </div>
      </div>

      <article className="mt-6 rounded-2xl border border-slatepro-400/20 bg-navy-900/65 p-5 text-sm leading-relaxed text-slatepro-200">
        <ul className="space-y-2">
          {feedbackLines.map((line, index) => (
            <li key={`${line}-${index}`} className="flex gap-2">
              <span className="mt-[2px] text-accent-400">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </article>

      <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} type="button" className="btn-primary mt-7" onClick={onRestart}>
        Start New Interview
        <MoveRight size={16} />
      </motion.button>
    </motion.section>
  );
}

function App() {
  const [stage, setStage] = useState("upload");
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [qaPairs, setQaPairs] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentQuestion = questions[currentIndex] || "";
  const latestEvaluation = evaluations[evaluations.length - 1] || null;

  useEffect(() => {
    if (stage !== "interview") {
      return undefined;
    }
    const timer = setInterval(() => setElapsedSeconds((previous) => previous + 1), 1000);
    return () => clearInterval(timer);
  }, [stage]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Attach your resume PDF to continue.");
      return;
    }

    let pulse;
    try {
      setLoading(true);
      setError("");
      setUploadProgress(8);

      pulse = setInterval(() => {
        setUploadProgress((previous) => clamp(previous + Math.random() * 14, 8, 92));
      }, 260);

      const data = await uploadResume(file);
      const loadedQuestions = Array.isArray(data.questions) ? data.questions.filter(Boolean) : [];
      if (!loadedQuestions.length) {
        throw new Error("No interview questions were generated.");
      }

      setUploadProgress(100);
      setQuestions(loadedQuestions);
      setCurrentIndex(0);
      setQaPairs([]);
      setEvaluations([]);
      setFeedback("");
      setAnswer("");
      setElapsedSeconds(0);
      setStage("interview");
      speakText(loadedQuestions[0]);
    } catch (uploadError) {
      setError(uploadError.message || "Unable to process this resume.");
    } finally {
      clearInterval(pulse);
      setTimeout(() => {
        setLoading(false);
        setUploadProgress(0);
      }, 240);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      setError("Please answer the question before submitting.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await submitAnswer({
        question: currentQuestion,
        answer,
        all_questions: questions
      });

      const updatedPairs = [...qaPairs, { question: currentQuestion, answer }];
      const updatedEvaluations = [
        ...evaluations,
        {
          sentiment: response.sentiment,
          score: response.score,
          metrics: response.metrics || {
            technicalDepth: 0,
            communication: 0,
            confidence: 0,
            problemSolving: 0
          }
        }
      ];

      setQaPairs(updatedPairs);
      setEvaluations(updatedEvaluations);
      setAnswer("");

      const isLastQuestion = currentIndex >= questions.length - 1;
      if (isLastQuestion) {
        const finalData = await getFinalFeedback(updatedPairs);
        setFeedback(finalData.feedback || "Interview complete.");
        setStage("result");
      } else {
        const next = currentIndex + 1;
        setCurrentIndex(next);
        speakText(questions[next]);
      }
    } catch (submitError) {
      setError(submitError.message || "Unable to evaluate the answer.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setStage("upload");
    setFile(null);
    setUploadProgress(0);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswer("");
    setQaPairs([]);
    setEvaluations([]);
    setFeedback("");
    setElapsedSeconds(0);
    setError("");
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8 md:py-10">
      <BackgroundDecor />

      <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 mx-auto mb-8 flex w-full max-w-5xl items-center justify-between">
        <div className="chip">
          <Bot size={14} />
          Interview Bot Pro
        </div>
        <div className="chip">
          <Sparkles size={14} />
          AI Technical Assessment Platform
        </div>
      </motion.header>

      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {stage === "upload" && (
            <UploadView
              key="upload"
              file={file}
              setFile={setFile}
              loading={loading}
              uploadProgress={uploadProgress}
              error={error}
              onSubmit={handleUpload}
            />
          )}

          {stage === "interview" && (
            <InterviewView
              key="interview"
              questionIndex={currentIndex}
              totalQuestions={questions.length}
              currentQuestion={currentQuestion}
              answer={answer}
              setAnswer={setAnswer}
              latestEvaluation={latestEvaluation}
              elapsedSeconds={elapsedSeconds}
              loading={loading}
              error={error}
              onSubmit={handleSubmitAnswer}
              onReadQuestion={() => speakText(currentQuestion)}
              onVoiceAnswer={() =>
                startListening(
                  (transcript) => setAnswer(transcript),
                  (listenError) => setError(listenError)
                )
              }
            />
          )}

          {stage === "result" && (
            <FeedbackView key="result" feedback={feedback} evaluations={evaluations} qaPairs={qaPairs} onRestart={handleRestart} />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export default App;
