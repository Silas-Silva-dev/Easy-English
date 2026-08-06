/**
 * TERCEIRO CANTO: Resolver (circuitos 27 a 39)
 *
 * O inglês de quando as coisas NÃO saem como planejado: trabalho, viagem,
 * problema, negociação, conselho, arrependimento. É onde a maioria dos cursos
 * para: e onde a vida adulta em inglês realmente começa.
 */

import type { CircuitContent } from "../compose-lesson";

export const CANTO_3: CircuitContent[] = [
  // ======================================================== 27
  {
    n: 27,
    immersion: [
      ["Kate", "So what line of work are you in?", "Então, em que área você trabalha?"],
      ["Ana", "I work in marketing. I'm in charge of the sales team.", "Eu trabalho com marketing. Sou responsável pela equipe de vendas."],
      ["Kate", "Oh, so you manage people.", "Ah, então você gerencia pessoas."],
      ["Ana", "Basically, I help companies figure out who they're talking to.", "Basicamente, eu ajudo empresas a descobrir com quem elas estão falando."],
      ["Kate", "That sounds interesting. How long have you done that?", "Isso parece interessante. Faz quanto tempo que você faz isso?"],
      ["Ana", "I've been doing this for five years.", "Eu faço isso há cinco anos."],
      ["Kate", "Do you like it?", "Você gosta?"],
      ["Ana", "It's challenging but rewarding. What line of work are you in?", "É desafiador mas recompensador. E você, em que área trabalha?"],
    ],
    listening: [
      ["Mike", "What do you do exactly? You never told me.", "O que você faz exatamente? Você nunca me contou."],
      ["Bruno", "I work in logistics. I'm in charge of the warehouse.", "Eu trabalho com logística. Sou responsável pelo depósito."],
      ["Mike", "What does that involve?", "O que isso envolve?"],
      ["Bruno", "Basically, I help make sure nothing gets lost between here and there.", "Basicamente, eu ajudo a garantir que nada se perca entre aqui e lá."],
      ["Mike", "Sounds stressful.", "Parece estressante."],
      ["Bruno", "It's challenging but rewarding. I've been doing this for eight years.", "É desafiador mas recompensador. Eu faço isso há oito anos."],
      ["Mike", "Eight years! You must be good at it.", "Oito anos! Você deve ser bom nisso."],
      ["Bruno", "I'm getting there. That sounds interesting though, what about you?", "Estou chegando lá. Mas parece interessante, e você?"],
    ],
    why: {
      title: "'Basically' é a sua muleta legítima",
      body:
        "Você não sabe o termo técnico da sua profissão em inglês. Nem precisa.\n\n*Basically, I help companies ___* resolve qualquer explicação de trabalho, porque desloca a conversa de **o nome do que você faz** para **o efeito do que você faz**: e o efeito você consegue explicar com vocabulário simples.\n\nAmericano usa esse recurso o tempo todo, inclusive entre nativos. Não é simplificação para estrangeiro: é como se explica trabalho complexo em qualquer idioma.",
    },
    swaps: ["the sales team", "a team of six", "hiring", "the whole operation", "everything that goes wrong", "customer support", "two departments", "making sure it ships on time"],
    expansion: [
      ["I work in marketing and I'm in charge of the sales team, so it's a lot of people management.", "Eu trabalho com marketing e sou responsável pela equipe de vendas, então é muita gestão de pessoas."],
      ["Basically, I help companies figure out who they're talking to. I've been doing this for five years.", "Basicamente, eu ajudo empresas a descobrir com quem estão falando. Faço isso há cinco anos."],
      ["It's challenging but rewarding, though some weeks are rougher than others.", "É desafiador mas recompensador, embora algumas semanas sejam mais duras que outras."],
      ["What line of work are you in? That sounds interesting, tell me more.", "Em que área você trabalha? Isso parece interessante, me conta mais."],
    ],
    drift: [
      "Como você foi parar nessa profissão",
      "O que você faria se pudesse recomeçar",
      "A parte do seu trabalho que ninguém vê",
      "Se você levaria seu trabalho para outro país",
    ],
    sounds: [
      ["'Basically' tem três sílabas, não quatro", "BEI-sic-li. O 'a' do meio some. Brasileiro diz 'bei-si-ca-li': corte a sílaba."],
      ["'In charge of' emendado", "'incharjov': o 'of' vira quase um 'v'. Toda preposição encolhe assim na fala."],
    ],
    quiz: [
      ["'I'm in charge of the sales team' significa que você:", ["Trabalha na equipe", "É responsável pela equipe", "Cobra da equipe", "Foi contratado pela equipe"], 1, "'In charge of' é ter a responsabilidade. Nada a ver com 'charge' de cobrar, que é outro sentido do mesmo verbo."],
      ["Por que 'Basically, I help ___' funciona tão bem?", ["É formal", "Troca o jargão pelo efeito do trabalho", "É mais curto", "É obrigatório"], 1, "Você não precisa do termo técnico: precisa explicar o efeito. Nativo faz igual."],
      ["'What line of work are you in?' pergunta:", ["Em que fila você está", "Em que área você trabalha", "Qual seu cargo", "Onde fica seu trabalho"], 1, "É sinônimo de 'What do you do?', um pouco mais formal e comum em conversa de adulto."],
      ["'Challenging but rewarding' descreve um trabalho que é:", ["Difícil e mal pago", "Difícil mas que compensa", "Fácil e chato", "Impossível"], 1, "É a fórmula padrão para descrever trabalho exigente sem reclamar. Quase um clichê: e por isso mesmo, seguro."],
    ],
  },

  // ======================================================== 28
  {
    n: 28,
    immersion: [
      ["Kate", "Have you ever been to Europe?", "Você já foi para a Europa?"],
      ["Ana", "I've been there twice. Portugal and Spain.", "Eu fui lá duas vezes. Portugal e Espanha."],
      ["Kate", "How was it?", "Como foi?"],
      ["Ana", "It's the best trip I've ever had.", "É a melhor viagem que eu já fiz."],
      ["Kate", "Have you tried the food in the north?", "Você experimentou a comida do norte?"],
      ["Ana", "I've never tried that. I've always wanted to.", "Eu nunca experimentei isso. Sempre quis."],
      ["Kate", "You have to. Next time.", "Você tem que experimentar. Da próxima."],
      ["Ana", "Definitely. How about you?", "Com certeza. E você?"],
    ],
    listening: [
      ["Mike", "How long have you worked here?", "Faz quanto tempo que você trabalha aqui?"],
      ["Bruno", "I've worked here since 2020.", "Eu trabalho aqui desde 2020."],
      ["Mike", "Have you ever thought about leaving?", "Você já pensou em sair?"],
      ["Bruno", "Honestly, I've never seriously considered it.", "Sinceramente, eu nunca considerei seriamente."],
      ["Mike", "Really? Not even during the merger?", "Sério? Nem durante a fusão?"],
      ["Bruno", "That was rough. But it's the best team I've ever had.", "Aquilo foi duro. Mas é a melhor equipe que eu já tive."],
      ["Mike", "That's fair. I've always wanted to work somewhere like this.", "É justo. Eu sempre quis trabalhar num lugar assim."],
      ["Bruno", "You should apply. How about you, where were you before?", "Você devia se candidatar. E você, onde estava antes?"],
    ],
    why: {
      title: "'Have you ever' abre a porta que 'did you' fecha",
      body:
        "*Did you go to Europe?* pergunta sobre uma viagem específica que os dois já sabem qual é.\n*Have you ever been to Europe?* pergunta sobre a **vida inteira**: e por isso puxa história.\n\nO mesmo vale para as respostas: *I've been there twice*, *I've never tried that*, *I've always wanted to*.\n\nÉ o tempo verbal da experiência acumulada, e é ele que transforma pergunta seca em conversa. Você não precisa do nome dele: precisa dos quatro blocos.",
    },
    swaps: ["been to Japan", "tried sushi", "worked abroad", "driven on the other side", "flown business class", "lived alone", "done anything like that", "wanted to learn an instrument"],
    expansion: [
      ["Have you ever been to Europe? I've been there twice and I'd go again tomorrow.", "Você já foi para a Europa? Eu fui lá duas vezes e iria de novo amanhã."],
      ["I've never tried that, but I've always wanted to.", "Eu nunca experimentei isso, mas sempre quis."],
      ["I've worked here since 2020, and it's the best team I've ever had.", "Eu trabalho aqui desde 2020, e é a melhor equipe que eu já tive."],
      ["It's the best trip I've ever had, though the flight was terrible.", "É a melhor viagem que eu já fiz, embora o voo tenha sido terrível."],
    ],
    drift: [
      "A experiência mais marcante que você já teve",
      "Algo que você nunca fez e quer muito fazer",
      "Um lugar para onde você voltaria",
      "A melhor comida que você já comeu",
    ],
    sounds: [
      ["'Have you ever' vira 'haviuever'", "Três palavras coladas, com o H quase mudo. Reconhecer esse bloco na velocidade real é meio caminho para entender pergunta."],
      ["'I've' é um som só", "'Aiv'. Não é 'ai hév'. Se você separa, a frase inteira desanda de ritmo."],
    ],
    quiz: [
      ["'Have you ever been to Europe?' pergunta sobre:", ["Uma viagem específica", "Toda a sua vida até agora", "Seus planos", "Onde você mora"], 1, "É a pergunta de experiência acumulada. Por isso puxa história: e por isso é tão útil em conversa."],
      ["'I've never tried that' significa:", ["Não gostei", "Nunca experimentei até hoje", "Não vou experimentar", "Tentei e não deu"], 1, "'Never' + present perfect cobre a vida inteira até agora. Deixa a porta aberta para experimentar."],
      ["'I've worked here since 2020' indica que você:", ["Trabalhou lá e saiu", "Trabalha lá até hoje", "Vai trabalhar lá", "Trabalhou só em 2020"], 1, "'Since' marca o ponto de partida de algo que continua. 'For' marca a duração: for four years."],
      ["'It's the best trip I've ever had' usa o present perfect porque:", ["É passado recente", "Compara com toda a sua experiência de vida", "É futuro", "É formal"], 1, "Superlativo + 'I've ever' é uma dupla fixa. Guarde inteira: 'the best ___ I've ever ___'."],
    ],
  },

  // ======================================================== 29
  {
    n: 29,
    immersion: [
      ["Interviewer", "So, tell me about yourself.", "Então, me fale sobre você."],
      ["Ana", "Sure. I've been working in marketing for five years.", "Claro. Eu trabalho com marketing há cinco anos."],
      ["Interviewer", "What would you say is your biggest strength?", "O que você diria que é sua maior força?"],
      ["Ana", "One of my strengths is problem-solving.", "Uma das minhas forças é resolução de problemas."],
      ["Interviewer", "And a weakness?", "E uma fraqueza?"],
      ["Ana", "I'm working on being more patient with slow processes.", "Eu estou trabalhando para ser mais paciente com processos lentos."],
      ["Interviewer", "Why are you leaving your current role?", "Por que você está saindo do cargo atual?"],
      ["Ana", "I'm looking for a new challenge. In my last role, I built the team from scratch.", "Estou buscando um novo desafio. No meu último cargo, eu montei a equipe do zero."],
      ["Interviewer", "Great. Do you have any questions for me?", "Ótimo. Você tem alguma pergunta para mim?"],
    ],
    listening: [
      ["Interviewer", "Walk me through your background.", "Me conte sua trajetória."],
      ["Bruno", "I graduated in 2018 and started in logistics right after.", "Eu me formei em 2018 e comecei em logística logo depois."],
      ["Interviewer", "What drew you to this position?", "O que te atraiu para essa vaga?"],
      ["Bruno", "I'm looking for a new challenge, honestly. I've hit a ceiling.", "Estou buscando um novo desafio, sinceramente. Cheguei num teto."],
      ["Interviewer", "Tell me about a time you failed.", "Me fale sobre uma vez em que você falhou."],
      ["Bruno", "In my last role, I underestimated a deadline and we shipped late.", "No meu último cargo, eu subestimei um prazo e entregamos atrasado."],
      ["Interviewer", "And what did you learn?", "E o que você aprendeu?"],
      ["Bruno", "One of my strengths is that I over-communicate now. Do you have any questions for me?", "Uma das minhas forças é que agora eu comunico demais. Você tem alguma pergunta para mim?"],
    ],
    why: {
      title: "'Tell me about yourself' não é sobre você",
      body:
        "É a pergunta que mais derruba brasileiro em entrevista, porque parece um convite para autobiografia. Não é.\n\nO que se espera são **90 segundos** cobrindo três coisas: o que você faz hoje, o que fez antes que importa para esta vaga, por que você está aqui.\n\nA regra prática: se você mencionou o ensino médio, saiu do roteiro. Comece pelo presente, uma frase de passado relevante, e feche em por que esta vaga.",
    },
    swaps: ["problem-solving", "staying calm under pressure", "getting people aligned", "learning fast", "spotting problems early", "communication", "following through", "working with difficult clients"],
    expansion: [
      ["I've been working in marketing for five years, and one of my strengths is problem-solving.", "Eu trabalho com marketing há cinco anos, e uma das minhas forças é resolução de problemas."],
      ["In my last role, I built the team from scratch, so I'm looking for a similar challenge.", "No meu último cargo, eu montei a equipe do zero, então estou buscando um desafio parecido."],
      ["I'm working on being more patient, which is honestly still a work in progress.", "Eu estou trabalhando para ser mais paciente, o que sinceramente ainda está em andamento."],
      ["I graduated in 2018 and I've been in this field ever since.", "Eu me formei em 2018 e estou nessa área desde então."],
    ],
    drift: [
      "A entrevista mais estranha que você já fez",
      "O que você procura num trabalho hoje",
      "Se você mudaria de área",
      "A pergunta de entrevista que você mais odeia",
    ],
    sounds: [
      ["'Strengths' é o pesadelo consonantal", "STRENGTHS: cinco consoantes no fim. Se travar, diga 'strength' no singular: ninguém repara e a frase funciona."],
      ["'Problem-solving' com pausa curta", "PRÁ-blem SÓL-ving, duas palavras com dois acentos. Composto assim sempre tem duas batidas."],
    ],
    quiz: [
      ["'Tell me about yourself' espera:", ["Sua biografia completa", "90 segundos sobre presente, passado relevante e motivação", "Só seu nome e cargo", "Suas fraquezas"], 1, "Se você mencionou o ensino médio, saiu do roteiro. Comece pelo presente."],
      ["Como falar de uma fraqueza sem se sabotar?", ["I don't have any.", "I'm working on being more patient.", "I'm terrible at deadlines.", "That's a bad question."], 1, "'I'm working on ___' apresenta a fraqueza já em processo de correção. É honesto e não derruba a candidatura."],
      ["'In my last role, I ___' serve para:", ["Reclamar do emprego antigo", "Dar exemplo concreto de realização", "Justificar a saída", "Falar de salário"], 1, "Entrevista americana valoriza exemplo concreto acima de adjetivo. Prefira 'eu fiz X' a 'eu sou bom em X'."],
      ["'Do you have any questions for me?': o que fazer?", ["Dizer que não, para não incomodar", "Ter pelo menos duas perguntas prontas", "Perguntar só sobre salário", "Perguntar se você passou"], 1, "Não ter pergunta é lido como falta de interesse. Duas perguntas sobre a equipe ou o desafio da vaga resolvem."],
    ],
  },

  // ======================================================== 30
  {
    n: 30,
    immersion: [
      ["Kate", "So the timeline is tight but doable, and if we push the launch: ", "Então o cronograma está apertado mas viável, e se a gente empurrar o lançamento: "],
      ["Ana", "Can I jump in here?", "Posso entrar aqui?"],
      ["Kate", "Please.", "Por favor."],
      ["Ana", "Just to be clear, are we talking about April or May?", "Só para deixar claro, estamos falando de abril ou maio?"],
      ["Kate", "April.", "Abril."],
      ["Ana", "Okay. I'd like to add something about the budget.", "Ok. Eu gostaria de acrescentar algo sobre o orçamento."],
      ["Mike", "Can we come back to that later? Let's move on to the next point.", "A gente pode voltar nisso depois? Vamos para o próximo ponto."],
      ["Ana", "Sure. So, what are the next steps?", "Claro. Então, quais são os próximos passos?"],
      ["Mike", "I'll follow up by email.", "Eu mando um acompanhamento por e-mail."],
    ],
    listening: [
      ["Mike", "The vendor says two weeks, but I don't believe them.", "O fornecedor diz duas semanas, mas eu não acredito neles."],
      ["Bruno", "Can I jump in here? I talked to them yesterday.", "Posso entrar aqui? Eu falei com eles ontem."],
      ["Mike", "Go ahead.", "Pode falar."],
      ["Bruno", "Just to be clear, two weeks is from approval, not from today.", "Só para deixar claro, duas semanas é a partir da aprovação, não de hoje."],
      ["Kate", "That changes everything.", "Isso muda tudo."],
      ["Bruno", "I'd like to add something. We can start the prep in parallel.", "Eu gostaria de acrescentar algo. Podemos começar a preparação em paralelo."],
      ["Mike", "Can we come back to that later? So, what are the next steps?", "A gente pode voltar nisso depois? Então, quais são os próximos passos?"],
      ["Bruno", "I'll follow up by email with the vendor's exact wording.", "Eu mando por e-mail com as palavras exatas do fornecedor."],
    ],
    why: {
      title: "Interromper em inglês tem senha",
      body:
        "Numa reunião em inglês, entrar sem senha é lido como agressivo. E ficar esperando um espaço educado é ficar mudo a reunião inteira: porque esse espaço não vem.\n\nA senha é curta: *Can I jump in here?*, *Sorry, quick question*, *Just to be clear...*\n\nEla dura um segundo e faz duas coisas: sinaliza que você quer a palavra e reconhece que está cortando alguém. Com ela, interromper é normal. Sem ela, é grosseria.",
    },
    swaps: ["Can I jump in here?", "Just to be clear...", "I'd like to add something.", "Sorry, quick question.", "Can we come back to that?", "Let's move on.", "So, what are the next steps?", "I'll follow up by email."],
    expansion: [
      ["Can I jump in here? Just to be clear, are we talking about April or May?", "Posso entrar aqui? Só para deixar claro, estamos falando de abril ou maio?"],
      ["I'd like to add something, but we can come back to it later if we're short on time.", "Eu gostaria de acrescentar algo, mas podemos voltar nisso depois se estivermos sem tempo."],
      ["Let's move on to the next point, and I'll follow up by email with the details.", "Vamos para o próximo ponto, e eu mando os detalhes por e-mail."],
      ["So, what are the next steps? I want to make sure we all leave with the same list.", "Então, quais são os próximos passos? Quero garantir que todos saiam com a mesma lista."],
    ],
    drift: [
      "A reunião mais inútil que você já participou",
      "Se você fala muito ou pouco em reunião",
      "Como é reunião no Brasil versus em empresa estrangeira",
      "Uma decisão importante que saiu de uma conversa rápida",
    ],
    sounds: [
      ["'Can I jump in' vira 'kenaijampin'", "Bloco único, dito rápido. Se sair devagar, você perde a janela e alguém já falou."],
      ["'Just to be clear' com o T mudo", "'Jus to be clear'. O T de 'just' desaparece antes de consoante. Vale para 'must be', 'last time', 'first day'."],
    ],
    quiz: [
      ["Como pedir a palavra numa reunião?", ["Excuse me!", "Can I jump in here?", "Stop, please.", "Listen to me."], 1, "É a senha padrão. Reconhece que você está cortando e sinaliza que quer falar: tudo em quatro palavras."],
      ["'Just to be clear' serve para:", ["Discordar", "Confirmar um entendimento sem parecer que duvida", "Encerrar", "Elogiar"], 1, "Coloca a responsabilidade da confusão em você, não no outro. É diplomacia embutida."],
      ["'Can we come back to that later?' significa:", ["Nunca mais falaremos disso", "Adiar o assunto sem descartá-lo", "Vamos decidir agora", "Não entendi"], 1, "Na prática, às vezes é um enterro educado. Mas formalmente adia sem fechar a porta."],
      ["'I'll follow up by email' quer dizer que você:", ["Vai cobrar alguém", "Vai mandar continuidade por escrito", "Vai marcar outra reunião", "Vai desistir"], 1, "'Follow up' é dar continuidade. É o fechamento padrão de reunião americana."],
    ],
  },

  // ======================================================== 31
  {
    n: 31,
    immersion: [
      ["Officer", "Passport, please. What's the purpose of your visit?", "Passaporte, por favor. Qual o motivo da sua visita?"],
      ["Ana", "I'm here on vacation.", "Estou aqui de férias."],
      ["Officer", "How long will you be staying?", "Quanto tempo vai ficar?"],
      ["Ana", "I'll be staying for two weeks.", "Vou ficar por duas semanas."],
      ["Officer", "Anything to declare?", "Algo a declarar?"],
      ["Ana", "I have nothing to declare.", "Não tenho nada a declarar."],
      ["Officer", "Enjoy your stay.", "Aproveite sua estadia."],
      ["Ana", "Thank you. Excuse me, could you tell me where gate 12 is?", "Obrigada. Com licença, pode me dizer onde fica o portão 12?"],
    ],
    listening: [
      ["Bruno", "Excuse me, I missed my connection.", "Com licença, eu perdi minha conexão."],
      ["Agent", "Let me see. Flight number?", "Deixa eu ver. Número do voo?"],
      ["Bruno", "AA 1240. What's the next available flight?", "AA 1240. Qual o próximo voo disponível?"],
      ["Agent", "There's one at 6 PM, but it's standby.", "Tem um às 18h, mas é lista de espera."],
      ["Bruno", "Could you tell me where the service desk is?", "Pode me dizer onde fica o balcão de atendimento?"],
      ["Agent", "Down this hall, on your left.", "Por esse corredor, à sua esquerda."],
      ["Bruno", "And where can I pick up my luggage if I don't fly today?", "E onde eu pego minha bagagem se eu não voar hoje?"],
      ["Agent", "Baggage services, level one.", "Serviços de bagagem, nível um."],
    ],
    why: {
      title: "'Could you tell me where ___ is' e a ordem invertida",
      body:
        "Pergunta direta: *Where **is the gate**?*\nPergunta educada: *Could you tell me where **the gate is**?*\n\nRepare: quando a pergunta vira parte de outra frase, o verbo **volta para depois** do sujeito. É a chamada pergunta indireta, e é o que soa educado em balcão, aeroporto e hotel.\n\nSe você errar a ordem, entendem perfeitamente. Mas esse bloco é o que separa 'turista pedindo' de 'adulto perguntando'.",
    },
    swaps: ["gate 12", "the restroom", "baggage claim", "the check-in counter", "the exit", "customs", "my terminal", "the shuttle stop"],
    expansion: [
      ["Excuse me, could you tell me where gate 12 is? I missed my connection.", "Com licença, pode me dizer onde fica o portão 12? Eu perdi minha conexão."],
      ["I'm here on vacation and I'll be staying for two weeks.", "Estou aqui de férias e vou ficar por duas semanas."],
      ["I have nothing to declare, but I do have some food from home.", "Não tenho nada a declarar, mas tenho alguma comida de casa."],
      ["What's the next available flight? And where can I pick up my luggage?", "Qual o próximo voo disponível? E onde eu pego minha bagagem?"],
    ],
    drift: [
      "A pior experiência que você já teve num aeroporto",
      "Se você chega três horas antes ou em cima da hora",
      "Um voo que você quase perdeu",
      "O que você sempre esquece de levar",
    ],
    sounds: [
      ["'Could you tell me' vira 'kudjutelmi'", "Bloco único. Em balcão de aeroporto, dito devagar demais soa hesitante: e hesitação atrasa você."],
      ["'Luggage' não é 'lagueiji'", "LÁ-guij, duas sílabas curtas, com o G suave no fim. O E final não soa."],
    ],
    quiz: [
      ["Qual é a forma educada de perguntar onde fica algo?", ["Where is gate 12?", "Could you tell me where gate 12 is?", "Gate 12 where?", "Tell me gate 12."], 1, "A pergunta indireta inverte a ordem de volta: 'where gate 12 IS'. É o que soa educado em balcão."],
      ["'I'm here on vacation' responde a qual pergunta?", ["How long?", "What's the purpose of your visit?", "Where are you staying?", "Do you have a ticket?"], 1, "Motivo da visita. As respostas padrão são 'on vacation', 'on business' ou 'visiting family'."],
      ["'I missed my connection' significa:", ["Senti falta da conexão", "Perdi o voo de conexão", "A conexão falhou", "Cancelei a conexão"], 1, "'Miss' é perder no sentido de não alcançar. O mesmo verbo de 'I miss you': outro sentido, mesmo bloco."],
      ["'Anything to declare?' pergunta se você:", ["Quer dizer algo", "Traz algo que precisa ser declarado na alfândega", "Tem reclamação", "Precisa de ajuda"], 1, "É pergunta de alfândega sobre bens. 'I have nothing to declare' é a resposta padrão."],
    ],
  },

  // ======================================================== 32
  {
    n: 32,
    immersion: [
      ["Ana", "Hi, I have a reservation under Silva.", "Oi, eu tenho uma reserva no nome de Silva."],
      ["Clerk", "Let me check. Two nights, correct?", "Deixa eu verificar. Duas noites, correto?"],
      ["Ana", "That's right. Is breakfast included?", "Isso mesmo. O café da manhã está incluso?"],
      ["Clerk", "It is, from seven to ten.", "Está, das sete às dez."],
      ["Ana", "Great. What time is check-out?", "Ótimo. Que horas é o check-out?"],
      ["Clerk", "Eleven AM.", "Onze da manhã."],
      ["Ana", "Would it be possible to get a late check-out?", "Seria possível conseguir um check-out mais tarde?"],
      ["Clerk", "I can do one PM.", "Posso fazer uma da tarde."],
      ["Ana", "Perfect, thank you.", "Perfeito, obrigada."],
    ],
    listening: [
      ["Bruno", "Hi, sorry to bother you. The air conditioning isn't working.", "Oi, desculpa incomodar. O ar-condicionado não está funcionando."],
      ["Clerk", "I'm sorry about that. Which room?", "Sinto muito por isso. Qual quarto?"],
      ["Bruno", "412. Could I change rooms?", "412. Eu poderia trocar de quarto?"],
      ["Clerk", "Let me see what's available.", "Deixa eu ver o que está disponível."],
      ["Bruno", "Would it be possible to get something on a lower floor?", "Seria possível conseguir algo num andar mais baixo?"],
      ["Clerk", "I have 208. Same layout.", "Tenho o 208. Mesmo layout."],
      ["Bruno", "That works. And could you call me a taxi for eight?", "Isso serve. E você pode chamar um táxi para as oito?"],
      ["Clerk", "Of course. It'll be waiting.", "Claro. Vai estar esperando."],
    ],
    why: {
      title: "'Would it be possible' é a chave-mestra dos pedidos difíceis",
      body:
        "Você tem três níveis de pedido:\n\n*Can I ___?*: normal\n*Could I ___?*: educado\n*Would it be possible to ___?*: o pedido que talvez incomode\n\nO terceiro é mais longo de propósito. Em inglês, **quanto mais palavras, mais educado**: a distância é a cortesia.\n\nUse-o quando estiver pedindo algo fora do padrão: late check-out, exceção, favor que dá trabalho. A recusa fica fácil para o outro, e é isso que faz ele querer dizer sim.",
    },
    swaps: ["get a late check-out", "change rooms", "store my bags after check-out", "get an extra towel", "have a quiet room", "check in early", "extend one more night", "get a receipt by email"],
    expansion: [
      ["I have a reservation under Silva. Would it be possible to get a late check-out?", "Eu tenho uma reserva no nome de Silva. Seria possível um check-out mais tarde?"],
      ["The air conditioning isn't working. Could I change rooms, please?", "O ar-condicionado não está funcionando. Eu poderia trocar de quarto, por favor?"],
      ["Is breakfast included? And what time is check-out?", "O café da manhã está incluso? E que horas é o check-out?"],
      ["Could you call me a taxi for eight? I have an early flight.", "Você pode chamar um táxi para as oito? Tenho um voo cedo."],
    ],
    drift: [
      "O melhor e o pior hotel em que você já ficou",
      "Se você é do tipo que reclama na recepção",
      "Hotel, hostel ou casa alugada",
      "Uma viagem em que tudo deu errado na hospedagem",
    ],
    sounds: [
      ["'Would it be' vira 'wudidbi'", "O T de 'it' vira D entre vogais. Bloco único, dito rápido, mesmo sendo um pedido educado."],
      ["'Reservation' tem o acento na terceira", "re-zer-VEI-shan. E o S soa como Z. Brasileiro tende a acentuar a primeira sílaba."],
    ],
    quiz: [
      ["Qual pedido é o mais educado?", ["Can I change rooms?", "Could I change rooms?", "Would it be possible to change rooms?", "I want another room."], 2, "Em inglês, mais palavras = mais cortesia. A distância é o que amortece o pedido."],
      ["'I have a reservation under Silva': o 'under' aqui significa:", ["Embaixo de", "No nome de", "Sob condições", "Menos de"], 1, "'Under the name of' encurtado. É a fórmula fixa em hotel e restaurante."],
      ["'Is breakfast included?' pergunta se:", ["O café está pronto", "O café faz parte do preço", "Você pode tomar café", "Onde é o café"], 1, "'Included' é estar dentro do preço. Pergunta essencial: a resposta muda bastante o custo da viagem."],
      ["'The air conditioning isn't working' é preferível a 'It's broken' porque:", ["É mais curto", "Descreve o sintoma sem acusar", "É mais formal", "Não há diferença"], 1, "Descrever o sintoma facilita a solução e evita defensiva. Vale para hotel, loja e suporte técnico."],
    ],
  },

  // ======================================================== 33
  {
    n: 33,
    immersion: [
      ["Doctor", "What brings you in today?", "O que traz você aqui hoje?"],
      ["Ana", "I don't feel well. I have a headache.", "Eu não estou me sentindo bem. Estou com dor de cabeça."],
      ["Doctor", "How long has it been going on?", "Faz quanto tempo que isso está acontecendo?"],
      ["Ana", "Three days. It hurts here.", "Três dias. Dói aqui."],
      ["Doctor", "Any allergies?", "Alguma alergia?"],
      ["Ana", "I'm allergic to penicillin.", "Eu sou alérgica a penicilina."],
      ["Doctor", "I'll write you something mild.", "Vou receitar algo leve."],
      ["Ana", "Do I need a prescription? And does my insurance cover this?", "Eu preciso de receita? E meu convênio cobre isso?"],
      ["Doctor", "The front desk can check that for you.", "A recepção pode verificar isso para você."],
    ],
    listening: [
      ["Pharmacist", "Can I help you?", "Posso ajudar?"],
      ["Bruno", "Yes, I don't feel well. I think it's my stomach.", "Sim, não estou me sentindo bem. Acho que é meu estômago."],
      ["Pharmacist", "Fever?", "Febre?"],
      ["Bruno", "No fever. It just hurts here, after I eat.", "Sem febre. Só dói aqui, depois que eu como."],
      ["Pharmacist", "Do you take any medication?", "Você toma algum medicamento?"],
      ["Bruno", "No. But I'm allergic to penicillin.", "Não. Mas sou alérgico a penicilina."],
      ["Pharmacist", "This one's fine, then. It's over the counter.", "Esse serve, então. É sem receita."],
      ["Bruno", "Do I need a prescription for the stronger one?", "Eu preciso de receita para o mais forte?"],
      ["Pharmacist", "Yes. You'd need to see a doctor.", "Sim. Você precisaria ver um médico."],
    ],
    why: {
      title: "Sintoma em inglês: três blocos que resolvem",
      body:
        "Você não precisa de vocabulário médico. Precisa de três moldes:\n\n**I have a ___**: para o que tem nome: *a headache*, *a fever*, *a cough*, *a sore throat*.\n**It hurts ___**: para apontar: *it hurts here*, *it hurts when I walk*.\n**I don't feel well**: para o resto.\n\nCom esses três e o dedo apontando, você descreve praticamente qualquer sintoma. E numa emergência, apontar vale mais que vocabulário perfeito.",
    },
    swaps: ["headache", "fever", "sore throat", "cough", "stomachache", "toothache", "rash", "terrible cold"],
    expansion: [
      ["I don't feel well. I have a headache and it hurts here when I move.", "Não estou me sentindo bem. Estou com dor de cabeça e dói aqui quando eu me movo."],
      ["I'm allergic to penicillin, so please check before prescribing anything.", "Eu sou alérgico a penicilina, então por favor confira antes de receitar qualquer coisa."],
      ["Do I need a prescription for this? And does my insurance cover it?", "Eu preciso de receita para isso? E meu convênio cobre?"],
      ["I need to see a doctor. It's been three days and it's getting worse.", "Eu preciso ver um médico. Já são três dias e está piorando."],
    ],
    drift: [
      "Se você vai ao médico logo ou espera passar",
      "Como funciona a saúde no seu país",
      "Um remédio que você sempre leva na mala",
      "A última vez que você ficou doente numa viagem",
    ],
    sounds: [
      ["'Headache' é 'RED-eik'", "Duas sílabas, e o 'ache' soa 'eik'. Mesma coisa em 'stomachache' e 'toothache'."],
      ["'Allergic' com o G suave", "a-LER-jic. O acento vai na segunda sílaba e o G soa como J. Brasileiro diz 'alérgic' com força no começo."],
    ],
    quiz: [
      ["Como se diz 'estou com dor de cabeça'?", ["I am with headache", "I have a headache", "I have headache", "My head is pain"], 1, "'Have a ___' com artigo. É um dos poucos casos em que esquecer o 'a' soa realmente estranho."],
      ["'It hurts here' serve para:", ["Descrever dor apontando o lugar", "Dizer que dói sempre", "Pedir remédio", "Reclamar do preço"], 0, "Combinado com o dedo, resolve qualquer sintoma que você não sabe nomear. Numa emergência, é o suficiente."],
      ["'I'm allergic to penicillin' deve ser dito:", ["Só se perguntarem", "Sempre, sem esperar a pergunta", "Só no hospital", "Apenas por escrito"], 1, "Alergia a medicamento é informação de segurança. Diga antes de qualquer prescrição, sempre."],
      ["'Over the counter' significa:", ["Em cima do balcão", "Sem necessidade de receita", "Com desconto", "Importado"], 1, "É o oposto de 'prescription only'. Termo padrão em farmácia americana."],
    ],
  },

  // ======================================================== 34
  {
    n: 34,
    immersion: [
      ["Ana", "Excuse me, I'm afraid there's been a mistake.", "Com licença, receio que houve um engano."],
      ["Manager", "What happened?", "O que aconteceu?"],
      ["Ana", "I was charged twice for the same item.", "Eu fui cobrada duas vezes pelo mesmo item."],
      ["Manager", "Let me look at the receipt.", "Deixa eu ver o recibo."],
      ["Ana", "And this isn't what I ordered, either.", "E isso não é o que eu pedi, também."],
      ["Manager", "I see. I apologize.", "Entendo. Peço desculpas."],
      ["Ana", "What can you do to fix this?", "O que você pode fazer para resolver isso?"],
      ["Manager", "I'll refund the second charge and replace the item.", "Vou estornar a segunda cobrança e trocar o item."],
      ["Ana", "I appreciate your help.", "Eu agradeço sua ajuda."],
    ],
    listening: [
      ["Bruno", "I'm afraid there's been a mistake with my bill.", "Receio que houve um engano na minha conta."],
      ["Clerk", "Let me pull it up.", "Deixa eu abrir."],
      ["Bruno", "There's a charge for the minibar. I never opened it.", "Tem uma cobrança do frigobar. Eu nunca abri."],
      ["Clerk", "The system shows two waters.", "O sistema mostra duas águas."],
      ["Bruno", "This is the second time it happens. I'd like to speak to a manager.", "Essa é a segunda vez que acontece. Eu gostaria de falar com um gerente."],
      ["Clerk", "Of course. One moment.", "Claro. Um momento."],
      ["Manager", "I've removed the charge. I'm sorry about that.", "Eu removi a cobrança. Desculpe por isso."],
      ["Bruno", "I appreciate your help. Thank you.", "Eu agradeço sua ajuda. Obrigado."],
    ],
    why: {
      title: "Reclamar sem atacar a pessoa na sua frente",
      body:
        "*I'm afraid there's been a mistake* é uma obra-prima de diplomacia. Repare no que ela **não** diz: quem errou.\n\n'Houve um engano': sem sujeito, sem culpado. Isso libera a pessoa na sua frente para resolver em vez de se defender, porque ela não foi acusada.\n\nÉ o oposto do instinto. Quando você diz *You charged me twice*, cria adversário. Quando diz *There's been a mistake*, cria aliado: e é o aliado que resolve seu problema.",
    },
    swaps: ["I'm afraid there's been a mistake", "I was charged twice", "this isn't what I ordered", "the amount doesn't match", "I never received it", "it was supposed to be free", "the price was different online", "this is the second time"],
    expansion: [
      ["I'm afraid there's been a mistake. I was charged twice for the same item.", "Receio que houve um engano. Fui cobrado duas vezes pelo mesmo item."],
      ["This isn't what I ordered, and this is the second time it happens.", "Isso não é o que eu pedi, e essa é a segunda vez que acontece."],
      ["What can you do to fix this? I'd like a refund if possible.", "O que você pode fazer para resolver isso? Eu gostaria de um reembolso se possível."],
      ["I appreciate your help. That solves it, thank you.", "Eu agradeço sua ajuda. Isso resolve, obrigado."],
    ],
    drift: [
      "A vez em que você reclamou e valeu muito a pena",
      "Se você prefere reclamar na hora ou por escrito",
      "Uma cobrança indevida que você quase não percebeu",
      "Como você reage quando o atendente é grosso",
    ],
    sounds: [
      ["'I'm afraid' não é medo", "É a fórmula de dar má notícia. E soa 'aimafreid', numa batida só."],
      ["'There's been' com dois TH", "'Dhérz bin'. O primeiro TH é sonoro, o 'been' é curto e fraco. Não é 'ben' nem 'bin' alongado."],
    ],
    quiz: [
      ["Por que 'There's been a mistake' funciona melhor que 'You made a mistake'?", ["É mais curto", "Não acusa ninguém, então o outro coopera", "É mais formal", "É mais claro"], 1, "Sem culpado nomeado, a pessoa resolve em vez de se defender. É a diferença entre criar aliado e criar adversário."],
      ["'I was charged twice' usa voz passiva porque:", ["É mais elegante", "Foca no fato, não em quem cobrou", "É obrigatório", "É mais curto"], 1, "Mesma lógica do item anterior: descrever o problema sem apontar culpado acelera a solução."],
      ["'What can you do to fix this?' é melhor que exigir porque:", ["Convida o outro a propor a solução", "É mais educado apenas", "Evita o gerente", "É mais rápido"], 0, "Quem propõe a solução se compromete com ela. Costuma render mais do que a solução que você exigiria."],
      ["'I'd like to speak to a manager' deve vir:", ["Logo no começo", "Depois de tentar resolver com quem te atende", "Sempre por telefone", "Por escrito"], 1, "Escalar cedo demais queima a boa vontade de quem poderia resolver na hora."],
    ],
  },

  // ======================================================== 35
  {
    n: 35,
    immersion: [
      ["Kate", "I don't know if I should tell her.", "Eu não sei se devo contar para ela."],
      ["Ana", "If I were you, I'd talk to her.", "Se eu fosse você, eu falaria com ela."],
      ["Kate", "You think?", "Você acha?"],
      ["Ana", "You should probably wait until the weekend, though.", "Você provavelmente deveria esperar até o fim de semana, no entanto."],
      ["Kate", "Why?", "Por quê?"],
      ["Ana", "Have you thought about how busy she is right now?", "Você pensou em como ela está ocupada agora?"],
      ["Kate", "Good point. It might be worth trying on Sunday.", "Bom ponto. Pode valer a pena tentar no domingo."],
      ["Ana", "That's up to you. Whatever you decide, I support you.", "Isso é com você. Seja lá o que decidir, eu te apoio."],
      ["Kate", "Thanks.", "Obrigada."],
    ],
    listening: [
      ["Bruno", "I got another offer. Same money, better team.", "Eu recebi outra proposta. Mesmo dinheiro, equipe melhor."],
      ["Mike", "Have you thought about the commute?", "Você pensou no deslocamento?"],
      ["Bruno", "A bit longer. But the team is really good.", "Um pouco mais longo. Mas a equipe é muito boa."],
      ["Mike", "If I were you, I'd ask for a hybrid setup.", "Se eu fosse você, eu pediria um esquema híbrido."],
      ["Bruno", "They might say no.", "Eles podem dizer não."],
      ["Mike", "It might be worth trying. You should probably ask before you decide.", "Pode valer a pena tentar. Você provavelmente deveria perguntar antes de decidir."],
      ["Bruno", "What do you think you'll do if they refuse?", "O que você acha que faria se eles recusassem?"],
      ["Mike", "That's up to you, honestly. Whatever you decide, I support you.", "Isso é com você, sinceramente. Seja lá o que decidir, eu te apoio."],
    ],
    why: {
      title: "Por que 'If I WERE you' e não 'If I was you'",
      body:
        "Gramaticalmente, é o subjuntivo: a forma da hipótese impossível. Você não é a outra pessoa, então o verbo muda.\n\nNa prática, esqueça a explicação e guarde o bloco: **If I were you, I'd ___**. Sempre *were*, sempre *I'd*.\n\nDetalhe cultural que importa mais que a gramática: em inglês, conselho vem embrulhado. *You should* direto pode soar mandão. *If I were you*, *You might want to*, *Have you thought about*: todos entregam o mesmo conselho sem pisar na autonomia do outro.",
    },
    swaps: ["talk to her", "wait a week", "ask for more time", "take the offer", "sleep on it", "be honest with them", "get it in writing", "trust your gut"],
    expansion: [
      ["If I were you, I'd talk to her, but you should probably wait until the weekend.", "Se eu fosse você, eu falaria com ela, mas você provavelmente deveria esperar até o fim de semana."],
      ["Have you thought about asking for a hybrid setup? It might be worth trying.", "Você pensou em pedir um esquema híbrido? Pode valer a pena tentar."],
      ["That's up to you. Whatever you decide, I support you.", "Isso é com você. Seja lá o que decidir, eu te apoio."],
      ["It might be worth trying, though I understand why you'd hesitate.", "Pode valer a pena tentar, embora eu entenda por que você hesitaria."],
    ],
    drift: [
      "O melhor conselho que você já recebeu",
      "Se você costuma pedir conselho ou decidir sozinho",
      "Uma vez em que você ignorou um conselho e se deu bem",
      "Como você aconselha alguém sem se meter demais",
    ],
    sounds: [
      ["'I'd' é um som só", "'Aid'. O 'would' virou um D. Em 'I'd rather', 'I'd like', 'I'd say': sempre a mesma redução."],
      ["'Should probably' vira 'shudprábli'", "O 'probably' perde uma sílaba na fala: 'prábli'. Falar as quatro sílabas soa artificial."],
    ],
    quiz: [
      ["Qual a forma correta?", ["If I was you", "If I were you", "If I am you", "If I would be you"], 1, "É subjuntivo. Guarde como bloco fixo: 'If I were you, I'd ___'. Sempre 'were'."],
      ["Por que conselho em inglês vem embrulhado?", ["Porque é mais formal", "Porque 'you should' direto pode soar mandão", "Porque é mais claro", "Porque é tradição"], 1, "A cultura anglo protege a autonomia de decisão. O conselho é oferecido, não prescrito."],
      ["'Have you thought about ___?' é um conselho disfarçado de:", ["Ordem", "Pergunta", "Reclamação", "Elogio"], 1, "Formalmente é pergunta; na prática é sugestão. É a forma mais suave de aconselhar que existe."],
      ["'That's up to you' significa:", ["Você está por cima", "A decisão é sua", "Depende de mim", "Suba até você"], 1, "Devolve a autonomia depois de dar a opinião. Costuma vir logo após o conselho, para não parecer pressão."],
    ],
  },

  // ======================================================== 36
  {
    n: 36,
    immersion: [
      ["Kate", "Do you regret anything?", "Você se arrepende de alguma coisa?"],
      ["Ana", "I should have taken that job in Lisbon.", "Eu deveria ter aceitado aquele emprego em Lisboa."],
      ["Kate", "Really? Why didn't you?", "Sério? Por que não aceitou?"],
      ["Ana", "I wish I had studied more before the interview.", "Eu queria ter estudado mais antes da entrevista."],
      ["Kate", "That's a tough one.", "Essa é dura."],
      ["Ana", "If I'd known how good the team was, I would have pushed harder.", "Se eu soubesse como a equipe era boa, eu teria insistido mais."],
      ["Kate", "But look where you are now.", "Mas olha onde você está agora."],
      ["Ana", "True. Looking back, it was the right call. I don't regret it.", "Verdade. Olhando para trás, foi a decisão certa. Eu não me arrependo."],
    ],
    listening: [
      ["Mike", "You ever think about the startup?", "Você já pensa na startup?"],
      ["Bruno", "All the time. I should have stayed one more year.", "O tempo todo. Eu deveria ter ficado mais um ano."],
      ["Mike", "You couldn't have known it would take off.", "Você não tinha como saber que ia decolar."],
      ["Bruno", "I wish I had asked more questions before leaving.", "Eu queria ter feito mais perguntas antes de sair."],
      ["Mike", "Would it have changed anything?", "Teria mudado alguma coisa?"],
      ["Bruno", "If I'd known, I would have negotiated equity.", "Se eu soubesse, eu teria negociado participação."],
      ["Mike", "Still, you learned a lot.", "Mesmo assim, você aprendeu muito."],
      ["Bruno", "Looking back, it was the right call. Everything happens for a reason.", "Olhando para trás, foi a decisão certa. Tudo acontece por um motivo."],
    ],
    why: {
      title: "'Should have' é o arrependimento em uma só peça",
      body:
        "*I should have taken that job*: eu deveria ter aceitado (e não aceitei).\n\nO bloco carrega três coisas ao mesmo tempo: uma ação no passado, ela não ter acontecido, e você lamentar. Em português precisamos de 'deveria ter' + particípio para o mesmo efeito.\n\nNa fala, *should have* vira **should've**, que soa quase 'shoulda'. É por isso que você ouve *shoulda*, *coulda*, *woulda* em filme e não acha no dicionário: são exatamente esses três blocos, reduzidos.",
    },
    swaps: ["taken that job", "said something", "asked for more", "left earlier", "listened to her", "saved more money", "started sooner", "gone anyway"],
    expansion: [
      ["I should have taken that job, but looking back, it was the right call.", "Eu deveria ter aceitado aquele emprego, mas olhando para trás, foi a decisão certa."],
      ["I wish I had studied more, though I'm not sure it would have changed anything.", "Eu queria ter estudado mais, embora não tenha certeza se teria mudado algo."],
      ["If I'd known how good the team was, I would have pushed a lot harder.", "Se eu soubesse como a equipe era boa, eu teria insistido bem mais."],
      ["I don't regret it. Everything happens for a reason, or at least that's what I tell myself.", "Eu não me arrependo. Tudo acontece por um motivo, ou pelo menos é o que eu digo a mim mesmo."],
    ],
    drift: [
      "Uma decisão que você mudaria se pudesse",
      "Se você acredita que tudo acontece por um motivo",
      "Um arrependimento que virou aprendizado",
      "O conselho que você daria a si mesmo há dez anos",
    ],
    sounds: [
      ["'Should have' vira 'shoulda'", "O 'have' colapsa. Vale para 'coulda' (could have) e 'woulda' (would have). É o que você ouve em filme."],
      ["'I wish I had' vira 'aiwishaid'", "O 'had' encolhe para um D grudado. Sem essa redução, a frase soa recitada."],
    ],
    quiz: [
      ["'I should have taken that job' quer dizer que você:", ["Aceitou o emprego", "Não aceitou e se arrepende", "Vai aceitar", "Está pensando em aceitar"], 1, "O bloco já embute que não aconteceu e que você lamenta. Três informações em duas palavras."],
      ["Na fala rápida, 'should have' soa como:", ["should of", "shoulda", "shood hav", "should"], 1, "Por isso muita gente escreve 'should of': é o que se ouve. Errado na escrita, mas explica a confusão."],
      ["'I wish I had studied more' fala de:", ["Um plano futuro", "Um arrependimento sobre o passado", "Um hábito atual", "Uma dúvida"], 1, "'Wish + had + particípio' é o arrependimento sobre algo já encerrado."],
      ["'Looking back, it was the right call' significa:", ["Olhando para trás, foi a decisão certa", "Vou rever a decisão", "A ligação estava certa", "Foi um erro"], 0, "'Call' aqui é decisão, julgamento. Vem do árbitro que 'marca' a jogada."],
    ],
  },

  // ======================================================== 37
  {
    n: 37,
    immersion: [
      ["Mike", "Did you talk to Kate?", "Você falou com a Kate?"],
      ["Ana", "Yeah. She said she was busy until Thursday.", "Falei. Ela disse que estava ocupada até quinta."],
      ["Mike", "And the deadline?", "E o prazo?"],
      ["Ana", "He told me to wait for the final version.", "Ele me disse para esperar a versão final."],
      ["Mike", "Who, Bruno?", "Quem, o Bruno?"],
      ["Ana", "Yes. They mentioned something about a delay.", "Sim. Eles mencionaram algo sobre um atraso."],
      ["Mike", "According to her, when does it ship?", "Segundo ela, quando é a entrega?"],
      ["Ana", "I heard that it moved to June. That's what I was told.", "Eu ouvi que mudou para junho. Foi o que me disseram."],
      ["Mike", "Okay. She asked if I could help, by the way.", "Ok. Ela perguntou se eu poderia ajudar, aliás."],
    ],
    listening: [
      ["Kate", "What did the client say?", "O que o cliente disse?"],
      ["Bruno", "He said he wanted three options, not one.", "Ele disse que queria três opções, não uma."],
      ["Kate", "Three? That doubles the work.", "Três? Isso dobra o trabalho."],
      ["Bruno", "They mentioned something about comparing internally.", "Eles mencionaram algo sobre comparar internamente."],
      ["Kate", "And the budget?", "E o orçamento?"],
      ["Bruno", "According to him, it hasn't changed.", "Segundo ele, não mudou."],
      ["Kate", "That doesn't add up.", "Isso não fecha."],
      ["Bruno", "I heard that a new manager came in. That's what I was told, anyway.", "Eu ouvi que entrou um gerente novo. Foi o que me disseram, de qualquer forma."],
      ["Kate", "She asked if I could join the next call, so I'll ask directly.", "Ela perguntou se eu poderia entrar na próxima call, então vou perguntar direto."],
    ],
    why: {
      title: "O verbo recua um passo: e ninguém repara se você errar",
      body:
        "Ela disse: *I am busy*. Você reporta: *She said she **was** busy*.\n\nÉ a regra do recuo: presente vira passado, passado vira mais-que-perfeito. Vale para toda fala relatada.\n\nA verdade prática: **ninguém deixa de te entender se você não recuar**. Nativo também escorrega nisso o tempo todo, principalmente quando o que foi dito ainda é verdade.\n\nO que realmente importa aqui são os quatro blocos de atribuição: *She said*, *He told me*, *According to*, *I heard that*: porque eles marcam que a informação não é sua. E isso, em trabalho, protege você.",
    },
    swaps: ["She said she was busy", "He told me to wait", "They mentioned a delay", "According to her", "I heard that it moved", "She asked if I could help", "That's what I was told", "He said he'd get back to us"],
    expansion: [
      ["She said she was busy until Thursday, so he told me to wait.", "Ela disse que estava ocupada até quinta, então ele me disse para esperar."],
      ["According to her, it moved to June, but that's just what I was told.", "Segundo ela, mudou para junho, mas é só o que me disseram."],
      ["They mentioned something about a delay, and I heard that a new manager came in.", "Eles mencionaram algo sobre um atraso, e eu ouvi que entrou um gerente novo."],
      ["She asked if I could help, so I said I'd check my schedule first.", "Ela perguntou se eu podia ajudar, então eu disse que ia checar minha agenda primeiro."],
    ],
    drift: [
      "Uma informação que chegou até você completamente distorcida",
      "Se você acredita em tudo que ouve no trabalho",
      "Uma fofoca que deu errado",
      "Como você confirma se algo é verdade",
    ],
    sounds: [
      ["'Said' rima com 'bed'", "É 'sed', não 'seid'. Um dos erros de pronúncia mais persistentes de brasileiro."],
      ["'Told me' com o D quase mudo", "'toul mi'. O D final de 'told' some antes do M. Vale para 'old man', 'cold morning'."],
    ],
    quiz: [
      ["Ela disse 'I am busy'. Como você reporta?", ["She said I am busy", "She said she is busy", "She said she was busy", "She say she busy"], 2, "O verbo recua um passo: 'am' vira 'was'. Errar não gera mal-entendido, mas acertar soa natural."],
      ["'He told me to wait': repare que 'tell' pede:", ["Ninguém depois", "Uma pessoa depois", "Uma preposição", "Um artigo"], 1, "'Tell' sempre tem alguém: tell ME, tell HIM. 'Say' não: he said that. Confundir os dois é clássico."],
      ["'According to her' introduz:", ["Sua própria opinião", "Informação atribuída a outra pessoa", "Uma dúvida", "Uma ordem"], 1, "Marca que a informação não é sua. Em trabalho, isso protege você quando a informação estiver errada."],
      ["'That's what I was told' serve para:", ["Confirmar uma certeza", "Repassar informação sem se responsabilizar por ela", "Discordar", "Encerrar"], 1, "É a cláusula de segurança. Você repassa o que ouviu sem assinar embaixo."],
    ],
  },

  // ======================================================== 38
  {
    n: 38,
    immersion: [
      ["Client", "The proposal looks good, but the timeline is a problem.", "A proposta parece boa, mas o cronograma é um problema."],
      ["Ana", "Would you be open to a different timeline?", "Você estaria aberto a um cronograma diferente?"],
      ["Client", "What did you have in mind?", "O que você tinha em mente?"],
      ["Ana", "Six weeks instead of four, same scope.", "Seis semanas em vez de quatro, mesmo escopo."],
      ["Client", "That's a bit outside our budget if it means more hours.", "Isso fica um pouco fora do nosso orçamento se significar mais horas."],
      ["Ana", "Could we meet halfway? Five weeks.", "A gente pode se encontrar no meio? Cinco semanas."],
      ["Client", "Let me check and get back to you.", "Deixa eu verificar e te retorno."],
      ["Ana", "Of course. Is the scope a deal breaker for you?", "Claro. O escopo é um impedimento para você?"],
      ["Client", "No. I think we can work with that.", "Não. Acho que podemos trabalhar com isso."],
    ],
    listening: [
      ["Vendor", "Our standard rate is 90 an hour.", "Nossa taxa padrão é 90 por hora."],
      ["Bruno", "That's a bit outside our budget, honestly.", "Isso fica um pouco fora do nosso orçamento, sinceramente."],
      ["Vendor", "What were you thinking?", "O que você estava pensando?"],
      ["Bruno", "Seventy. Would you be open to that for a longer contract?", "Setenta. Você estaria aberto a isso para um contrato mais longo?"],
      ["Vendor", "How long are we talking?", "Estamos falando de quanto tempo?"],
      ["Bruno", "Twelve months instead of three.", "Doze meses em vez de três."],
      ["Vendor", "Could we meet halfway at eighty?", "A gente pode se encontrar no meio em oitenta?"],
      ["Bruno", "I think we can work with that. Payment terms are a deal breaker though.", "Acho que podemos trabalhar com isso. Mas as condições de pagamento são um impedimento."],
      ["Vendor", "Let me check and get back to you. Sounds like we have a deal.", "Deixa eu verificar e te retorno. Parece que temos um acordo."],
    ],
    why: {
      title: "Negociar em inglês: nunca feche a porta",
      body:
        "Repare que nenhuma frase deste circuito é um 'não'.\n\n*That's a bit outside our budget*: não é 'caro demais', é 'está um pouco fora'.\n*Would you be open to ___?*: não é 'faça assim', é 'você consideraria?'.\n*Let me check and get back to you*: não é 'não', é 'ainda não'.\n\nA lógica é: enquanto ninguém disser 'não', a negociação continua. E negociação que continua costuma terminar melhor para os dois lados do que a que fecha cedo.",
    },
    swaps: ["a different timeline", "a longer contract", "splitting the cost", "a trial period", "revisiting this next quarter", "adjusting the scope", "a different payment schedule", "including support"],
    expansion: [
      ["Would you be open to a different timeline? Six weeks instead of four.", "Você estaria aberto a um cronograma diferente? Seis semanas em vez de quatro."],
      ["That's a bit outside our budget, but could we meet halfway?", "Isso fica um pouco fora do nosso orçamento, mas a gente pode se encontrar no meio?"],
      ["Let me check and get back to you. Payment terms are a deal breaker, though.", "Deixa eu verificar e te retorno. Mas as condições de pagamento são um impedimento."],
      ["I think we can work with that. Sounds like we have a deal.", "Acho que podemos trabalhar com isso. Parece que temos um acordo."],
    ],
    drift: [
      "A melhor negociação que você já fez",
      "Se você pechincha ou paga o preço pedido",
      "Uma vez em que você aceitou rápido demais",
      "Como se negocia salário no seu país",
    ],
    sounds: [
      ["'Would you be' vira 'wudjubi'", "O D vira J antes do Y. Mesma coisa em 'could you' e 'did you'. É universal na fala americana."],
      ["'Deal breaker' com dois acentos", "DÍL-brei-ker. Composto de duas palavras, cada uma com sua batida, mas ditas juntas."],
    ],
    quiz: [
      ["'That's a bit outside our budget' é preferível a 'too expensive' porque:", ["É mais educado e mantém a negociação aberta", "É mais curto", "É mais formal", "É mais verdadeiro"], 0, "'Too expensive' encerra. 'A bit outside' convida a uma contraproposta."],
      ["'Would you be open to ___?' propõe:", ["Uma exigência", "Uma consideração, sem pressão", "Uma recusa", "Um encerramento"], 1, "Pergunta se a pessoa consideraria, não se ela aceita. É o que mantém a porta aberta."],
      ["'Deal breaker' significa:", ["Um bom negócio", "Algo que inviabiliza o acordo", "Quem fecha o acordo", "Uma quebra de contrato"], 1, "É o ponto inegociável. Deixar claro qual é o seu poupa rodadas de conversa."],
      ["'Let me check and get back to you' é:", ["Um não disfarçado sempre", "Uma pausa legítima que não fecha a porta", "Um sim", "Uma recusa formal"], 1, "Pode ser um não educado, mas formalmente é uma pausa. Em negociação, nunca leia como recusa definitiva."],
    ],
  },

  // ======================================================== 39
  {
    n: 39,
    immersion: [
      ["Client", "So, tell me about your team.", "Então, me fale sobre sua equipe."],
      ["Ana", "I'm in charge of six people. Have you ever worked with a distributed team?", "Eu sou responsável por seis pessoas. Você já trabalhou com equipe distribuída?"],
      ["Client", "We tried. It didn't go well.", "A gente tentou. Não foi bem."],
      ["Ana", "Can I jump in here? Just to be clear, was it the tooling or the process?", "Posso entrar aqui? Só para deixar claro, foi a ferramenta ou o processo?"],
      ["Client", "Process, mostly.", "Processo, principalmente."],
      ["Ana", "If I were you, I'd start with a two-week pilot.", "Se eu fosse você, eu começaria com um piloto de duas semanas."],
      ["Client", "That's a bit outside our timeline.", "Isso fica um pouco fora do nosso cronograma."],
      ["Ana", "Would you be open to running it in parallel?", "Você estaria aberto a rodar em paralelo?"],
      ["Client", "Let me check and get back to you.", "Deixa eu verificar e te retorno."],
    ],
    listening: [
      ["Clerk", "Room 412, checking out?", "Quarto 412, fazendo check-out?"],
      ["Bruno", "Yes. I'm afraid there's been a mistake with the bill.", "Sim. Receio que houve um engano na conta."],
      ["Clerk", "What is it?", "O que foi?"],
      ["Bruno", "I was charged for a late check-out I never requested.", "Fui cobrado por um check-out tardio que eu nunca pedi."],
      ["Clerk", "According to the system, you called at ten.", "Segundo o sistema, você ligou às dez."],
      ["Bruno", "That wasn't me. Would it be possible to check the recording?", "Não fui eu. Seria possível verificar a gravação?"],
      ["Clerk", "Let me speak to my manager.", "Deixa eu falar com meu gerente."],
      ["Bruno", "I appreciate your help. And could you tell me where I can leave my bags?", "Eu agradeço sua ajuda. E pode me dizer onde eu posso deixar minhas malas?"],
      ["Clerk", "Right behind you, the luggage room.", "Bem atrás de você, o depósito de bagagem."],
    ],
    why: {
      title: "O Terceiro Canto foi sobre atrito",
      body:
        "Compare com o Primeiro Canto: lá tudo dava certo. Aqui, quase nada deu: voo perdido, cobrança errada, prazo apertado, opinião divergente.\n\nE em todos os casos você tinha bloco pronto. É isso que muda o jogo: não é falar inglês quando tudo está bem, é **continuar falando quando não está**.\n\nO Quarto Canto muda de eixo. Sai da situação e entra no som: fala grudada, phrasal verbs, ironia, registro. É a diferença entre falar inglês e soar como quem fala inglês.",
    },
    swaps: ["I'm in charge of the team.", "Have you ever done that?", "Can I jump in here?", "Would it be possible to change it?", "I'm afraid there's been a mistake.", "If I were you, I'd wait.", "Would you be open to that?", "Let me check and get back to you."],
    expansion: [
      ["I'm in charge of six people, and I've been doing this for five years.", "Eu sou responsável por seis pessoas, e faço isso há cinco anos."],
      ["Can I jump in here? Just to be clear, I'm afraid there's been a mistake.", "Posso entrar aqui? Só para deixar claro, receio que houve um engano."],
      ["If I were you, I'd ask first. Would you be open to a shorter pilot?", "Se eu fosse você, eu perguntaria primeiro. Você estaria aberto a um piloto mais curto?"],
      ["I should have asked earlier, but let me check and get back to you.", "Eu deveria ter perguntado antes, mas deixa eu verificar e te retorno."],
    ],
    drift: [
      "A situação mais difícil que você resolveu em inglês",
      "Se você se sente diferente falando inglês no trabalho",
      "Um problema que você resolveu sozinho no exterior",
      "O que você ainda evita fazer em inglês",
    ],
    sounds: [
      ["Revisão: os modais reduzidos", "should've, could've, would've, I'd, wouldn't. Grave-se e confira se você ainda fala expandido."],
      ["Revisão: D virando J", "could you, would you, did you, don't you. Se você ainda separa, é o que mais entrega o sotaque agora."],
    ],
    quiz: [
      ["O que o Terceiro Canto adicionou?", ["Vocabulário técnico", "Capacidade de agir quando algo dá errado", "Pronúncia perfeita", "Escrita formal"], 1, "Falar inglês quando tudo vai bem é fácil. O canto inteiro foi sobre continuar falando quando não vai."],
      ["Qual bloco é o mais reaproveitável do canto?", ["I'm in charge of ___", "Would it be possible to ___?", "I graduated in ___", "I have a headache"], 1, "Serve para hotel, trabalho, atendimento, negociação: qualquer pedido fora do padrão."],
      ["A diferença entre 'You made a mistake' e 'There's been a mistake' é:", ["Formalidade", "A segunda não acusa ninguém e gera cooperação", "Tamanho", "Nenhuma"], 1, "Ao não nomear culpado, você libera a pessoa para resolver em vez de se defender."],
      ["O que vem no Quarto Canto?", ["Mais situações do dia a dia", "Soar natural: fala grudada, phrasal verbs, ironia, registro", "Gramática avançada", "Vocabulário acadêmico"], 1, "Muda o eixo: sai da situação e entra no som e no registro. É a diferença entre falar e soar."],
    ],
  },
];
