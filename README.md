 HEAD
# Assessment
=======
 HEAD
# Hair & Scalp Health Assessment Quiz — Zaftan Media

Full-stack build matching the product spec: gender-branching quiz (About Me →
Hair Health → Internal Health → Scalp Scan) ending in an AI-generated
personalized report.

- **frontend/** — React + Vite, single-page step flow, dark navy/glassmorphism UI
- **backend/** — Express API, calls the Anthropic API for scalp image moderation,
  stage classification, and the final report copy

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# then edit .env and paste your ANTHROPIC_API_KEY
npm run dev
```

Runs on `http://localhost:5000`. Health check: `GET /api/health`.

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL should point at your backend, default is fine for local dev
npm run dev
```

Runs on `http://localhost:5173`.

## 3. How the flow maps to the spec

| Spec section | Component |
|---|---|
| 3. About Me | `Section1AboutMe.jsx` — sets `gender`, the routing field |
| 4A/4B. Hair Health | `Section2Male.jsx` / `Section2Female.jsx` — Male path has the Stage 1 / Stage 2-3 / Stage 4-7 branching + hope messaging exactly as specced |
| 5A/5B. Internal Health | `Section3Male.jsx` / `Section3Female.jsx` |
| 6. Scalp Assessment | `Section4Scalp.jsx` — consent checkbox, front/top upload slots, calls `POST /api/quiz/analyze` |
| 7. Result Generation | `Result.jsx` — calls `POST /api/quiz/result`, shows reconciled stage, contributing factors, summary, CTA |

## 4. Backend endpoints

**`POST /api/quiz/analyze`**
```json
{
  "gender": "male",
  "selfReportedStage": "Stage 3",
  "images": [{ "base64Data": "...", "mediaType": "image/jpeg", "label": "front" }]
}
```
- Runs a moderation pass on every image first (rejects non-scalp / inappropriate images per spec section 6)
- Classifies stage using Norwood (male) or Ludwig (female) scale
- Confidence below 0.7 → returns `predictedStage: null` and `recommendConsultation: true`, matching the spec's "don't show a wrong hard number" fallback
- Flags `mismatchWithSelfReport` when AI stage disagrees with the user's self-report

**`POST /api/quiz/result`**
```json
{ "aboutMe": {...}, "hairHealth": {...}, "internalHealth": {...}, "scalpAnalysis": {...} }
```
- Returns `{ report: { finalStageClassification, contributingFactors, summary, recommendedNextStep } }`
- Prompted to stay reassuring/solution-oriented at every stage, never alarmist

## 5. Things intentionally left as your next steps

These were called out as "improvements" in the spec but need product decisions
before building, so they're not wired in yet:

- **WhatsApp OTP verification** — needs a Twilio/WhatsApp Business account
- **Save & resume via emailed link** — needs an email/SMS sending service + a database (right now quiz state lives only in React state, nothing is persisted)
- **Persisting submissions** — add a database (Postgres/Mongo) and a `POST /api/quiz/submit` that stores the full answer set once you're ready to log real users
- **Drop-off analytics tagging** — plug in whatever analytics tool you use (PostHog, GA, Mixpanel) on each `nextStep()` call in `QuizContext.jsx`

## 6. Notes on the AI calls

Both `/analyze` and `/result` use `claude-sonnet-4-6` and ask for raw JSON back,
which is parsed directly — no separate vision model or NSFW API needed, Claude
handles both the moderation check and the stage classification in one flow.
=======
# Assessment
cf0ec122c643da0d980f58ff8fa1955aed569b0f
 7cd84c1 (Clean initial commit)
