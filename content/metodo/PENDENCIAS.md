# O que o sistema precisa ganhar

A espinha do método vive em `content/metodo/`. Ela foi desenhada contra o
código que existe — o motor SM-2 de `review_chunk`, as três trilhas de
`curriculum.ts`, o portão de escuta de `audio-player.tsx` — e no caminho
ficou claro o que o sistema ainda não tem.

Esta lista não é desejo. Cada item aqui é uma coisa sem a qual algum pedaço da
espinha é **inimplementável**, e cada um traz o arquivo e a linha onde mora o
problema. A ordem é por tamanho do conserto, do mais pesado para o mais leve,
porque as migrações destravam as funções.

Quatro defeitos que apareceram nessa auditoria já foram corrigidos e não estão
mais aqui: a aritmética morta da revisão intercalada, a janela de seis
circuitos, a gravação que não reagendava o SRS, e a fila de revisão que não
alcançava o degrau neutro do SM-2.

## Uma decisão de produto que atravessa tudo

**O portão não tranca nada.** Ele é diagnóstico, não fechadura. Quem não passa
não perde acesso ao circuito seguinte — o que muda é a quinzena seguinte, que
repete o que ficou para trás dentro do material novo. Nenhum dos 52 portões
dizia isso, e sem essa frase as duas leituras possíveis são opostas.

## Um número que está errado na tela hoje

A trilha Essencial declara `dailyMinutes: 20` e seus blocos somam **30**
(`core` 15 + `srs` 15, `content/curriculum.ts:171` e `:178`). Quem
comprou 20 minutos vê 30 em qualquer tela que some `dayBlocksFor('essential')`.
As outras duas trilhas fecham exato. Não foi remendado de propósito: o item 5
abaixo substitui `DAY_BLOCKS` inteiro pelos quatro movimentos, e um remendo
agora criaria um terceiro número para a mesma coisa.

---

## 1. Coluna study_days

**Migração**

Coluna study_days.input_minutes, escrita só pelo player de áudio, com detecção de aba em segundo plano, mais o parâmetro p_input_minutes em register_study_activity e um predicado `input_minutes > 0` para o dia contar como 'input registrado'. Sem ela, os 48 portões não-fechamento do Completo e do Intensivo são literalmente inimplementáveis.

**Onde:** supabase/schema.sql:575-587 (tabela study_days) e schema.sql:590 / 2428 (as duas versões de register_study_activity; a segunda, com safe_timezone, é a que vale). Chamada a partir de completeLessonAction.

**Por quê:** study_days.minutes soma minutos de QUALQUER atividade, vindos do cliente, num único número. Não existe coluna de escuta em lugar nenhum do schema, então 'o input da sessão foi registrado hoje' não tem onde ser lido. Minuto autodeclarado que destranca conteúdo ensina o aluno a mentir.

---

## 2. Teto diário com rolagem do excedente para o dia seguinte (20/28/36/36 itens por canto no Completo; 9 a 11 na Essencial; 45 no Intensivo), regra de sanguessuga (bloco com N lapsos sai da fila ativa e volta como conteúdo, não como agenda) e reset de lapses depois de M acertos consecutivos

**Migração**

Teto diário com rolagem do excedente para o dia seguinte (20/28/36/36 itens por canto no Completo; 9 a 11 na Essencial; 45 no Intensivo), regra de sanguessuga (bloco com N lapsos sai da fila ativa e volta como conteúdo, não como agenda) e reset de lapses depois de M acertos consecutivos.

**Onde:** src/lib/srs.ts:218-220 (reviewBatchSize) e a função review_chunk em supabase/schema.sql:1352. Hoje reviewBatchSize apenas corta o LOTE EXIBIDO — nada faz o excedente rolar, nada tira da fila o bloco que só fabrica lapso, e não existe nenhum caminho que decremente lapses.

**Por quê:** Simulado com um aluno ruim (40/38/22), o atraso chega a 550 itens e nunca drena: a fila vira uma dívida que só cresce e o aluno abandona. E lapses é monotônico, então como critério ele é uma condenação permanente — por isso nenhum dos 52 portões o usa.

---

## 3. Uma única definição de 'dominado'

**Migração**

