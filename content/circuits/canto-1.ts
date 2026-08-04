/**
 * PRIMEIRO CANTO: Destravar (circuitos 1 a 13)
 *
 * Material redigido à mão. `content/compose-lesson.ts` expande cada circuito
 * daqui nos 14 dias do ritmo, de forma determinística.
 *
 * Regras que valem para todos os diálogos deste arquivo:
 *   - Inglês americano falado, não inglês de livro. Contrações sempre.
 *   - Nenhuma fala contém barra ("/"), porque é o separador do roteiro.
 *   - A tradução é o que a pessoa DIRIA em português, não a tradução literal.
 */

import type { CircuitContent } from "../compose-lesson";

export const CANTO_1: CircuitContent[] = [
  // ======================================================== 1
  {
    n: 1,
    immersion: [
      ["Sarah", "Hi! I'm Sarah.", "Oi! Eu sou a Sarah."],
      ["Ana", "Oh, hi! I'm Ana. Nice to meet you.", "Ah, oi! Eu sou a Ana. Prazer."],
      ["Sarah", "Nice to meet you too! How are you?", "Prazer também! Tudo bem?"],
      ["Ana", "I'm good, thanks. And you?", "Tudo bem, obrigada. E você?"],
      ["Sarah", "I'm great. So, is this your first time here?", "Estou ótima. Então, é sua primeira vez aqui?"],
      ["Ana", "Yeah, it is.", "É, sim."],
      ["Sarah", "Cool! Well, see you later, Ana!", "Legal! Bom, até mais, Ana!"],
      ["Ana", "See you later!", "Até mais!"],
    ],
    listening: [
      ["Mike", "Hey, I don't think we've met. I'm Mike.", "Ei, acho que a gente não se conhece. Eu sou o Mike."],
      ["Ana", "Hi Mike, I'm Ana. Nice to meet you.", "Oi Mike, eu sou a Ana. Prazer."],
      ["Mike", "Sorry, what's your name again?", "Desculpa, qual seu nome mesmo?"],
      ["Ana", "Ana. A-N-A.", "Ana. A-N-A."],
      ["Mike", "Got it. Nice to meet you, Ana. How are you doing?", "Entendi. Prazer, Ana. Como você está?"],
      ["Ana", "I'm good, thanks. And you?", "Bem, obrigada. E você?"],
      ["Mike", "Pretty good. Hey, they're starting. See you later!", "Bem também. Ei, vão começar. Até mais!"],
      ["Ana", "See you later!", "Até mais!"],
    ],
    why: {
      title: "Por que 'I'm' e não 'I am'",
      body:
        "Você vai ouvir *I'm*, nunca *I am*, em conversa normal. **I am** existe, mas soa duro: americano usa quando quer enfatizar (*I AM going, I promise*).\n\nA regra prática: contraia sempre. Se você fala *I am Ana*, funciona, mas marca você como estrangeiro na primeira frase. E contrair é mais fácil, não mais difícil.",
    },
    swaps: ["Ana", "Pedro", "Carla", "your full name", "your nickname", "Ana, from Brazil", "Ana, Marina's friend", "Ana. I'm new here"],
    expansion: [
      ["Hi, I'm Ana. Nice to meet you. Is this your first time here too?", "Oi, eu sou a Ana. Prazer. É sua primeira vez aqui também?"],
      ["I'm good, thanks. And you? Sorry, what's your name again?", "Tudo bem, obrigada. E você? Desculpa, qual seu nome mesmo?"],
      ["Nice to meet you too! I'm Ana, and this is my first time here.", "Prazer também! Eu sou a Ana, e é minha primeira vez aqui."],
      ["It was great meeting you. See you later!", "Foi ótimo te conhecer. Até mais!"],
    ],
    drift: [
      "De onde cada um de vocês veio até esse lugar",
      "O que trouxe você a esse evento",
      "Se você conhece mais alguém ali",
      "O que você faz quando não está trabalhando",
    ],
    sounds: [
      ["O TH de 'thanks'", "A língua encosta entre os dentes e sopra. Não é F nem T. Diga 'thanks' com a língua aparecendo: exagere, depois relaxe."],
      ["'How are you' vira 'hauaryu'", "Americano não separa as três palavras. Treine dizendo tudo grudado, como se fosse uma palavra só."],
    ],
    quiz: [
      ["Alguém diz 'How are you?'. O que se espera que você responda?", ["Um resumo do seu dia", "Algo curto e positivo, devolvendo a pergunta", "Só 'yes'", "Seu nome completo"], 1, "É parte do cumprimento, não uma consulta médica. 'I'm good, thanks. And you?' resolve em três segundos."],
      ["Você não pegou o nome da pessoa. O que dizer?", ["Fingir que entendeu e seguir", "Sorry, what's your name again?", "Repeat, please", "What is your name? (de novo, igual)"], 1, "'Sorry, what's your name again?' é natural e educado. O 'again' faz parecer distração momentânea, não falta de atenção."],
      ["Por que o Mike soletra o nome depois de perguntar?", ["Porque não conhecia o nome", "Porque nomes estrangeiros costumam pedir confirmação", "Porque é obrigatório em inglês", "Porque a Ana falou errado"], 1, "Soletrar é comum em inglês justamente por causa de nomes que a pessoa nunca ouviu. 'How do you spell that?' vem no circuito 3."],
      ["Qual a diferença entre 'Nice to meet you' e 'Nice to meet you too'?", ["Nenhuma", "O 'too' é usado por quem responde", "O 'too' é mais formal", "O 'too' é usado na despedida"], 1, "Quem fala primeiro diz 'Nice to meet you'. Quem responde acrescenta 'too'. Trocar isso soa estranho, mas ninguém corrige."],
    ],
  },

  // ======================================================== 2
  {
    n: 2,
    immersion: [
      ["Mike", "So, where are you from, Ana?", "Então, de onde você é, Ana?"],
      ["Ana", "I'm from Brazil. I live in São Paulo.", "Eu sou do Brasil. Moro em São Paulo."],
      ["Mike", "Oh, nice! And what do you do?", "Ah, legal! E o que você faz?"],
      ["Ana", "I work as a designer. What about you?", "Eu trabalho como designer. E você?"],
      ["Mike", "I'm a teacher. How long have you been here?", "Eu sou professor. Faz quanto tempo que você está aqui?"],
      ["Ana", "About three months.", "Uns três meses."],
      ["Mike", "That's interesting! Do you like it?", "Que interessante! Você está gostando?"],
      ["Ana", "Yeah, a lot.", "Sim, bastante."],
    ],
    listening: [
      ["Kate", "Hi! Are you new here?", "Oi! Você é novo por aqui?"],
      ["Bruno", "Yeah, I'm from Brazil. I moved here last month.", "É, eu sou do Brasil. Me mudei mês passado."],
      ["Kate", "Wow, welcome! What do you do?", "Nossa, bem-vindo! O que você faz?"],
      ["Bruno", "I work as an engineer. What about you?", "Eu trabalho como engenheiro. E você?"],
      ["Kate", "I work in sales. How old are you, if you don't mind me asking?", "Eu trabalho com vendas. Quantos anos você tem, se não se importa?"],
      ["Bruno", "I'm 32.", "Eu tenho 32."],
      ["Kate", "Same here! That's interesting, we're the same age.", "Eu também! Que interessante, temos a mesma idade."],
      ["Bruno", "Small world!", "Mundo pequeno!"],
    ],
    why: {
      title: "Idade em inglês é ser, não ter",
      body:
        "Em português você **tem** 32 anos. Em inglês você **é** 32: *I'm 32*.\n\n*I have 32 years* é o erro mais reconhecível de brasileiro falando inglês: o americano entende, mas registra na hora. Não é regra para decorar: é um bloco para instalar. Diga *I'm 32* dez vezes hoje e o problema acabou para sempre.",
    },
    swaps: ["Brazil", "São Paulo", "the south of Brazil", "a small town near Rio", "Portugal originally", "here, actually", "Recife", "a city you've never heard of"],
    expansion: [
      ["I'm from Brazil, but I live in Lisbon now, and I work as a designer.", "Eu sou do Brasil, mas moro em Lisboa agora, e trabalho como designer."],
      ["I'm 32 and I've been working as a designer for about six years.", "Eu tenho 32 e trabalho como designer há uns seis anos."],
      ["I live in São Paulo, which is a huge city, so everything takes forever.", "Eu moro em São Paulo, que é uma cidade enorme, então tudo demora uma eternidade."],
      ["That's interesting! What about you? How long have you been here?", "Que interessante! E você? Faz quanto tempo que está aqui?"],
    ],
    drift: [
      "Como é a cidade de onde você vem",
      "O que você mais sente falta quando viaja",
      "Como você foi parar nessa profissão",
      "Se você já morou fora",
    ],
    sounds: [
      ["'Brazil' não é 'Brasiu'", "Em inglês é bra-ZIL, com o acento na segunda sílaba e um L de língua no céu da boca. Brasileiro tende a apagar o L final: não apague."],
      ["O R de 'work' e 'designer'", "O R americano não vibra. A língua se enrola para trás sem encostar em nada. Se está vibrando como em 'carro', está errado."],
    ],
    quiz: [
      ["Como se diz 'eu tenho 32 anos'?", ["I have 32 years", "I have 32 years old", "I'm 32", "I'm 32 years"], 2, "Idade em inglês usa o verbo to be: I'm 32. O 'years old' é opcional e mais comum em contexto formal."],
      ["A Ana responde 'I work as a designer'. Qual pergunta ela respondeu?", ["Where are you from?", "What do you do?", "How are you?", "How long have you been here?"], 1, "'What do you do?' é como se pergunta profissão em inglês. Literalmente 'o que você faz', sem completar com 'da vida'."],
      ["Para que serve 'What about you?'", ["Mudar de assunto", "Devolver a mesma pergunta sem repeti-la", "Encerrar a conversa", "Pedir para repetir"], 1, "É o atalho para devolver a pergunta. Sem ele, a conversa vira interrogatório de mão única e morre."],
      ["A Kate diz 'if you don't mind me asking'. Por quê?", ["Porque idade é assunto delicado em inglês", "Porque ela não conhece o Bruno", "Porque é obrigatório antes de perguntas", "Porque ela está sendo irônica"], 0, "Perguntar idade é considerado invasivo em boa parte da cultura americana. A fórmula amortece a pergunta."],
    ],
  },

  // ======================================================== 3
  {
    n: 3,
    immersion: [
      ["Clerk", "Okay so if you head down past the intersection it'll be on your left right after the pharmacy.", "Ok, então se você seguir depois do cruzamento vai estar à sua esquerda logo depois da farmácia."],
      ["Ana", "Sorry, could you say that again?", "Desculpa, pode repetir?"],
      ["Clerk", "Sure. Go past the intersection, then left.", "Claro. Passe o cruzamento, depois à esquerda."],
      ["Ana", "Could you speak more slowly, please?", "Pode falar mais devagar, por favor?"],
      ["Clerk", "Of course. Go. Past. The intersection.", "Claro. Siga. Passando. O cruzamento."],
      ["Ana", "Okay. What does 'intersection' mean?", "Ok. O que significa 'intersection'?"],
      ["Clerk", "Where two streets cross. A crossing.", "Onde duas ruas se cruzam. Um cruzamento."],
      ["Ana", "Got it. Thank you so much!", "Entendi. Muito obrigada!"],
    ],
    listening: [
      ["Host", "Your table will be ready in about fifteen, but there's a waitlist for the patio.", "Sua mesa fica pronta em uns quinze, mas tem lista de espera para a varanda."],
      ["Bruno", "I'm sorry, I don't understand.", "Desculpa, não entendi."],
      ["Host", "No problem. Fifteen minutes. Inside is faster.", "Sem problema. Quinze minutos. Dentro é mais rápido."],
      ["Bruno", "Do you mean I can sit inside now?", "Você quer dizer que eu posso sentar dentro agora?"],
      ["Host", "Exactly.", "Exatamente."],
      ["Bruno", "Perfect. My English is still basic, sorry.", "Perfeito. Meu inglês ainda é básico, desculpa."],
      ["Host", "You're doing great. What's the name?", "Você está indo muito bem. Qual o nome?"],
      ["Bruno", "Bruno. How do you spell that? B-R-U-N-O.", "Bruno. Como se escreve? B-R-U-N-O."],
    ],
    why: {
      title: "Por que 'could' e não 'can'",
      body:
        "*Can you repeat?* funciona. *Could you repeat?* soa melhor.\n\nEm inglês, o passado de um verbo modal serve para **suavizar o pedido**, não para falar do passado. Por isso *could*, *would* e *might* soam educados: eles criam distância, e distância soa gentil.\n\nÉ o mesmo mecanismo do nosso 'você **poderia**...' em vez de 'você pode'. Não precisa entender a teoria: só use *could* em pedido, sempre.",
    },
    swaps: ["say that again", "speak more slowly", "repeat the last part", "write it down", "spell that", "explain that again", "say it one more time", "show me"],
    expansion: [
      ["Sorry, could you say that again? My English is still basic.", "Desculpa, pode repetir? Meu inglês ainda é básico."],
      ["I'm sorry, I don't understand. What does that mean?", "Desculpa, não entendi. O que isso significa?"],
      ["Do you mean the street after the pharmacy? Could you show me on the map?", "Você quer dizer a rua depois da farmácia? Pode me mostrar no mapa?"],
      ["Could you speak more slowly, please? And how do you spell that?", "Pode falar mais devagar, por favor? E como se escreve?"],
    ],
    drift: [
      "Uma vez em que você não entendeu nada e se virou mesmo assim",
      "Que sotaque é mais difícil para você",
      "O que você faz quando trava numa conversa",
      "Se as pessoas costumam desacelerar quando você pede",
    ],
    sounds: [
      ["'Could you' vira 'kudju'", "O D encontra o Y e vira um som de J. Ninguém fala 'cud-you' separado. Treine grudado: 'kudju say that again'."],
      ["'Sorry' americano", "O O de 'sorry' é aberto, quase 'sá-ri', não 'só-ri'. E o R é enrolado, não vibrado."],
    ],
    quiz: [
      ["Você não entendeu absolutamente nada. Qual a melhor saída?", ["Ficar em silêncio até a pessoa desistir", "Sorry, could you say that again?", "Sorrir e concordar", "Trocar para português"], 1, "Silêncio mata a conversa; a pergunta mantém ela viva. E ninguém se incomoda de repetir."],
      ["Você entendeu mais ou menos e quer confirmar. O que usar?", ["What does that mean?", "Do you mean ___ ?", "How do you spell that?", "I don't understand"], 1, "'Do you mean...?' confirma o que você achou que entendeu. É a frase que evita mal-entendido sem parecer que você não entendeu nada."],
      ["Por que o Bruno diz 'My English is still basic, sorry'?", ["Para se desculpar por existir", "Para tirar o peso e baixar a velocidade do outro", "Porque é obrigatório", "Para pedir desconto"], 1, "Avisar muda o comportamento do interlocutor na hora: ele desacelera e simplifica. É estratégia, não desculpa."],
      ["'How do you spell that?' serve para quê?", ["Perguntar o significado", "Pedir a soletração", "Pedir para repetir", "Pedir para falar devagar"], 1, "Serve para nome, endereço, e-mail: tudo que você precisa anotar certo. Vai salvar você muitas vezes."],
    ],
  },

  // ======================================================== 4
  {
    n: 4,
    immersion: [
      ["Barista", "Hi there! What can I get you?", "Oi! O que posso trazer para você?"],
      ["Ana", "Can I have a coffee, please?", "Pode me ver um café, por favor?"],
      ["Barista", "Sure. Small, medium or large?", "Claro. Pequeno, médio ou grande?"],
      ["Ana", "Medium, please. How much is it?", "Médio, por favor. Quanto é?"],
      ["Barista", "Four fifty. Anything else?", "Quatro e cinquenta. Mais alguma coisa?"],
      ["Ana", "That's all, thanks.", "Só isso, obrigada."],
      ["Barista", "For here or to go?", "Para comer aqui ou levar?"],
      ["Ana", "To go, please.", "Para levar, por favor."],
    ],
    listening: [
      ["Clerk", "Hi, what can I get started for you?", "Oi, o que posso começar a preparar para você?"],
      ["Bruno", "I'd like a sandwich, please.", "Eu queria um sanduíche, por favor."],
      ["Clerk", "We've got turkey, ham and veggie.", "Temos peru, presunto e vegetariano."],
      ["Bruno", "Sorry, how much is the turkey one?", "Desculpa, quanto é o de peru?"],
      ["Clerk", "Seven ninety-nine. Anything else?", "Sete e noventa e nove. Mais alguma coisa?"],
      ["Bruno", "Can I have a water too?", "Pode me ver uma água também?"],
      ["Clerk", "You got it. For here or to go?", "É pra já. Para comer aqui ou levar?"],
      ["Bruno", "For here, please. That's all, thanks.", "Para comer aqui, por favor. Só isso, obrigado."],
    ],
    why: {
      title: "O 'please' não é opcional",
      body:
        "Em português, 'me vê um café' sem 'por favor' passa. Em inglês, *Give me a coffee* soa **rude**: não brusco, rude mesmo.\n\nO **please** faz o trabalho que o nosso tom de voz faz. Sem ele, o pedido vira ordem. Cole o *please* no fim de todo pedido até virar reflexo e você elimina de uma vez a impressão de grosseria que muito brasileiro deixa sem querer.",
    },
    swaps: ["a coffee", "a large water", "the check", "a bag", "one of those", "two of these", "a receipt", "a minute"],
    expansion: [
      ["Can I have a coffee, please? And how much is it?", "Pode me ver um café, por favor? E quanto é?"],
      ["I'd like a sandwich and a water. That's all, thanks.", "Eu queria um sanduíche e uma água. Só isso, obrigado."],
      ["Can I have a medium coffee to go, please? Sorry, how much was that?", "Pode me ver um café médio para levar, por favor? Desculpa, quanto foi?"],
      ["I'd like the turkey one, but could you make it without cheese?", "Eu queria o de peru, mas dá para fazer sem queijo?"],
    ],
    drift: [
      "Qual é o seu pedido de sempre",
      "Café no Brasil versus café nos Estados Unidos",
      "A gorjeta e como ela funciona lá",
      "O que você nunca pediria",
    ],
    sounds: [
      ["'Can I' vira 'kenai'", "As duas palavras grudam numa só. 'Ken-ai have a coffee': sem pausa entre elas."],
      ["'Coffee' não tem O de 'copo'", "É KÁ-fi, com o A bem aberto. 'Cófi' entrega o sotaque na primeira sílaba."],
    ],
    quiz: [
      ["'For here or to go?': o que estão perguntando?", ["Se você quer pagar agora", "Se é para comer no local ou levar", "Se você quer sacola", "Onde você quer sentar"], 1, "É a pergunta padrão em qualquer balcão americano. Responda 'For here' ou 'To go': só isso."],
      ["Qual soa mais natural num café?", ["Give me a coffee.", "I want a coffee.", "Can I have a coffee, please?", "Coffee."], 2, "Os três primeiros são compreensíveis, mas só o terceiro soa educado. O 'please' é obrigatório em pedido."],
      ["'Anything else?' aparece em que momento?", ["No começo do pedido", "Quando você termina de pedir", "Quando você paga", "Quando você entra"], 1, "É a deixa para você fechar. 'That's all, thanks' encerra o pedido."],
      ["Como se pergunta o preço?", ["What is the value?", "How much is it?", "How many is it?", "What price?"], 1, "'How much is it?': 'how many' é para coisas contáveis (quantos), 'how much' é para preço e quantidade não contável."],
    ],
  },

  // ======================================================== 5
  {
    n: 5,
    immersion: [
      ["Cashier", "That'll be fifteen ninety.", "Vai dar quinze e noventa."],
      ["Ana", "Sorry, how much?", "Desculpa, quanto?"],
      ["Cashier", "Fifteen ninety. One five, ninety cents.", "Quinze e noventa. Um cinco, noventa centavos."],
      ["Ana", "Got it. Here you go.", "Entendi. Aqui está."],
      ["Cashier", "Thanks. Do you need a receipt?", "Obrigada. Você precisa de recibo?"],
      ["Ana", "Yes, please. What time do you close?", "Sim, por favor. Que horas vocês fecham?"],
      ["Cashier", "At nine. Around eight is when it gets quiet.", "Às nove. Por volta das oito é quando fica calmo."],
      ["Ana", "Perfect, thank you!", "Perfeito, obrigada!"],
    ],
    listening: [
      ["Bruno", "Excuse me, what time is it?", "Com licença, que horas são?"],
      ["Woman", "It's half past three.", "São três e meia."],
      ["Bruno", "Sorry, could you say that again?", "Desculpa, pode repetir?"],
      ["Woman", "Three thirty.", "Três e trinta."],
      ["Bruno", "Ah, three thirty. And what time does the last train leave?", "Ah, três e trinta. E que horas sai o último trem?"],
      ["Woman", "Around eight, I think. Maybe eight fifteen.", "Por volta das oito, eu acho. Talvez oito e quinze."],
      ["Bruno", "Can you write it down?", "Você pode escrever?"],
      ["Woman", "Sure, here.", "Claro, aqui."],
    ],
    why: {
      title: "Duas formas de dizer a hora, e a que você deve usar",
      body:
        "Existe a forma clássica (*half past three*, *quarter to five*) e a forma que a maioria usa hoje: **só os números**. *Three thirty*. *Four forty-five*.\n\nA forma numérica é mais fácil, mais comum e impossível de errar. Aprenda a **reconhecer** *half past* e *quarter to*: você vai ouvir. Mas para falar, use os números. Não é preguiça: é o que soa mais atual.",
    },
    swaps: ["five dollars", "half past three", "around eight", "twenty bucks", "the third floor", "room 214", "about ten minutes", "almost noon"],
    expansion: [
      ["It's around eight, but I'm not sure. Can you write it down?", "É por volta das oito, mas não tenho certeza. Você pode escrever?"],
      ["Sorry, how much? Fifteen or fifty? Could you say that again?", "Desculpa, quanto? Quinze ou cinquenta? Pode repetir?"],
      ["It's five dollars for one, so it's ten for two.", "É cinco dólares por um, então dá dez por dois."],
      ["What time is it? I have to leave around half past four.", "Que horas são? Eu tenho que sair por volta das quatro e meia."],
    ],
    drift: [
      "Como funcionam os preços e a gorjeta nos Estados Unidos",
      "Se você é do tipo pontual ou do tipo dos quinze minutos",
      "Que horas você acorda e por quê",
      "Fahrenheit, milhas, libras: o que mais te confunde",
    ],
    sounds: [
      ["Thirteen versus thirty", "A diferença está no acento: thir-TEEN (13) tem a força no fim; THIR-ty (30) tem a força no começo. Erre isso e você paga dez vezes mais."],
      ["'Fifteen ninety' grudado", "Números longos saem sem pausa. Se você não pegar, peça o número dígito por dígito: 'one five, ninety'."],
    ],
    quiz: [
      ["Como você diferencia 13 de 30 na fala?", ["Pelo contexto apenas", "Pelo acento: thirTEEN versus THIRty", "São iguais", "Pela vogal"], 1, "O acento tônico é a única diferença confiável. É por isso que confundir preço é tão comum: e por isso pedir para repetir é normal."],
      ["'Half past three' significa:", ["Três e meia", "Meia hora para as três", "Três e quinze", "Duas e meia"], 0, "'Half past' = meia hora DEPOIS. Três e meia. A forma numérica 'three thirty' é mais comum hoje."],
      ["O que fazer quando você não pega um número?", ["Pagar e conferir depois", "Sorry, how much? ou Can you write it down?", "Fingir que entendeu", "Sair da loja"], 1, "As duas frases são normais e ninguém se incomoda. Número errado custa dinheiro; perguntar não custa nada."],
      ["'Around eight' quer dizer:", ["Exatamente às oito", "Por volta das oito", "Depois das oito", "Antes das oito"], 1, "'Around' é o 'por volta de'. Muito usado: americano raramente promete horário exato em conversa informal."],
    ],
  },

  // ======================================================== 6
  {
    n: 6,
    immersion: [
      ["Kate", "So what's a normal day like for you?", "Então, como é um dia normal para você?"],
      ["Ana", "I wake up at seven. I usually have coffee first.", "Eu acordo às sete. Normalmente tomo café primeiro."],
      ["Kate", "Same. I can't do anything before coffee.", "Igual. Eu não faço nada antes do café."],
      ["Ana", "Then I go to work. I get home around six.", "Depois eu vou trabalhar. Chego em casa por volta das seis."],
      ["Kate", "That's a long day. What do you do after that?", "É um dia longo. O que você faz depois disso?"],
      ["Ana", "After that, I cook dinner. And I go to bed late.", "Depois disso, eu faço o jantar. E vou dormir tarde."],
      ["Kate", "How late?", "Quão tarde?"],
      ["Ana", "Around one. What's your routine like?", "Por volta de uma. Como é a sua rotina?"],
    ],
    listening: [
      ["Mike", "You look tired. Rough morning?", "Você parece cansado. Manhã difícil?"],
      ["Bruno", "Yeah. I wake up at five thirty every day.", "É. Eu acordo às cinco e meia todo dia."],
      ["Mike", "Five thirty! Why so early?", "Cinco e meia! Por que tão cedo?"],
      ["Bruno", "I go to the gym first, then I go to work.", "Eu vou para a academia primeiro, depois vou trabalhar."],
      ["Mike", "That's impressive. Do you do that every day?", "Isso é impressionante. Você faz isso todo dia?"],
      ["Bruno", "Almost. Not on weekends.", "Quase. Nos fins de semana não."],
      ["Mike", "And what time do you get home?", "E que horas você chega em casa?"],
      ["Bruno", "Around six. After that I just cook and sleep.", "Por volta das seis. Depois disso eu só cozinho e durmo."],
    ],
    why: {
      title: "O S que aparece do nada em 'he works'",
      body:
        "*I work*, *you work*, *we work*: mas *he workS*, *she workS*, *it workS*.\n\nSó a terceira pessoa do singular ganha S no presente. É a regra mais chata do inglês e a que menos importa: se você esquecer, **ninguém deixa de te entender**.\n\nNão pare a frase para conferir. Fale, erre, e deixe o S se instalar sozinho de tanto ouvir. Ele cola por exposição, não por vigilância.",
    },
    swaps: ["wake up at seven", "have coffee first", "go to work by bus", "work from home", "get home around six", "cook dinner", "go to the gym", "go to bed late"],
    expansion: [
      ["I wake up at seven, I usually have coffee first, and then I go to work.", "Eu acordo às sete, normalmente tomo café primeiro, e depois vou trabalhar."],
      ["I get home around six, and after that I cook dinner and watch something.", "Chego em casa por volta das seis, e depois disso faço o jantar e assisto alguma coisa."],
      ["I go to bed late because I work from home, so my day never really ends.", "Eu durmo tarde porque trabalho de casa, então meu dia nunca acaba de verdade."],
      ["On weekdays I wake up early, but on weekends I sleep until ten.", "Nos dias de semana eu acordo cedo, mas nos fins de semana durmo até as dez."],
    ],
    drift: [
      "Se você é pessoa de manhã ou de madrugada",
      "O que você mudaria na sua rotina se pudesse",
      "Como era sua rotina há cinco anos",
      "O que você faz no primeiro minuto depois de acordar",
    ],
    sounds: [
      ["'Wake up' vira 'weikap'", "Consoante final gruda na vogal seguinte. 'Wake-up', 'get-up', 'pick-it-up': tudo emendado. É isso que faz o inglês soar rápido."],
      ["O A de 'after' e 'ask'", "Não é 'áfter' fechado nem 'êfter'. É um A aberto, quase de 'pá'. Exagere um pouco no começo."],
    ],
    quiz: [
      ["Como você diz 'eu acordo às sete'?", ["I wake up in seven", "I wake up at seven", "I wake at seven hours", "I wake up on seven"], 1, "Horário exato usa 'at': at seven, at three thirty. 'In' é para períodos (in the morning), 'on' é para dias (on Monday)."],
      ["Onde entra o S da terceira pessoa?", ["I workS", "You workS", "He workS", "We workS"], 2, "Só he, she e it ganham S no presente. É a regra que mais gera erro e menos gera mal-entendido."],
      ["O que 'After that' faz na frase?", ["Marca o passado", "Encadeia a próxima coisa da sequência", "Indica dúvida", "Pede confirmação"], 1, "É conectivo de sequência. Ele, 'then' e 'first' transformam uma lista de frases soltas numa narrativa."],
      ["'What's your routine like?': o 'like' aí significa:", ["Gostar", "Como é, de que jeito é", "Parecido com", "Preferir"], 1, "'What's ___ like?' pergunta como algo é. Nada a ver com gostar: é uma das armadilhas clássicas."],
    ],
  },

  // ======================================================== 7
  {
    n: 7,
    immersion: [
      ["Kate", "So what do you do for fun?", "Então, o que você faz por diversão?"],
      ["Ana", "I love cooking. And I'm really into music.", "Eu adoro cozinhar. E sou muito ligada em música."],
      ["Kate", "Oh nice, what kind?", "Ah, legal, que tipo?"],
      ["Ana", "Everything, honestly. It depends.", "Tudo, sinceramente. Depende."],
      ["Kate", "Have you seen that new cooking show?", "Você viu aquele programa novo de culinária?"],
      ["Ana", "No, is it good?", "Não, é bom?"],
      ["Kate", "You should try it! It's great.", "Você devia experimentar! É ótimo."],
      ["Ana", "I'll check it out. Same here, I love that stuff.", "Vou dar uma olhada. Igual, eu adoro esse tipo de coisa."],
    ],
    listening: [
      ["Mike", "Are you into sports?", "Você curte esportes?"],
      ["Bruno", "Not really. I'm not a big fan of that.", "Nem tanto. Eu não sou muito fã disso."],
      ["Mike", "Fair enough. What about movies?", "Justo. E filmes?"],
      ["Bruno", "I love watching movies. Especially old ones.", "Eu adoro assistir filmes. Principalmente antigos."],
      ["Mike", "Have you seen Casablanca?", "Você viu Casablanca?"],
      ["Bruno", "Of course! Three times.", "Claro! Três vezes."],
      ["Mike", "Same here! You should try the director's other stuff.", "Eu também! Você devia experimentar as outras coisas do diretor."],
      ["Bruno", "It depends on how much time I have, but I'll try.", "Depende de quanto tempo eu tiver, mas vou tentar."],
    ],
    why: {
      title: "Por que 'I love cookING' e não 'I love to cook'",
      body:
        "As duas existem e as duas estão certas. Mas na fala do dia a dia, depois de *love*, *like*, *hate* e *enjoy*, americano usa muito mais o **-ing**: *I love cooking*, *I hate waiting*, *I enjoy reading*.\n\nA vantagem prática: o **-ing** nunca muda. *cooking*, *waiting*, *reading*: mesma forma sempre. Um molde, zero conjugação.",
    },
    swaps: ["cooking", "traveling", "watching movies", "listening to podcasts", "running in the morning", "playing guitar", "reading before bed", "meeting new people"],
    expansion: [
      ["I love cooking, but I'm not a big fan of doing the dishes afterwards.", "Eu adoro cozinhar, mas não sou muito fã de lavar a louça depois."],
      ["I'm really into music, especially old stuff. Have you seen that documentary?", "Eu sou muito ligada em música, principalmente coisa antiga. Você viu aquele documentário?"],
      ["It depends on the day, but I usually love reading before bed.", "Depende do dia, mas normalmente eu adoro ler antes de dormir."],
      ["Same here! You should try it, it's really good.", "Eu também! Você devia experimentar, é muito bom."],
    ],
    drift: [
      "O que você faria se tivesse um dia livre inteiro",
      "Um hobby que você abandonou e sente falta",
      "A última série ou filme que te prendeu",
      "Algo de que todo mundo gosta e você não",
    ],
    sounds: [
      ["O -ING final", "O som é nasal e o G quase não aparece: 'cook-in', não 'cook-ingui'. Brasileiro tende a colocar uma vogal no fim: não coloque."],
      ["'Really' com dois R diferentes", "O primeiro R é enrolado (americano), o L é de língua no céu da boca. 'Ri-a-li', devagar, até separar os dois."],
    ],
    quiz: [
      ["Qual soa mais natural na conversa?", ["I love to cook.", "I love cooking.", "I love cook.", "I love the cook."], 1, "As duas primeiras estão certas, mas -ing é muito mais comum na fala. E não muda de forma nunca."],
      ["'I'm not a big fan of that' quer dizer:", ["Eu odeio isso", "Eu não curto muito", "Eu não conheço", "Eu adoro"], 1, "É o jeito educado de dizer que não gosta. Americano raramente diz 'I hate it' em conversa casual com desconhecido."],
      ["'It depends' serve para:", ["Encerrar a conversa", "Dar uma resposta honesta sem se comprometer", "Concordar", "Discordar"], 1, "É uma das frases mais úteis do inglês. Ganha tempo, soa ponderado e é sempre verdade."],
      ["'Same here!' é a forma curta de:", ["I'm here too", "Me too, I feel the same", "Same place", "I agree with the place"], 1, "É 'eu também' aplicado a gostos e sensações. Curtíssimo e muito usado."],
    ],
  },

  // ======================================================== 8
  {
    n: 8,
    immersion: [
      ["Kate", "Is that your family in the photo?", "Essa é sua família na foto?"],
      ["Ana", "Yeah! This is my brother.", "É! Esse é meu irmão."],
      ["Kate", "He looks like your dad.", "Ele parece com seu pai."],
      ["Ana", "Everyone says that. We're really close.", "Todo mundo fala isso. A gente é muito próximo."],
      ["Kate", "Do you have any siblings besides him?", "Você tem outros irmãos além dele?"],
      ["Ana", "No, just him. And I have two kids.", "Não, só ele. E eu tenho dois filhos."],
      ["Kate", "Oh wow! How old are they?", "Nossa! Quantos anos eles têm?"],
      ["Ana", "Six and nine. That's my family.", "Seis e nove. Essa é minha família."],
    ],
    listening: [
      ["Mike", "Who's that in the picture?", "Quem é esse na foto?"],
      ["Bruno", "That's my sister. She's the one who lives in Canada.", "Essa é minha irmã. É ela que mora no Canadá."],
      ["Mike", "Do you see her often?", "Você a vê com frequência?"],
      ["Bruno", "Not really. Once a year, maybe. But we're really close.", "Nem tanto. Uma vez por ano, talvez. Mas somos muito próximos."],
      ["Mike", "Do you have any other siblings?", "Você tem outros irmãos?"],
      ["Bruno", "I have two brothers. And this is my mom.", "Eu tenho dois irmãos. E essa é minha mãe."],
      ["Mike", "She looks young!", "Ela parece jovem!"],
      ["Bruno", "She'd love to hear that. That's my family.", "Ela ia adorar ouvir isso. Essa é minha família."],
    ],
    why: {
      title: "'This is' apresenta gente, não só coisa",
      body:
        "Em português a gente diz 'esse é meu irmão' apontando para a foto, e 'esse aqui é o João' apresentando alguém ao vivo. Em inglês é o **mesmo bloco** nos dois casos: *This is my brother*.\n\nInclusive ao telefone: *Hi, this is Ana*: não *I am Ana*. Um bloco, três usos. Guarde inteiro.",
    },
    swaps: ["brother", "sister", "mom", "dad", "wife", "best friend", "cousin", "coworker"],
    expansion: [
      ["This is my brother. He looks like my dad, and everyone says that.", "Esse é meu irmão. Ele parece com meu pai, e todo mundo fala isso."],
      ["I have two kids, and we're really close, even though I work a lot.", "Eu tenho dois filhos, e somos muito próximos, mesmo eu trabalhando muito."],
      ["She's the one who lives in Canada, so I only see her once a year.", "É ela que mora no Canadá, então eu só a vejo uma vez por ano."],
      ["Do you have any siblings? I have one brother and two sisters.", "Você tem irmãos? Eu tenho um irmão e duas irmãs."],
    ],
    drift: [
      "Com quem da sua família você mais se parece",
      "Uma história de infância com seus irmãos",
      "Como sua família reagiu quando você começou a estudar inglês",
      "Se você mora perto ou longe deles",
    ],
    sounds: [
      ["'Brother' e o TH sonoro", "Esse TH vibra: a língua entre os dentes COM voz. 'Bro-ther', não 'bro-der'. Ponha a mão na garganta: tem que tremer."],
      ["'Looks like' vira 'lukslaik'", "O S final gruda no L seguinte. Não separe as palavras: ninguém separa."],
    ],
    quiz: [
      ["'He looks like my dad' significa:", ["Ele gosta do meu pai", "Ele se parece com meu pai", "Ele olha para meu pai", "Ele procura meu pai"], 1, "'Look like' = parecer com. Nada a ver com gostar. É a mesma armadilha do 'What's it like?'."],
      ["Como se apresenta alguém em inglês?", ["He is my brother", "This is my brother", "That is my brother there", "My brother is he"], 1, "'This is ___' é o bloco de apresentação. Serve ao vivo, na foto e no telefone."],
      ["'We're really close' quer dizer:", ["Moramos perto", "Somos muito unidos", "Estamos quase chegando", "Somos parecidos"], 1, "'Close' aqui é proximidade afetiva. Para distância física seria 'We live close to each other'."],
      ["'Do you have any siblings?' pergunta sobre:", ["Filhos", "Irmãos e irmãs", "Primos", "Pais"], 1, "'Siblings' cobre irmãos e irmãs sem especificar gênero. Não existe equivalente de uma palavra só em português."],
    ],
  },

  // ======================================================== 9
  {
    n: 9,
    immersion: [
      ["Kate", "Where do you live?", "Onde você mora?"],
      ["Ana", "I live in a small apartment downtown.", "Eu moro num apartamento pequeno no centro."],
      ["Kate", "Nice! How's the area?", "Legal! Como é a região?"],
      ["Ana", "It's a nice area. The neighborhood is pretty quiet.", "É uma área boa. O bairro é bem tranquilo."],
      ["Kate", "Is there anything around?", "Tem alguma coisa por perto?"],
      ["Ana", "There's a park near my place. It's about ten minutes away.", "Tem um parque perto de casa. Fica a uns dez minutos."],
      ["Kate", "How long have you been there?", "Faz quanto tempo que você está lá?"],
      ["Ana", "I've lived here for three years. Where do you live?", "Eu moro aqui há três anos. E você, onde mora?"],
    ],
    listening: [
      ["Mike", "Did you find a place yet?", "Você já achou um lugar?"],
      ["Bruno", "Yeah, finally. I live in a small apartment now.", "Achei, finalmente. Moro num apartamento pequeno agora."],
      ["Mike", "Where exactly?", "Onde exatamente?"],
      ["Bruno", "Near the university. There's a supermarket near my place.", "Perto da universidade. Tem um supermercado perto de casa."],
      ["Mike", "That's convenient. Is it far from work?", "Isso é conveniente. É longe do trabalho?"],
      ["Bruno", "It's about twenty minutes away by bus.", "Fica a uns vinte minutos de ônibus."],
      ["Mike", "Not bad. Is the neighborhood okay?", "Nada mal. O bairro é bom?"],
      ["Bruno", "Pretty quiet. It's a nice area, actually.", "Bem tranquilo. É uma área boa, na verdade."],
    ],
    why: {
      title: "'There's' é o nosso 'tem'",
      body:
        "Brasileiro traduz 'tem um parque perto' como *Have a park near*. Não funciona: em inglês, existência usa **there is** e **there are**.\n\n*There's a park* (um). *There are two parks* (mais de um).\n\nNa fala, *there's* aparece até com plural (*there's two parks*): não é considerado bonito, mas é o que se ouve. Você use *there's* para singular e não se preocupe com o resto.",
    },
    swaps: ["park", "supermarket", "gym", "coffee shop", "subway station", "school", "pharmacy", "really good bakery"],
    expansion: [
      ["I live in a small apartment, and there's a park near my place.", "Eu moro num apartamento pequeno, e tem um parque perto de casa."],
      ["The neighborhood is pretty quiet, but it's about ten minutes from downtown.", "O bairro é bem tranquilo, mas fica a uns dez minutos do centro."],
      ["I've lived here for three years and I still love it.", "Eu moro aqui há três anos e ainda amo."],
      ["It's a nice area, though there's not much to do at night.", "É uma área boa, embora não tenha muito o que fazer à noite."],
    ],
    drift: [
      "O bairro em que você cresceu",
      "O que faz um lugar ser bom para morar",
      "Se você prefere cidade grande ou pequena",
      "Onde você moraria se pudesse escolher qualquer lugar",
    ],
    sounds: [
      ["'There's' com TH sonoro + Z", "O TH vibra e o S final soa como Z: 'dhérz'. Não é 'dérs' nem 'térs'."],
      ["'Neighborhood' é mais curta do que parece", "São três batidas: NEI-bor-hud. Brasileiro tende a pronunciar todas as letras: não pronuncie."],
    ],
    quiz: [
      ["Como se diz 'tem um parque perto de casa'?", ["Have a park near my place", "There's a park near my place", "It has a park near my place", "Exists a park near my place"], 1, "Existência em inglês é 'there is' e 'there are'. 'Have' é posse, sempre com dono."],
      ["'It's about ten minutes away' significa:", ["Custa dez minutos", "Fica a uns dez minutos daqui", "Abre em dez minutos", "Dura dez minutos"], 1, "'Away' marca distância a partir de onde você está. Muito usado para localizar."],
      ["'I've lived here for three years' quer dizer que você:", ["Morou lá e saiu", "Mora lá até hoje, há três anos", "Vai morar por três anos", "Morou três anos atrás"], 1, "É a construção que liga passado e presente: começou há três anos e continua. 'For' marca a duração."],
      ["'Pretty quiet' aqui significa:", ["Bonito e silencioso", "Bem tranquilo", "Quase silencioso", "Silencioso demais"], 1, "'Pretty' antes de adjetivo é intensificador: bem, bastante. Nada a ver com beleza."],
    ],
  },

  // ======================================================== 10
  {
    n: 10,
    immersion: [
      ["Ana", "Excuse me, how do I get to the station?", "Com licença, como eu chego na estação?"],
      ["Man", "Go straight and turn left at the light.", "Siga reto e vire à esquerda no semáforo."],
      ["Ana", "Sorry, left or right?", "Desculpa, esquerda ou direita?"],
      ["Man", "Left. Then it's on your right, after the bank.", "Esquerda. Aí fica à sua direita, depois do banco."],
      ["Ana", "Is it far from here?", "É longe daqui?"],
      ["Man", "No, five minutes walking.", "Não, cinco minutos a pé."],
      ["Ana", "Can you show me on the map?", "Você pode me mostrar no mapa?"],
      ["Man", "Sure. Right here.", "Claro. Bem aqui."],
    ],
    listening: [
      ["Bruno", "Excuse me, how do I get to the museum?", "Com licença, como eu chego no museu?"],
      ["Woman", "The museum? Go straight for two blocks, then turn right.", "O museu? Siga reto por dois quarteirões, depois vire à direita."],
      ["Bruno", "Two blocks, then right. Is it far from here?", "Dois quarteirões, depois direita. É longe daqui?"],
      ["Woman", "About ten minutes. It's on your left, you can't miss it.", "Uns dez minutos. Fica à sua esquerda, não tem como errar."],
      ["Bruno", "Sorry, left or right?", "Desculpa, esquerda ou direita?"],
      ["Woman", "Turn right, and then the museum is on your left.", "Vire à direita, e aí o museu fica à sua esquerda."],
      ["Bruno", "Got it. Thanks a lot!", "Entendi. Muito obrigado!"],
      ["Woman", "No problem!", "De nada!"],
    ],
    why: {
      title: "Por que 'How do I get to' e não 'How do I arrive'",
      body:
        "*Get to* é o verbo de chegar em um lugar no inglês falado. *Arrive* existe, mas soa de aeroporto e horário de voo.\n\n*How do I get to the station?*: como eu chego na estação.\n*I get home around six*: eu chego em casa por volta das seis.\n\nRepare que *get* não tem tradução fixa. Não tente traduzir: guarde o bloco inteiro e use.",
    },
    swaps: ["the station", "the airport", "downtown", "the nearest pharmacy", "this address", "the bus stop", "the beach", "your place"],
    expansion: [
      ["Excuse me, how do I get to the station? Is it far from here?", "Com licença, como eu chego na estação? É longe daqui?"],
      ["Go straight and turn left, then it's on your right after the bank.", "Siga reto e vire à esquerda, aí fica à sua direita depois do banco."],
      ["Sorry, left or right? Could you show me on the map?", "Desculpa, esquerda ou direita? Você pode me mostrar no mapa?"],
      ["It's about ten minutes walking, so you don't need a taxi.", "É uns dez minutos a pé, então você não precisa de táxi."],
    ],
    drift: [
      "A última vez que você se perdeu numa cidade",
      "Se você confia mais no GPS ou em perguntar",
      "Como é o transporte público na sua cidade",
      "Um lugar que vale a pena visitar onde você mora",
    ],
    sounds: [
      ["'Straight' começa com STR", "Três consoantes juntas, sem vogal no meio. Brasileiro insere um 'i': 'istreit'. Comece pelo S puxado: 'ssstreit'."],
      ["'Turn left' e o R enrolado", "O R de 'turn' não vibra: a língua vai para trás e não encosta. Depois emenda direto no L de 'left'."],
    ],
    quiz: [
      ["Como se pergunta o caminho?", ["Where is the way to the station?", "How do I get to the station?", "How I arrive the station?", "Which is the station road?"], 1, "'How do I get to ___?' é o bloco padrão. Funciona para qualquer destino."],
      ["'It's on your right' significa:", ["Você está certo", "Fica à sua direita", "É o seu direito", "Vire à direita"], 1, "'On your right' localiza; 'turn right' comanda. São coisas diferentes e é fácil confundir na hora."],
      ["Você ouviu a direção mas não teve certeza. O que dizer?", ["Repeat", "Sorry, left or right?", "I don't know", "Please"], 1, "Perguntar a alternativa específica é mais rápido que pedir para repetir tudo: e mostra que você acompanhou."],
      ["'You can't miss it' quer dizer:", ["Você não pode perder o horário", "É impossível não ver", "Você não pode errar o caminho", "Não perca essa chance"], 1, "É a frase que americano solta quando o lugar é óbvio. Costuma ser mentira, mas é bem-intencionada."],
    ],
  },

  // ======================================================== 11
  {
    n: 11,
    immersion: [
      ["Clerk", "Hi! Let me know if you need anything.", "Oi! Me avise se precisar de alguma coisa."],
      ["Ana", "I'm just looking, thanks.", "Só estou olhando, obrigada."],
      ["Ana", "Actually, do you have this in a medium?", "Na verdade, você tem isso em médio?"],
      ["Clerk", "Let me check. Yes, here you go.", "Vou verificar. Sim, aqui está."],
      ["Ana", "Can I try it on? Where's the fitting room?", "Posso experimentar? Onde fica o provador?"],
      ["Clerk", "Right over there, on the left.", "Bem ali, à esquerda."],
      ["Ana", "It's too tight. Do you have a large?", "Está muito apertado. Você tem grande?"],
      ["Clerk", "Sure, one second.", "Claro, um segundo."],
    ],
    listening: [
      ["Bruno", "Excuse me, do you have this in blue?", "Com licença, você tem isso em azul?"],
      ["Clerk", "We do, but only in small and large.", "Temos, mas só em pequeno e grande."],
      ["Bruno", "Can I try the large on?", "Posso experimentar o grande?"],
      ["Clerk", "Of course. The fitting room is in the back.", "Claro. O provador fica no fundo."],
      ["Bruno", "Thanks. Hmm, it's too tight around the shoulders.", "Obrigado. Hmm, está muito apertado nos ombros."],
      ["Clerk", "We have the same one in a different cut.", "Temos o mesmo num corte diferente."],
      ["Bruno", "Perfect. I'll take it. Can I return it if it doesn't fit?", "Perfeito. Vou levar. Posso devolver se não servir?"],
      ["Clerk", "Within thirty days, with the receipt.", "Em até trinta dias, com o recibo."],
    ],
    why: {
      title: "'Try it on' é diferente de 'try it'",
      body:
        "*Try it* = experimentar, testar (uma comida, uma ideia).\n*Try it **on*** = provar uma roupa, vestir para ver se serve.\n\nEsse *on* muda tudo, e ele é grudado no verbo. Em inglês existem centenas desses: são os **phrasal verbs**, e o circuito 40 é inteiro dedicado a eles.\n\nPor ora, guarde os dois blocos separados e não tente deduzir: *try it on* não é dedutível de *try*.",
    },
    swaps: ["a medium", "a large", "blue", "black", "a smaller size", "another color", "the same one", "a different style"],
    expansion: [
      ["Do you have this in a medium? Can I try it on?", "Você tem isso em médio? Posso experimentar?"],
      ["It's too tight, so I'd like to try the large instead.", "Está muito apertado, então eu queria experimentar o grande."],
      ["I'll take it. Can I return it if it doesn't fit?", "Vou levar. Posso devolver se não servir?"],
      ["I'm just looking, thanks. But where's the fitting room, just in case?", "Só estou olhando, obrigado. Mas onde fica o provador, por via das dúvidas?"],
    ],
    drift: [
      "Se você é do tipo que compra rápido ou demora horas",
      "Quanto tempo faz que você comprou uma peça nova",
      "Comprar online versus na loja",
      "A peça de roupa que você mais usa",
    ],
    sounds: [
      ["'Clothes' é quase 'close'", "Ninguém pronuncia o TH ali no meio. Diga 'clouz' e está certo. Tentar articular tudo é que soa errado."],
      ["'Try it on' vira 'traionn'", "Três palavras, um som só. As vogais se encadeiam. Diga rápido até virar uma coisa só."],
    ],
    quiz: [
      ["Como você pede outro tamanho?", ["Do you have this in a medium?", "Do you have this medium?", "Have you this in medium?", "This is medium?"], 0, "'Do you have this in ___?' é o molde. Serve para tamanho, cor e modelo."],
      ["'Can I try it on?' pergunta se você pode:", ["Comprar", "Provar a roupa", "Testar a qualidade", "Pegar na mão"], 1, "O 'on' é o que faz virar provar roupa. Sem ele, 'try it' é experimentar qualquer coisa."],
      ["'I'm just looking, thanks' serve para:", ["Pedir ajuda", "Dizer educadamente que não quer ajuda agora", "Elogiar a loja", "Pedir desconto"], 1, "É a frase que tira o vendedor de cima sem grosseria. Universal em qualquer loja americana."],
      ["'It's too tight' quer dizer:", ["Está muito caro", "Está muito apertado", "Está muito curto", "Está muito bonito"], 1, "'Tight' é apertado. 'Too' antes de adjetivo marca excesso: passou do ponto aceitável."],
    ],
  },

  // ======================================================== 12
  {
    n: 12,
    immersion: [
      ["Host", "Hi! How many?", "Oi! Quantos?"],
      ["Ana", "A table for two, please.", "Uma mesa para dois, por favor."],
      ["Waiter", "Are you ready to order?", "Prontos para pedir?"],
      ["Ana", "What do you recommend?", "O que você recomenda?"],
      ["Waiter", "The chicken is really good today.", "O frango está muito bom hoje."],
      ["Ana", "Could I get the chicken, please? I'm allergic to nuts.", "Pode me trazer o frango, por favor? Eu sou alérgica a castanhas."],
      ["Waiter", "I'll let the kitchen know.", "Vou avisar a cozinha."],
      ["Ana", "Thank you. It was delicious, thank you!", "Obrigada. Estava delicioso, obrigada!"],
    ],
    listening: [
      ["Waiter", "How is everything?", "Como está tudo?"],
      ["Bruno", "It was delicious, thank you.", "Estava delicioso, obrigado."],
      ["Waiter", "Glad to hear it. Any dessert?", "Que bom. Alguma sobremesa?"],
      ["Bruno", "Not today. Could we get the check, please?", "Hoje não. Pode trazer a conta, por favor?"],
      ["Waiter", "Of course. Together or separate?", "Claro. Junto ou separado?"],
      ["Bruno", "Can we split the bill?", "A gente pode dividir a conta?"],
      ["Waiter", "Sure. Two cards?", "Claro. Dois cartões?"],
      ["Bruno", "Yes, please. Thanks a lot!", "Sim, por favor. Muito obrigado!"],
    ],
    why: {
      title: "'Could I get' é o pedido mais seguro do inglês",
      body:
        "Você já tem *Can I have ___?* do circuito 4. *Could I get ___?* é o mesmo molde, um degrau mais educado: e é o que se ouve em restaurante americano o tempo todo.\n\nOs dois funcionam sempre. Se você só quiser guardar um, guarde este: **could** é mais educado que **can**, e **get** é mais falado que **have**.",
    },
    swaps: ["the chicken", "a table for two", "the check", "some water", "the same thing", "one of those", "it without onions", "another one of these"],
    expansion: [
      ["Could I get the chicken, please? And I'm allergic to nuts.", "Pode me trazer o frango, por favor? E eu sou alérgico a castanhas."],
      ["What do you recommend? It's my first time here.", "O que você recomenda? É minha primeira vez aqui."],
      ["It was delicious, thank you. Could we get the check, please?", "Estava delicioso, obrigada. Pode trazer a conta, por favor?"],
      ["Can we split the bill? There are four of us.", "A gente pode dividir a conta? Somos quatro."],
    ],
    drift: [
      "O prato brasileiro que você tentaria explicar em inglês",
      "Uma comida que você comeu fora e não esperava gostar",
      "Como funciona a gorjeta e por que confunde tanto",
      "Restaurante caro ou barzinho: o que você prefere",
    ],
    sounds: [
      ["'Could I get' vira 'kudaiguet'", "Todas grudam. O D de 'could' encosta no A de 'I' e o T final de 'get' quase some."],
      ["'Delicious' tem CH no meio", "É di-LI-shas, com o acento na segunda sílaba e um 'sh' no meio. Não é 'delicious' letra por letra."],
    ],
    quiz: [
      ["Como você pede a conta?", ["Bring the account, please", "Could we get the check, please?", "I want to pay now", "The bill me, please"], 1, "'Check' nos Estados Unidos, 'bill' no Reino Unido. Os dois são entendidos em qualquer lugar."],
      ["'I'm allergic to nuts' é importante porque:", ["É educado avisar", "Alergia alimentar é levada muito a sério lá", "Faz o prato sair mais rápido", "Dá desconto"], 1, "Restaurante americano trata alergia com protocolo. Avisar não é frescura: é segurança, e eles agradecem."],
      ["'Can we split the bill?' pede para:", ["Dividir a conta entre as pessoas", "Parcelar o pagamento", "Reduzir a conta", "Conferir a conta"], 0, "'Split' é dividir entre pessoas. Parcelar seria 'pay in installments', que praticamente não existe em restaurante lá."],
      ["'What do you recommend?' é útil porque:", ["Mostra que você é educado", "Resolve o cardápio que você não entendeu", "É obrigatório perguntar", "Dá direito a desconto"], 1, "É a saída elegante quando o cardápio tem vinte pratos com nomes que você nunca viu. E costuma render uma boa escolha."],
    ],
  },

  // ======================================================== 13
  {
    n: 13,
    immersion: [
      ["Sarah", "Hi! I'm Sarah. I don't think we've met.", "Oi! Eu sou a Sarah. Acho que a gente não se conhece."],
      ["Ana", "Hi Sarah, I'm Ana. Nice to meet you.", "Oi Sarah, eu sou a Ana. Prazer."],
      ["Sarah", "So what brings you here? Sorry, could you say that again if I talk too fast.", "Então, o que te traz aqui? Desculpa, pode pedir para repetir se eu falar rápido demais."],
      ["Ana", "I'm from Brazil. I usually work downtown, and there's a coffee shop near my place I love.", "Eu sou do Brasil. Normalmente trabalho no centro, e tem um café perto de casa que eu amo."],
      ["Sarah", "Oh nice. Speaking of coffee, do you want one?", "Ah, legal. Falando em café, você quer um?"],
      ["Ana", "Sure. Can I have a coffee, please?", "Claro. Pode me ver um café, por favor?"],
      ["Sarah", "On me. How do I get to the counter from here?", "Por minha conta. Como eu chego no balcão daqui?"],
      ["Ana", "Go straight and turn left. See you in a minute!", "Siga reto e vire à esquerda. Até já!"],
    ],
    listening: [
      ["Waiter", "Are you ready to order?", "Prontos para pedir?"],
      ["Bruno", "Could I get the chicken, please? And a water.", "Pode me trazer o frango, por favor? E uma água."],
      ["Waiter", "Sure thing. Anything else?", "Claro. Mais alguma coisa?"],
      ["Bruno", "That's all, thanks. Sorry, how much is the chicken?", "Só isso, obrigado. Desculpa, quanto é o frango?"],
      ["Waiter", "Sixteen fifty.", "Dezesseis e cinquenta."],
      ["Bruno", "Got it. I usually don't eat out, but I'm celebrating today.", "Entendi. Eu normalmente não como fora, mas estou comemorando hoje."],
      ["Waiter", "Oh nice, what's the occasion?", "Ah, legal, qual a ocasião?"],
      ["Bruno", "One year of learning English. Could we get the check later, please?", "Um ano aprendendo inglês. Pode trazer a conta depois, por favor?"],
    ],
    why: {
      title: "Doze circuitos, um mesmo mecanismo",
      body:
        "Olhe para trás: *Can I have ___?*, *Could you ___?*, *There's a ___ near*, *How do I get to ___?*. Nenhum deles você montou palavra por palavra. Você **instalou o molde** e passou a trocar a peça.\n\nÉ isso que o curso inteiro faz. Não existe um momento futuro em que você vai 'aprender a gramática e aí falar': o molde já é a gramática, só que instalada pela boca em vez de pela tabela.",
    },
    swaps: ["Can I have a coffee, please?", "Sorry, could you say that again?", "There's a park near my place.", "How do I get to the station?", "I usually wake up at seven.", "This is my brother.", "Could we get the check, please?", "Nice to meet you too."],
    expansion: [
      ["Hi, I'm Ana. Nice to meet you. Sorry, could you say that again?", "Oi, eu sou a Ana. Prazer. Desculpa, pode repetir?"],
      ["I usually work downtown, and there's a great coffee shop near my place.", "Eu normalmente trabalho no centro, e tem um café ótimo perto de casa."],
      ["Can I have a coffee, please? And how do I get to the station from here?", "Pode me ver um café, por favor? E como eu chego na estação daqui?"],
      ["This is my brother. He lives about ten minutes away, so we see each other a lot.", "Esse é meu irmão. Ele mora a uns dez minutos, então a gente se vê bastante."],
    ],
    drift: [
      "O que mudou no seu inglês desde o dia 1",
      "Qual bloco você mais usou fora do aplicativo",
      "Qual situação ainda te dá medo",
      "O que você quer conseguir fazer nos próximos três meses",
    ],
    sounds: [
      ["Revisão: TH, R e -ING", "Os três sons que o português não tem. Grave-se dizendo 'thanks', 'really' e 'working' e compare com o áudio do curso."],
      ["Palavras grudadas", "'Can I have' = kenaihav. 'How do I get to' = haudaiguetu. Se você ainda separa, o resto do ano vai soar lento."],
    ],
    quiz: [
      ["O que os moldes dos circuitos 1 a 12 têm em comum?", ["Todos são do presente", "Todos têm uma parte fixa e uma peça que troca", "Todos são perguntas", "Todos são formais"], 1, "É o mecanismo central do método: molde fixo + peça trocável. Foi assim que você saiu de zero a doze situações."],
      ["Qual molde resolve mais situações diferentes?", ["I'm from ___", "Can I have ___, please?", "This is my ___", "It's ___"], 1, "Serve para comida, bebida, objeto, informação e favor. É o mais reaproveitável do canto inteiro."],
      ["Se você trava no meio de uma frase, o melhor é:", ["Parar e começar de novo em português", "Usar uma frase de socorro do circuito 3 e continuar", "Ficar em silêncio até lembrar", "Pedir desculpas e sair"], 1, "As frases do circuito 3 existem exatamente para isso. Travar é normal; parar de falar é o que mata a conversa."],
      ["Depois de 13 circuitos, o que você já consegue fazer?", ["Falar sobre qualquer assunto", "Se apresentar, pedir, se localizar e se virar no básico", "Assistir série sem legenda", "Trabalhar em inglês"], 1, "É exatamente o A1 alcançado: você se apresenta, pede, se localiza e sobrevive. Os outros três cantos constroem o resto."],
    ],
  },
];
