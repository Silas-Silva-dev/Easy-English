# O que o sistema precisava ganhar, e o que ganhou

A espinha do método vive em `content/metodo/`. Ela foi desenhada contra o
código que existe — o motor SM-2 de `review_chunk`, as três trilhas de
`curriculum.ts`, o portão de escuta de `audio-player.tsx` — e no caminho ficou
claro o que o sistema não tinha.

Eram dezesseis itens, e nenhum era desejo: cada um era uma coisa sem a qual
algum pedaço da espinha era **inimplementável**. Os dezesseis estão fechados.
Este arquivo deixou de ser uma lista de tarefas e virou o registro de onde cada
regra do método mora no código — que é o que evita reabrir a mesma discussão
daqui a seis meses.

**Aplicar em produção ainda é um passo manual.** A migração
`20260101001400_espinha.sql` precisa ser colada no SQL Editor do Supabase
(`npm run db:bundle` gera `supabase/schema.sql` com ela dentro), e
`npm run seed:curriculum` precisa rodar depois para semear os 156 portões. Até
lá, o código está pronto e o banco não.

## A decisão de produto que atravessa tudo

**O portão não tranca nada.** Ele é diagnóstico, não fechadura. Quem não passa
não perde acesso ao circuito seguinte — o que muda é a quinzena seguinte, que
repete o que ficou para trás dentro do material novo. Trancar conteúdo pago de
um adulto que estuda cansado à noite é hostil, e o produto já diz o que cada
trilha não entrega.

Isto vale para `circuit_gate_status`, para a tela `/app/portao/[circuito]` e
para qualquer coisa que venha depois: nenhuma consulta desta espinha nega acesso
a conteúdo.

**O portão de ESCUTA é a única exceção, e é outra coisa.** Ele não tranca
circuito: tranca o texto de uma peça até ela ter sido ouvida. Não é
gamificação nem disciplina — é o diagnóstico do próprio curso, que diz que ler
antes de ouvir instala fonema português sobre grafia inglesa e que desfazer
isso custa caro.

---

## Onde cada regra mora agora

### Banco — `supabase/migrations/20260101001400_espinha.sql`

| Regra | Onde |
|---|---|
| Escuta medida do dia | `study_days.input_minutes`, escrita só pelo player |
| Fila zerada do dia | `study_days.queue_cleared` + `mark_queue_cleared()` |
| Meta diária pela trilha | `track_daily_minutes()` dentro de `register_study_activity` |
| "Hoje" do aluno, não do servidor | `today_for(user)` |
| Uma régua de "dominado" | `is_mastered(rep, ease, spoken, track)` |
| Baralho por trilha | `enroll_circuit_chunks(course, circuito, track)` + `chunk_mastery.is_core` |
| Lapso que desce | `chunk_mastery.correct_streak`, 3 acertos perdoam 1 lapso |
| Sanguessuga | `chunk_mastery.suspended_at`, 8 lapsos saem da agenda |
| Portão de escuta persistido | `listening_exposures` + `count_listen()` + `unlock_exposure()` |
| Escutas por canto (4/3/2/2) | `required_plays(circuito)` |
| Dispensa de áudio | `profiles.audio_exempt`, protegida por `guard_profile_privileges` |
| Os 52 portões | `circuit_gates` (critério) + `circuit_gate_status` (avaliação) |
| Avaliação do portão | `evaluate_circuit_gate(course, circuito)` |

### Conteúdo

| Regra | Onde |
|---|---|
| Os 104 portões, estruturados | `content/metodo/portoes.ts` — extraídos por regex da prosa de `rampa.json`, que continua sendo a fonte |
| Piso de fala do circuito | `pisoDeFala(n, trilha)` |
| Teto diário da fila | `tetoDiarioDaFila` em `content/curriculum.ts` |
| Quatro movimentos por trilha | `movimentosDaTrilha` em `content/curriculum.ts` |

### Aplicação

| Regra | Onde |
|---|---|
| Escuta que só conta ouvida | `ouvidoRef` em `src/components/audio/audio-player.tsx` |
| Segundos ouvidos da sessão | contexto `EscutaMedida`, consumido por `completeLessonAction` |
| Texto travado fora do payload | `src/app/app/licao/[day]/page.tsx` + `src/app/app/licao/actions.ts` |
| Reserva de 45% ao circuito corrente | `src/app/app/revisao/page.tsx` |
| Tela do portão | `src/app/app/portao/[circuito]/page.tsx` |

---

## As duas fontes duplicadas, e quem vigia cada uma

Duas regras existem em dois lugares por necessidade, não por descuido. As duas
têm guarda automática em `npm run verify:content`, e as duas foram testadas
quebrando o SQL de propósito para confirmar que a guarda acusa:

- **Quantas escutas destravam o texto.** `orcamento.json` diz 4/3/2/2 por
  canto; `public.required_plays` repete os números em SQL. A decisão precisa
  ser do servidor — se viesse do cliente, o portão seria um parâmetro que
  qualquer um edita.
- **Os denominadores dos portões.** A prosa de `rampa.json` cita "5 dos 8
  blocos novos", e a rampa declara `blocosNovos: 8` no mesmo objeto. O
  verificador confere os 104 contra a rampa, e confere que a fórmula do núcleo
  (`min(10, ceil(0,32 × blocosNovos))`) bate com o denominador que a Essencial
  cita — bate nos 48 circuitos, e soma 359 de 1.193.

`content/metodo/portoes.ts` derruba o import se qualquer um dos 104 portões
deixar de casar. Não é zelo: um portão que o parser não entende vira um portão
de zero componentes, e um portão de zero componentes **passa** — o aluno
receberia aprovação automática num circuito que não fez.

---

## O que continua fora do alcance do código

Duas coisas que a espinha prescreve e que nenhuma tela mede, e é honesto que
estejam escritas aqui em vez de fingidas em algum número:

- **As 403 horas de `minutosInputFora`** — 36% do contato total do curso. O app
  prescreve e pergunta, mas não hospeda, e nenhum portão depende desse número.
  Minuto autodeclarado que destranca conteúdo ensina o aluno a mentir.
- **A tarefa falada de cada portão** ("atravessa um dia inteiro em inglês numa
  conversa de 10 minutos com a Emma"). Não tem número e não é avaliável por
  consulta. Ela continua na prosa, que vai inteira para a tela do portão.
