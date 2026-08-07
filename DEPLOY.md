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
git commit -m "Easy English: plataforma de ingles para conversacao"
git remote add origin https://github.com/SEU_USUARIO/easy-english.git
git push -u origin main
```

Crie o repositório como **privado**. O `.env.local` não vai junto, mas o conteúdo do curso, o schema e a lógica de negócio vão. Na importação você autoriza o acesso da Hostinger ao repositório privado.

---

## 3. Criar a aplicação no hPanel

**Websites → Adicionar site → Aplicações Node.js → Importar repositório Git.**

| Campo | Valor |
|---|---|
| Repositório | `SEU_USUARIO/easy-english`, branch `main` |
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
| 6 | `GEMINI_MODEL_TUTOR` | `gemini-3.1-flash-lite` | execução | não |
| 7 | `GEMINI_MODEL_SPEAKING` | `gemini-3.6-flash` | execução | não |
| 8 | `GEMINI_MODEL_EMBEDDING` | `gemini-embedding-001` | execução | não |
| 9 | `GEMINI_MODEL_LIVE` | `gemini-3.1-flash-live-preview` | execução | não |
| 10 | `MERCADOPAGO_ACCESS_TOKEN` | token de produção (`APP_USR-…`) | execução | **NUNCA** |
| 11 | `MERCADOPAGO_WEBHOOK_SECRET` | assinatura secreta do webhook | execução | **NUNCA** |
| 12 | `CHECKOUT_PRICE_CENTS` | `29700` (R$ 297,00) | **build** + execução | não |
| 13 | `CHECKOUT_MAX_INSTALLMENTS` | `10` | **build** + execução | não |

> **O tutor NÃO pode ser o mesmo modelo da fala.** A cota do Gemini é contada por
> projeto **e por modelo**: com os dois em `gemini-3.6-flash`, cada mensagem de texto
> consome uma das análises de áudio do dia. Além disso o `3.6-flash` recusa a chamada
> do tradutor por voz com `400 INVALID_ARGUMENT` — esta tabela já mandou
> `gemini-3.6-flash` aqui e derrubou a tradução por voz em produção enquanto
> funcionava em desenvolvimento.

**1 a 5, 10 e 11 são obrigatórias.** Sem 1 a 5 o build falha (`src/lib/env.ts`
recusa valor ausente) ou o app sobe sem conseguir autenticar ninguém. Sem 10 e
11 ninguém consegue pagar — e o cadastro agora é pago.

**12 e 13 são lidas no build** porque o preço aparece na landing e no
`/cadastro`, que são pré-renderizadas. Mudar o preço exige **Redeploy**, não só
reiniciar; caso contrário a página de vendas anuncia um valor e o checkout cobra
outro.

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
- **Redirect URLs:** adicione `https://seudominio.com.br/**` e, para conseguir testar
  na sua máquina, `http://localhost:3000/**`

Sem isso o cadastro funciona, mas o link do e-mail leva a lugar nenhum. E o
Supabase **não avisa** quando o destino está fora da lista: ele troca pelo Site
URL em silêncio, e o aluno cai na home em vez da tela de nova senha.

### ⚠️ `.env.local` NÃO vai para o servidor

Vale para todas as variáveis, mas morde com força nas do Mercado Pago porque a
falha é silenciosa e parece bug de código.

`.env.local` está no `.gitignore` — ele existe **só na sua máquina**. Preencher
o token lá e fazer deploy não leva nada para a Hostinger: as variáveis de
produção se configuram **exclusivamente** no hPanel.

Como o sintoma aparece quando falta `MERCADOPAGO_ACCESS_TOKEN` no servidor:

| Onde | O que você vê | Por quê |
|---|---|---|
| Botão "Ir para o pagamento" | erro "pagamento temporariamente indisponível" e nenhum redirecionamento | `startCheckoutAction` para antes de falar com o Mercado Pago |
| Landing e `/cadastro` | parcela **R$ 34,80** em vez de **R$ 35,83** | a consulta à tabela real falhou e caiu na simulação local |
| `/admin/pagamentos` | faixa vermelha "Mercado Pago não configurado" | — |
| Webhook | `401` mesmo em notificação legítima | falta `MERCADOPAGO_WEBHOOK_SECRET` |

