# Deploy — GitHub + Hostinger

Este projeto é um **Next.js com servidor**: Server Actions, rotas de API, rota de token efêmero e renderização por requisição. Ele **não** funciona como site estático nem em hospedagem só-PHP.

O plano **Business** (2 vCPU, 3 GB RAM, 50 GB NVMe) e os planos **Cloud** rodam
[aplicações Node.js pelo hPanel](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/),
com importação direta do GitHub e build automático a cada push. O Next.js é um dos
frameworks reconhecidos, com SSR, ISR e rotas de API funcionando.

> Se o seu plano for **Premium** ou **Single**, Node.js não está disponível: aí é upgrade para Business/Cloud ou uma VPS.

---

## 1. Antes do primeiro push

### Confirme que nenhum segredo vai junto

```powershell
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

```powershell
git init
git branch -M main
git add .
git commit -m "InglishEasy: plataforma de ingles para conversacao"
git remote add origin https://github.com/SEU_USUARIO/inglisheasy.git
git push -u origin main
```

Crie o repositório como **privado**. O `.env.local` não vai junto, mas o conteúdo do curso, o schema e a lógica de negócio vão. Na importação você autoriza o acesso da Hostinger ao repositório privado.

---

## 3. Criar a aplicação no hPanel

**Websites → Adicionar site → Aplicações Node.js → Importar repositório Git.**

| Campo | Valor |
|---|---|
| Repositório | `SEU_USUARIO/inglisheasy`, branch `main` |
| Framework | **Next.js** (a detecção automática acerta) |
| Versão do Node | **22.x** — o projeto exige 20.9+ (`engines` no package.json) |
| Diretório de saída | `.next` |
| Comando de build | `npm run build` |

O `npm install` roda sozinho antes do build; não é preciso (nem possível) chamá-lo por SSH nos planos Business e Cloud.

### ⚠️ Configure as variáveis ANTES do primeiro deploy

Esta é a pegadinha que mais custa tempo. As variáveis `NEXT_PUBLIC_*` são **gravadas dentro do JavaScript** durante o build, não lidas quando o site roda. E `src/lib/env.ts` lança erro se elas faltarem, o que derruba a geração das páginas estáticas.

Deployar primeiro e configurar depois não funciona: o build falha, ou pior, passa e gera um bundle apontando para lugar nenhum. Se isso acontecer, corrija as variáveis e clique em **Redeploy** — não adianta só reiniciar.

São **9 variáveis**. A coluna "quando é lida" decide o que acontece se você errar:
o que é lido no *build* exige um novo deploy para corrigir; o que é lido em
*execução* basta reiniciar.

| # | Variável | Valor | Quando é lida | Vai ao navegador? |
|---|---|---|---|---|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | **build** + execução | sim |
| 2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave `anon` (JWT longo) | **build** + execução | sim |
| 3 | `NEXT_PUBLIC_SITE_URL` | `https://seudominio.com.br` | **build** + execução | sim |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` | execução | **NUNCA** |
| 5 | `GEMINI_API_KEY` | chave do Google AI Studio | execução | **NUNCA** |
| 6 | `GEMINI_MODEL_TUTOR` | `gemini-3.6-flash` | execução | não |
| 7 | `GEMINI_MODEL_SPEAKING` | `gemini-3.6-flash` | execução | não |
| 8 | `GEMINI_MODEL_EMBEDDING` | `gemini-embedding-001` | execução | não |
| 9 | `GEMINI_MODEL_LIVE` | `gemini-3.1-flash-live-preview` | execução | não |

**1 a 5 são obrigatórias.** Sem elas o build falha (`src/lib/env.ts` recusa valor
ausente) ou o app sobe sem conseguir autenticar ninguém.

**6 a 9 são opcionais** — o código tem esses mesmos valores como padrão. Defina
mesmo assim: o catálogo do Google muda, e assim a produção não troca de modelo
sozinha num deploy futuro.

`NEXT_PUBLIC_SITE_URL` precisa ser o domínio **real**, sem barra no fim. Ele monta
os links de confirmação de e-mail e recuperação de senha
(`src/app/(auth)/actions.ts`); apontando para `localhost`, ninguém confirma a
conta. É também a base das URLs de prévia de link (`metadataBase`).

### Variáveis que NÃO devem ir para o servidor

| Variável | Por quê |
|---|---|
| `SUPABASE_DB_PASSWORD` | serve só à CLI do Supabase (`supabase db push`), na sua máquina. Nenhuma linha do app a lê — colocá-la lá é expor a senha do banco sem ganho nenhum |
| `ADMIN_BOOTSTRAP_EMAILS` | só o script local `bootstrap-admin` a consome. O app em execução nunca lê |
| `PORT` | a porta é gerenciada pela Hostinger |
| `NODE_ENV` | o `next build` e o `next start` já definem `production` |

