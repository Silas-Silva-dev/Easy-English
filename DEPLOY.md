# Deploy — GitHub + Hostinger

Este projeto é um **Next.js com servidor**: Server Actions, rotas de API, rota de token efêmero e renderização por requisição. Ele **não** funciona como site estático.

Isso decide tudo o que vem abaixo: você precisa de um plano da Hostinger que rode **Node.js** — VPS ou Cloud. Hospedagem compartilhada de PHP não serve, e não existe ajuste de configuração que contorne isso.

---

## 1. Antes do primeiro push

### Confirme que nenhum segredo vai junto

```bash
git status --porcelain --ignored | Select-String "env|redencia|senha"
```

Deve aparecer `!!` (ignorado) na frente de `.env.local` e de qualquer arquivo de credencial. Se aparecer `??`, **pare** — o arquivo entraria no commit.

> O `.gitignore` deste repositório cobre `.env*`, `*credenciai*`, `*senha*`, `*secret*`, `*.pem` e `*.key`, inclusive quando o nome começa com ponto. O padrão antigo (`Credenciais*.txt`) não pegava `.Credenciais DB.txt`.

### O que fazer se um segredo já foi enviado

Trocar a chave é obrigatório — remover o arquivo do histórico **não basta**, porque o GitHub e qualquer clone já viram o valor.

1. Supabase → Project Settings → API Keys → **Reset service_role key**
2. Google AI Studio → revogar e recriar a `GEMINI_API_KEY`
3. Supabase → Database → **Reset database password**
4. Só depois limpe o histórico (`git filter-repo` ou recriar o repositório)

---

## 2. Criar o repositório

```bash
git init
git branch -M main
git add .
git commit -m "InglishEasy: plataforma de inglês para conversação"
git remote add origin https://github.com/SEU_USUARIO/inglisheasy.git
git push -u origin main
```

Crie o repositório como **privado**. O `.env.local` não vai junto, mas o conteúdo do curso, o schema e a lógica de negócio vão.

---

## 3. Variáveis de ambiente na Hostinger

O `.env.local` **não** é versionado, então o servidor não tem essas variáveis. Configure-as no painel (hPanel → Node.js → Environment Variables) ou num `.env.production` criado direto no servidor, fora do git.

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anônima |
| `SUPABASE_SERVICE_ROLE_KEY` | **nunca** exponha; só no servidor |
| `GEMINI_API_KEY` | chave do Google AI Studio |
| `GEMINI_MODEL_TUTOR` | `gemini-3.6-flash` |
| `GEMINI_MODEL_SPEAKING` | `gemini-3.6-flash` |
| `GEMINI_MODEL_EMBEDDING` | `gemini-embedding-001` |
| `GEMINI_MODEL_LIVE` | `gemini-3.1-flash-live-preview` |
| `NEXT_PUBLIC_SITE_URL` | `https://seudominio.com.br` |
| `ADMIN_BOOTSTRAP_EMAILS` | seu e-mail |
| `NODE_ENV` | `production` |
| `PORT` | a porta que a Hostinger indicar (geralmente `3000`) |

⚠️ `NEXT_PUBLIC_SITE_URL` precisa ser o domínio **real**. Ele entra nos links de confirmação de e-mail; apontando para `localhost`, ninguém consegue confirmar a conta.

---

## 4. Ajustar o Supabase para produção

Em **Authentication → URL Configuration**:

- **Site URL:** `https://seudominio.com.br`
- **Redirect URLs:** adicione `https://seudominio.com.br/auth/confirm` e `https://seudominio.com.br/nova-senha`

Sem isso o cadastro funciona, mas o link do e-mail leva a lugar nenhum.

---

## 5. Build e execução no servidor

```bash
npm ci            # ci, não install: respeita o package-lock
npm run build
npm start         # next start, escuta em $PORT
```

O processo precisa ficar de pé. Numa VPS, use PM2:

```bash
npm install -g pm2
pm2 start npm --name inglisheasy -- start
pm2 save
pm2 startup       # sobe sozinho depois de reiniciar a máquina
```

### Deploy automático a partir do GitHub

No hPanel, em **Git**, conecte o repositório e aponte para a branch `main`. Depois configure o script de pós-deploy:

```bash
cd /caminho/do/app
npm ci
npm run build
pm2 restart inglisheasy
```

Se o seu plano expõe apenas o webhook, crie um `deploy.sh` no servidor com esse conteúdo e chame-o pelo webhook.

---

## 6. Requisitos do servidor

| Item | Mínimo | Por quê |
|---|---|---|
| Node.js | **20.9+** | exigido pelo Next 16 (`engines` no package.json) |
| RAM | **2 GB** | o build do Next estoura 1 GB; em 1 GB ele morre com OOM |
| Disco | ~1,5 GB | `node_modules` + `.next` |
| HTTPS | obrigatório | o microfone da gravação e da conversa ao vivo **só funciona em HTTPS**. Em HTTP o navegador nem pede permissão. |

Se o build morrer por memória na VPS:

```bash
NODE_OPTIONS="--max-old-space-size=2048" npm run build
```

Ou faça o build na sua máquina e envie a pasta `.next` — mas aí o deploy deixa de ser automático pelo GitHub.

---

## 7. Depois do primeiro deploy

```bash
# no servidor, uma vez
npm run check              # valida env, banco, storage e API
npm run seed:curriculum    # publica os 4 cantos, 52 circuitos e 728 lições
npm run bootstrap:admin -- seu@email.com
npm run index:knowledge    # opcional: liga o RAG da tutora
```

O `seed:curriculum` remove módulos de posição > 4 e as lições ligadas a eles. Em base nova é inofensivo; **com alunos já matriculados, não rode sem backup**.

---

## 8. Checklist final

- [ ] Repositório privado e `.env.local` fora dele
- [ ] Variáveis configuradas no hPanel, incluindo `NEXT_PUBLIC_SITE_URL` com o domínio real
- [ ] Site URL e Redirect URLs atualizadas no Supabase
- [ ] Migrations aplicadas (`supabase/schema.sql` no SQL Editor)
- [ ] `npm run check` verde **no servidor**
- [ ] `npm run seed:curriculum` executado
- [ ] HTTPS ativo — sem ele, gravação e conversa ao vivo não funcionam
- [ ] Um cadastro de teste completo: criar conta → confirmar e-mail → abrir o Dia 1

---

## Limites que valem saber antes de vender acesso

- **Conversa ao vivo e correção de fala consomem cota do Gemini.** No free tier o limite é baixo e a resposta vira `429`. Com alunos pagantes, habilite billing no Google Cloud.
- **O áudio das lições é sintetizado no navegador** (Web Speech API). Não custa nada e não usa cota, mas a voz depende do sistema do aluno: boa no Windows, macOS e iOS; irregular em Android antigo.
- **O Supabase free tier pausa o projeto** após 7 dias sem atividade. Para produção, o plano Pro.
