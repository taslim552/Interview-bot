# Deployment Guide (Render + Vercel)

This guide deploys:

- Backend (Node/Express) on Render
- Frontend (React/Vite) on Vercel

## 1. Push Project to GitHub

Push this repository so both Render and Vercel can import it.

## 2. Deploy Backend on Render

### Option A: Blueprint (recommended)

1. In Render, choose "New +" -> "Blueprint".
2. Connect your GitHub repo.
3. Render will detect `render.yaml` from project root.
4. Create service.
5. In service environment variables, set:
   - `FRONTEND_ORIGIN` = your Vercel URL (for example `https://your-app.vercel.app`)
   - `GEMINI_API_KEY` = your Gemini API key
   - `MONGO_URI` = your MongoDB connection string (optional)

### Option B: Manual web service

1. In Render, create "Web Service".
2. Set Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add same env vars as above.

### Verify backend

Open:

- `https://<your-render-service>/health`

Expected response includes `{"status":"ok"...}`.

## 3. Deploy Frontend on Vercel

1. In Vercel, import the same repository.
2. Set Root Directory: `frontend`
3. Vercel will use `frontend/vercel.json`.
4. Add env var:
   - `VITE_API_BASE_URL` = your Render backend URL (for example `https://your-api.onrender.com`)
5. Deploy.

## 4. Wire CORS Correctly

After frontend deployment:

1. Copy the Vercel production URL.
2. Go to Render backend env vars.
3. Set `FRONTEND_ORIGIN` to that exact URL.
4. Redeploy backend.

## 5. End-to-End Smoke Test

1. Open frontend URL.
2. Upload a PDF resume.
3. Ensure questions are generated.
4. Submit answers.
5. Confirm final feedback is returned.

## Troubleshooting

- CORS blocked:
  - `FRONTEND_ORIGIN` does not exactly match Vercel URL.
- AI fallback behavior appears:
  - `GEMINI_API_KEY` missing/invalid.
- Feedback not persisted:
  - `MONGO_URI` missing/unreachable (app still works without DB persistence).
