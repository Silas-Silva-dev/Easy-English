/**
 * Tipos do banco escritos a mao para espelhar `supabase/migrations`.
 * Se voce alterar o schema, rode:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/types/database.ts
 */

export type UserRole = "student" | "instructor" | "admin";
export type AccountStatus = "pending_verification" | "active" | "suspended" | "banned";
export type EnrollmentStatus = "active" | "paused" | "completed" | "cancelled";
export type ProgressStatus = "not_started" | "in_progress" | "completed";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";
export type SpeakingStatus = "uploaded" | "processing" | "completed" | "failed";
export type PaymentStatus =
  | "pending"
  | "in_process"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";
/** De onde veio o direito de estudar: compra aprovada ou liberação do admin. */
export type AccessSource = "payment" | "courtesy";
export type LessonKind =
  | "vocabulary"
  | "grammar"
  | "listening"
  | "speaking"
  | "dialogue"
  | "review"
  | "assessment";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type StudyTrack = "essential" | "complete" | "intensive";

export interface TrackTarget {
  track: StudyTrack;
  label: string;
  daily_minutes: number;
  total_hours: number;
  cefr_target: CefrLevel;
  promise: string;
  honest_limit: string;
}

export interface AuthenticInputItem {
  kind: "series" | "podcast" | "video" | "news" | "music" | "social";
  title: string;
  search: string;
  why: string;
  minutes: number;
}

/** Atividades extras liberadas conforme a trilha do aluno. */
export interface LessonExtensions {
  shadowing?: { script: string; instruction: string };
  authentic_input?: AuthenticInputItem[];
  live_prompt?: string;
  srs_target?: number;
}