Aquela diferença na parcela é o teste mais rápido que existe: se a landing de
produção mostra o valor da simulação, o servidor não está enxergando o token.

Rode o diagnóstico apontando para o domínio real — ele testa token, tabela de
parcelas, criação da preferência e webhook (com assinatura de verdade), sem
cobrar ninguém:

```bash
npm run check:pagamento -- https://seudominio.com.br
```

> **Preço exige Redeploy, não reinício.** `CHECKOUT_PRICE_CENTS` e
> `CHECKOUT_MAX_INSTALLMENTS` são lidas no build porque a landing e o
> `/cadastro` são pré-renderizadas. Já `MERCADOPAGO_*` são lidas em execução —
> mas se você acabou de adicionar as duas, faça **Redeploy** mesmo assim, senão
> a página de vendas continua servindo o HTML antigo com a parcela simulada.

### Mercado Pago — o webhook é o que libera o acesso

O aluno paga no ambiente do Mercado Pago e volta para o site. Quem realmente
libera o curso **não é esse retorno** — é a notificação que o Mercado Pago manda
para o servidor. Quem paga no PIX e fecha a aba depende só dela.

No painel do desenvolvedor (`mercadopago.com.br/developers/panel`), abra sua
aplicação → **Webhooks** → *Configurar notificações*:

- **URL de produção:** `https://seudominio.com.br/api/pagamentos/webhook`
- **Evento:** `Pagamentos`
- Copie a **assinatura secreta** gerada e coloque em `MERCADOPAGO_WEBHOOK_SECRET`

A assinatura não é enfeite: a rota é pública, e sem validar o HMAC qualquer um
que descubra a URL manda um POST dizendo "aprovado" e ganha o curso. Por isso o
código **recusa** notificação sem assinatura válida quando o token é de produção.

Para conferir se está de pé, o painel em **/admin/pagamentos** mostra um aviso
vermelho quando o token falta e um aviso amarelo quando o segredo do webhook
falta. Se um pagamento cair e o acesso não abrir, use *Reconsultar no Mercado
Pago* na linha do pedido — ele refaz a conciliação sem mexer no banco na mão.

> **Cuidado com o token de teste.** `TEST-…` roda no sandbox e não move dinheiro;
> em produção use o `APP_USR-…`. Com o token de teste a validação de assinatura é
> dispensada de propósito, para dar para testar sem webhook público.

### SMTP — obrigatório, não é opcional

Em **Authentication → Emails → SMTP Settings**, ligue o **Custom SMTP**.

O serviço de e-mail embutido do Supabase não serve para produção: ele só entrega
para membros do time do projeto e para em **2 mensagens por hora**. Quando ele
recusa, o app recebe `500 unexpected_failure` com `"Error sending recovery
email"` — cadastro e recuperação de senha param juntos, porque é o mesmo mailer.

Serve qualquer provedor (Resend, Brevo, SendGrid, Amazon SES, Mailgun). Preencha
host, porta, usuário, senha e o remetente — e confirme o domínio no provedor:
sem isso ele aceita a conexão e recusa a mensagem, que dá o mesmo erro.

Para conferir o caminho inteiro — token, destino do link e envio:

```powershell
npm run check:email -- seu@email.com
```

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
- [ ] Custom SMTP ligado e `npm run check:email -- seu@email.com` verde
- [ ] Migrations aplicadas no SQL Editor (inclui `20260101000700_billing.sql`)
- [ ] `npm run check` verde apontando para o Supabase de produção
- [ ] `npm run seed:curriculum` executado
- [ ] HTTPS ativo
- [ ] Webhook do Mercado Pago apontando para `https://seudominio.com.br/api/pagamentos/webhook` com a assinatura secreta salva
- [ ] `/admin/pagamentos` sem avisos vermelhos ou amarelos
- [ ] Um cadastro de teste completo: criar conta → confirmar e-mail → **pagar** → abrir o Dia 1 → gravar uma fala
- [ ] Um teste de cortesia: **Adicionar aluno sem custo** no admin → o link de senha abre e o aluno entra sem pagar
