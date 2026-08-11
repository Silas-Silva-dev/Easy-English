/**
 * SEGUNDO CANTO: Contar (circuitos 14 a 26)
 *
 * O salto deste canto é sair do "yes / no" e passar a NARRAR: o que aconteceu,
 * o que vai acontecer, o que você acha. É aqui que a conversa deixa de ser
 * troca de informação e vira conversa de verdade.
 */

import type { CircuitContent } from "../compose-lesson";

export const CANTO_2: CircuitContent[] = [
  // ======================================================== 14
  {
    n: 14,
    immersion: [
      ["Mike", "Hey! How was your weekend?", "Ei! Como foi seu fim de semana?"],
      ["Ana", "It was great, thanks! I went to the beach.", "Foi ótimo, obrigada! Eu fui para a praia."],
      ["Mike", "Nice! With friends?", "Legal! Com amigos?"],
      ["Ana", "Yeah, I met up with some friends on Saturday.", "É, eu encontrei uns amigos no sábado."],
      ["Mike", "Sounds fun. And Sunday?", "Parece divertido. E domingo?"],
      ["Ana", "I stayed home and watched a movie. Nothing special, really.", "Fiquei em casa e assisti um filme. Nada de especial, na verdade."],
      ["Mike", "Sometimes that's the best kind.", "Às vezes esse é o melhor tipo."],
      ["Ana", "Exactly. What about yours?", "Exatamente. E o seu?"],
    ],
    listening: [
      ["Kate", "How was your weekend, Bruno?", "Como foi seu fim de semana, Bruno?"],
      ["Bruno", "Pretty quiet. I stayed home most of the time.", "Bem calmo. Fiquei em casa a maior parte do tempo."],
      ["Kate", "Nothing at all?", "Nada mesmo?"],
      ["Bruno", "Well, I went to my sister's place on Sunday and we cooked.", "Bom, eu fui na casa da minha irmã no domingo e a gente cozinhou."],
      ["Kate", "Oh, that sounds nice. What did you make?", "Ah, parece bom. O que vocês fizeram?"],
      ["Bruno", "Feijoada. It took four hours.", "Feijoada. Levou quatro horas."],
      ["Kate", "Four hours! Was it worth it?", "Quatro horas! Valeu a pena?"],
      ["Bruno", "Absolutely. What about yours?", "Com certeza. E o seu?"],
    ],
    why: {
      title: "O passado que você precisa (e o que pode ignorar por enquanto)",
      body:
        "Passado em inglês tem duas famílias: os regulares (**+ed**: *worked*, *watched*, *stayed*) e os irregulares, que mudam de forma (*go → went*, *have → had*, *make → made*).\n\nNão decore lista de irregulares. Os vinte mais frequentes cobrem quase toda conversa, e você vai instalá-los como bloco: *I went*, *I had*, *I made*, *I saw*, *I did*.\n\nErrar o passado quase nunca gera mal-entendido: o contexto salva. Silêncio, sim, gera.",
    },
    // Molde de duas lacunas: lugar | o que fez lá.
    swaps: [
      "the beach | swam all afternoon",
      "my parents' place | ate way too much",
      "a friend's party | got home really late",
      "the gym | regretted it the next day",
      "the mall | didn't buy anything",
      "a barbecue | met a bunch of people",
      "the movies | fell asleep halfway through",
      "downtown | just walked around",
    ],
    expansion: [
      ["It was great, thanks! I went to the beach and met up with some friends.", "Foi ótimo, obrigada! Eu fui para a praia e encontrei uns amigos."],
      ["I stayed home and watched a movie, so nothing special, really.", "Fiquei em casa e assisti um filme, então nada de especial."],
      ["I went to my sister's place on Sunday and we cooked for four hours.", "Eu fui na casa da minha irmã no domingo e a gente cozinhou por quatro horas."],
      ["It was pretty quiet, but honestly I needed that. What about yours?", "Foi bem calmo, mas sinceramente eu precisava disso. E o seu?"],
    ],
    drift: [
      "O melhor fim de semana que você já teve",
      "O que você faz quando não tem nada marcado",
      "Se você prefere sair ou ficar em casa",
      "Um plano que deu errado e virou história boa",
    ],
    sounds: [
      ["As três pronúncias do -ED", "*watched* soa 'watcht' (T), *stayed* soa 'steid' (D), *visited* soa 'visitid' (ID). Nunca 'watch-ED'. A regra sai sozinha com a boca, não com a tabela."],
      ["'Went' é curto", "Uma sílaba, vogal fechada, T final quase engolido. Brasileiro alonga: 'uenti'. Corte o final."],
    ],
    quiz: [
      ["'How was your weekend?' espera que resposta?", ["Um relato minuto a minuto", "Uma frase curta e a pergunta devolvida", "Só 'good'", "Uma desculpa"], 1, "É small talk: duas ou três frases e devolve. Contar demais é tão estranho quanto responder só 'good'."],
      ["Qual o passado de 'go'?", ["goed", "gone", "went", "going"], 2, "'Went' é irregular. 'Gone' existe, mas em outra construção (I have gone): que vem no circuito 28."],
      ["'Nothing special, really' serve para:", ["Encerrar a conversa", "Dizer que foi um fim de semana comum, sem parecer rude", "Reclamar", "Elogiar"], 1, "É modéstia conversacional. Quase sempre seguido de algo que a pessoa acabou fazendo: como no diálogo do Bruno."],
      ["'I met up with some friends' significa:", ["Encontrei por acaso", "Combinei e encontrei", "Conheci pela primeira vez", "Reuni todos"], 1, "'Meet up' é encontro combinado. 'Run into' (circuito 40) é o encontro por acaso."],
    ],
  },

  // ======================================================== 15
  {
    n: 15,
    immersion: [
      ["Ana", "You won't believe what happened yesterday.", "Você não vai acreditar no que aconteceu ontem."],
      ["Kate", "What? Tell me.", "O quê? Me conta."],
      ["Ana", "So, I was walking home when I saw my old boss.", "Então, eu estava indo para casa quando vi meu antigo chefe."],
      ["Kate", "No way. Did he see you?", "Sem chance. Ele te viu?"],
      ["Ana", "All of a sudden he crossed the street and hugged me.", "De repente ele atravessou a rua e me abraçou."],
      ["Kate", "That's crazy!", "Que loucura!"],
      ["Ana", "And then it got worse. He called me by the wrong name.", "E aí piorou. Ele me chamou pelo nome errado."],
      ["Kate", "Oh no!", "Ah não!"],
      ["Ana", "It was so embarrassing! But in the end, everything was fine.", "Foi tão constrangedor! Mas no fim, deu tudo certo."],
    ],
    listening: [
      ["Bruno", "You won't believe what happened at the airport.", "Você não vai acreditar no que aconteceu no aeroporto."],
      ["Mike", "Uh oh. What?", "Opa. O quê?"],
      ["Bruno", "So, I was checking in when they said my flight was cancelled.", "Então, eu estava fazendo check-in quando disseram que meu voo foi cancelado."],
      ["Mike", "That's rough.", "Isso é duro."],
      ["Bruno", "And then it got worse. All of a sudden the next flight was full too.", "E aí piorou. De repente o próximo voo estava cheio também."],
      ["Mike", "What did you do?", "O que você fez?"],
      ["Bruno", "I waited eight hours. It was so frustrating!", "Esperei oito horas. Foi tão frustrante!"],
      ["Mike", "That's crazy. Did you make it?", "Que loucura. Você conseguiu chegar?"],
      ["Bruno", "In the end, everything was fine. I got there at midnight.", "No fim, deu tudo certo. Cheguei lá à meia-noite."],
    ],
    why: {
      title: "Duas camadas de passado numa história",
      body:
        "Toda história tem um **pano de fundo** e um **acontecimento**.\n\n*I **was walking** home*: o fundo, o que estava rolando.\n*when I **saw** my old boss*: o acontecimento que corta o fundo.\n\nÉ por isso que *So, I was ___ when suddenly ___* é o molde de história mais útil do inglês: ele já traz as duas camadas montadas. Você só troca as peças.",
    },
    // Molde de duas lacunas: o que eu estava fazendo | o que aconteceu de repente.
    swaps: [
      "walking home | it started pouring",
      "waiting for the bus | my phone died",
      "having lunch | my boss called",
      "working late | the power went out",
      "getting ready to leave | someone knocked",
      "talking to a client | the call dropped",
      "cooking dinner | the smoke alarm went off",
      "trying to sleep | the neighbors started a party",
    ],
    expansion: [
      ["So, I was walking home when all of a sudden I saw my old boss.", "Então, eu estava indo para casa quando de repente vi meu antigo chefe."],
      ["And then it got worse, because he called me by the wrong name.", "E aí piorou, porque ele me chamou pelo nome errado."],
      ["It was so embarrassing, but in the end everything was fine.", "Foi tão constrangedor, mas no fim deu tudo certo."],
      ["You won't believe what happened. I was working late when the power went out.", "Você não vai acreditar no que aconteceu. Eu estava trabalhando até tarde quando a luz caiu."],
    ],
    drift: [
      "A história mais constrangedora que você já viveu",
      "Uma coincidência inacreditável que aconteceu com você",
      "A pior viagem que você já fez",
      "Uma vez em que você entendeu tudo errado",
    ],
    sounds: [
      ["'Was' é fraco na frase", "Sozinho é 'uóz'. Dentro da frase vira 'uez', quase mudo: 'I wez walking'. Toda palavra funcional encolhe assim."],
      ["'All of a sudden' vira 'ólovassádn'", "Quatro palavras, uma respiração. É expressão fixa: treine como se fosse uma palavra só."],
    ],
    quiz: [
      ["Qual parte é o pano de fundo da história?", ["I saw my old boss", "I was walking home", "He hugged me", "It was embarrassing"], 1, "O 'was walking' é a cena em curso; o 'saw' é o que corta ela. Toda história boa tem essas duas camadas."],
      ["'You won't believe what happened' serve para:", ["Duvidar do outro", "Abrir uma história e prender a atenção", "Encerrar", "Pedir confirmação"], 1, "É a abertura clássica. Sem ela, você começa a história e a pessoa ainda não entrou no modo de ouvir."],
      ["'And then it got worse' indica:", ["Que a história acabou", "Que vem outra reviravolta", "Que você se arrependeu", "Que foi bom"], 1, "É a costura que mantém a história andando. Sem conectivo de reviravolta, o relato vira lista de fatos."],
      ["'In the end' significa:", ["Finalmente, depois de tudo", "No fundo", "Por fim das contas, no final", "No final da rua"], 2, "'In the end' fecha a narrativa. Cuidado: 'at the end' é o fim de algo físico ou temporal específico: coisa diferente."],
    ],
  },

  // ======================================================== 16
  {
    n: 16,
    immersion: [
      ["Kate", "What were you like as a kid?", "Como você era quando criança?"],
      ["Ana", "I used to play soccer every day.", "Eu jogava futebol todo dia."],
      ["Kate", "Really? Were you any good?", "Sério? Você era boa?"],
      ["Ana", "When I was a kid, I thought I was amazing.", "Quando eu era criança, eu achava que era incrível."],
      ["Kate", "Do you still play?", "Você ainda joga?"],
      ["Ana", "I don't do that anymore. I really miss that.", "Eu não faço mais isso. Sinto muita falta."],
      ["Kate", "Why did you stop?", "Por que você parou?"],
      ["Ana", "Work, mostly. Things were different back then.", "Trabalho, principalmente. As coisas eram diferentes naquela época."],
    ],
    listening: [
      ["Mike", "This song reminds me of high school.", "Essa música me lembra o colégio."],
      ["Bruno", "Me too. I used to listen to this every morning.", "Eu também. Eu ouvia isso toda manhã."],
      ["Mike", "What were you like back then?", "Como você era naquela época?"],
      ["Bruno", "Quiet. When I was a kid, I barely talked to anyone.", "Quieto. Quando eu era criança, eu quase não falava com ninguém."],
      ["Mike", "Hard to believe now.", "Difícil de acreditar agora."],
      ["Bruno", "Things were different back then. I don't do that anymore.", "As coisas eram diferentes naquela época. Eu não sou mais assim."],
      ["Mike", "Do you miss it?", "Você sente falta?"],
      ["Bruno", "Some parts. I really miss having no responsibilities.", "De algumas partes. Sinto muita falta de não ter responsabilidade."],
    ],
    why: {
      title: "'Used to' é o nosso imperfeito",
      body:
        "Português tem uma forma verbal só para hábito no passado: 'eu **jogava**'. Inglês não tem: resolve com o bloco **used to**.\n\n*I used to play soccer* = eu jogava futebol (e não jogo mais).\n\nDetalhe que vale ouro: o *used to* já carrega a ideia de 'não é mais assim'. Se ainda acontece, não use: diga *I still play*.\n\nE cuidado com o falso amigo: *I'm used to it* (com o verbo to be) significa 'estou acostumado'. Outro bloco, outro sentido.",
    },
    swaps: ["play soccer every day", "live in a small town", "hate vegetables", "wake up at five", "study a lot", "be really shy", "spend every summer at my grandma's", "think I knew everything"],
    expansion: [
      ["I used to play soccer every day, but I don't do that anymore.", "Eu jogava futebol todo dia, mas não faço mais isso."],
      ["When I was a kid, things were different back then and I really miss that.", "Quando eu era criança, as coisas eram diferentes e sinto muita falta disso."],
      ["This song reminds me of high school, when I used to listen to it every morning.", "Essa música me lembra o colégio, quando eu ouvia isso toda manhã."],
      ["I used to be really shy, but working with people changed that completely.", "Eu era muito tímido, mas trabalhar com gente mudou isso completamente."],
    ],
    drift: [
      "Uma coisa que você fazia e parou",
      "Como era sua cidade quando você era criança",
      "Algo que era normal na sua infância e hoje não é mais",
      "Se você era o tipo quieto ou o bagunceiro",
    ],
    sounds: [
      ["'Used to' vira 'iustu'", "O D some completamente e o S soa como SS. Nunca 'iuzed tu'. Duas palavras, um som só."],
      ["'Anymore' com o acento no fim", "eni-MÓR. Brasileiro põe a força no começo. E o R final é enrolado, não vibrado."],
    ],
    quiz: [
      ["'I used to play soccer' quer dizer que você:", ["Joga futebol agora", "Jogava antes e parou", "Vai jogar", "Gosta de futebol"], 1, "O 'used to' já embute o 'e não faço mais'. Se ainda faz, use 'I still play'."],
      ["Qual a diferença de 'I'm used to it'?", ["Nenhuma", "Significa 'estou acostumado', é outro bloco", "É mais formal", "É o plural"], 1, "Um usa o verbo to be, o outro não. Confundir os dois é clássico: guarde como blocos separados."],
      ["'Things were different back then' se refere a:", ["Ao futuro", "A uma época passada específica", "A agora", "A outro país"], 1, "'Back then' aponta para o passado já mencionado. É a costura que evita repetir 'when I was a kid' toda hora."],
      ["'I really miss that' significa:", ["Eu perdi isso", "Eu sinto falta disso", "Eu errei isso", "Eu não vi isso"], 1, "'Miss' é sentir falta. Também significa perder (um voo, um prazo): o contexto separa."],
    ],
  },

  // ======================================================== 17
  {
    n: 17,
    immersion: [
      ["Mike", "What are you up to this weekend?", "O que você vai fazer esse fim de semana?"],
      ["Ana", "I'm going to visit my parents.", "Eu vou visitar meus pais."],
      ["Mike", "Nice. The whole weekend?", "Legal. O fim de semana todo?"],
      ["Ana", "I haven't decided yet. Maybe just Saturday.", "Ainda não decidi. Talvez só sábado."],
      ["Mike", "We're going hiking on Sunday. Do you want to join?", "A gente vai fazer uma trilha domingo. Você quer ir junto?"],
      ["Ana", "I'd love to, but I can't. Family stuff.", "Eu adoraria, mas não posso. Coisa de família."],
      ["Mike", "No worries. Maybe next time!", "Sem problema. Talvez na próxima!"],
      ["Ana", "Definitely. I'm thinking about traveling next month, though.", "Com certeza. Estou pensando em viajar mês que vem, aliás."],
    ],
    listening: [
      ["Kate", "Any plans for the holidays?", "Algum plano para o feriado?"],
      ["Bruno", "I'm thinking about traveling, but I haven't decided yet.", "Estou pensando em viajar, mas ainda não decidi."],
      ["Kate", "Where would you go?", "Para onde você iria?"],
      ["Bruno", "Somewhere with a beach. I'm going to look at prices tonight.", "Algum lugar com praia. Vou olhar preços hoje à noite."],
      ["Kate", "We're renting a place by the coast. Do you want to join?", "A gente vai alugar um lugar no litoral. Você quer ir junto?"],
      ["Bruno", "Seriously? I'd love to!", "Sério? Eu adoraria!"],
      ["Kate", "Great, I'll send you the details.", "Ótimo, vou te mandar os detalhes."],
      ["Bruno", "Perfect. And if it doesn't work out, maybe next time.", "Perfeito. E se não der certo, talvez na próxima."],
    ],
    why: {
      title: "'Going to' e 'will' não são a mesma coisa",
      body:
        "**Going to** = já decidido, já pensado. *I'm going to visit my parents*: está no plano.\n\n**Will** = decidido agora, na hora. *I'll send you the details*: decidiu enquanto falava.\n\nNa dúvida em conversa, use **going to** para planos e **I'll** para promessas de momento. Errar aqui não gera mal-entendido, mas acertar faz você soar bem mais natural.\n\nE sim: na fala, *going to* vira **gonna**. O circuito 42 é inteiro sobre isso.",
    },
    swaps: ["visit my parents", "stay home and rest", "finally clean the house", "look for a new job", "travel next month", "take a course", "call my sister", "figure it out later"],
    expansion: [
      ["I'm going to visit my parents, but I haven't decided if I'll stay the whole weekend.", "Eu vou visitar meus pais, mas ainda não decidi se fico o fim de semana todo."],
      ["I'd love to, but I can't. I'm thinking about traveling next month instead.", "Eu adoraria, mas não posso. Estou pensando em viajar mês que vem em vez disso."],
      ["What are you up to this weekend? Do you want to join us?", "O que você vai fazer esse fim de semana? Quer ir junto com a gente?"],
      ["I haven't decided yet, so maybe next time. Thanks for the invite though!", "Ainda não decidi, então talvez na próxima. Mas obrigado pelo convite!"],
    ],
    drift: [
      "O plano mais empolgante que você tem para este ano",
      "Uma viagem que você quer fazer e ainda não fez",
      "O que você faria com uma semana livre",
      "Se você planeja tudo ou decide na hora",
    ],
    sounds: [
      ["'Going to' vira 'gonna'", "Em fala normal, sempre. 'I'm gonna visit'. Não é gíria nem preguiça: é como americano fala o tempo todo."],
      ["'Want to' vira 'wanna'", "'Do you wanna join?' Mesma lógica. Reconhecer isso é o que separa entender e não entender uma conversa rápida."],
    ],
    quiz: [
      ["'I'm going to visit my parents' indica:", ["Uma decisão tomada na hora", "Um plano já decidido", "Uma obrigação", "Uma possibilidade remota"], 1, "'Going to' é plano. Para decisão de momento, usa-se 'I'll'."],
      ["Como recusar um convite sem ser rude?", ["No.", "I can't.", "I'd love to, but I can't.", "Impossible."], 2, "O 'I'd love to' antes do 'but' faz todo o trabalho social. Sem ele, o não soa seco."],
      ["'I haven't decided yet' quer dizer:", ["Eu decidi que não", "Ainda não decidi", "Nunca vou decidir", "Não posso decidir"], 1, "'Yet' marca que a decisão ainda está aberta. É honesto e mantém a porta aberta."],
      ["Na fala rápida, 'going to' soa como:", ["go-ing to", "gonna", "goin to", "gon"], 1, "'Gonna' é o padrão absoluto na fala. Você não precisa falar assim, mas precisa reconhecer."],
    ],
  },

  // ======================================================== 18
  {
    n: 18,
    immersion: [
      ["Mike", "Are you free on Friday?", "Você está livre na sexta?"],
      ["Ana", "I think so. What time?", "Acho que sim. Que horas?"],
      ["Mike", "Does 3 PM work for you?", "Três da tarde funciona para você?"],
      ["Ana", "Can we make it a bit later? Say, four?", "Dá para ser um pouco mais tarde? Tipo, quatro?"],
      ["Mike", "Four works for me!", "Quatro funciona para mim!"],
      ["Ana", "Perfect. See you then!", "Perfeito. Até lá!"],
      ["Mike", "Actually, wait. Something came up.", "Na verdade, espera. Surgiu uma coisa."],
      ["Ana", "No problem. Can we reschedule?", "Sem problema. Podemos remarcar?"],
    ],
    listening: [
      ["Kate", "Hey, are you free next week?", "Ei, você está livre semana que vem?"],
      ["Bruno", "Should be. What day?", "Devo estar. Que dia?"],
      ["Kate", "Does Tuesday work for you?", "Terça funciona para você?"],
      ["Bruno", "Tuesday's tight. Can we make it a bit later in the week?", "Terça está apertado. Dá para ser um pouco mais para o fim da semana?"],
      ["Kate", "Thursday at two?", "Quinta às duas?"],
      ["Bruno", "Works for me! Should I bring anything?", "Funciona para mim! Devo levar alguma coisa?"],
      ["Kate", "Just yourself. Oh wait, something came up on Thursday.", "Só você. Ah, espera, surgiu uma coisa na quinta."],
      ["Bruno", "No worries, can we reschedule? Friday maybe?", "Sem problema, podemos remarcar? Sexta talvez?"],
    ],
    why: {
      title: "'Work' não é só trabalhar",
      body:
        "*Does 3 PM work for you?*: o horário não trabalha, ele **serve**, **encaixa**.\n\n*Work* em inglês cobre 'funcionar', 'dar certo', 'servir': *It works*, *That works for me*, *It's not working*.\n\nEssa é a lógica que mais atrapalha quem traduz palavra por palavra. Verbos frequentes em inglês (*get*, *take*, *work*, *make*) têm dez sentidos cada, e nenhum deles é o sentido do dicionário. Guarde o **bloco inteiro** e o sentido vem junto.",
    },
    swaps: ["3 PM", "Friday morning", "next Tuesday", "any time after five", "the same time next week", "a video call", "Thursday instead", "lunch time"],
    expansion: [
      ["Are you free on Friday? Does 3 PM work for you?", "Você está livre na sexta? Três da tarde funciona para você?"],
      ["Can we make it a bit later? Something came up in the morning.", "Dá para ser um pouco mais tarde? Surgiu uma coisa de manhã."],
      ["Works for me! See you then, and let me know if anything changes.", "Funciona para mim! Até lá, e me avise se mudar alguma coisa."],
      ["Sorry, can we reschedule? I'm free any time next week.", "Desculpa, podemos remarcar? Estou livre qualquer horário semana que vem."],
    ],
    drift: [
      "Como você organiza sua agenda",
      "Uma vez em que você esqueceu completamente de um compromisso",
      "Se você é o que chega cedo ou o que chega atrasado",
      "O compromisso que você mais adia",
    ],
    sounds: [
      ["'Does' fraco vira 'dez'", "Em pergunta, 'does' quase some: 'dez three PM work for you'. Palavra funcional nunca é acentuada."],
      ["'Work for you' emendado", "'Workforyou': sem pausa. Se você separar, soa como leitura de texto, não como pergunta."],
    ],
    quiz: [
      ["'Does 3 PM work for you?' pergunta:", ["Se você trabalha às 3", "Se esse horário serve", "Se você funciona a essa hora", "Se é dia útil"], 1, "'Work' aqui é servir, encaixar. É um dos verbos mais polissêmicos do inglês."],
      ["'Something came up' significa:", ["Alguma coisa subiu", "Surgiu um imprevisto", "Alguém apareceu", "Deu tudo certo"], 1, "É a desculpa universal e educada. Ninguém pergunta o que foi: faz parte do jogo."],
      ["Como pedir um horário mais tarde?", ["Make it later", "Can we make it a bit later?", "I want later", "Later is possible?"], 1, "O 'a bit' suaviza e o 'can we' inclui o outro na decisão. Pedir sem eles soa como ordem."],
      ["'Works for me!' é a forma curta de:", ["I work with that", "That works for me", "It's my work", "I can work"], 1, "Resposta curta e muito comum. Confirma sem repetir a proposta inteira."],
    ],
  },

  // ======================================================== 19
  {
    n: 19,
    immersion: [
      ["Kate", "I think remote work is better for everyone.", "Eu acho que trabalho remoto é melhor para todo mundo."],
      ["Ana", "I totally agree. Especially for focus.", "Eu concordo totalmente. Principalmente para foco."],
      ["Kate", "Right? And no commute.", "Né? E sem deslocamento."],
      ["Ana", "That's a good point. I see your point, but I do miss people.", "Esse é um bom ponto. Eu entendo seu ponto, mas eu sinto falta de gente."],
      ["Kate", "Hmm. I'm not so sure about that.", "Hmm. Eu não tenho tanta certeza disso."],
      ["Ana", "It depends on the situation, I guess.", "Depende da situação, eu acho."],
      ["Kate", "Fair enough.", "Justo."],
      ["Ana", "Let's agree to disagree!", "Vamos concordar em discordar!"],
    ],
    listening: [
      ["Mike", "Honestly, I think learning grammar first is the only way.", "Sinceramente, eu acho que aprender gramática primeiro é o único jeito."],
      ["Bruno", "I see your point, but that's not how kids learn.", "Eu entendo seu ponto, mas não é assim que criança aprende."],
      ["Mike", "That's a good point.", "Esse é um bom ponto."],
      ["Bruno", "I'm not so sure grammar first works for speaking.", "Eu não tenho tanta certeza de que gramática primeiro funciona para falar."],
      ["Mike", "It depends on the person, maybe.", "Depende da pessoa, talvez."],
      ["Bruno", "I totally agree with that part.", "Eu concordo totalmente com essa parte."],
      ["Mike", "Fair enough. Let's agree to disagree on the rest.", "Justo. Vamos concordar em discordar no resto."],
      ["Bruno", "Deal.", "Fechado."],
    ],
    why: {
      title: "O 'but' precisa de almofada",
      body:
        "Em português a gente discorda direto: 'mas eu acho que não'. Em inglês, discordar sem almofada soa agressivo.\n\nA estrutura é sempre a mesma:\n**1. reconhece**: *That's a good point* / *I see your point*\n**2. discorda**: *but...*\n\nSem o passo 1, você não parece direto: parece rude. E o custo de incluir é uma frase de três palavras.",
    },
    swaps: ["I'm not sure it works for everyone", "it depends on the person", "I've seen the opposite happen", "there's another side to it", "that hasn't been my experience", "I'd look at it differently", "that only works sometimes", "I used to think that too"],
    expansion: [
      ["That's a good point, but I'm not so sure it works for everyone.", "Esse é um bom ponto, mas não tenho tanta certeza de que funciona para todo mundo."],
      ["I totally agree with the first part. I see your point on the rest, but it depends.", "Concordo totalmente com a primeira parte. Entendo seu ponto no resto, mas depende."],
      ["It depends on the situation, so let's agree to disagree for now.", "Depende da situação, então vamos concordar em discordar por enquanto."],
      ["Fair enough. I hadn't thought about it that way, honestly.", "Justo. Eu não tinha pensado nisso desse jeito, sinceramente."],
    ],
    drift: [
      "Um assunto em que você mudou de opinião",
      "Se discordar em público é normal na sua cultura",
      "Alguém que te fez ver as coisas de outro jeito",
      "Um debate que nunca termina entre seus amigos",
    ],
    sounds: [
      ["'I see your point' emendado", "'Aisiyorpoint': quatro palavras, um bloco. Se você pausar entre elas, perde o efeito de resposta natural."],
      ["'Totally' com T de D", "Americano transforma o T entre vogais num D suave: 'tou-DAH-li'. É a mesma coisa em 'water', 'better', 'city'."],
    ],
    quiz: [
      ["Qual a forma mais educada de discordar?", ["No, you're wrong.", "I disagree.", "That's a good point, but...", "That's not true."], 2, "Reconhecer antes de discordar é o que evita soar agressivo. É quase obrigatório na conversa americana."],
      ["'Fair enough' significa:", ["Está justo o preço", "Ok, aceito seu argumento", "Isso é injusto", "Chega de conversa"], 1, "É o reconhecimento de que o outro tem razão: ou pelo menos um ponto válido. Encerra o atrito sem ceder tudo."],
      ["'I'm not so sure about that' é:", ["Concordância", "Discordância suave", "Dúvida sobre si mesmo", "Pedido de repetição"], 1, "É discordar sem dizer 'você está errado'. Uma das frases mais úteis para debate civilizado."],
      ["'Let's agree to disagree' propõe:", ["Continuar discutindo", "Encerrar o desacordo sem vencedor", "Você aceitar o outro lado", "Chamar alguém para decidir"], 1, "Fecha o assunto preservando a relação. Muito usado quando o debate já rendeu o que tinha de render."],
    ],
  },

  // ======================================================== 20
  {
    n: 20,
    immersion: [
      ["Kate", "Which one should I get?", "Qual eu devo levar?"],
      ["Ana", "This one is better than that one.", "Esse é melhor que aquele."],
      ["Kate", "Why?", "Por quê?"],
      ["Ana", "It's cheaper, but not as good in quality.", "É mais barato, mas não tão bom em qualidade."],
      ["Kate", "Hmm. What would you do?", "Hmm. O que você faria?"],
      ["Ana", "Honestly? I'd rather stay home and order online.", "Sinceramente? Eu preferiria ficar em casa e pedir online."],
      ["Kate", "That makes sense.", "Isso faz sentido."],
      ["Ana", "On the other hand, you'd have to wait a week.", "Por outro lado, você teria que esperar uma semana."],
    ],
    listening: [
      ["Mike", "Train or plane?", "Trem ou avião?"],
      ["Bruno", "The train is better than flying for this trip.", "O trem é melhor que voar para essa viagem."],
      ["Mike", "Really? It takes longer.", "Sério? Demora mais."],
      ["Bruno", "It's cheaper, but not as fast, sure. On the other hand, no airport.", "É mais barato, mas não tão rápido, é verdade. Por outro lado, sem aeroporto."],
      ["Mike", "That makes sense. What would you do?", "Isso faz sentido. O que você faria?"],
      ["Bruno", "I'd rather take the train and sleep.", "Eu preferiria pegar o trem e dormir."],
      ["Mike", "It's the best option for you, then.", "É a melhor opção para você, então."],
      ["Bruno", "Exactly. For you, maybe not.", "Exatamente. Para você, talvez não."],
    ],
    why: {
      title: "Comparar: quando é -ER e quando é MORE",
      body:
        "Palavra curta ganha **-er**: *cheaper*, *faster*, *bigger*.\nPalavra longa ganha **more**: *more expensive*, *more comfortable*.\n\nA fronteira é o ouvido, não a contagem de sílabas: e há irregulares que você já conhece como bloco: *good → better*, *bad → worse*.\n\nSe errar (*more cheap*), ninguém deixa de entender. Instale *better*, *worse*, *cheaper* e *faster* como blocos e o resto vem por imitação.",
    },
    // Molde de TRÊS lacunas: isto | aquilo | o motivo.
    swaps: [
      "The train | the bus | it's way faster",
      "This one | that one | it's a lot cheaper",
      "Working from home | the office | I sleep an hour more",
      "Cooking | ordering in | it costs half as much",
      "A morning flight | a night flight | you don't lose the whole day",
      "Walking | driving | parking downtown is impossible",
      "This place | the one downtown | it's way less crowded",
      "Learning by talking | learning by reading | you actually remember it",
    ],
    expansion: [
      ["This one is better than that one because it's cheaper and faster.", "Esse é melhor que aquele porque é mais barato e mais rápido."],
      ["It's cheaper, but not as good. On the other hand, I don't need the best.", "É mais barato, mas não tão bom. Por outro lado, eu não preciso do melhor."],
      ["I'd rather stay home, honestly. What would you do in my place?", "Eu preferiria ficar em casa, sinceramente. O que você faria no meu lugar?"],
      ["It's the best option for me, though it might not be for you.", "É a melhor opção para mim, embora possa não ser para você."],
    ],
    drift: [
      "Uma escolha difícil que você fez recentemente",
      "Se você pesquisa muito antes de comprar",
      "Barato que saiu caro",
      "Uma decisão que você adiou por tempo demais",
    ],
    sounds: [
      ["'Better' com D no meio", "'bé-der'. O T entre vogais vira D em inglês americano. Vale para 'water', 'letter', 'matter'."],
      ["'I'd rather' vira 'aidráder'", "O 'would' encolheu para um D e grudou. Depois vem o TH sonoro de 'rather'. Treine devagar e acelere."],
    ],
    quiz: [
      ["Como se diz 'mais barato'?", ["more cheap", "cheaper", "most cheap", "cheap more"], 1, "Palavra curta ganha -er. 'More' é para palavras longas: more expensive, more comfortable."],
      ["'I'd rather stay home' significa:", ["Eu deveria ficar em casa", "Eu prefiro ficar em casa", "Eu preciso ficar em casa", "Eu fiquei em casa"], 1, "'Would rather' é preferência. Guarde como bloco: 'I'd rather ___' e troque a peça."],
      ["'On the other hand' introduz:", ["Uma conclusão", "O lado oposto do argumento", "Uma repetição", "Uma pergunta"], 1, "É o conectivo que mostra que você pensou nos dois lados. Faz qualquer opinião soar mais madura."],
      ["'It's cheaper, but not as good' quer dizer:", ["É barato e ruim", "É mais barato, porém a qualidade é menor", "Não é barato nem bom", "É o melhor custo-benefício"], 1, "'Not as good (as)' é a comparação negativa. Muito usada para ponderar sem condenar."],
    ],
  },

  // ======================================================== 21
  {
    n: 21,
    immersion: [
      ["Kate", "I got the job!", "Eu consegui o emprego!"],
      ["Ana", "That's amazing! I'm so happy for you!", "Isso é incrível! Estou tão feliz por você!"],
      ["Kate", "Thanks! I was so nervous.", "Obrigada! Eu estava tão nervosa."],
      ["Ana", "Congratulations! You totally deserve it.", "Parabéns! Você merece muito."],
      ["Kate", "How about you? How have you been?", "E você? Como você tem estado?"],
      ["Ana", "I'm a bit stressed lately, honestly.", "Estou um pouco estressada ultimamente, sinceramente."],
      ["Kate", "I'm so sorry to hear that. That must be hard.", "Sinto muito por ouvir isso. Deve ser difícil."],
      ["Ana", "It is. But it'll pass.", "É. Mas vai passar."],
      ["Kate", "Let me know if you need anything.", "Me avise se precisar de alguma coisa."],
    ],
    listening: [
      ["Bruno", "My grandmother passed away last week.", "Minha avó faleceu semana passada."],
      ["Mike", "Oh Bruno, I'm so sorry to hear that.", "Ah Bruno, sinto muito por ouvir isso."],
      ["Bruno", "Thanks. It was expected, but still.", "Obrigado. Era esperado, mas mesmo assim."],
      ["Mike", "That must be hard. Are you okay?", "Deve ser difícil. Você está bem?"],
      ["Bruno", "I'm managing. Work helps, actually.", "Estou levando. Trabalhar ajuda, na verdade."],
      ["Mike", "Let me know if you need anything. I mean it.", "Me avise se precisar de alguma coisa. Estou falando sério."],
      ["Bruno", "I appreciate that.", "Eu agradeço."],
      ["Mike", "Take the time you need.", "Leve o tempo que precisar."],
    ],
    why: {
      title: "Reagir importa mais do que responder",
      body:
        "Numa conversa em inglês, quem só responde parece frio. Quem **reage** parece presente.\n\nA reação vem antes da informação: *That's amazing!*, *No way!*, *I'm so sorry to hear that*, *That must be hard*.\n\nSão blocos fixos, curtos e prontos. E são eles que fazem a diferença entre 'esse cara fala inglês' e 'dá gosto conversar com esse cara'. Não custa vocabulário nenhum: custa lembrar de usar.",
    },
    swaps: ["happy", "excited", "sorry", "proud", "glad", "relieved", "worried", "thrilled"],
    expansion: [
      ["That's amazing! I'm so happy for you! You totally deserve it.", "Isso é incrível! Estou tão feliz por você! Você merece muito."],
      ["I'm so sorry to hear that. That must be hard. Are you okay?", "Sinto muito por ouvir isso. Deve ser difícil. Você está bem?"],
      ["I'm a bit stressed lately, but it'll pass. Thanks for asking.", "Estou um pouco estressado ultimamente, mas vai passar. Obrigado por perguntar."],
      ["Let me know if you need anything. I mean it, anytime.", "Me avise se precisar de alguma coisa. Falo sério, a qualquer hora."],
    ],
    drift: [
      "A última boa notícia que você recebeu",
      "Como você reage quando alguém te conta um problema",
      "Se brasileiro é mais expressivo que americano",
      "Uma pessoa que te apoiou num momento difícil",
    ],
    sounds: [
      ["'That's amazing' com o A longo", "É a-MEI-zing, com o acento no meio e um ditongo bem aberto. Metade da força da reação está na entonação, não na palavra."],
      ["Entonação de empatia", "'I'm so sorry to hear that' desce no fim. Se subir, soa sarcástico. Grave-se e ouça a curva."],
    ],
    quiz: [
      ["Alguém te conta uma notícia ruim. O que dizer primeiro?", ["Why?", "I'm so sorry to hear that.", "What happened exactly?", "That's life."], 1, "A reação vem antes da pergunta. Perguntar detalhes antes de reagir soa frio em inglês."],
      ["'That must be hard' expressa:", ["Certeza sobre um fato", "Empatia com a situação do outro", "Discordância", "Curiosidade"], 1, "'Must' aqui é dedução, não obrigação. 'Deve ser difícil': você imagina o que o outro sente."],
      ["'I'm so happy for you' é diferente de 'I'm so happy' porque:", ["É mais formal", "O 'for you' põe a alegria na conquista do outro", "É mais forte", "É usado só com amigos"], 1, "Sem o 'for you', você está falando de si. A preposição é o que transfere o foco."],
      ["'Let me know if you need anything' é:", ["Uma oferta genérica de ajuda", "Um pedido", "Uma despedida", "Uma desculpa"], 0, "É a oferta padrão de apoio. Muitas vezes é protocolar: mas 'I mean it' depois dela indica que é sério."],
    ],
  },

  // ======================================================== 22
  {
    n: 22,
    immersion: [
      ["Ana", "Sorry to bother you, but could you help me with this?", "Desculpa incomodar, mas você pode me ajudar com isso?"],
      ["Mike", "Sure, no problem. What's up?", "Claro, sem problema. O que foi?"],
      ["Ana", "I can't get this file to open.", "Eu não consigo abrir esse arquivo."],
      ["Mike", "Let me take a look. Do you need a hand with the rest too?", "Deixa eu dar uma olhada. Você precisa de ajuda com o resto também?"],
      ["Ana", "If you have time, I'd appreciate it.", "Se você tiver tempo, eu agradeceria."],
      ["Mike", "Of course. There, it's working now.", "Claro. Pronto, está funcionando agora."],
      ["Ana", "Thanks, you're a lifesaver!", "Obrigada, você é um salva-vidas!"],
      ["Mike", "Don't worry about it.", "Não se preocupe com isso."],
    ],
    listening: [
      ["Kate", "Need a hand with those boxes?", "Precisa de ajuda com essas caixas?"],
      ["Bruno", "Actually, yes. Sorry to bother you.", "Na verdade, sim. Desculpa incomodar."],
      ["Kate", "Don't worry about it. Where do they go?", "Não se preocupe. Onde elas vão?"],
      ["Bruno", "Second floor. Could you help me with the heavy one?", "Segundo andar. Você pode me ajudar com a pesada?"],
      ["Kate", "Sure, no problem. On three.", "Claro, sem problema. No três."],
      ["Bruno", "I'd appreciate it. This would take me an hour alone.", "Eu agradeço. Isso levaria uma hora sozinho."],
      ["Kate", "That's what neighbors are for.", "É para isso que servem os vizinhos."],
      ["Bruno", "Thanks, you're a lifesaver!", "Obrigado, você é um salva-vidas!"],
    ],
    why: {
      title: "Pedir ajuda tem uma abertura obrigatória",
      body:
        "Em inglês, um pedido de ajuda quase nunca começa pelo pedido. Começa por um **amortecedor**: *Sorry to bother you, but...*, *Do you have a second?*, *Quick question...*\n\nO amortecedor reconhece que você está tomando o tempo da pessoa. Sem ele, o pedido chega seco: e a resposta tende a vir seca também.\n\nDo outro lado, oferecer ajuda é o inverso: curto e direto. *Need a hand?*: três palavras.",
    },
    swaps: ["this", "the report", "moving these boxes", "something quick", "my English", "the setup", "a translation", "one last thing"],
    expansion: [
      ["Sorry to bother you, but could you help me with this? It'll take two minutes.", "Desculpa incomodar, mas você pode me ajudar com isso? Vai levar dois minutos."],
      ["Do you need a hand? I'm free for the next hour anyway.", "Você precisa de ajuda? Eu estou livre pela próxima hora de qualquer jeito."],
      ["I'd appreciate it. Thanks, you're a lifesaver!", "Eu agradeceria. Obrigado, você é um salva-vidas!"],
      ["Sure, no problem. And don't worry about it, it's really no trouble.", "Claro, sem problema. E não se preocupe, não é incômodo nenhum."],
    ],
    drift: [
      "A última vez que alguém te ajudou sem pedir nada em troca",
      "Se você tem dificuldade de pedir ajuda",
      "Alguém que sempre aparece na hora certa",
      "Um favor que você deve a alguém",
    ],
    sounds: [
      ["'Could you' com o D virando J", "'Kudju help me': sempre. Vale para 'would you' (uudju) e 'did you' (didju)."],
      ["'Lifesaver' com dois acentos", "LAIF-sei-ver. A força vem na primeira sílaba. E o V não é F: os dentes tocam o lábio e vibram."],
    ],
    quiz: [
      ["Como se abre um pedido de ajuda educadamente?", ["Help me.", "Sorry to bother you, but...", "I need help now.", "Can you? Please."], 1, "O amortecedor reconhece que você está tomando o tempo do outro. Sem ele o pedido chega seco."],
      ["'Do you need a hand?' oferece:", ["Um aperto de mão", "Ajuda", "Um cumprimento", "Uma opinião"], 1, "'Give someone a hand' é ajudar. Oferecer ajuda em inglês é curto e direto: o oposto de pedir."],
      ["'Don't worry about it' responde a:", ["Um elogio", "Um agradecimento ou um pedido de desculpas", "Uma pergunta", "Uma reclamação"], 1, "Serve para os dois. É o 'imagina' brasileiro, que também cobre agradecimento e desculpa."],
      ["'You're a lifesaver' é:", ["Literal, sobre salvar vidas", "Um agradecimento enfático e informal", "Um elogio profissional", "Uma ironia"], 1, "É exagero afetuoso, como o nosso 'você me salvou'. Informal e muito comum."],
    ],
  },

  // ======================================================== 23
  {
    n: 23,
    immersion: [
      ["Mike", "Hey! How's it going?", "Ei! Como vai?"],
      ["Ana", "Good, good. Busy week?", "Bem, bem. Semana corrida?"],
      ["Mike", "Insane. Crazy weather, huh?", "Insana. Tempo maluco, né?"],
      ["Ana", "Right? It was 30 degrees yesterday.", "Né? Estava 30 graus ontem."],
      ["Mike", "How's the project going?", "Como vai o projeto?"],
      ["Ana", "Slowly. We're waiting on approval.", "Devagar. Estamos esperando aprovação."],
      ["Mike", "Oh really? Tell me more.", "Ah é? Me conta mais."],
      ["Ana", "Long story. Anyway, I should get going.", "História longa. Enfim, eu preciso ir."],
      ["Mike", "Good talking to you!", "Foi bom falar com você!"],
    ],
    listening: [
      ["Kate", "Bruno! How's it going?", "Bruno! Como vai?"],
      ["Bruno", "Not bad. Busy week?", "Nada mal. Semana corrida?"],
      ["Kate", "Always. How's the new place going?", "Sempre. Como vai o apartamento novo?"],
      ["Bruno", "Getting there. Still no furniture.", "Indo. Ainda sem móveis."],
      ["Kate", "Oh really? Tell me more.", "Ah é? Me conta mais."],
      ["Bruno", "The delivery keeps getting delayed. Three weeks now.", "A entrega fica sendo adiada. Três semanas já."],
      ["Kate", "That's rough. Crazy weather this week, huh?", "Isso é duro. Tempo maluco essa semana, né?"],
      ["Bruno", "Terrible. Anyway, I should get going. Good talking to you!", "Terrível. Enfim, preciso ir. Foi bom falar com você!"],
    ],
    why: {
      title: "Small talk tem começo, meio e saída",
      body:
        "Small talk não é conversa vazia: é o **protocolo de aproximação**. E ele tem três partes fixas:\n\n**Abre**: *How's it going?* / *Busy week?*\n**Sustenta**: *Oh really? Tell me more* / *How's the ___ going?*\n**Fecha**: *Anyway, I should get going* / *Good talking to you!*\n\nA parte que brasileiro mais esquece é a **saída**. Sem ela, a conversa não termina: ela morre, e fica constrangedor. Decore o fechamento junto com a abertura.",
    },
    swaps: ["it", "the project", "work", "the move", "your family", "school", "the new job", "everything"],
    expansion: [
      ["How's it going? Busy week? Crazy weather, huh?", "Como vai? Semana corrida? Tempo maluco, né?"],
      ["Oh really? Tell me more. How's the project going on your side?", "Ah é? Me conta mais. Como vai o projeto do seu lado?"],
      ["Anyway, I should get going. Good talking to you!", "Enfim, preciso ir. Foi bom falar com você!"],
      ["Not bad, thanks. Busy, but the good kind of busy.", "Nada mal, obrigado. Corrido, mas do tipo bom."],
    ],
    drift: [
      "Se você gosta ou odeia small talk",
      "O assunto que sempre funciona onde você mora",
      "Como se despedir sem parecer que está fugindo",
      "Uma conversa de elevador que virou amizade",
    ],
    sounds: [
      ["'How's it going' vira 'hauzitgouin'", "Quatro palavras, uma só. E o -ING perde o G. É provavelmente o cumprimento mais falado do inglês americano."],
      ["'Huh?' no fim da frase", "Curto, nasal, com entonação subindo. É o nosso 'né?'. Serve para transformar afirmação em convite de conversa."],
    ],
    quiz: [
      ["'How's it going?' espera:", ["Um relato detalhado", "Uma resposta curta e a conversa seguindo", "Um 'yes' ou 'no'", "Uma pergunta de volta apenas"], 1, "É cumprimento, não entrevista. 'Good, good' já basta: mas devolver mantém a conversa viva."],
      ["Qual frase encerra o small talk sem grosseria?", ["Bye.", "Anyway, I should get going.", "I'm leaving.", "Enough."], 1, "O 'anyway' sinaliza que você está fechando. Sem ele, a saída soa abrupta."],
      ["'Oh really? Tell me more' serve para:", ["Duvidar", "Mostrar interesse e alongar a conversa", "Encerrar", "Discordar"], 1, "Conversa não morre por falta de vocabulário. Morre por falta de interesse demonstrado."],
      ["'Crazy weather, huh?' é usado porque:", ["Americano se importa muito com clima", "Clima é o assunto neutro universal", "É engraçado", "É obrigatório"], 1, "É o assunto que não ofende ninguém e todo mundo pode opinar. Existe em toda cultura, com temas diferentes."],
    ],
  },

  // ======================================================== 24
  {
    n: 24,
    immersion: [
      ["Ana", "Hi, this is Ana speaking.", "Oi, aqui é a Ana."],
      ["Mike", "Hi Ana! Can you hear me?", "Oi Ana! Você consegue me ouvir?"],
      ["Ana", "Barely. You're breaking up.", "Mal. Você está cortando."],
      ["Mike", "Is this better?", "Assim está melhor?"],
      ["Ana", "Much better. Sorry, I didn't catch that.", "Muito melhor. Desculpa, não peguei isso."],
      ["Mike", "I said the meeting moved to four.", "Eu disse que a reunião mudou para quatro."],
      ["Ana", "Could you repeat the last part?", "Você pode repetir a última parte?"],
      ["Mike", "Four PM. Today.", "Quatro da tarde. Hoje."],
      ["Ana", "Got it. Let me call you back in five. Thanks, talk soon!", "Entendi. Deixa eu te ligar de volta em cinco. Obrigada, até logo!"],
    ],
    listening: [
      ["Receptionist", "Good morning, Wilson and Partners.", "Bom dia, Wilson e Associados."],
      ["Bruno", "Hi, this is Bruno Silva speaking. Is Kate available?", "Oi, aqui é o Bruno Silva. A Kate está disponível?"],
      ["Receptionist", "One moment. Sorry, I didn't catch the name.", "Um momento. Desculpa, não peguei o nome."],
      ["Bruno", "Bruno. B-R-U-N-O.", "Bruno. B-R-U-N-O."],
      ["Receptionist", "Thank you. She's on another call.", "Obrigada. Ela está em outra ligação."],
      ["Bruno", "No problem. Could you repeat the last part? You're breaking up.", "Sem problema. Pode repetir a última parte? Você está cortando."],
      ["Receptionist", "She's on another call. Can she call you back?", "Ela está em outra ligação. Ela pode te ligar de volta?"],
      ["Bruno", "Yes, please. Thanks, talk soon!", "Sim, por favor. Obrigado, até logo!"],
    ],
    why: {
      title: "Telefone é mais difícil, e não é culpa sua",
      body:
        "Ao telefone você perde a leitura labial, a expressão facial e o gesto: que juntos carregam boa parte da compreensão. É **objetivamente mais difícil**, inclusive para nativo.\n\nPor isso o inglês tem blocos dedicados: *You're breaking up*, *I didn't catch that*, *Could you repeat the last part?*\n\nE repare no *this is Ana speaking*: ao telefone não se diz *I am Ana*. É *this is*, o mesmo bloco de apresentar alguém do circuito 8.",
    },
    swaps: ["I didn't catch that", "you're breaking up", "the line is bad", "I lost you for a second", "I can barely hear you", "let me call you back", "can you hear me now", "I'll try you again later"],
    expansion: [
      ["Hi, this is Ana speaking. Sorry, I didn't catch that, could you repeat?", "Oi, aqui é a Ana. Desculpa, não peguei, pode repetir?"],
      ["You're breaking up. Let me call you back in five minutes.", "Você está cortando. Deixa eu te ligar de volta em cinco minutos."],
      ["Could you repeat the last part? The line is really bad here.", "Pode repetir a última parte? A linha está muito ruim aqui."],
      ["Can you hear me now? Great. Thanks, talk soon!", "Consegue me ouvir agora? Ótimo. Obrigada, até logo!"],
    ],
    drift: [
      "Se você prefere ligar ou mandar mensagem",
      "Uma ligação em inglês que deu errado",
      "Como é atender um número desconhecido",
      "Reunião por vídeo versus telefone",
    ],
    sounds: [
      ["'Didn't catch that' com T mudo", "'Didn' + 'catch': o T de 'didn't' some quase inteiro. E 'catch that' gruda: 'catchat'."],
      ["'This is' vira 'thisiz'", "O S final e o I inicial se fundem. Ao telefone, esse bloco sai numa batida só."],
    ],
    quiz: [
      ["Como você se identifica ao telefone?", ["I am Ana.", "Here is Ana.", "This is Ana speaking.", "My name Ana."], 2, "'This is ___ speaking' é a fórmula. O mesmo 'this is' de apresentar alguém pessoalmente."],
      ["'You're breaking up' significa:", ["Você está terminando", "O sinal está cortando", "Você está nervoso", "Você está errado"], 1, "É específico de telefone e vídeo. Muito mais usado que 'the signal is bad'."],
      ["'I didn't catch that' quer dizer:", ["Não peguei o objeto", "Não entendi o que você disse", "Não anotei", "Não concordo"], 1, "'Catch' aqui é captar o som. É mais natural que 'I didn't understand' quando o problema foi audição."],
      ["Por que telefone é mais difícil que conversa presencial?", ["O vocabulário é diferente", "Falta leitura labial, expressão e gesto", "As pessoas falam mais rápido", "É sempre formal"], 1, "Você perde os canais visuais que carregam parte da compreensão. Vale para nativos também."],
    ],
  },

  // ======================================================== 25
  {
    n: 25,
    immersion: [
      ["Ana", "Hi, there's a problem with my order.", "Oi, tem um problema com meu pedido."],
      ["Agent", "I'm sorry to hear that. What's going on?", "Sinto muito. O que está acontecendo?"],
      ["Ana", "It arrived damaged. The box was open.", "Chegou danificado. A caixa estava aberta."],
      ["Agent", "Let me pull up your order.", "Deixa eu abrir seu pedido."],
      ["Ana", "I've been waiting for two weeks already.", "Eu já estou esperando há duas semanas."],
      ["Agent", "I understand. Let me see what I can do.", "Eu entendo. Deixa eu ver o que posso fazer."],
      ["Ana", "What can we do about it? I'd like a refund, please.", "O que a gente pode fazer sobre isso? Eu gostaria de um reembolso, por favor."],
      ["Agent", "I can process that today.", "Eu posso processar isso hoje."],
      ["Ana", "Thank you. Who should I talk to if it doesn't come through?", "Obrigada. Com quem eu falo se não vier?"],
    ],
    listening: [
      ["Bruno", "Hi, there's a problem with my internet.", "Oi, tem um problema com minha internet."],
      ["Agent", "Okay, what seems to be the issue?", "Ok, qual parece ser o problema?"],
      ["Bruno", "It's not working properly. It drops every hour.", "Não está funcionando direito. Cai toda hora."],
      ["Agent", "Since when?", "Desde quando?"],
      ["Bruno", "I've been waiting for two weeks for someone to come.", "Eu estou esperando há duas semanas alguém vir."],
      ["Agent", "I see the ticket here. It wasn't escalated.", "Estou vendo o chamado aqui. Não foi escalado."],
      ["Bruno", "What can we do about it?", "O que a gente pode fazer sobre isso?"],
      ["Agent", "I'll send a technician tomorrow morning.", "Vou mandar um técnico amanhã de manhã."],
      ["Bruno", "Thank you. Who should I talk to if he doesn't show up?", "Obrigado. Com quem eu falo se ele não aparecer?"],
    ],
    why: {
      title: "Descrever o problema antes de exigir a solução",
      body:
        "A ordem importa. Em inglês, reclamação eficiente segue:\n\n**1. o fato**: *There's a problem with my order*\n**2. o detalhe**: *It arrived damaged*\n**3. o histórico**: *I've been waiting for two weeks*\n**4. o pedido**: *I'd like a refund, please*\n\nQuem inverte (começa exigindo) recebe resistência. Quem segue a ordem recebe cooperação: e o quarto passo, dito com *I'd like*, quase nunca é recusado.",
    },
    swaps: ["my order", "my account", "the delivery", "the charge on my card", "the room", "my reservation", "the app", "the size I received"],
    expansion: [
      ["There's a problem with my order. It arrived damaged and I'd like a refund, please.", "Tem um problema com meu pedido. Chegou danificado e eu gostaria de um reembolso, por favor."],
      ["I've been waiting for two weeks, so what can we do about it?", "Eu estou esperando há duas semanas, então o que a gente pode fazer sobre isso?"],
      ["It's not working properly, and this is the second time it happens.", "Não está funcionando direito, e essa é a segunda vez que acontece."],
      ["Who should I talk to if this doesn't get resolved today?", "Com quem eu falo se isso não for resolvido hoje?"],
    ],
    drift: [
      "A pior experiência de atendimento que você já teve",
      "Se você reclama ou deixa passar",
      "Uma vez em que reclamar funcionou muito bem",
      "Atendimento no Brasil versus no exterior",
    ],
    sounds: [
      ["'Problem' tem o acento na primeira", "PRÁ-blem, e o segundo E quase some. Brasileiro diz 'problêm' com força no fim: inverta."],
      ["'I've been waiting' com o 've quase mudo", "'Aiv bin ueiting': o 'have' encolheu para um V grudado. Reconhecer isso é essencial para entender fala rápida."],
    ],
    quiz: [
      ["Qual a melhor abertura para uma reclamação?", ["This is unacceptable!", "There's a problem with my order.", "I want my money back.", "You made a mistake."], 1, "Começar pelo fato, não pela emoção. As outras podem vir depois, se necessário."],
      ["'I've been waiting for two weeks' enfatiza:", ["Quando começou apenas", "Que a espera continua até agora", "Que já acabou", "Que vai esperar mais"], 1, "É a construção que liga passado e presente com duração. Perfeita para reclamação porque mostra que o problema persiste."],
      ["'It's not working properly' é melhor que 'It's broken' porque:", ["É mais educado e mais preciso", "É mais curto", "É mais formal", "Não há diferença"], 0, "'Broken' pode ser exagero e gerar defensiva. 'Not working properly' descreve sem acusar."],
      ["'Who should I talk to?' serve para:", ["Reclamar do atendente", "Descobrir o próximo nível de contato", "Encerrar a conversa", "Pedir desculpas"], 1, "É a pergunta que mantém a porta aberta sem ameaçar. Muito mais eficaz que exigir um gerente de cara."],
    ],
  },

  // ======================================================== 26
  {
    n: 26,
    immersion: [
      ["Kate", "Hey! How was your weekend?", "Ei! Como foi seu fim de semana?"],
      ["Ana", "Really good. I used to hate Sundays, but now I love them.", "Muito bom. Eu odiava domingos, mas agora eu amo."],
      ["Kate", "What changed?", "O que mudou?"],
      ["Ana", "I'm going to start cooking on Sundays. It's my thing now.", "Eu vou começar a cozinhar aos domingos. É a minha coisa agora."],
      ["Kate", "I think that's a waste of a free day, honestly.", "Eu acho que isso é desperdício de um dia livre, sinceramente."],
      ["Ana", "I see your point, but it relaxes me.", "Eu entendo seu ponto, mas me relaxa."],
      ["Kate", "Fair enough. Oh, I heard about your mom. I'm so sorry to hear that.", "Justo. Ah, eu soube da sua mãe. Sinto muito."],
      ["Ana", "Thanks. Sorry, I didn't catch the last part, the line is bad.", "Obrigada. Desculpa, não peguei a última parte, a linha está ruim."],
    ],
    listening: [
      ["Agent", "Thanks for holding. How can I help?", "Obrigado por aguardar. Como posso ajudar?"],
      ["Bruno", "There's a problem with my reservation.", "Tem um problema com minha reserva."],
      ["Agent", "Let me check. What's the issue?", "Deixa eu verificar. Qual o problema?"],
      ["Bruno", "I booked for Friday, but I'm going to arrive on Saturday.", "Eu reservei para sexta, mas eu vou chegar no sábado."],
      ["Agent", "I can move it. Does Saturday at 3 work for you?", "Posso mudar. Sábado às 3 funciona para você?"],
      ["Bruno", "Works for me. Sorry, could you repeat the confirmation number?", "Funciona para mim. Desculpa, pode repetir o número de confirmação?"],
      ["Agent", "Of course. It's on its way by email too.", "Claro. Está indo por e-mail também."],
      ["Bruno", "Thanks, you're a lifesaver!", "Obrigado, você é um salva-vidas!"],
    ],
    why: {
      title: "Você agora consegue contar, não só responder",
      body:
        "Compare o Bruno do circuito 1 com o do circuito 26. No primeiro, ele respondia. Agora ele **narra**: o que fez, o que vai fazer, o que acha, o que deu errado.\n\nEssa é a diferença entre A1 e A2: e é a diferença entre conversa que morre em trinta segundos e conversa que dura.\n\nO Terceiro Canto sobe mais um degrau: resolver problemas, negociar, discordar com firmeza. Ou seja, o inglês de quando as coisas **não** saem como planejado.",
    },
    swaps: ["How was your weekend?", "I used to live there.", "I'm going to try again.", "I see your point, but...", "I'm so sorry to hear that.", "Sorry, I didn't catch that.", "There's a problem with my order.", "Does Friday work for you?"],
    expansion: [
      ["How was your weekend? I went to my parents' place and it was really good.", "Como foi seu fim de semana? Eu fui na casa dos meus pais e foi muito bom."],
      ["I used to hate Mondays, but I'm going to change my routine and see if it helps.", "Eu odiava segundas, mas vou mudar minha rotina e ver se ajuda."],
      ["I see your point, but there's a problem with that plan.", "Eu entendo seu ponto, mas tem um problema com esse plano."],
      ["Sorry, I didn't catch that. Does Friday at four work for you?", "Desculpa, não peguei. Sexta às quatro funciona para você?"],
    ],
    drift: [
      "O que mudou no seu inglês em seis meses",
      "A conversa mais longa que você já teve em inglês",
      "Qual circuito você mais usou na vida real",
      "O que ainda te trava",
    ],
    sounds: [
      ["Revisão: o -ED e o passado", "'watched' = watcht, 'stayed' = steid, 'wanted' = uantid. Grave uma história de 30 segundos e confira os finais."],
      ["Revisão: contrações", "I'm, I'd, I've, don't, didn't, it's. Se você ainda fala expandido, é o que mais está entregando seu sotaque agora."],
    ],
    quiz: [
      ["O que o Segundo Canto adicionou ao seu inglês?", ["Vocabulário técnico", "Capacidade de narrar passado, futuro e opinião", "Pronúncia perfeita", "Gramática avançada"], 1, "Sair do 'yes/no' e passar a contar é o salto de A1 para A2. É o que faz conversa durar."],
      ["Qual bloco resolve mais situações de conflito?", ["I totally agree.", "I see your point, but...", "That's amazing!", "How's it going?"], 1, "Discordar com almofada é o que permite ter opinião sem criar atrito. Vale para trabalho e vida pessoal."],
      ["'I used to' e 'I'm going to' cobrem:", ["Só o passado", "Passado habitual e futuro planejado", "Só o futuro", "Presente e passado"], 1, "Os dois moldes juntos cobrem quase toda conversa sobre a própria vida: que é a maior parte de qualquer conversa."],
      ["No fim deste canto, o que você já consegue fazer?", ["Trabalhar em inglês", "Contar histórias, opinar e resolver o básico por telefone", "Assistir séries sem legenda", "Escrever relatórios"], 1, "É o A2 alcançado. O Terceiro Canto é onde entram os problemas, as negociações e o inglês de trabalho."],
    ],
  },
];