Uma única definição de 'dominado': função SQL `public.is_mastered(chunk)` usada pela view, pelos portões e por qualquer agregado, espelhada em srs.ts. O predicado dos portões é repetitions >= 4 AND spoken_count >= 2 (Completo/Intensivo) ou repetitions >= 4 (Essencial); com gradeFromRecall já devolvendo 4, a cláusula ease_factor >= 2,3 volta a ser alcançável e pode entrar.

**Onde:** src/lib/srs.ts:165-173 (masteryStage: repetitions >= 4 AND ease >= 2,3 AND spoken_count >= 2) contra supabase/schema.sql:1510 (chunk_review_queue.mastered: repetitions >= 3 AND ease >= 2,3, ignorando a fala) contra os 52 portões. São três réguas para a mesma palavra.

**Por quê:** O app consulta a view para os agregados e a função TS para a tela do bloco, e as duas discordam. Um portão que diz 'dominado' passa ou não passa conforme quem o implementar, e o aluno vê dois números diferentes na mesma sessão.

---

## 4. Object storage para o áudio

**Migração**

Object storage para o áudio: bucket do Supabase Storage (ou CDN) com URL assinada, e o audio-manifest passando a resolver chave -> URL remota em vez de caminho em public/audio.

**Onde:** public/audio (500 arquivos, 58 MB hoje) e content/audio-manifest.ts.

**Por quê:** A espinha pede 12.360 arquivos novos e 256 MB (12.138 sentenças de família a 15 KB medidos + 222 peças graduadas do Canto 1). Somados ao que já existe seriam 12.860 arquivos e 314 MB versionados em git. Não cabe, e nenhum ajuste de portão ou de rampa resolve.

---

## 5. enroll_circuit_chunks passa a receber a trilha e matricular só o baralho daquela trilha

**Migração**

enroll_circuit_chunks passa a receber a trilha e matricular só o baralho daquela trilha: nucleo(N) = min(10, ceil(0,32 x blocosNovos(N))) na Essencial (359 blocos no total), tudo no Completo e no Intensivo (1.193). Precisa também de uma coluna que marque o bloco como de núcleo, para o portão poder contar 'do núcleo'.

**Onde:** supabase/schema.sql:1310-1346 (enroll_circuit_chunks(uuid, integer)) e o grant em :1493-1494.

**Por quê:** A função matricula os blocos do circuito sem olhar a trilha. A Essencial tem 3 minutos de Memória — 9 cartões por dia — e 1.193 blocos exigem cerca de 33 por dia em regime: sem o corte, a fila da Essencial estoura em três meses e os 52 portões dela ficam impossíveis pelo mesmo motivo que os do Completo estavam.

---

## 6. Tabela de avaliação de portão (circuit_gate_status

**Migração**

Tabela de avaliação de portão (circuit_gate_status: user_id, circuit_number, track, avaliado_em, passou, os componentes com valor medido e valor exigido), calculada por função SQL a partir de study_days, lesson_progress e chunk_mastery.

**Onde:** Não existe: uma busca por gate/portão em supabase/ só acha o guard de autenticação (schema.sql:1690). Não há tabela, view nem função que avalie os 52 portões.

**Por quê:** Os 52 portões são a espinha do produto e hoje não têm onde ser calculados nem exibidos. Sem eles persistidos, 'passou o circuito 14' é uma frase do briefing, o aluno não vê por que passou ou não, e nenhuma tela pode mostrar o que falta.

---

## 7. Modelar a família do bloco

**Migração**

Modelar a família do bloco: as 12.138 formas são FACES do mesmo cartão (média de 10,17 por bloco, variando 6/9/12/11 por nível), e precisam de tabela própria (chunk_forms) mais o sorteio de face a cada revisão. chunk_mastery guarda um en/pt único.

**Onde:** supabase/schema.sql:1274-1296 (chunk_mastery tem chunk_en e chunk_pt, um par só) e src/lib/srs.ts:20-36 (a interface ChunkMastery espelha isso).

**Por quê:** Toda a aritmética da rampa aprovada — 1.193 blocos, 12.138 sentenças, fila que não multiplica por dez — depende de face variável sobre cartão único. Sem chunk_forms, ou a fila tem 1.193 itens sempre com a mesma frase (e o aluno decora a frase, não o molde), ou tem 12.138 itens e o teto diário e o portão caem juntos.

