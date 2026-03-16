# Vox — Ask Your Database Anything

Connect your PostgreSQL database and query it in plain English. Vox uses AI to generate SQL, streams results in real time, and displays data in clean, readable tables.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Auth & Backend:** Supabase (GitHub OAuth)
- **AI:** LangChain + LlamaIndex (via configurable LLM provider)
- **Styling:** Tailwind CSS, Framer Motion
- **Language:** TypeScript

## Setup

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Configure environment** — copy `.env.example` to `.env.local` and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

3. **Run the dev server**

   ```bash
   bun dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Key Features

- **Natural language queries** — ask questions in plain English, get precise read-only SQL
- **Real-time streaming** — watch SQL generation and results arrive via SSE
- **Instant visualization** — results displayed in sortable tables, right in the chat
