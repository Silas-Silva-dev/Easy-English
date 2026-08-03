# InglishEasy

Plataforma de cursos online com painel administrativo e **tutora de IA que ouve o aluno falar inglês e corrige a pronúncia**.

O primeiro curso é **"Inglês Destravado — 4 Cantos"**: 52 circuitos, 728 dias, três ritmos de estudo. Ele já está **escrito por inteiro** neste repositório — nenhuma lição é gerada no momento do uso.

## O curso é conteúdo, não geração

As 728 lições vivem em [`content/circuits/`](content/circuits/) e são expandidas por [`content/compose-lesson.ts`](content/compose-lesson.ts) de forma **determinística**: mesma entrada, mesma saída, sempre.

Isso é uma decisão, não uma limitação:

- **Você pode ler o curso inteiro antes do aluno ler.** Está tudo em texto, versionado, revisável em diff.
- **Não muda entre execuções.** Duas pessoas rodando o mesmo comando recebem exatamente o mesmo curso.
- **Não depende de cota, de rede nem de um modelo continuar existindo.**

Para mudar uma lição, edite o circuito correspondente em `content/circuits/canto-N.ts` e rode o seed de novo. `npm run verify:content` confere o curso inteiro sem tocar no banco.

## O cronograma não tem dia da semana

É **Dia 1, Dia 2, Dia 3** — nunca "segunda-feira". Um curso de dois anos amarrado ao calendário quebra na primeira vez que o aluno pula um dia, e todo aluno pula. Quem faz 4 dias numa semana e 9 na outra continua no Dia 13, sem dívida acumulada e sem a sensação de estar atrasado.

No banco isso é `lessons.circuit_day` (1..14, a posição dentro do circuito). Não existe coluna de dia da semana.

## As três trilhas — e o que cada uma realmente entrega

| Trilha | Por dia | Total | Meta | O que entrega | O que **não** entrega |
|---|---|---|---|---|---|
| **Essencial** | 20 min | 243 h | A2 | Você se vira sozinho: pedir, resolver, se apresentar, falar de você | Não é fluência. Numa roda de americanos falando rápido entre si, você ainda perde o fio |
| **Completo** | 60 min | 728 h | B2 | Você conversa sobre qualquer assunto com um nativo, sem ele desacelerar | Gíria regional muito específica e humor de nicho ainda escapam |
| **Intensivo** | 100 min | 1213 h | C1 | Você discute, argumenta e trabalha em inglês, inclusive em grupo | Exige 1h40 por dia, todo dia — a maioria não sustenta |

As estimativas sérias colocam B2 na casa das 600–700 horas. É por isso que a trilha Completo existe, e por isso a Essencial **não promete fluência**. Cada trilha carrega sua promessa e seu limite honesto no banco (`track_targets`), e os dois aparecem lado a lado na hora em que o aluno escolhe — não só na landing.

---

## Onde a IA entra (e onde não entra)

| Peça | Como funciona |
|---|---|
| **Conteúdo das 728 lições** | Redigido à mão, versionado no repositório. **Sem IA.** |
| **Áudio de diálogos e blocos** | Sintetizado no navegador pela Web Speech API. **Sem IA, sem API, sem cota.** |
| **Correção de fala (assíncrona)** | Gemini. Ouve a gravação, transcreve o que o aluno *realmente* disse e corrige pronúncia com IPA. |
| **Conversa ao vivo por voz** | Gemini Live API, via token efêmero de uso único. |
| **Tutora de dúvidas (RAG)** | Gemini + pgvector. Responde citando a lição exata. |

A regra é simples: a IA faz o que exige inteligência **no momento** — ouvir este aluno, conversar com este aluno. O que pode ser escrito uma vez e revisado, foi escrito uma vez e revisado.

### Sobre o áudio, sem enfeite

