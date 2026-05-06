# PromptFlow Agent

PromptFlow Agent is a React + TypeScript frontend for turning short software requests into structured AI coding prompts, task trees, and exportable implementation plans.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Zustand
- Axios
- Backend target: Node.js Express or Laravel API
- Database target: PostgreSQL or MySQL
- AI provider: Gemini through backend only

## Run

```bash
npm install
npm run dev
```

Run the local Codex runner in another terminal when using Run/Stop from the UI:

```bash
npm run runner
```

Copy `.env.example` to `.env` when wiring a backend.

```bash
VITE_API_BASE_URL=http://localhost:3000/api
VITE_USE_MOCK_API=false
VITE_LOCAL_RUNNER_URL=http://127.0.0.1:8787
```

Never put `GEMINI_API_KEY` in a React public env file. Keep it in backend `.env`.

The runner listens on `127.0.0.1:8787`, opens macOS Terminal, and runs Codex with:

```bash
codex --dangerously-bypass-approvals-and-sandbox --cd <project> "<task prompt>"
```

## Architecture

Chi tiết kiến trúc, database schema, API routes, Gemini flow, task splitting algorithm và test plan nằm ở:

- `docs/PROMPTFLOW_AGENT_ARCHITECTURE.md`
