<div align="center">

# 🎓 Easy English

### English learning platform with a live AI teacher, speech correction and signed certificates

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-8E75B2?logo=google&logoColor=white)](https://ai.google.dev)

</div>

---

## 📖 About the project

**Easy English** is an online English learning platform built around speech chunks, active listening, and spaced repetition (SRS). Its tutor, **Emma**, is powered by Google Gemini: she hears the student's real voice in a **live conversation** and teaches during it, corrects recorded speech with IPA (International Phonetic Alphabet) feedback tuned to Brazilian pronunciation habits, and translates on demand. The platform also handles **enrolment and payment**, **signed certificates with public verification**, and ships a **complete administrative panel**.

The flagship curriculum, **"Inglês Destravado — 4 Cantos"**, consists of **52 circuits** and **728 deterministic lessons** pre-written directly into the repository, ensuring zero AI hallucination for core course content, complete privacy, offline resilience, and fast load times.

---

## ✨ Features

- **📚 728 Deterministic Lessons** — 52 circuits across 4 corners (*Cantos*) and 3 study tracks (*Essencial*, *Completo*, *Intensivo*), pre-written in the repository: no AI hallucination in core content, and no API cost to read a lesson.
- **🧩 Connective Grammar Layer** — cumulative explanations of the glue words a Brazilian cannot guess (*is / are / was / were / -ing*), so the student says *"Mike and Ana were talking"* instead of *"Mike and Ana is speaking"*. Authored for **Canto 1** (circuits 1–13), where the gap does the most damage; the remaining corners still run on chunks alone.
- **🎙️ Emma, Live Voice Conversation** — real-time voice through the Gemini Live API, with single-use ephemeral tokens and make-before-break reconnection, so the ten-minute server cut-off is invisible to the student. See **Teacher mode** below.
- **🗣️ Speech Correction** — Emma listens to a recording and returns transcript, IPA, a Portuguese respelling of the target sound, what she actually heard, and scores per dimension. Grounded in a guide of predictable Brazilian interference (TH, epenthetic vowels, final -ED, dark L, false friends).
- **🌐 Translator, typed or spoken** — two tabs. *Digitar* translates text with pronunciation, IPA and examples; *Falar* recognises speech in the browser (no API quota) and sends only the finished sentence to Gemini, so the translation appears with no perceptible delay.
- **🔊 Neural Audio with Browser Fallback** — dialogues and chunks are pre-generated as neural audio files; anything not yet generated falls back to the system voice, transparently and mid-lesson.
- **🧠 Spaced Repetition (SRS)** — SM-2 adapted for spoken production: a chunk only advances when the student actually says it, in a lesson or in a live conversation.
- **🔍 pgvector Grounding (RAG)** — the curriculum is indexed into Supabase `pgvector` and retrieved to anchor speech correction, live conversation and translation in the course's own material.
- **📈 Progress, Streak and Schedule** — daily goal in minutes, study-consistency calendar, streak, and a schedule that adapts to the chosen track.
- **🎓 Signed Certificates** — issued with a code and an HMAC signature, verifiable by anyone at a public URL or by QR code, with the course average computed from the last evaluated recording of each lesson.
- **💳 Enrolment and Payment** — Mercado Pago checkout with installments, webhook-driven access grants, and a paywall enforced in the database (RLS), not only in the interface.
- **🛡️ Security & RBAC** — Row Level Security for `student`, `instructor` and `admin`, `SECURITY DEFINER` helpers with `EXECUTE` revoked from `PUBLIC`, and private storage for student audio.
- **📊 Admin Panel** — users, courses, lesson editor, payments, certificates, submitted speech practices, and an audit log.

### 👩‍🏫 Teacher mode (Professora)

The live room has two modes, and the student owns the switch.

**Professora** is the default. Emma teaches while she talks, in this priority order:

1. **Combinations no American would say** — the hardest error for a Brazilian to catch, because every individual word is correct. *"My computer is problem"* becomes *"My computer is acting up"*.
2. **Structure a native would never produce** — *"Mike and Ana is talking"*, *"I have 30 years"*.
3. **False friends** — *actually*, *pretend*, *library*, *parents*.
4. **Pronunciation**, and only when a native would misunderstand the word. An accent is not an error.

Each correction is given as natural English first, then a single sentence of Portuguese explaining why, then a request to say it once. **One correction per turn, never mid-sentence**: a student corrected on everything stops talking.

**Só conversa** is pure conversation, correcting only what blocks understanding.

The student switches by voice, mid-sentence, in either language — *"vamos só conversar agora"*, *"volta a corrigir"* — or with the toggle under the timer. The mode travels with every connection, so the reconnection at ten minutes does not silently restore the default, and a mode asked for out loud outranks the one the session started in.

---

## 🖥️ Screens

**Student** — `/app`

| Route | Screen | What it does |
|---|---|---|
| `/app` | Meu Painel | Today's lesson, streak, goal and shortcuts |
| `/app/licao/[day]` | Lição | Lesson player: audio, blocks, speech challenge |
| `/app/canto/[code]` | Canto | Map of the 13 circuits of a corner |
| `/app/cronograma` | Cronograma | Full schedule for the chosen track |
| `/app/ao-vivo` | Conversa ao vivo | Live voice with Emma, Professora / Só conversa |
| `/app/conversacao` | Praticar fala | Record, send, and get the correction with IPA |
| `/app/revisao` | Revisão espaçada | SRS queue of chunks due today |
| `/app/tradutor` | Tradutor | Translate by typing or by speaking |
| `/app/progresso` | Meu progresso | Charts, study consistency, evolution |
| `/app/certificado` | Meu Certificado | Issue and download, with verification QR |
| `/app/perfil` | Meu perfil | Level, timezone, daily goal, photo |

**Admin** — `/admin`

| Route | Screen | What it does |
|---|---|---|
| `/admin` | Visão geral | Platform indicators |
| `/admin/usuarios` | Usuários | Roles, status, access |
| `/admin/cursos` | Cursos | Courses and publication |
| `/admin/licoes` · `/[id]` | Lições | List and lesson editor |
| `/admin/conversacao` | Práticas de fala | Recordings submitted by students |
| `/admin/pagamentos` | Pagamentos | Orders, grants and courtesy access |
| `/admin/certificados` | Certificados | Issued certificates and reissues |
| `/admin/auditoria` | Auditoria | Log of administrative actions |

**Public and account**

| Route | Screen |
|---|---|
| `/` | Landing page |
| `/login` · `/cadastro` · `/recuperar-senha` · `/nova-senha` | Authentication |
| `/verificar-email` · `/conta-bloqueada` | Account status |
| `/checkout` · `/checkout/retorno` | Enrolment and payment return |
| `/verificar-certificado` · `/[code]` | Public certificate verification |

**API routes**

| Route | What it does |
|---|---|
| `POST /api/live/token` | Ephemeral Gemini Live token; builds Emma's system instruction |
| `POST /api/speaking/analyze` | Receives the audio, stores it, returns the correction |
| `GET /api/speaking/audio` | Serves the student's own recording from the private bucket |
| `POST /api/pagamentos/webhook` | Mercado Pago notification, releases access |

---

## 🛠️ Technologies

| Layer | Stack |
|---|---|
| **Front-end** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, Lucide Icons |
| **Artificial Intelligence** | Google Gemini — `gemini-3.6-flash` (hears speech), `gemini-3.1-flash-lite` (text: translation and evaluation), Live Preview (real-time voice), Embeddings (RAG) |
| **Back-end & Database** | Supabase (PostgreSQL, Auth, Storage, `pgvector`, RLS) |
| **Audio & Speech** | Pre-generated neural audio, Web Speech API (synthesis and recognition), Web Audio API, AudioWorklet |
| **Payments** | Mercado Pago (Checkout Pro, webhook, installments) |
| **Algorithms** | SM-2 Spaced Repetition, Deterministic Circuit Composer, HMAC certificate signature |
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

# Site and certificates
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_CERTIFICATE_BASE_URL=https://your-domain.com

# Payments (Mercado Pago)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-your-token
MERCADOPAGO_WEBHOOK_SECRET=your-webhook-secret
CHECKOUT_PRICE_CENTS=19700

# Bootstrap Admin
ADMIN_BOOTSTRAP_EMAILS=your-email@domain.com
```

The model for each task is overridable (`GEMINI_MODEL_SPEAKING`, `GEMINI_MODEL_TUTOR`,
`GEMINI_MODEL_LIVE`, `GEMINI_MODEL_EMBEDDING`) — quota on the free tier is counted per
project **and per model**, so pointing two tasks at the same model makes them compete.
Audio generation can run through Vertex AI (`VERTEX_CREDENTIALS`) to escape the
per-day cap of the TTS preview models. The full list is in
[`.env.example`](.env.example).

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

# Index lessons into pgvector, to ground the AI in the course material
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

Every day of a circuit is composed deterministically from the same source: the
circuit's chunks, its situation, and the connective grammar accumulated up to
that point. The student meets a chunk in listening, produces it out loud, and
only then does it enter the spaced-repetition queue — a chunk that was never
spoken never counts as learned.

---

## 📂 Project Structure

```
├── content/             # 52 circuits, 728 lessons & deterministic lesson composer
│   ├── circuits/        # Canto 1 to Canto 4, chunks and connective grammar blocks
│   └── compose-lesson.ts# Deterministic 14-day lesson generator
├── public/audio/        # Pre-generated neural audio for dialogues and chunks
├── scripts/             # Seeding, content validation, audio generation, diagnostics
├── supabase/            # Migrations, bundled schema, RLS policies & buckets
├── src/
│   ├── app/             # App Router: landing, auth, /app (student), /admin, /api
│   ├── components/      # audio · lesson · live · speaking · translator · certificate · ui
│   ├── lib/
│   │   ├── gemini/      # Prompts, client with retry, speech analysis, live-prompt, RAG
│   │   ├── srs.ts       # SM-2 adapted for spoken production
│   │   ├── certificate.ts # Issuing, signature and verification
│   │   └── supabase/    # Browser, server and service-role clients
│   └── types/           # TypeScript interfaces and schema types
├── DEPLOY.md            # Hostinger Node.js deployment documentation
└── README.md            # Project documentation
```

---

## 📜 Available Scripts

**Everyday**

| Command | Description |
|---|---|
| `npm run dev` | Development environment |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript static type checking |

**Content and curriculum**

| Command | Description |
|---|---|
| `npm run verify:content` | Validate the 728 lessons without touching the database |
| `npm run seed:curriculum` | Publish 4 corners, 52 circuits and 728 lessons |
| `npm run index:knowledge` | Index the curriculum into pgvector for RAG |
| `npm run gen:listening` | Generate the listening exercises |
| `npm run gen:pronuncia` | Generate the respelling of every English the student reads |

**Audio**

| Command | Description |
|---|---|
| `npm run gen:audio` | Generate the neural audio for dialogues and chunks, stopping at the quota |
| `npm run gen:audio:setup` | Install Piper TTS and download the local voices |
| `npm run audio:start` · `audio:status` · `audio:stop` | Long batch as a background daemon |
| `npm run rebuild:audio` | Resynthesise the whole course from scratch |
| `npm run check:audio` | Audit the generated files: presence, size, truncation |
| `npm run cleanup:audio` | List and remove leftovers from API-generated audio |

**Database and administration**

| Command | Description |
|---|---|
| `npm run db:bundle` | Regenerate `supabase/schema.sql` from the migrations |
| `npm run db:push` · `db:reset` | Apply or rebuild the schema via Supabase CLI |
| `npm run bootstrap:admin` | Promote an email address to administrator |

**Diagnostics**

| Command | Description |
|---|---|
| `npm run check` | Environment, database, storage and API end-to-end |
| `npm run check:seguranca` | Audit secrets, permissions and exposure |
| `npm run check:pagamento` | Validate the Mercado Pago integration |
| `npm run check:email` | Diagnose Supabase Auth email delivery |
| `npm run check:qr` | Decode the generated QR independently and compare it |
| `npm run models` | List the Gemini models your API key can reach |
| `npm run compare:fala` | Compare speech-correction models on real audio |
| `npm run gen:icons` | Regenerate the PWA icons |

---

## 👨‍💻 Developer

Developed by **Silas Silva**.

---

<div align="center">

⭐ If this project helped you, consider giving it a star.

</div>