A fala do curso é **voz sintética do sistema operacional**, não gravação de nativo humano. A qualidade varia por dispositivo: no Windows e no macOS as vozes en-US são boas; em Androids antigos são mecânicas. Diálogos usam duas vozes distintas, porque com uma só o aluno não separa os turnos.

Para reconhecer o bloco, copiar o ritmo e fazer shadowing, isso serve bem. Para ouvido treinado em fala natural conectada, o dia 8 de cada circuito manda o aluno para material humano real — que é o lugar certo para isso.

---

## O método

A unidade de aprendizado **não é a regra gramatical**. É o **chunk**: um bloco de fala pronto, memorizado inteiro e reaproveitado trocando peças.

1. **Situação antes de regra** — cada circuito é uma cena real, nunca um tempo verbal
2. **Bloco antes de palavra** — `Can I have a coffee, please?` decorado inteiro, depois troca a peça
3. **Ouvir antes de ler** — dia 1 é áudio puro, com portão de 3 escutas
4. **Repetição espaçada** — agenda individual por bloco (SM-2), não revisão em lote
5. **Gramática é nota de rodapé** — só no dia 3, curta, e sempre *depois* do uso

**Circuito = 14 dias.** Dias 1–7 adquirem (imersão, blocos, troca de peças, escuta ativa, produção, revisão, missão). Dias 8–14 consolidam (input autêntico, shadowing, expansão, conversa ao vivo, escuta acelerada, revisão intercalada, uso sem roteiro).

Um bloco só conta como **dominado** depois de produzido em voz alta: a rota de fala compara a transcrição do aluno com os blocos do circuito e só então incrementa `spoken_count`.

### Papéis de acesso

- **`student`** — só vê conteúdo publicado e só escreve os próprios dados
- **`instructor`** — gerencia catálogo e acompanha alunos; **não** mexe em papéis nem vê auditoria
- **`admin`** — acesso total: usuários, papéis, bloqueios, exclusões e auditoria

O isolamento é garantido por **Row Level Security no Postgres**, não apenas na aplicação. Mesmo que alguém obtenha a `anon key`, o banco recusa o acesso.

---

## Setup

### 1. Pré-requisitos