---

## 8. DAY_BLOCKS deixa de ser um Record plano de cinco ids com um `minutes` fixo e vira orçamento de QUATRO MOVIMENTOS por trilha (Ouvido/Memória/Boca/Som = 55/15/20/10) com modulação por circuito dentro do movimento Ouvido; o bloco `authentic` sai do orçamento da sessão e vira prescrição 'fora da sessão' para as três trilhas, de 0 a 60 min por circuito

**Refatoração**

DAY_BLOCKS deixa de ser um Record plano de cinco ids com um `minutes` fixo e vira orçamento de QUATRO MOVIMENTOS por trilha (Ouvido/Memória/Boca/Som = 55/15/20/10) com modulação por circuito dentro do movimento Ouvido; o bloco `authentic` sai do orçamento da sessão e vira prescrição 'fora da sessão' para as três trilhas, de 0 a 60 min por circuito.

**Onde:** content/curriculum.ts:133-161 (DayBlockId e DAY_BLOCKS), :167-204 (TRACKS[].blocks) e src/lib/learning.ts:274-276 (dayBlocksFor, que só faz map de ids para minutos). Duplicado em SQL em supabase/schema.sql:1220-1245 (track_targets), que precisa ser mudado junto ou vai divergir.

**Por quê:** Hoje o arquivo dá a Completo listening = 15 min fixos quando a rampa pede de 14 a 29, põe o Ouvido em 25% quando o desenho pede 55%, e dá o único bloco parecido com input de fora (authentic, 40 min, plano) só ao Intensivo. Enquanto DAY_BLOCKS for plano, nenhum orçamento por circuito existe no código.

---

## 9. Reserva de 45% do teto diário da fila para os blocos do circuito corrente, antes de ordenar por vencimento

**Função**

Reserva de 45% do teto diário da fila para os blocos do circuito corrente, antes de ordenar por vencimento. Duas listas: reservada (circuit_number = circuito corrente) e geral, concatenadas até o teto.

**Onde:** src/app/app/revisao/page.tsx:25-39 (o select `.lte('due_date', today).order('due_date').limit(200)` seguido de sortReviewQueue + slice) e src/lib/srs.ts:197-212 (sortReviewQueue, que ainda põe os travados na frente de tudo). A coluna necessária já existe: chunk_mastery.circuit_number, com índice chunk_mastery_circ_idx (schema.sql:1278 e 1299).

**Por quê:** Com teto e a fila ordenada por vencimento, os blocos velhos consomem o teto inteiro e os blocos NOVOS do circuito corrente não recebem revisão nenhuma — medido em cinco circuitos do Canto 3 recebendo menos de 50%, alguns zero. O portão do circuito corrente fica impossível exatamente para quem está com dificuldade, que é o oposto do que o teto existe para fazer.

---

## 10. Persistir o portão de escuta

**Função**

Persistir o portão de escuta: as escutas viram linha em listening_exposures via RPC, e o botão de fuga sai.

**Onde:** src/components/audio/audio-player.tsx:460-520 (ImmersionGate). O contador é `useState(0)` na linha 469, e as linhas 509-515 renderizam o botão 'Mostrar o texto agora' que faz setForced(true).

**Por quê:** O portão vive só em estado de React: um F5 zera o contador, e o botão de fuga abre o texto em um clique. Um portão com botão de pular é conselho com animação, e o diagnóstico do próprio curso diz que ler antes de ouvir instala fonema português sobre grafia inglesa e que desfazer isso custa caro.

---

## 11. countListen passa a ser chamada no fim do áudio, não no clique do play, com guarda de velocidade (<= 1,0x) e de aba em primeiro plano

**Função**

countListen passa a ser chamada no fim do áudio, não no clique do play, com guarda de velocidade (<= 1,0x) e de aba em primeiro plano.

**Onde:** src/components/audio/audio-player.tsx:248-253 (countListen), chamada em toggle() na linha 274 e em restart() na linha 284. Os pontos corretos são o audio.onended nas linhas 216-222 e o onEnd da síntese na linha 192.

