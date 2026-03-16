# CherryBot - MERN Interview Assistant

CherryBot is now a MERN-style project with a React frontend and a Node.js/Express backend API.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- NLP/Scoring: `natural`, `sentiment`
- Resume parsing: `pdf-parse`
- AI generation: Google Gemini (`@google/generative-ai`)

## Project Structure

```
backend/
	server.js
	package.json
	.env.example
frontend/
	src/
	package.json
	.env.example
```

## Run Locally

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env
```

Set `GEMINI_API_KEY` in `.env`, then run:

```bash
npm run dev
```

Backend URL: `http://localhost:5000`

Set `MONGO_URI` in `.env` if you want interview feedback and Q/A results to be stored in MongoDB.

### 2. Frontend

```bash
cd ../frontend
npm install
copy .env.example .env
npm run dev
```

Frontend URL: `http://localhost:5173`

## API Endpoints

- `POST /upload_resume` (multipart form-data, field name: `file`)
- `POST /submit_answer`
- `POST /final_feedback`
- `GET /health`

## Notes

- If `GEMINI_API_KEY` is missing, backend uses fallback question/feedback behavior.
- If `MONGO_URI` is missing, the app still runs and skips database persistence.
- Voice input/output is handled in the browser using Web Speech APIs.