O hPanel tem um assistente de conexão com o Supabase que preenche as variáveis
sozinho — confira mesmo assim, principalmente se ele trouxe a `service_role` e
não a `anon` no campo errado.

---

## 4. Ajustar o Supabase para produção

Em **Authentication → URL Configuration**:

- **Site URL:** `https://seudominio.com.br`
- **Redirect URLs:** adicione `https://seudominio.com.br/auth/confirm` e `https://seudominio.com.br/nova-senha`

Sem isso o cadastro funciona, mas o link do e-mail leva a lugar nenhum.

---

## 5. Popular o banco — da sua máquina, não do servidor

Os scripts de seed conversam com o Supabase pela rede. **Não precisam rodar no servidor** — rodam daqui mesmo, apontando para o projeto de produção. Isso evita completamente a limitação de terminal do plano compartilhado.

```powershell
# .env.local apontando para o Supabase de produção
npm run check              # valida env, banco, storage e API
npm run seed:curriculum    # publica os 4 cantos, 52 circuitos e 728 lições
npm run bootstrap:admin -- seu@email.com
npm run index:knowledge    # opcional: liga o RAG da tutora
```

O `seed:curriculum` remove módulos de posição > 4 e as lições ligadas a eles. Em base nova é inofensivo; **com alunos já matriculados, não rode sem backup**.

---

## 6. Deploy contínuo

Depois de importado, todo `git push` na branch `main` dispara build e publicação. O painel tem um botão **Restart** que reinicia o processo Node sem rebuildar — útil quando você só troca uma variável de ambiente que **não** seja `NEXT_PUBLIC_*` (essas exigem redeploy).

---

## 7. Seus recursos dão conta?

Medido neste projeto:

| Recurso | Consumo | Limite do Business | Folga |
|---|---|---|---|
| **Inodes** | `node_modules` 30.654 + `.next` 1.689 + fonte ~130 ≈ **32.500** | 600.000 | sai de ~27 mil para ~60 mil (10%) |
| **Disco** | ~1,2 GB com dependências e build | 50 GB | sobra folgada |
| **RAM** | o build do Next chega a ~2 GB | 3 GB | aperta, mas cabe |
| **CPU** | build de ~1 a 3 min | 2 vCPU | ok |

A memória é o único item apertado. Se o build morrer por falta dela, adicione a variável `NODE_OPTIONS` com `--max-old-space-size=2560` e refaça o deploy.

---

## 8. Coisas que poderiam preocupar e não preocupam

**WebSocket para a conversa ao vivo.** O plano compartilhado não sustenta conexão persistente, mas isso não afeta o app: `/api/live/token` só emite um token efêmero (válido por 2 min, sessão de até 30) e **o navegador conversa direto com o Google**. O WebSocket nunca passa pela Hostinger.

**Tamanho do upload de áudio.** A gravação para em 3 minutos e sai em WebM/Opus — algo entre 300 e 700 KB. O limite de 12 MB das Server Actions existe por segurança, não porque os arquivos cheguem perto disso.

**Otimização de imagem / `sharp`.** O projeto não usa `next/image`, então não há dependência binária para compilar no servidor.

**Áudio das lições.** É sintetizado no navegador (Web Speech API). Não consome cota, não gera arquivo e não ocupa inode.

---

## 9. O que exige atenção de verdade

**HTTPS é obrigatório.** Sem certificado ativo o navegador nem pede permissão de microfone — gravação e conversa ao vivo simplesmente deixam de existir. O SSL grátis da Hostinger resolve; confirme que está emitido e que o site força HTTPS.

**Cota do Gemini.** Conversa ao vivo e correção de fala consomem cota. No free tier o limite é baixo e a resposta vira `429`. Com alunos pagantes, habilite billing no Google Cloud.

**Supabase free tier pausa o projeto** após 7 dias sem atividade. Para produção, o plano Pro.

---

## 10. Checklist final

- [ ] Repositório privado e `.env.local` fora dele
- [ ] Aplicação Node.js criada no hPanel, Node 22.x, saída `.next`
- [ ] **Todas as variáveis configuradas antes do primeiro build**, com `NEXT_PUBLIC_SITE_URL` no domínio real
- [ ] Site URL e Redirect URLs atualizadas no Supabase
- [ ] Migrations aplicadas no SQL Editor
- [ ] `npm run check` verde apontando para o Supabase de produção
- [ ] `npm run seed:curriculum` executado
- [ ] HTTPS ativo
- [ ] Um cadastro de teste completo: criar conta → confirmar e-mail → abrir o Dia 1 → gravar uma fala