**Por quê:** Como está, quatro cliques em play em quatro segundos destravam o texto do dia 1 sem que uma única frase tenha sido ouvida. O contador mede intenção de tocar, não escuta.

---

## 12. Não enviar ao cliente o texto que está atrás do portão

**Função**

Não enviar ao cliente o texto que está atrás do portão: o server component filtra content.gated e os blocos com `gate` do payload enquanto listening_exposures.unlocked_at for nulo.

**Onde:** src/components/lesson/lesson-player.tsx:406-414 e :463-469 — os blocos travados são serializados na resposta e apenas não renderizados; o admin (src/app/admin/licoes/[id]/page.tsx:116) mostra tudo, o que lá está certo.

**Por quê:** O texto travado está no HTML da página. Quem abrir o inspetor lê a transcrição inteira antes da primeira escuta, e o portão vira decoração — exatamente o que a Decisão C manda deixar de ser.

---

## 13. gradeFromScore passa a receber o piso esperado do circuito e devolver 4 quando o aluno ATINGE esse piso, em vez de ser uma escala absoluta

**Função**

gradeFromScore passa a receber o piso esperado do circuito e devolver 4 quando o aluno ATINGE esse piso, em vez de ser uma escala absoluta.

**Onde:** src/lib/srs.ts:96-103. gradeFromSpokenChunk (linha 131) já protege o caminho da gravação com Math.max(3, ...), e gradeFromRecall (linha 153) já foi corrigido para 5/4/1.

**Por quê:** Numa escala absoluta o iniciante passa meses abaixo de 6,0 e o motor o pune por ser iniciante. É o único dos caminhos de nota que ainda não tem piso: a fila está protegida, a gravação está protegida, a nota da tutora que entra por outros caminhos não. Enquanto isso não existir, nenhum portão antes do C27 pode citar nota de fala — que é exatamente o que a rampa aprovada faz.

---

## 14. Corrigir o orçamento da Essencial dentro da própria fonte da verdade

**Uma linha**

Corrigir o orçamento da Essencial dentro da própria fonte da verdade: blocks ['core','srs'] soma 15 + 15 = 30 minutos contra dailyMinutes: 20 declarado três linhas acima.

**Onde:** content/curriculum.ts:171 (dailyMinutes: 20) e :178 (blocks: ['core','srs']), lidos juntos por src/lib/learning.ts:274.

**Por quê:** A trilha estoura o próprio orçamento em 50% no arquivo que o seed e o gerador de lições usam como lei. Qualquer tela que some dayBlocksFor('essential') mostra 30 min para quem comprou 20 — e foi essa incoerência que deixou a Essencial sem Ouvido e sem Boca no desenho antigo.

---

## 15. reviewBatchSize passa a receber os minutos do movimento Memória da trilha (3 / 9 / 15), não números escritos na chamada

**Uma linha**

reviewBatchSize passa a receber os minutos do movimento Memória da trilha (3 / 9 / 15), não números escritos na chamada.

**Onde:** src/app/app/revisao/page.tsx:38 — `reviewBatchSize(track.dailyMinutes >= 60 ? 15 : 10)`.

**Por quê:** Os 15 e 10 minutos são invenção do call site e não correspondem a orçamento nenhum: com o novo desenho a Memória é 3 min na Essencial, 9 no Completo e 15 no Intensivo, e o Intensivo hoje recebe o mesmo lote do Completo. O `.limit(200)` da consulta acima também vira o teto real quando o atraso passa de 200.

---

## 16. goal_met deixa de usar profiles

**Uma linha**

goal_met deixa de usar profiles.daily_goal_minutes com fallback 15 e passa a usar os minutos da trilha do aluno (20 / 60 / 100).

**Onde:** supabase/schema.sql:617-618 e 2455-2456 (select p.daily_goal_minutes into v_goal) e :624 / :2462 (`>= coalesce(v_goal, 15)`).

**Por quê:** A ofensiva e a presença são calculadas contra uma meta de perfil que ignora a trilha: um aluno do Intensivo bate a meta com 15 minutos. O componente 'presença' dos portões da Essencial precisa se apoiar em lesson_progress.status = 'completed' justamente porque goal_met, hoje, não significa nada.