export interface ChunkMasteryRow {
  id: string;
  user_id: string;
  course_id: string;
  circuit_number: number;
  chunk_key: string;
  chunk_en: string;
  chunk_pt: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_date: string;
  last_grade: number | null;
  last_reviewed_at: string | null;
  spoken_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChunkReviewQueue {
  user_id: string;
  due_today: number;
  due_tomorrow: number;
  total_chunks: number;
  mastered: number;
  struggling: number;
}

export interface LiveSession {
  id: string;
  user_id: string;
  course_id: string | null;
  lesson_id: string | null;
  circuit_number: number | null;
  scenario: string | null;
  model: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  turns: number;
  transcript: { role: "user" | "model"; text: string; at: number }[];
  summary_pt: string | null;
  scores: Json;
  chunks_used: string[];
  created_at: string;
}

/** Bloco de conteudo renderizado no player de licao. */
export type LessonBlock =
  | { type: "text"; title?: string; body: string }
  | { type: "callout"; variant?: "tip" | "warning" | "culture"; title?: string; body: string }
  | { type: "dialogue"; title?: string; lines: { speaker: string; en: string; pt?: string }[] }
  | { type: "examples"; title?: string; items: { en: string; pt: string; note?: string }[] }
  | { type: "drill"; title?: string; instruction: string; items: string[] }
  | { type: "practice"; title?: string; instruction: string; prompts: string[] };

export interface LessonContent {
  warmup?: string;
  blocks?: LessonBlock[];
  /**
   * Blocos que só aparecem depois do portão de imersão (dia 1 de cada circuito).
   * Ficam separados de `blocks` porque o player renderiza `blocks` sempre: se
   * a transcrição estivesse lá, o portão de escuta não valeria nada.
   */
  gated?: LessonBlock[];
  summary?: string;
  homework?: string;
}

export interface VocabularyItem {
  term: string;
  translation: string;
  ipa?: string;
  example?: string;
  exampleTranslation?: string;
}

export interface PhraseItem {
  en: string;
  pt: string;
  context?: string;
}

/**
 * A unidade de aprendizado do curso: um bloco de fala pronto, memorizado
 * inteiro e reaproveitado trocando peças.
 */
export interface Chunk {
  en: string;
  pt: string;
  /** O gatilho de memória: quando usar este bloco. */
  when?: string;
  ipa?: string;
}

/** Uma situação real, trabalhada em 14 dias. */
export interface Circuit {
  id: string;
  course_id: string;
  module_id: string;
  number: number;
  title: string;
  situation: string;
  pattern: string | null;
  pattern_note: string | null;
  chunks: Chunk[];
  mission: string | null;
  mindset_note: string | null;
  pitfall: string | null;
  review_circuits: number[];
  level: CefrLevel;
  is_published: boolean;
  /** O que a fase B (dias 8-14) faz com a situação adquirida na fase A. */
  week_b_focus: string | null;
  authentic_input: AuthenticInputItem[];
  live_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export interface SpeakingRubricItem {
  criterion: string;
  description: string;
}

export interface SpeakingCorrection {
  original: string;
  corrected: string;
  explanation_pt: string;
  category: "pronunciation" | "grammar" | "vocabulary" | "fluency" | "naturalness";
  severity: "low" | "medium" | "high";
}

export interface PronunciationNote {
  word: string;
  ipa: string;
  heard: string;
  tip_pt: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: AccountStatus;
  native_language: string;
  target_level: CefrLevel;
  /** Preferência de ritmo. A trilha que vale é a de `enrollments.track`. */
  preferred_track: StudyTrack;
  daily_goal_minutes: number;
  timezone: string;
  phone: string | null;
  bio: string | null;
  email_verified_at: string | null;
  onboarded_at: string | null;
  last_seen_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  language: string;
  level_from: CefrLevel;
  level_to: CefrLevel;
  cover_url: string | null;
  accent_color: string | null;
  duration_days: number;
  daily_minutes: number;
  /** Media minima nas avaliacoes de fala exigida para emitir o certificado. */
  min_certificate_score: number;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseModule {
  id: string;
  course_id: string;
  position: number;
  code: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  level: CefrLevel;
  week_start: number;
  week_end: number;
  objectives: string[];
  can_do: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  module_id: string;
  day_number: number;
  /** Número do circuito (1..52) ao qual este dia pertence. */
  week_number: number;
  /**
   * Posição do dia DENTRO do circuito (1..14).
   *
   * Deliberadamente não existe "dia da semana" aqui: o cronograma é "Dia 1,
   * Dia 2, Dia 3…" e não segunda-a-domingo. Quem começa numa quinta não pode
   * receber a lição de sexta como se fosse a segunda aula.
   */
  circuit_day: number;
  title: string;
  subtitle: string | null;
  kind: LessonKind;
  level: CefrLevel;
  estimated_minutes: number;
  objective: string | null;
  content: LessonContent;
  vocabulary: VocabularyItem[];
  phrases: PhraseItem[];
  /** Nota curta "por que funciona assim": nunca titula a lição. */
  grammar_focus: string | null;
  grammar_explanation: string | null;
  listening_script: string | null;
  speaking_prompt: string | null;
  speaking_rubric: SpeakingRubricItem[];
  quiz: QuizQuestion[];
  // --- método "Blocos e Situações" (migration 20260101000300) ---
  circuit_id: string | null;
  chunks: Chunk[];
  situation: string | null;
  pattern: string | null;
  mission: string | null;
  mindset_note: string | null;
  /** Áudio ouvido ANTES de qualquer texto, no dia 1. */
  immersion_script: string | null;
  /** Circuitos revisados neste dia (revisão espaçada do dia 6). */
  review_of: number[];
  // --- 700h / trilhas (migration 20260101000400) ---
  /** 'A' = aquisição (dias 1-7) · 'B' = consolidação (dias 8-14) */
  phase: "A" | "B";
  extensions: LessonExtensions;
  core_minutes: number;
  is_published: boolean;
  generated_by: string | null;
  generated_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: EnrollmentStatus;
  /** Ritmo diário escolhido. Define a meta prometida e os blocos do dia. */
  track: StudyTrack;
  current_day: number;
  streak_current: number;
  streak_longest: number;
  minutes_total: number;
  lessons_completed: number;
  last_activity_date: string | null;
  started_at: string;
  target_end_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonProgress {
  id: string;
  enrollment_id: string;
  user_id: string;
  lesson_id: string;
  status: ProgressStatus;
  score: number | null;
  quiz_answers: Json;
  minutes_spent: number;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyDay {
  id: string;
  user_id: string;
  enrollment_id: string;
  study_date: string;
  minutes: number;
  lessons_done: number;
  goal_met: boolean;
  created_at: string;
}

export interface SpeakingSession {
  id: string;
  user_id: string;
  course_id: string | null;
  lesson_id: string | null;
  prompt: string;
  level: CefrLevel;
  audio_path: string;
  audio_mime: string;
  duration_seconds: number | null;
  status: SpeakingStatus;
  transcript: string | null;
  model: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpeakingFeedback {
  id: string;
  session_id: string;
  user_id: string;
  overall_score: number;
  pronunciation_score: number;
  fluency_score: number;
  grammar_score: number;
  vocabulary_score: number;
  task_score: number | null;
  estimated_level: CefrLevel | null;
  corrected_text: string | null;
  summary_pt: string | null;
  encouragement_pt: string | null;
  corrections: SpeakingCorrection[];
  pronunciation_notes: PronunciationNote[];
  suggested_phrases: PhraseItem[];
  next_steps: string[];
  raw: Json;
  created_at: string;
}

export interface TutorThread {
  id: string;
  user_id: string;
  lesson_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface TutorMessage {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  citations: { lesson_id: string | null; title: string; snippet: string }[];
  created_at: string;
}

export interface KnowledgeDocument {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  title: string;
  source: string;
  checksum: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  course_id: string | null;
  lesson_id: string | null;
  chunk_index: number;
  content: string;
  metadata: Json;
  embedding: number[] | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Json;
  created_at: string;
}

/**
 * Um pedido de compra. Todo valor monetário é inteiro em centavos: `297.00`
 * em ponto flutuante não sobrevive a uma soma de extrato sem divergir.
 */
export interface Order {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  amount_cents: number;
  currency: string;
  description: string | null;
  status: PaymentStatus;
  provider: string;
  preference_id: string | null;
  init_point: string | null;
  /** Chave que amarra o pedido ao webhook do Mercado Pago. */
  external_reference: string;
  payment_id: string | null;
  /** credit_card · debit_card · bank_transfer (PIX) */
  payment_type: string | null;
  payment_method: string | null;
  status_detail: string | null;
  installments: number | null;
  installment_amount_cents: number | null;
  /** Com juros do comprador este valor é MAIOR que `amount_cents`. */
  total_paid_cents: number | null;
  /** Líquido creditado depois da taxa do Mercado Pago. */
  net_received_cents: number | null;
  paid_at: string | null;
  expires_at: string | null;
  raw: Json;
  created_at: string;
  updated_at: string;
}

export interface AccessGrant {
  id: string;
  user_id: string;
  source: AccessSource;
  order_id: string | null;
  granted_by: string | null;
  note: string | null;
  starts_at: string;
  /** Nulo = vitalício, que é o padrão da compra única. */
  expires_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
}

export interface AdminBillingOverview {
  paid_orders: number;
  pending_orders: number;
  rejected_orders: number;
  refunded_orders: number;
  gross_cents: number;
  net_cents: number;
  paid_orders_30d: number;
  gross_cents_30d: number;
  active_grants: number;
  courtesy_grants: number;
}

export interface AdminOverview {
  total_users: number;
  active_users: number;
  pending_users: number;
  blocked_users: number;
  new_users_30d: number;
  total_courses: number;
  published_courses: number;
  total_lessons: number;
  published_lessons: number;
  active_enrollments: number;
  speaking_sessions: number;
  speaking_sessions_7d: number;
  avg_speaking_score: number;
}

/**
 * O postgrest-js exige que cada `Row` seja atribuível a `Record<string, unknown>`.
 * Uma `interface` não satisfaz isso (só `type` ganha index signature implícita),
 * então passamos tudo por um mapped type homomórfico: que satisfaz.
 */
type AsRecord<T> = { [K in keyof T]: T[K] };

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: AsRecord<Row>;
  Insert: AsRecord<Insert>;
  Update: AsRecord<Update>;
  Relationships: [];
};

type View<Row> = {
  Row: AsRecord<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile>;
      admin_allowlist: Table<{ email: string; note: string | null; created_at: string }>;
      courses: Table<Course>;
      modules: Table<CourseModule>;
      circuits: Table<Circuit>;
      lessons: Table<Lesson>;
      lesson_resources: Table<{
        id: string;
        lesson_id: string;
        kind: string;
        title: string;
        url: string | null;
        storage_path: string | null;
        meta: Json;
        position: number;
        created_at: string;
      }>;
      enrollments: Table<Enrollment>;
      lesson_progress: Table<LessonProgress>;
      study_days: Table<StudyDay>;
      speaking_sessions: Table<SpeakingSession>;
      speaking_feedback: Table<SpeakingFeedback>;
      tutor_threads: Table<TutorThread>;
      tutor_messages: Table<TutorMessage>;
      knowledge_documents: Table<KnowledgeDocument>;
      knowledge_chunks: Table<KnowledgeChunk>;
      audit_log: Table<AuditLogEntry>;
      track_targets: Table<TrackTarget>;
      chunk_mastery: Table<ChunkMasteryRow>;
      live_sessions: Table<LiveSession>;
      orders: Table<Order>;
      access_grants: Table<AccessGrant>;
      certificates: Table<Certificate>;
    };
    Views: {
      admin_overview: View<AdminOverview>;
      admin_billing_overview: View<AdminBillingOverview>;
      chunk_review_queue: View<ChunkReviewQueue>;
    };
    Functions: {
      register_study_activity: {
        Args: { p_enrollment_id: string; p_minutes?: number; p_lessons_done?: number };
        Returns: Enrollment;
      };
      match_knowledge: {
        Args: {
          query_embedding: number[];
          match_count?: number;
          filter_course?: string | null;
          similarity_floor?: number;
        };
        Returns: {
          id: string;
          lesson_id: string | null;
          content: string;
          metadata: Json;
          similarity: number;
        }[];
      };
      enroll_circuit_chunks: {
        Args: { p_course_id: string; p_circuit_number: number };
        Returns: number;
      };
      review_chunk: {
        Args: { p_chunk_key: string; p_grade: number };
        Returns: ChunkMasteryRow;
      };
      mark_chunks_spoken: { Args: { p_chunk_keys: string[] }; Returns: number };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      has_course_access: { Args: { p_user?: string }; Returns: boolean };
      /** Só alcançável com service_role: ver os GRANTs da migration 700. */
      grant_course_access: {
        Args: {
          p_user: string;
          p_source: AccessSource;
          p_order_id?: string | null;
          p_granted_by?: string | null;
          p_note?: string | null;
          p_expires_at?: string | null;
        };
        Returns: AccessGrant;
      };
      revoke_course_access: { Args: { p_user: string; p_reason?: string | null }; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      payment_status: PaymentStatus;
      access_source: AccessSource;
      account_status: AccountStatus;
      enrollment_status: EnrollmentStatus;
      progress_status: ProgressStatus;
      cefr_level: CefrLevel;
      lesson_kind: LessonKind;
      speaking_status: SpeakingStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  enrollment_id: string | null;
  code: string;
  hash_signature: string;
  student_name: string;
  course_title: string;
  workload_hours: number;
  average_score: number;
  completed_at: string;
  issued_at: string;
  metadata: {
    cefr_level?: CefrLevel;
    modules_completed?: number;
    total_lessons?: number;
    track_name?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface CertificateEligibility {
  isEligible: boolean;
  publishedLessons: number;
  completedLessons: number;
  lessonsProgressPct: number;
  averageScore: number;
  /** Quantas avaliacoes de fala o aluno ja tem. Sem nenhuma, nao ha media. */
  speakingEvaluations: number;
  minScoreRequired: number;
  calculatedWorkloadHours: number;
  reasons: string[];
}

