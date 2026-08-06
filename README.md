<div align="center">

# 🎓 Easy English

### Complete English learning platform with AI tutor, speech correction, and live voice conversation

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-8E75B2?logo=google&logoColor=white)](https://ai.google.dev)

</div>

---

## 📖 About the project

**Easy English** is an online English learning platform built around speech chunks, active listening, and spaced repetition (SRS). It features an **AI Tutor powered by Google Gemini** that listens to student recordings to correct pronunciation using IPA (International Phonetic Alphabet), an interactive **Live Voice Conversation** mode, a **Knowledge RAG Chat** for answering grammar and lesson questions, and a **complete administrative panel**.

The flagship curriculum, **"Inglês Destravado — 4 Cantos"**, consists of **52 circuits** and **728 deterministic lessons** pre-written directly into the repository, ensuring zero AI hallucination for core course content, complete privacy, offline resilience, and fast load times.

---

## ✨ Features

- **📚 728 Deterministic Lessons** — 52 circuits divided into 4 corners (*Cantos*) across 3 flexible study tracks (*Essencial*, *Completo*, *Intensivo*).
- **🤖 AI Tutor & Speech Correction** — Gemini AI listens to student voice recordings, transcribes spoken words, and provides phonetic (IPA) feedback.
- **🎙️ Live Voice Conversation** — Real-time interactive conversation practice powered by Gemini Live API via single-use ephemeral tokens.
- **🔊 Native Browser Audio** — Zero API cost speech synthesis using Web Speech API with dual-voice dialogues.
- **🧠 Spaced Repetition System (SRS)** — SM-2 algorithm customized for spoken production and active recall memory.
- **🔍 Knowledge RAG Assistant** — AI doubts assistant integrated with Supabase `pgvector` to answer questions citing exact lesson content.
- **🛡️ Security & Role-Based Access (RBAC)** — Row Level Security (RLS) in Postgres for `student`, `instructor`, and `admin` roles.
- **📊 Admin Dashboard** — Management panel for users, progress auditing, curriculum verification, and system status checks.

---

## 🛠️ Technologies

| Layer | Stack |
|---|---|
| **Front-end** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, Lucide Icons |
| **Artificial Intelligence** | Google Gemini API (`gemini-3.6-flash`, Live Preview, Embeddings) |
| **Back-end & Database** | Supabase (PostgreSQL, Auth, Storage, `pgvector`, RLS) |
| **Audio & Speech** | Web Speech API (Local System Voices), Web Audio API |
| **Algorithms** | SM-2 Spaced Repetition, Deterministic Circuit Composer |
| **Deploy & Hosting** | Hostinger Node.js Web App / GitHub |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20.9+ and npm
- A project on [Supabase](https://supabase.com)
- A Google Gemini API Key on [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Installation
```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory (see `.env.example`):
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Gemini
GEMINI_API_KEY=AIzaSyYourGeminiApiKey

# Bootstrap Admin
ADMIN_BOOTSTRAP_EMAILS=your-email@domain.com
```

### 3. Database Setup
In the Supabase **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql) to create all tables, RLS policies, RPC functions, and storage buckets.

*Alternatively, using the Supabase CLI:*
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### 4. Curriculum Seeding & Indexing
```bash
# Validate lesson integrity
npm run verify:content

# Publish 4 corners, 52 circuits, and 728 lessons
npm run seed:curriculum

# Index lessons into pgvector for AI RAG Chat
npm run index:knowledge

# Promote your email to administrator
npm run bootstrap:admin -- your-email@domain.com
```

### 5. Development Environment
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Production Build
```bash
npm run build
```
For complete deployment instructions on Hostinger Node.js, see [`DEPLOY.md`](DEPLOY.md).

---

## 🎓 Curriculum & Methodology

| Track | Daily Time | Total Hours | Target Level | Outcome | Limit |
|---|---|---|---|---|---|
| **Essencial** | 20 min | 243 h | A2 | Independent basic communication | Not full fluency |
| **Completo** | 60 min | 728 h | B2 | Natural conversation with native speakers | Regional slang & niche humor |
| **Intensivo** | 100 min | 1213 h | C1 | Professional debate & work environments | High daily commitment |

---

## 📂 Project Structure

```
├── content/             # 52 circuits, 728 lessons & deterministic lesson composer
│   ├── circuits/        # Canto 1 to Canto 4 circuit definitions
│   └── compose-lesson.ts# Deterministic 14-day lesson generator
├── scripts/             # Seeding, verification, setup check & RAG indexers
├── supabase/            # Migrations, SQL schema, RLS policies & buckets
├── src/
│   ├── app/             # Next.js App Router (Auth, Student App, Admin, API routes)
│   ├── components/      # Audio player, speech recorder, lesson renderer & UI
│   ├── lib/             # Gemini AI prompts, Supabase clients, SRS & Speech API
│   └── types/           # TypeScript interfaces and schema types
├── DEPLOY.md            # Hostinger Node.js deployment documentation
└── README.md            # Project documentation
```

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development environment |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript static type checking |
| `npm run check` | Environment, database, storage & API diagnostic tool |
| `npm run models` | List Gemini AI models accessible by your API key |
| `npm run verify:content` | Validate integrity of 728 lessons without touching DB |
| `npm run seed:curriculum` | Publish 4 corners, 52 circuits, and 728 lessons |
| `npm run index:knowledge` | Index curriculum content into pgvector for RAG |
| `npm run bootstrap:admin` | Promote an email address to administrator |
| `npm run db:bundle` | Regenerate `supabase/schema.sql` from migrations |

---

## 👨‍💻 Developer

Developed by **Silas Silva**.

---

<div align="center">

⭐ If this project helped you, consider giving it a star.

</div>