- Node.js 20.9+
- Um projeto no [Supabase](https://supabase.com)
- Uma chave da API do Gemini no [Google AI Studio](https://aistudio.google.com/apikey) — necessária para a tutora de fala e a conversa ao vivo, **não** para o conteúdo

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar as variáveis de ambiente

Edite o `.env.local` (já criado) com os valores reais:

```bash
# Supabase → Project Settings → Data API  (URL)
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"

# Supabase → Project Settings → API Keys
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."     # NUNCA exponha esta chave no front

# Google AI Studio
GEMINI_API_KEY="AIza..."

# Seu e-mail vira admin automaticamente no primeiro cadastro
ADMIN_BOOTSTRAP_EMAILS="voce@exemplo.com"
```

> **Modelos do Gemini.** O catálogo do Google muda e modelos antigos deixam de
> ser liberados para contas novas. Rode `npm run models` para ver o que a **sua**
> chave alcança. Os modelos **Pro exigem billing habilitado** — no free tier eles
> retornam `429 quota exceeded`.

### 4. Aplicar o schema no banco

**Opção A — pelo SQL Editor do Supabase** (mais simples):

Abra o **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. É um arquivo único com as migrations já na ordem correta, idempotente.

> Esse arquivo é gerado a partir de `supabase/migrations/`. Se você editar alguma migration, rode `npm run db:bundle` para regenerá-lo.

**Opção B — pela CLI do Supabase:**

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

> A extensão `vector` (pgvector) é criada pela primeira migration. Se o seu projeto não permitir `create extension`, habilite pgvector em **Database → Extensions** antes de rodar.

**Deu algo errado no meio?** Depois que o schema base existir, cole [`supabase/repair.sql`](supabase/repair.sql) no SQL Editor. Ele recria a RPC `match_knowledge`, cria os buckets, força o reload do cache do PostgREST e imprime um relatório.

### 4.1. Conferir se está tudo certo

```bash
npm run check
```

Valida variáveis de ambiente, conexão, tabelas, colunas da grade de 14 dias, pgvector, buckets e acesso ao Gemini — cada falha vem com a instrução de correção.

### 5. Configurar a autenticação no Supabase

Em **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (em produção, seu domínio)
- **Redirect URLs:** adicione `http://localhost:3000/auth/confirm`

Em **Authentication → Providers → Email**: mantenha **Confirm email** ligado — é o que faz a validação de conta funcionar.

### 6. Publicar o curso

```bash
# Confere o curso inteiro sem tocar no banco
npm run verify:content

# Cria o curso, os 4 Cantos, os 52 Circuitos e as 728 lições — todas publicadas
npm run seed:curriculum

# Promove seu e-mail a administrador
npm run bootstrap:admin -- voce@exemplo.com
```

> ⚠️ O seed remove módulos de posição > 4 e, por cascata, as lições ligadas a eles.
> Inofensivo num banco novo; **destrutivo** num banco que já tem alunos com progresso.

### 7. Rodar

```bash
npm run dev
```

Acesse http://localhost:3000, crie sua conta, confirme o e-mail e entre em `/admin`.

---

## Editando o conteúdo

Cada circuito é um objeto em `content/circuits/canto-N.ts`:

```ts
{
  n: 4,
  immersion: [["Barista", "Hi there! What can I get you?", "Oi! O que posso trazer?"], ...],
  listening: [...],                       // o diálogo do dia 4
  why:      { title: "...", body: "..." }, // a nota de gramática do dia 3
  swaps:    ["a coffee", "the check", ...], // as peças que entram no molde
  expansion: [["...", "..."], ...],        // as frases longas do dia 10
  drift:    ["...", ...],                  // para onde a conversa do dia 14 vai
  sounds:   [["O TH de thanks", "..."], ...],
  quiz:     [q1, q2, q3, q4],              // 1 e 2 vão para o dia 1; 3 e 4 para o dia 4
}
```

O composer transforma isso nos 14 dias. Quizzes de recuperação (PT→EN, EN→PT, "quando usar") são gerados a partir dos blocos do próprio circuito, deterministicamente.

Depois de editar:

```bash
npm run verify:content     # checa integridade: quiz sem resposta única, lição vazia, fala com "/"
npm run seed:curriculum    # republica
```

### Indexar o material para o RAG

Depois de publicar, indexe as lições para a tutora conseguir citá-las:

```bash
npm run index:knowledge
```

O script usa checksum: rodar de novo só reprocessa o que mudou.

---

## Custo estimado da API

| Operação | Volume | Observação |
|---|---|---|
| Conteúdo das 728 lições | **zero chamadas** | Está no repositório |
| Áudio do curso | **zero chamadas** | Sintetizado no navegador |
| Análise de 1 áudio de 60s | ~1 chamada flash | O grosso do custo recorrente |
| Conversa ao vivo | 1 sessão de voz | O item mais caro por minuto |
| Indexação RAG | ~5.000 embeddings | Custo único, muito baixo |

---

## Estrutura

```
content/
  curriculum.ts          Grade: 4 cantos, 52 circuitos, ritmo de 14 dias, trilhas
  compose-lesson.ts      Expande cada circuito nos 14 dias (determinístico, sem API)
  circuits/
    canto-1.ts           Circuitos 1–13   · Destravar   (A1)
    canto-2.ts           Circuitos 14–26  · Contar      (A2)
    canto-3.ts           Circuitos 27–39  · Resolver    (B1)
    canto-4.ts           Circuitos 40–52  · Soar natural(B2)

scripts/
  verify-content.ts      Checa o curso inteiro sem tocar no banco
  seed-curriculum.ts     Publica curso, cantos, circuitos e as 728 lições
  index-knowledge.ts     Indexa no pgvector
  check-setup.ts         Diagnóstico de ambiente, schema e API
  bootstrap-admin.ts     Promove e-mails a admin

supabase/migrations/     Schema, RLS e buckets de storage

src/
  app/
    (auth)/              Login, cadastro, recuperação de senha
    app/                 Painel do aluno (dia, cronograma, revisão, ao vivo)
    admin/               Painel administrativo
    api/speaking/        Rota que recebe o áudio e chama a tutora
    api/live/token/      Token efêmero da conversa ao vivo
  components/
    audio/               Player de fala local + portão de imersão
    speaking/            Gravador e painel de feedback
    lesson/              Player e renderização dos blocos
  lib/
    speech.ts            Síntese de fala no navegador (sem API)
    srs.ts               SM-2 adaptado para produção falada
    gemini/              Cliente, prompts, análise de fala, RAG
    supabase/            Clientes (browser / server / service_role)
    auth/guards.ts       RBAC no servidor
```

### Onde mora a especialidade do agente

[`src/lib/gemini/prompts.ts`](src/lib/gemini/prompts.ts) contém o guia de interferência do português brasileiro que alimenta o diagnóstico: TH virando `f`/`t`/`d`, vogal epentética (`bigui` para *big*), `/ɪ/` vs `/iː/`, as três pronúncias do `-ed`, L vocalizado, falsos cognatos e traduções literais.

É isso que faz o feedback ser específico em vez de genérico. Ajuste esse arquivo para calibrar o comportamento da tutora.

---

## Segurança

- **RLS em todas as tabelas** — o banco recusa acesso indevido mesmo com a chave anônima
- **Trava de escalonamento de privilégio** — um trigger impede que o usuário altere o próprio papel ou status, mesmo passando pela policy de update
- **Áudios em bucket privado** — cada aluno só acessa a própria pasta
- **Notas gravadas com `service_role`** — o aluno não consegue forjar o próprio resultado
- **Token efêmero na conversa ao vivo** — uso único, 2 min para conectar; a `GEMINI_API_KEY` nunca vai ao browser
- **Auditoria imutável** — toda ação administrativa é registrada com autor, alvo e timestamp
- **`getUser()` em vez de `getSession()`** — o token é revalidado no servidor a cada request

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | Checagem de tipos |
| `npm run check` | Diagnóstico de setup (env, banco, storage, Gemini) |
| `npm run models` | Lista os modelos do Gemini liberados para a sua chave |
| `npm run verify:content` | Valida as 728 lições sem tocar no banco |
| `npm run gen:icons` | Regera favicon, ícones de PWA e imagem de prévia de link |
| `npm run cleanup:audio` | Lista (e com `--yes` apaga) os áudios órfãos da era do TTS por API |
| `npm run seed:curriculum` | Publica curso, 4 cantos, 52 circuitos e 728 lições |
| `npm run index:knowledge` | Indexa o material no pgvector |
| `npm run bootstrap:admin` | Promove um e-mail a administrador |
| `npm run db:bundle` | Regenera `supabase/schema.sql` a partir das migrations |

---

## Publicar

[`DEPLOY.md`](DEPLOY.md) tem o passo a passo de GitHub + Hostinger: como importar o repositório como aplicação Node.js, as variáveis que precisam existir **antes** do primeiro build, quanto do plano o projeto consome e o que fazer se um segredo escapar.

Três pontos que costumam derrubar o primeiro deploy:

- **É um app com servidor**, não um site estático. Exige plano com Node.js 20.9+ — na Hostinger, Business ou Cloud.
- **As variáveis vêm antes do build.** As `NEXT_PUBLIC_*` são gravadas dentro do bundle na hora de compilar; configurá-las depois exige um novo deploy, não um restart.
- **HTTPS é obrigatório.** Sem ele o navegador nem pede permissão de microfone, e a gravação e a conversa ao vivo simplesmente não existem.
