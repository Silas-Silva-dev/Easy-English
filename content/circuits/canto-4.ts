/**
 * QUARTO CANTO: Soar natural (circuitos 40 a 52)
 *
 * Muda o eixo. Os três primeiros cantos foram sobre SITUAÇÕES; este é sobre o
 * SOM e o REGISTRO: fala grudada, phrasal verbs, colocações, ironia, sotaques.
 *
 * É a diferença entre falar inglês e soar como quem fala inglês.
 */

import type { CircuitContent } from "../compose-lesson";

export const CANTO_4: CircuitContent[] = [
  // ======================================================== 40
  {
    n: 40,
    immersion: [
      ["Mike", "Hey! Long time. Let's catch up soon!", "Ei! Quanto tempo. Vamos colocar o papo em dia!"],
      ["Ana", "Definitely. I ran into your sister last week, by the way.", "Com certeza. Eu esbarrei na sua irmã semana passada, aliás."],
      ["Mike", "No way! Where?", "Sem chance! Onde?"],
      ["Ana", "At the market. She said you moved.", "No mercado. Ela disse que você se mudou."],
      ["Mike", "Yeah, still trying to figure this place out.", "É, ainda tentando entender esse lugar."],
      ["Ana", "You'll get there. Don't give up.", "Você vai chegar lá. Não desista."],
      ["Mike", "Ha! I'll pick you up at eight on Friday, then?", "Ha! Eu te pego às oito na sexta, então?"],
      ["Ana", "Something came up on Friday. Saturday?", "Surgiu uma coisa na sexta. Sábado?"],
      ["Mike", "Works for me. I'm looking forward to it.", "Funciona para mim. Estou ansioso."],
    ],
    listening: [
      ["Kate", "How's the new system going?", "Como vai o sistema novo?"],
      ["Bruno", "Rough. I still need to figure this out.", "Difícil. Eu ainda preciso entender isso."],
      ["Kate", "Want me to walk you through it?", "Quer que eu te mostre passo a passo?"],
      ["Bruno", "Please. I almost gave up yesterday.", "Por favor. Eu quase desisti ontem."],
      ["Kate", "Don't give up. It clicks around day three.", "Não desista. Cai a ficha por volta do terceiro dia."],
      ["Bruno", "Good to know. Something came up this morning, so I lost two hours.", "Bom saber. Surgiu uma coisa hoje de manhã, então perdi duas horas."],
      ["Kate", "I'll pick this up after lunch and we can catch up then.", "Eu retomo isso depois do almoço e a gente conversa."],
      ["Bruno", "I'm looking forward to it. Thanks.", "Estou ansioso. Obrigado."],
    ],
    why: {
      title: "Phrasal verb não se traduz, se instala",
      body:
        "*Give* é dar. *Up* é para cima. *Give up* é **desistir**. Não há lógica dedutível: e é por isso que traduzir palavra por palavra falha aqui.\n\nA partícula muda tudo: *pick up* (buscar), *pick out* (escolher), *pick on* (implicar com alguém).\n\nA única estratégia que funciona é a mesma do curso inteiro: guarde o **bloco inteiro com um exemplo colado**. *I'll pick you up at eight*. Nunca *pick up* solto: sempre dentro de uma frase que você usaria.",
    },
    swaps: ["figure it out", "catch up", "run into someone", "give up", "pick you up", "come up", "look forward to it", "work it out"],
    expansion: [
      ["I ran into your sister last week and she said we should catch up soon.", "Eu esbarrei na sua irmã semana passada e ela disse que a gente devia colocar o papo em dia."],
      ["Something came up, so I'll pick you up on Saturday instead.", "Surgiu uma coisa, então eu te pego no sábado em vez disso."],
      ["I still need to figure this out, but I'm not going to give up.", "Eu ainda preciso entender isso, mas não vou desistir."],
      ["I'm looking forward to it. It's been way too long.", "Estou ansioso. Já faz tempo demais."],
    ],
    drift: [
      "Alguém com quem você precisa colocar o papo em dia",
      "Um encontro por acaso que rendeu história",
      "Algo que você quase desistiu de aprender",
      "O que você está ansioso para fazer este ano",
    ],
    sounds: [
      ["A partícula carrega o acento", "'figure it OUT', 'give UP', 'catch UP'. A força vai na partícula, não no verbo. Errar isso muda o ritmo da frase inteira."],
      ["'Ran into' vira 'ranintu'", "O N final gruda no I seguinte. Toda consoante final gruda na vogal que vem depois: é a regra do inglês falado."],
    ],
    quiz: [
      ["'Give up' significa:", ["Dar para cima", "Desistir", "Entregar", "Levantar"], 1, "Nenhuma tradução de 'give' + 'up' chega em 'desistir'. Por isso phrasal verb se guarda inteiro."],
      ["'I ran into your sister' quer dizer:", ["Bati nela", "Encontrei por acaso", "Corri até ela", "Fui atrás dela"], 1, "'Run into' é encontro casual. 'Meet up' é o encontro combinado, do circuito 14."],
      ["Onde vai o acento em 'figure it out'?", ["FIgure", "it", "OUT", "Todos iguais"], 2, "A partícula leva o acento no phrasal verb. É isso que dá o ritmo característico da frase."],
      ["'Something came up' significa:", ["Algo subiu", "Surgiu um imprevisto", "Algo apareceu na tela", "Alguém chegou"], 1, "É a desculpa universal para desmarcar. Vaga de propósito: ninguém pergunta o que foi."],
    ],
  },

  // ======================================================== 41
  {
    n: 41,
    immersion: [
      ["Kate", "We need to make a decision by Friday.", "A gente precisa tomar uma decisão até sexta."],
      ["Ana", "Can I have a look at the numbers first?", "Posso dar uma olhada nos números primeiro?"],
      ["Kate", "Sure. I did some research last night.", "Claro. Eu fiz uma pesquisa ontem à noite."],
      ["Ana", "Anything useful?", "Algo útil?"],
      ["Kate", "Pay attention to this part. It changes everything.", "Preste atenção nessa parte. Muda tudo."],
      ["Ana", "Hm. Let's take a break and come back to it.", "Hm. Vamos fazer uma pausa e voltar nisso."],
      ["Kate", "Good idea. Keep that in mind though.", "Boa ideia. Mas guarde isso em mente."],
      ["Ana", "I will. Let's get in touch next week either way.", "Vou guardar. Vamos nos falar semana que vem de qualquer jeito."],
    ],
    listening: [
      ["Mike", "Did you do the research on the vendor?", "Você fez a pesquisa sobre o fornecedor?"],
      ["Bruno", "I did some research, yeah. Can I have a look at your notes too?", "Fiz uma pesquisa, sim. Posso dar uma olhada nas suas anotações também?"],
      ["Mike", "Here. Pay attention to the delivery history.", "Aqui. Preste atenção no histórico de entregas."],
      ["Bruno", "That's bad. We need to make a decision today, then.", "Isso é ruim. Precisamos tomar uma decisão hoje, então."],
      ["Mike", "Let's take a break first. My head is fried.", "Vamos fazer uma pausa primeiro. Minha cabeça está fritada."],
      ["Bruno", "Fair. Keep in mind we promised an answer by five.", "Justo. Tenha em mente que prometemos uma resposta até cinco."],
      ["Mike", "I know. I'll get in touch with them after.", "Eu sei. Eu entro em contato com eles depois."],
      ["Bruno", "Perfect.", "Perfeito."],
    ],
    why: {
      title: "Colocação: a palavra certa que anda com a outra",
      body:
        "Em português a gente **toma** uma decisão. Em inglês, se **faz** uma: *make a decision*.\n\nNinguém diz *take a decision* nos Estados Unidos. Não é errado gramaticalmente: é errado **socialmente**, do jeito que 'fazer uma decisão' soaria em português.\n\nEssas duplas fixas se chamam colocações, e não têm regra: *make a decision*, *do research*, *take a break*, *have a look*, *pay attention*.\n\nÉ mais uma vez o mesmo princípio: guarde a dupla, não a palavra.",
    },
    swaps: ["make a decision", "do some research", "take a break", "have a look", "pay attention", "keep in mind", "get in touch", "make sense"],
    expansion: [
      ["We need to make a decision by Friday, so let me do some research first.", "A gente precisa tomar uma decisão até sexta, então deixa eu fazer uma pesquisa primeiro."],
      ["Can I have a look? And pay attention to this part, it changes everything.", "Posso dar uma olhada? E preste atenção nessa parte, muda tudo."],
      ["Let's take a break and get in touch again after lunch.", "Vamos fazer uma pausa e nos falar de novo depois do almoço."],
      ["Keep that in mind, because it doesn't make sense otherwise.", "Guarde isso em mente, porque não faz sentido de outro jeito."],
    ],
    drift: [
      "Uma decisão que você adiou por tempo demais",
      "Como você pesquisa antes de decidir",
      "Se você trabalha melhor com ou sem pausa",
      "Um detalhe que mudou tudo numa decisão sua",
    ],
    sounds: [
      ["'Make a' vira 'meika'", "O K final gruda no A. Colocação boa é dita rápido: se sair separado, soa como se você tivesse montado a frase na hora."],
      ["'Pay attention' vira 'peiatenshan'", "O Y gruda no A seguinte. E o T no meio de 'attention' vira SH."],
    ],
    quiz: [
      ["Como se diz 'tomar uma decisão'?", ["take a decision", "make a decision", "do a decision", "have a decision"], 1, "Em inglês se FAZ uma decisão. 'Take a decision' existe no inglês britânico formal, mas não é o padrão americano."],
      ["Qual está certa?", ["make research", "take research", "do research", "have research"], 2, "'Do research'. Cada substantivo tem seu verbo fixo, e não há regra: só uso."],
      ["'Have a look' significa:", ["Ter uma aparência", "Dar uma olhada", "Manter o olhar", "Procurar"], 1, "'Have a look' e 'take a look' são intercambiáveis. Ambos = dar uma olhada."],
      ["Por que colocações importam mais que gramática aqui?", ["São mais fáceis", "Errar colocação soa estranho mesmo com gramática perfeita", "São obrigatórias", "Aparecem em provas"], 1, "'I took a decision' está gramaticalmente correto e ainda assim soa errado. É o nível seguinte de naturalidade."],
    ],
  },

  // ======================================================== 42
  {
    n: 42,
    immersion: [
      ["Mike", "Hey, whatcha doing?", "Ei, o que você tá fazendo?"],
      ["Ana", "Nothing much. Kinda tired today.", "Nada demais. Meio cansada hoje."],
      ["Mike", "What are you gonna do about dinner?", "O que você vai fazer sobre o jantar?"],
      ["Ana", "Dunno, honestly. I wanna try that new place.", "Sei lá, sinceramente. Eu quero experimentar aquele lugar novo."],
      ["Mike", "Let's do it. I've gotta go at nine though.", "Vamos. Mas eu tenho que ir às nove."],
      ["Ana", "That works. Lemme know when you're leaving.", "Isso funciona. Me avisa quando você sair."],
      ["Mike", "Will do. You gonna change first?", "Combinado. Você vai trocar de roupa antes?"],
      ["Ana", "Nah. Kinda late for that.", "Nã. Meio tarde para isso."],
    ],
    listening: [
      ["Kate", "You gonna finish that report today?", "Você vai terminar aquele relatório hoje?"],
      ["Bruno", "I wanna, but I've gotta leave early.", "Eu quero, mas tenho que sair cedo."],
      ["Kate", "Whatcha got going on?", "O que você tem rolando?"],
      ["Bruno", "Dentist. Kinda urgent.", "Dentista. Meio urgente."],
      ["Kate", "Ouch. Lemme know if you need me to cover.", "Ai. Me avisa se precisar que eu cubra."],
      ["Bruno", "I might. Dunno yet.", "Talvez. Ainda não sei."],
      ["Kate", "No rush. Just gotta know before three.", "Sem pressa. Só preciso saber antes das três."],
      ["Bruno", "I'll text you. Thanks!", "Eu te mando mensagem. Obrigado!"],
    ],
    why: {
      title: "Você não precisa falar assim. Precisa entender assim",
      body:
        "*Gonna*, *wanna*, *gotta*, *lemme*, *dunno*, *kinda* não são gíria nem preguiça: são o que acontece com **going to**, **want to**, **got to**, **let me**, **don't know** e **kind of** quando ditos em velocidade normal.\n\nA distinção que importa: essas formas são de **fala**, não de escrita. Nunca escreva *gonna* num e-mail de trabalho.\n\nE se você preferir falar as formas completas, tudo bem: soa um pouco formal, e só. O que **não** é opcional é reconhecê-las de ouvido. Sem isso, conversa rápida vira ruído.",
    },
    swaps: ["gonna", "wanna", "gotta", "lemme", "dunno", "kinda", "whatcha", "gimme"],
    expansion: [
      ["What are you gonna do tonight? I wanna try that new place.", "O que você vai fazer hoje à noite? Eu quero experimentar aquele lugar novo."],
      ["I've gotta go at nine, so lemme know when you're leaving.", "Eu tenho que ir às nove, então me avisa quando você sair."],
      ["Dunno, honestly. Kinda tired today.", "Sei lá, sinceramente. Meio cansado hoje."],
      ["Whatcha doing later? I'm gonna be around if you wanna grab coffee.", "O que você vai fazer mais tarde? Vou estar por aqui se você quiser tomar um café."],
    ],
    drift: [
      "Se você já perdeu uma conversa inteira por causa de fala rápida",
      "Um filme em que você entendeu quase nada",
      "Como é a fala rápida no português",
      "Se você prefere legenda em inglês ou nada",
    ],
    sounds: [
      ["'Gotta' com D no meio", "O TT vira D suave: 'gá-da'. Vale para 'better', 'water', 'letter': mesma transformação."],
      ["'Whatcha' e o T que virou CH", "'What are you' colapsou inteiro. É a forma mais reduzida que você vai ouvir, e é comuníssima."],
    ],
    quiz: [
      ["'Gonna' é a forma falada de:", ["got to", "going to", "gone to", "want to"], 1, "'Going to' colapsado. Só para futuro: 'I'm going to the store' (movimento) NÃO vira 'gonna'."],
      ["Você deve escrever 'gonna' em e-mail de trabalho?", ["Sim, é normal", "Não, é forma de fala apenas", "Só com colegas", "Sempre"], 1, "São reduções de fala. Em texto formal soam descuidadas: o equivalente a escrever 'né' num relatório."],
      ["'Dunno' significa:", ["Do not", "Don't know", "Done", "Down"], 1, "'Don't know' colapsado. Muito informal, muito frequente."],
      ["Por que aprender essas formas importa?", ["Para falar como nativo", "Para ENTENDER fala em velocidade real", "Para escrever melhor", "Para provas"], 1, "Você pode falar as formas completas a vida inteira. Mas se não reconhecer as reduzidas, não entende conversa rápida."],
    ],
  },

  // ======================================================== 43
  {
    n: 43,
    immersion: [
      ["Mike", "How was the exam?", "Como foi a prova?"],
      ["Ana", "It was a piece of cake, honestly.", "Foi moleza, sinceramente."],
      ["Mike", "Lucky. I'm feeling under the weather today.", "Sortuda. Eu estou meio adoentado hoje."],
      ["Ana", "Oh no. Go home!", "Ah não. Vá para casa!"],
      ["Mike", "Soon. Let's call it a day after this meeting.", "Logo. Vamos encerrar o dia depois dessa reunião."],
      ["Ana", "Deal. Are we on the same page about the deadline?", "Fechado. A gente está de acordo sobre o prazo?"],
      ["Mike", "I think so. It's not rocket science.", "Acho que sim. Não é nada de outro mundo."],
      ["Ana", "Then let's play it by ear.", "Então vamos ver como fica."],
    ],
    listening: [
      ["Kate", "Nervous about the presentation?", "Nervoso com a apresentação?"],
      ["Bruno", "A little. But it's not rocket science.", "Um pouco. Mas não é nada de outro mundo."],
      ["Kate", "Want to run through it first? Break the ice with a joke maybe.", "Quer passar por ela antes? Quebrar o gelo com uma piada talvez."],
      ["Bruno", "Maybe. I'll play it by ear.", "Talvez. Vou ver como fica."],
      ["Kate", "Fair. Are we on the same page about the numbers?", "Justo. A gente está de acordo sobre os números?"],
      ["Bruno", "We are. That part's a piece of cake.", "Estamos. Essa parte é moleza."],
      ["Kate", "Great. Honestly, I'm feeling under the weather, so let's call it a day after.", "Ótimo. Sinceramente, estou meio adoentada, então vamos encerrar depois."],
      ["Bruno", "Deal.", "Fechado."],
    ],
    why: {
      title: "Idiom é bloco puro: e menos é mais",
      body:
        "Idiom é o caso extremo do método: **zero** dedução possível. *Under the weather* não tem nada a ver com clima; significa estar meio doente.\n\nDuas advertências que valem mais que a lista:\n\n**1.** Aprenda a **reconhecer** muitos, mas a **usar** poucos. Estrangeiro que enfia idiom em toda frase soa como quem decorou um livro de expressões.\n\n**2.** Idiom envelhece. Os sete deste circuito são de alta frequência e não datam. Evite os que você viu em lista de internet: muitos ninguém mais usa.",
    },
    swaps: ["a piece of cake", "call it a day", "under the weather", "break the ice", "on the same page", "not rocket science", "play it by ear", "hit the road"],
    expansion: [
      ["It was a piece of cake, honestly. Not rocket science at all.", "Foi moleza, sinceramente. Nada de outro mundo."],
      ["I'm feeling under the weather, so let's call it a day.", "Estou meio adoentado, então vamos encerrar o dia."],
      ["Are we on the same page? If not, let's play it by ear and adjust.", "A gente está de acordo? Se não, vamos ver como fica e ajustar."],
      ["Someone should break the ice, because this silence is getting awkward.", "Alguém devia quebrar o gelo, porque esse silêncio está ficando estranho."],
    ],
    drift: [
      "Uma expressão brasileira impossível de traduzir",
      "Um idiom que você entendeu ao pé da letra e se confundiu",
      "Se você usa gíria em português",
      "A expressão que você mais usa no dia a dia",
    ],
    sounds: [
      ["Idiom sai numa batida só", "'apiece-of-cake', 'under-the-weather'. Se você pausa entre as palavras, quebra o efeito de expressão pronta."],
      ["'Weather' e o TH sonoro", "'UÉ-dher'. Não confunda com 'whether' (se): a pronúncia é idêntica e só o contexto separa."],
    ],
    quiz: [
      ["'It's a piece of cake' significa:", ["É um pedaço de bolo", "É muito fácil", "É delicioso", "É pequeno"], 1, "Idiom não se traduz. 'Moleza' é o equivalente funcional."],
      ["'I'm feeling under the weather' quer dizer:", ["Está frio", "Estou meio doente", "Estou deprimido", "Está chovendo"], 1, "Nada a ver com clima. É a forma educada de dizer que não está 100%."],
      ["Qual o melhor uso de idioms para quem aprende?", ["Usar o máximo possível", "Reconhecer muitos e usar poucos", "Ignorar completamente", "Só os antigos"], 1, "Estrangeiro que abusa de idiom soa artificial. Reconhecer é essencial; usar, com parcimônia."],
      ["'Let's play it by ear' propõe:", ["Ouvir música", "Decidir conforme a situação", "Prestar atenção", "Cancelar"], 1, "Vem de tocar de ouvido, sem partitura. Significa improvisar conforme as coisas andam."],
    ],
  },

  // ======================================================== 44
  {
    n: 44,
    immersion: [
      ["Ana", "I'd like to request a meeting to discuss the proposal.", "Eu gostaria de solicitar uma reunião para discutir a proposta."],
      ["Client", "Of course. Could you please confirm your availability?", "Claro. Você poderia por favor confirmar sua disponibilidade?"],
      ["Ana", "Tuesday works. I apologize for the delay in responding.", "Terça funciona. Peço desculpas pela demora em responder."],
      ["Client", "No problem at all. Please find attached the revised deck.", "Sem problema algum. Segue anexo o material revisado."],
      ["Ana", "Thank you for your time. Best regards, Ana.", "Obrigada pelo seu tempo. Atenciosamente, Ana."],
      ["Mike", "Hey! Wanna meet up Tuesday?", "Ei! Quer se encontrar terça?"],
      ["Ana", "Sure! Sorry I'm late replying.", "Claro! Desculpa a demora em responder."],
      ["Mike", "No worries. Here's the file. Cheers!", "Sem problema. Aqui está o arquivo. Falou!"],
    ],
    listening: [
      ["Bruno", "Hi Kate, I'm afraid I can't attend the Thursday session.", "Oi Kate, receio que não poderei comparecer à sessão de quinta."],
      ["Kate", "Understood. Thank you for letting me know in advance.", "Entendido. Obrigada por me avisar com antecedência."],
      ["Bruno", "Please find attached my notes so the team isn't blocked.", "Segue anexo minhas anotações para a equipe não ficar travada."],
      ["Kate", "Much appreciated. Best regards.", "Muito obrigada. Atenciosamente."],
      ["Bruno", "Hey Mike, can't make it Thursday, sorry!", "Ei Mike, não vou conseguir na quinta, desculpa!"],
      ["Mike", "No worries! Anything I should know?", "Sem problema! Algo que eu deva saber?"],
      ["Bruno", "Here's my notes, so nobody's stuck. Cheers!", "Aqui estão minhas anotações, para ninguém ficar travado. Falou!"],
      ["Mike", "You're a lifesaver. Thanks!", "Você é um salva-vidas. Valeu!"],
    ],
    why: {
      title: "Registro: a mesma ideia em dois volumes",
      body:
        "Repare que os dois diálogos dizem exatamente a **mesma coisa**. O que muda é o volume social.\n\nO padrão é consistente: **formal = mais longo, mais latino, mais indireto**. *I apologize for the delay* (formal) vira *Sorry I'm late* (informal). *I'm afraid I can't attend* vira *Can't make it, sorry*.\n\nErrar o registro custa mais caro que errar gramática. Formal demais com um colega soa frio e distante; informal demais com um cliente soa desleixado.\n\nNa dúvida, **espelhe**: responda no mesmo registro em que te escreveram.",
    },
    swaps: ["I apologize for the delay", "Sorry I'm late", "Could you please confirm", "Can you confirm", "I'm afraid I can't attend", "Can't make it, sorry", "Best regards", "Cheers"],
    expansion: [
      ["I'd like to request a meeting. Could you please confirm your availability?", "Eu gostaria de solicitar uma reunião. Você poderia confirmar sua disponibilidade?"],
      ["Wanna meet up? Just let me know what works.", "Quer se encontrar? Só me avisa o que funciona."],
      ["I apologize for the delay. Please find attached the revised version.", "Peço desculpas pela demora. Segue anexo a versão revisada."],
      ["Sorry I'm late replying! Here's the file. Cheers!", "Desculpa a demora! Aqui está o arquivo. Falou!"],
    ],
    drift: [
      "Como você escreve para o chefe versus para um amigo",
      "Se o português tem a mesma diferença de registro",
      "Uma vez em que você errou o tom numa mensagem",
      "Se e-mail está morrendo onde você trabalha",
    ],
    sounds: [
      ["Registro também é entonação", "A mesma frase dita rápido e para baixo soa informal; dita devagar e articulada soa formal. Grave 'thank you' das duas formas."],
      ["'Cheers' é britânico mas viajou", "'Chirz'. Nos Estados Unidos aparece em e-mail informal e como brinde. Formal, nunca."],
    ],
    quiz: [
      ["'I'm afraid I can't attend' é a versão formal de:", ["I don't want to go", "Can't make it, sorry", "I won't attend", "Maybe later"], 1, "Mesma mensagem, registros diferentes. O formal é mais longo e mais indireto: é o padrão."],
      ["O que é mais grave: errar gramática ou errar registro?", ["Gramática", "Registro", "São iguais", "Nenhum importa"], 1, "Gramática errada soa como estrangeiro. Registro errado soa como falta de leitura social: custa mais caro."],
      ["Na dúvida sobre o registro, o que fazer?", ["Sempre formal", "Sempre informal", "Espelhar o registro de quem escreveu", "Perguntar"], 2, "Espelhar é a estratégia mais segura e funciona em qualquer cultura corporativa."],
      ["'Please find attached' aparece em:", ["Conversa de bar", "E-mail formal de trabalho", "Mensagem para amigo", "Apresentação oral"], 1, "É fórmula fixa de e-mail formal. Em mensagem para amigo, seria 'here's the file'."],
    ],
  },

  // ======================================================== 45
  {
    n: 45,
    immersion: [
      ["Ana", "First of all, thank you all for coming.", "Antes de mais nada, obrigada a todos por virem."],
      ["Ana", "Let me walk you through the numbers from last quarter.", "Deixem-me apresentar os números do último trimestre."],
      ["Ana", "As you can see here, growth slowed in March.", "Como vocês podem ver aqui, o crescimento desacelerou em março."],
      ["Mike", "Was that seasonal?", "Isso foi sazonal?"],
      ["Ana", "Partly. This brings me to my next point.", "Em parte. Isso me leva ao meu próximo ponto."],
      ["Ana", "In a nutshell, we grew, but not where we expected.", "Em resumo, a gente cresceu, mas não onde esperava."],
      ["Ana", "The key takeaway is that the new channel is working.", "A conclusão principal é que o canal novo está funcionando."],
      ["Ana", "I'd be happy to take questions.", "Ficarei feliz em responder perguntas."],
    ],
    listening: [
      ["Bruno", "First of all, sorry for the technical issues.", "Antes de mais nada, desculpem pelos problemas técnicos."],
      ["Bruno", "Let me walk you through what changed since last month.", "Deixem-me apresentar o que mudou desde o mês passado."],
      ["Kate", "Can you go back one slide?", "Você pode voltar um slide?"],
      ["Bruno", "Of course. As you can see here, the delays dropped by half.", "Claro. Como vocês podem ver aqui, os atrasos caíram pela metade."],
      ["Kate", "What caused that?", "O que causou isso?"],
      ["Bruno", "Good question. This brings me to my next point.", "Boa pergunta. Isso me leva ao meu próximo ponto."],
      ["Bruno", "In a nutshell, we changed one supplier and it fixed most of it.", "Em resumo, a gente trocou um fornecedor e isso resolveu a maior parte."],
      ["Bruno", "The key takeaway is that it wasn't a process problem. I'd be happy to take questions.", "A conclusão principal é que não era problema de processo. Ficarei feliz em responder perguntas."],
    ],
    why: {
      title: "Apresentação é uma estrutura, não um texto",
      body:
        "Apresentar em inglês é mais fácil que conversar, e quase ninguém acredita nisso.\n\nO motivo: você controla o conteúdo, o ritmo e o vocabulário. Ninguém te interrompe com uma palavra que você não conhece. E existe um **esqueleto fixo** que sustenta qualquer apresentação:\n\n*First of all* → abre\n*Let me walk you through* → anuncia\n*As you can see here* → aponta\n*This brings me to my next point* → transiciona\n*In a nutshell* → resume\n*The key takeaway is* → conclui\n*I'd be happy to take questions* → encerra\n\nSete blocos. Você troca só o conteúdo entre eles.",
    },
    swaps: ["the numbers", "what changed", "the timeline", "how it works", "the three options", "where we are today", "the main risks", "what happens next"],
    expansion: [
      ["First of all, let me walk you through the numbers from last quarter.", "Antes de mais nada, deixem-me apresentar os números do último trimestre."],
      ["As you can see here, growth slowed. This brings me to my next point.", "Como vocês podem ver aqui, o crescimento desacelerou. Isso me leva ao próximo ponto."],
      ["In a nutshell, we grew, but the key takeaway is that the new channel works.", "Em resumo, a gente cresceu, mas a conclusão principal é que o canal novo funciona."],
      ["That's all from me. I'd be happy to take questions.", "É isso da minha parte. Ficarei feliz em responder perguntas."],
    ],
    drift: [
      "A apresentação mais difícil que você já fez",
      "Se você tem medo de falar em público",
      "O que faz uma apresentação ser boa",
      "Como você se prepara antes de apresentar",
    ],
    sounds: [
      ["Pausa é ferramenta", "Depois de 'First of all' e de 'The key takeaway is', PAUSE. A pausa dá autoridade e te dá tempo de pensar. Nativo faz de propósito."],
      ["'In a nutshell' emendado", "'inanátshel'. Expressão fixa, sai numa batida: e é o sinal de que o resumo está vindo."],
    ],
    quiz: [
      ["Por que apresentar é mais fácil que conversar?", ["O vocabulário é menor", "Você controla conteúdo, ritmo e vocabulário", "As pessoas prestam menos atenção", "É mais curto"], 1, "Ninguém te interrompe com uma palavra desconhecida. É o formato mais previsível do inglês falado."],
      ["'Let me walk you through ___' significa:", ["Vamos caminhar", "Vou explicar passo a passo", "Me acompanhe até lá", "Vou resumir"], 1, "'Walk through' é conduzir alguém pelos detalhes na ordem. Também usado em treinamento e suporte."],
      ["'The key takeaway is ___' introduz:", ["Uma pergunta", "A conclusão principal a ser lembrada", "Uma piada", "Um pedido"], 1, "'Takeaway' é o que a plateia leva embora. Dizer isso explicitamente aumenta muito a retenção."],
      ["Qual o papel da pausa numa apresentação?", ["Mostrar insegurança", "Dar autoridade e tempo para pensar", "Preencher tempo", "Nenhum"], 1, "Nativo pausa de propósito. Quem tem medo acelera: e acelerar é o que realmente denuncia nervosismo."],
    ],
  },

  // ======================================================== 46
  {
    n: 46,
    immersion: [
      ["Ana", "I really liked the opening section.", "Eu gostei muito da seção de abertura."],
      ["Mike", "Thanks! I wasn't sure about it.", "Obrigado! Eu não tinha certeza sobre ela."],
      ["Ana", "It works. One thing I'd suggest is cutting the second chart.", "Funciona. Uma coisa que eu sugeriria é cortar o segundo gráfico."],
      ["Mike", "Too much?", "Demais?"],
      ["Ana", "A bit. There's room for improvement in the ending too.", "Um pouco. Tem espaço para melhorar no final também."],
      ["Mike", "Have you considered a different closing line?", "Você considerou uma frase de encerramento diferente?"],
      ["Ana", "Exactly what I was going to say. That said, overall it's solid.", "Exatamente o que eu ia dizer. Dito isso, no geral está sólido."],
      ["Mike", "Thanks for the feedback. I'll take that on board.", "Obrigado pelo feedback. Vou levar isso em conta."],
    ],
    listening: [
      ["Kate", "Be honest. What did you think?", "Seja honesto. O que você achou?"],
      ["Bruno", "I really liked the research part. That was strong.", "Eu gostei muito da parte de pesquisa. Aquilo estava forte."],
      ["Kate", "And?", "E?"],
      ["Bruno", "One thing I'd suggest is slowing down at the start.", "Uma coisa que eu sugeriria é ir mais devagar no começo."],
      ["Kate", "I was nervous.", "Eu estava nervosa."],
      ["Bruno", "It showed a little. There's room for improvement there.", "Deu para notar um pouco. Tem espaço para melhorar ali."],
      ["Kate", "Anything else?", "Mais alguma coisa?"],
      ["Bruno", "Have you considered opening with the conclusion? That said, overall it's solid.", "Você considerou abrir com a conclusão? Dito isso, no geral está sólido."],
      ["Kate", "Thanks for the feedback. I'll take that on board.", "Obrigada pelo feedback. Vou levar isso em conta."],
    ],
    why: {
      title: "O sanduíche existe, e não é frescura",
      body:
        "Feedback em inglês corporativo tem uma forma quase ritual: **elogio → crítica → contexto positivo**.\n\n*I really liked the opening* → *One thing I'd suggest is* → *That said, overall it's solid*.\n\nBrasileiro costuma achar isso rodeio. Não é: numa cultura em que crítica direta é lida como ataque pessoal, o sanduíche é o que **permite** a crítica existir.\n\nE repare na forma da crítica: nunca *this is wrong*, sempre *one thing I'd suggest* ou *there's room for improvement*. A crítica vira sugestão, e sugestão a pessoa aceita.",
    },
    swaps: ["cutting the second chart", "slowing down at the start", "adding an example", "opening with the conclusion", "shortening the middle", "making the ask clearer", "using fewer slides", "practicing the ending"],
    expansion: [
      ["I really liked the opening. One thing I'd suggest is cutting the second chart.", "Eu gostei muito da abertura. Uma coisa que eu sugeriria é cortar o segundo gráfico."],
      ["There's room for improvement in the ending, but that said, overall it's solid.", "Tem espaço para melhorar no final, mas dito isso, no geral está sólido."],
      ["Have you considered opening with the conclusion? It might land better.", "Você considerou abrir com a conclusão? Pode funcionar melhor."],
      ["Thanks for the feedback. I'll take that on board and send a new version.", "Obrigado pelo feedback. Vou levar em conta e mandar uma nova versão."],
    ],
    drift: [
      "O feedback mais útil que você já recebeu",
      "Se você prefere crítica direta ou embrulhada",
      "Como se dá feedback na cultura brasileira",
      "Uma crítica que te machucou e estava certa",
    ],
    sounds: [
      ["'That said' com T mudo", "'Dhat sed': o T final quase some antes do S. Marcador de transição, dito rápido."],
      ["'I'd suggest' com o D grudado", "'Aid sagJEST'. O acento vai na segunda sílaba de 'suggest' e o G soa como J."],
    ],
    quiz: [
      ["Qual a estrutura do feedback em inglês corporativo?", ["Só crítica", "Elogio, crítica, contexto positivo", "Só elogio", "Crítica e elogio"], 1, "O sanduíche não é rodeio: é o que permite a crítica existir numa cultura que lê franqueza como ataque."],
      ["'One thing I'd suggest is ___' é preferível a 'This is wrong' porque:", ["É mais longo", "Transforma crítica em sugestão, que a pessoa aceita", "É mais formal", "É mais vago"], 1, "Sugestão é aceitável; veredicto gera defensiva. A informação é a mesma, o resultado não."],
      ["'There's room for improvement' significa:", ["Está ótimo", "Dá para melhorar", "Está péssimo", "Falta espaço"], 1, "É a crítica mais suave que existe em inglês corporativo. Todo mundo entende o recado."],
      ["'I'll take that on board' quer dizer:", ["Vou embarcar", "Vou levar em consideração", "Vou ignorar", "Vou anotar literalmente"], 1, "Vem da náutica: trazer para dentro do barco. Significa aceitar e incorporar o feedback."],
    ],
  },

  // ======================================================== 47
  {
    n: 47,
    immersion: [
      ["Mike", "The server crashed again.", "O servidor caiu de novo."],
      ["Ana", "Oh, great. Just what I needed.", "Ah, ótimo. Justo o que eu precisava."],
      ["Mike", "And the backup didn't run.", "E o backup não rodou."],
      ["Ana", "You're kidding me!", "Você está de brincadeira!"],
      ["Mike", "I'm just messing with you. The backup is fine.", "Estou só zoando com você. O backup está bem."],
      ["Ana", "Very funny.", "Muito engraçado."],
      ["Mike", "Sorry. But the server really did crash.", "Desculpa. Mas o servidor caiu mesmo."],
      ["Ana", "That's rough. Okay, let's fix it.", "Isso é duro. Ok, vamos consertar."],
      ["Mike", "Fair point. I'll start the restore.", "Ponto justo. Vou começar a restauração."],
    ],
    listening: [
      ["Kate", "Guess who's presenting on Monday.", "Adivinha quem vai apresentar na segunda."],
      ["Bruno", "No way!", "Sem chance!"],
      ["Kate", "Yes way. You.", "Chance sim. Você."],
      ["Bruno", "Oh, great. Just what I needed on a Monday.", "Ah, ótimo. Justo o que eu precisava numa segunda."],
      ["Kate", "You're gonna do fine.", "Você vai se sair bem."],
      ["Bruno", "You're kidding me. I have three days.", "Você está de brincadeira. Eu tenho três dias."],
      ["Kate", "I'm just messing with you. It's the following Monday.", "Estou só zoando com você. É na segunda seguinte."],
      ["Bruno", "Very funny. That's still rough, though.", "Muito engraçado. Mesmo assim é duro."],
      ["Kate", "Fair point. Want help?", "Ponto justo. Quer ajuda?"],
    ],
    why: {
      title: "Ironia em inglês mora no tom, não na palavra",
      body:
        "*Oh, great* dito para cima significa 'que ótimo'. *Oh, great* dito para baixo e devagar significa exatamente o contrário.\n\nA palavra é idêntica; o que muda é a **melodia**. Por isso ironia é a última coisa que estrangeiro pega: e a primeira que gera mal-entendido.\n\nDois marcadores que ajudam:\n\n**Alongamento**: a vogal se estica: *Oooh, greeeat*.\n**Queda**: a entonação desce no fim, quando o entusiasmo real subiria.\n\nSe você não tiver certeza se foi ironia, *Wait, are you serious?* resolve sem constrangimento nenhum.",
    },
    swaps: ["Oh, great.", "You're kidding me!", "No way!", "I'm just messing with you.", "Very funny.", "That's rough.", "Fair point.", "Yeah, right."],
    expansion: [
      ["Oh, great. Just what I needed on a Monday morning.", "Ah, ótimo. Justo o que eu precisava numa segunda de manhã."],
      ["You're kidding me! Please tell me you're just messing with me.", "Você está de brincadeira! Por favor me diz que você está só zoando."],
      ["Very funny. That's rough though, seriously.", "Muito engraçado. Mas é duro, sério."],
      ["Fair point. I hadn't looked at it that way.", "Ponto justo. Eu não tinha olhado por esse ângulo."],
    ],
    drift: [
      "Se o humor brasileiro viaja bem para o inglês",
      "Uma piada que você não entendeu numa série",
      "Se você é sarcástico em português",
      "Uma vez em que você levou ironia a sério",
    ],
    sounds: [
      ["A vogal esticada da ironia", "'Ooooh, greeeat'. Quanto mais estica, mais irônico. Grave as duas versões e ouça a diferença."],
      ["Entonação que desce", "Entusiasmo real sobe no fim. Ironia desce. É o sinal mais confiável: treine o ouvido nele."],
    ],
    quiz: [
      ["Como se identifica ironia em inglês?", ["Pelas palavras usadas", "Pelo tom: vogal esticada e entonação que desce", "Pelo contexto apenas", "Pela pontuação"], 1, "As palavras são idênticas. Só a melodia muda: e é por isso que é o último recurso que estrangeiro domina."],
      ["'I'm just messing with you' significa:", ["Estou atrapalhando você", "Estou só brincando", "Estou bravo", "Estou confuso"], 1, "É o desmentido da brincadeira. Quando alguém diz isso, a informação anterior era falsa."],
      ["'That's rough' expressa:", ["Está áspero", "Empatia com uma situação ruim", "Discordância", "Sarcasmo"], 1, "É solidariedade informal. Curto, sincero e muito usado entre colegas."],
      ["Se você não tem certeza se foi ironia, o melhor é:", ["Rir junto", "Perguntar: Wait, are you serious?", "Ignorar", "Mudar de assunto"], 1, "Perguntar é totalmente normal e evita mal-entendido. Nativo também pergunta."],
    ],
  },

  // ======================================================== 48
  {
    n: 48,
    immersion: [
      ["Kate", "So we ended up driving the whole way.", "Aí a gente acabou dirigindo o caminho todo."],
      ["Ana", "That reminds me of something. Did I tell you about the flat tire?", "Isso me lembra de uma coisa. Eu te contei do pneu furado?"],
      ["Kate", "No! How did that go?", "Não! Como foi isso?"],
      ["Ana", "Terrible. Speaking of which, do you still have that toolkit?", "Terrível. Falando nisso, você ainda tem aquele kit de ferramentas?"],
      ["Kate", "Somewhere. Let me think for a second.", "Em algum lugar. Deixa eu pensar um segundo."],
      ["Ana", "No rush.", "Sem pressa."],
      ["Kate", "Garage, probably. Anyway, what were you saying?", "Garagem, provavelmente. Enfim, o que você estava dizendo?"],
      ["Ana", "The tire. By the way, did you hear about Mike's new job?", "O pneu. Aliás, você soube do emprego novo do Mike?"],
      ["Kate", "No! It's been great talking to you, but tell me that first.", "Não! Foi ótimo conversar com você, mas me conta isso primeiro."],
    ],
    listening: [
      ["Mike", "The whole team is remote now.", "A equipe inteira é remota agora."],
      ["Bruno", "That reminds me of something. How did the office move go?", "Isso me lembra de uma coisa. Como foi a mudança do escritório?"],
      ["Mike", "Messy. Speaking of which, we still have your monitor.", "Bagunçada. Falando nisso, a gente ainda tem seu monitor."],
      ["Bruno", "Keep it. Let me think for a second, was it the big one?", "Fica com ele. Deixa eu pensar um segundo, era o grande?"],
      ["Mike", "The big one.", "O grande."],
      ["Bruno", "Then definitely keep it. Anyway, what were you saying about remote?", "Então fica com ele com certeza. Enfim, o que você estava dizendo sobre remoto?"],
      ["Mike", "Everyone's happier. By the way, did you hear about the merger?", "Todo mundo está mais feliz. Aliás, você soube da fusão?"],
      ["Bruno", "No! Tell me everything.", "Não! Me conta tudo."],
      ["Mike", "It's been great talking to you. Let's do this more often.", "Foi ótimo conversar com você. Vamos fazer isso mais vezes."],
    ],
    why: {
      title: "Conversa longa é gerenciamento de turno",
      body:
        "Conversa de trinta minutos não é conversa de dois minutos quinze vezes. Ela exige **manobras de turno**: blocos cujo único trabalho é mover a conversa.\n\n*That reminds me of...*: puxa um assunto novo a partir do que foi dito\n*Speaking of which...*: emenda por associação\n*Anyway, what were you saying?*: devolve a palavra depois de um desvio\n*Let me think for a second*: compra tempo sem silêncio constrangedor\n*By the way...*: insere algo fora do fio\n\nEsse último bloco é o mais valioso do circuito: **comprar tempo em inglês, em inglês**. Quem fica em silêncio pensando parece travado. Quem diz *let me think for a second* parece reflexivo.",
    },
    swaps: ["That reminds me of something.", "Speaking of which...", "Anyway, what were you saying?", "Let me think for a second.", "By the way...", "How did that go?", "It's been great talking to you.", "Where were we?"],
    expansion: [
      ["That reminds me of something. Speaking of which, did you hear about Mike?", "Isso me lembra de uma coisa. Falando nisso, você soube do Mike?"],
      ["Let me think for a second. Anyway, what were you saying before?", "Deixa eu pensar um segundo. Enfim, o que você estava dizendo antes?"],
      ["By the way, how did the interview go? You never told me.", "Aliás, como foi a entrevista? Você nunca me contou."],
      ["It's been great talking to you. Let's do this more often.", "Foi ótimo conversar com você. Vamos fazer isso mais vezes."],
    ],
    drift: [
      "A conversa mais longa que você já teve",
      "Se você é bom em manter conversa com desconhecido",
      "Alguém com quem você conversa por horas",
      "O que você faz quando o assunto acaba",
    ],
    sounds: [
      ["'Speaking of which' emendado", "'spikingofwich'. Marcador de transição, dito rápido, quase engolido. Se sair devagar, chama atenção demais para si."],
      ["'Let me' vira 'lemme'", "Mesmo em conversa neutra. 'Lemme think for a second': e essa frase é o seu botão de pausa em inglês."],
    ],
    quiz: [
      ["Para que serve 'Let me think for a second'?", ["Encerrar a conversa", "Comprar tempo sem silêncio constrangedor", "Discordar", "Mudar de assunto"], 1, "Silêncio parece travamento; a frase parece reflexão. Mesmo tempo, impressão oposta."],
      ["'Speaking of which' faz o quê?", ["Muda de assunto do nada", "Emenda um assunto novo por associação", "Encerra", "Repete"], 1, "Conecta com o que acabou de ser dito. É o que faz a conversa fluir em vez de saltar."],
      ["'Anyway, what were you saying?' serve para:", ["Encerrar", "Devolver a palavra depois de um desvio", "Discordar", "Pedir para repetir"], 1, "É educação conversacional: reconhece que você desviou e devolve o turno."],
      ["Conversa longa exige principalmente:", ["Vocabulário amplo", "Blocos de gerenciamento de turno", "Gramática perfeita", "Sotaque bom"], 1, "Conversa não morre por falta de palavra. Morre por falta de manobra de turno."],
    ],
  },

  // ======================================================== 49
  {
    n: 49,
    immersion: [
      ["Ana", "Okay. What am I doing right now?", "Ok. O que eu estou fazendo agora?"],
      ["Ana", "I need to remember to call the dentist.", "Eu preciso lembrar de ligar para o dentista."],
      ["Ana", "Where did I put my keys?", "Onde eu coloquei minhas chaves?"],
      ["Ana", "That doesn't make sense. I had them in the car.", "Isso não faz sentido. Eu estava com elas no carro."],
      ["Ana", "Let me try that again.", "Deixa eu tentar de novo."],
      ["Ana", "Jacket. Right pocket. Almost there.", "Jaqueta. Bolso direito. Quase lá."],
      ["Ana", "There they are. I've got this.", "Estão aí. Eu dou conta."],
      ["Ana", "Okay, what's next?", "Ok, o que vem agora?"],
    ],
    listening: [
      ["Bruno", "Alright, what am I doing right now?", "Certo, o que eu estou fazendo agora?"],
      ["Bruno", "Email first. No, wait. That doesn't make sense.", "E-mail primeiro. Não, espera. Isso não faz sentido."],
      ["Bruno", "I need to remember to send the file before the call.", "Eu preciso lembrar de mandar o arquivo antes da call."],
      ["Bruno", "Where did I save it? Let me try that again.", "Onde eu salvei? Deixa eu tentar de novo."],
      ["Bruno", "Downloads. Of course it's in Downloads.", "Downloads. Claro que está em Downloads."],
      ["Bruno", "Almost there. Two more things.", "Quase lá. Mais duas coisas."],
      ["Bruno", "Okay. I've got this.", "Ok. Eu dou conta."],
      ["Bruno", "Twenty minutes to go.", "Vinte minutos para o fim."],
    ],
    why: {
      title: "O último passo é parar de traduzir",
      body:
        "Enquanto você monta a frase em português e traduz, sua velocidade máxima é a velocidade da tradução: sempre metade da velocidade da conversa.\n\nO único jeito de sair disso é **usar inglês quando ninguém está ouvindo**. Narrar o que você está fazendo, em voz alta ou na cabeça, com o vocabulário simples que você já tem.\n\nParece bobagem e é o exercício mais eficaz do curso inteiro, por dois motivos: é o único que você pode fazer o dia todo, sem parceiro e sem material; e ele treina exatamente a operação que trava você na conversa real: produzir sem tempo de preparo.\n\nDez minutos por dia mudam mais que uma hora de exercício escrito.",
    },
    swaps: ["What am I doing right now?", "I need to remember to ___.", "Where did I put my ___?", "That doesn't make sense.", "Let me try that again.", "Almost there.", "I've got this.", "What's next?"],
    expansion: [
      ["What am I doing right now? I need to remember to call the dentist.", "O que eu estou fazendo agora? Preciso lembrar de ligar para o dentista."],
      ["Where did I put my keys? That doesn't make sense, I had them in the car.", "Onde eu coloquei minhas chaves? Isso não faz sentido, eu estava com elas no carro."],
      ["Let me try that again. Almost there, two more things and I'm done.", "Deixa eu tentar de novo. Quase lá, mais duas coisas e eu termino."],
      ["Okay, I've got this. What's next on the list?", "Ok, eu dou conta. O que vem agora na lista?"],
    ],
    drift: [
      "Se você já se pegou pensando em inglês",
      "Em que momento do dia você poderia narrar em inglês",
      "Se você sonha em outra língua",
      "O que muda quando você para de traduzir",
    ],
    sounds: [
      ["Narração é o laboratório sem plateia", "Você pode errar tudo e ninguém ouve. É onde a boca ganha quilometragem sem custo social."],
      ["'I've got this' vira 'aivgotthis'", "Dito rápido, quase uma palavra. É o que americano diz para si mesmo antes de algo difícil."],
    ],
    quiz: [
      ["Por que narrar em inglês funciona tão bem?", ["Aumenta vocabulário", "Treina produzir sem tempo de preparo, o que trava na conversa real", "Melhora a escrita", "É divertido"], 1, "É a mesma operação da conversa real: produzir sob pressão de tempo. E dá para treinar o dia inteiro, sozinho."],
      ["'That doesn't make sense' significa:", ["Isso não tem sentido", "Isso não é sensato", "Não sinto isso", "Não faz sentir"], 0, "'Make sense' é colocação fixa, do circuito 41. Em inglês o sentido se FAZ, não se tem."],
      ["'I've got this' quer dizer:", ["Eu peguei isso", "Eu dou conta", "Eu tenho isso aqui", "Eu entendi"], 1, "É autoencorajamento. Muito usado antes de algo difícil: e útil em voz alta para si mesmo."],
      ["Quanto tempo de narração interna vale a pena?", ["Uma hora por dia", "Dez minutos por dia", "Só nos fins de semana", "Não vale a pena"], 1, "Dez minutos consistentes rendem mais que uma hora esporádica. E cabem em qualquer rotina."],
    ],
  },

  // ======================================================== 50
  {
    n: 50,
    immersion: [
      ["Priya", "Sorry, could you repeat that? The line is not good.", "Desculpa, pode repetir? A linha não está boa."],
      ["Ana", "Of course. Where are you from originally?", "Claro. De onde você é originalmente?"],
      ["Priya", "Mumbai. And yourself?", "Mumbai. E você?"],
      ["Ana", "Brazil. I love your accent!", "Brasil. Eu adoro seu sotaque!"],
      ["Priya", "Thank you! Yours too. Bear with me, my English is still improving.", "Obrigada! O seu também. Tenha paciência comigo, meu inglês ainda está melhorando."],
      ["Ana", "Same here. Bear with me, I'm still learning.", "Igual. Tenha paciência comigo, ainda estou aprendendo."],
      ["Priya", "We will manage. Did I get that right, the deadline is Thursday?", "A gente se vira. Eu entendi certo, o prazo é quinta?"],
      ["Ana", "Thursday, yes. That's a new one for me, that expression you used.", "Quinta, sim. Essa é nova para mim, aquela expressão que você usou."],
    ],
    listening: [
      ["Liam", "Right, so we'll sort it out by Friday, yeah?", "Certo, então a gente resolve isso até sexta, né?"],
      ["Bruno", "Sorry, could you repeat that? I'm not familiar with that expression.", "Desculpa, pode repetir? Eu não conheço essa expressão."],
      ["Liam", "Sort it out. Means fix it, resolve it.", "Sort it out. Significa consertar, resolver."],
      ["Bruno", "Ah, got it. That's a new one for me.", "Ah, entendi. Essa é nova para mim."],
      ["Liam", "Where are you from originally?", "De onde você é originalmente?"],
      ["Bruno", "Brazil. You're not American, are you?", "Brasil. Você não é americano, é?"],
      ["Liam", "Scottish. I get that a lot.", "Escocês. Ouço isso bastante."],
      ["Bruno", "I love your accent! Bear with me though, I'm still learning.", "Eu adoro seu sotaque! Mas tenha paciência comigo, ainda estou aprendendo."],
      ["Liam", "You're doing grand. Did I get that right, Friday works?", "Você está indo muito bem. Eu entendi certo, sexta funciona?"],
    ],
    why: {
      title: "A maioria de quem fala inglês não é nativo",
      body:
        "Cerca de **três em cada quatro** conversas em inglês no mundo acontecem entre pessoas que não têm o inglês como língua materna. Indiano com alemão, brasileiro com japonês, escocês com nigeriano.\n\nDuas consequências práticas:\n\n**1.** Seu sotaque brasileiro não é um defeito a eliminar. Sotaque é normal: o que importa é ser **inteligível**, não soar americano. Quase ninguém soa.\n\n**2.** Você precisa treinar o ouvido em mais de um sotaque. Curso que só usa voz americana limpa produz aluno que trava com um indiano no telefone: e no trabalho real, o indiano no telefone é mais frequente que o americano.",
    },
    swaps: ["Sorry, could you repeat that?", "Where are you from originally?", "I love your accent!", "Bear with me, I'm still learning.", "Did I get that right?", "I'm not familiar with that expression.", "That's a new one for me!", "How do you say that where you're from?"],
    expansion: [
      ["Sorry, could you repeat that? I'm not familiar with that expression.", "Desculpa, pode repetir? Eu não conheço essa expressão."],
      ["Where are you from originally? I love your accent, honestly.", "De onde você é originalmente? Eu adoro seu sotaque, sinceramente."],
      ["Bear with me, I'm still learning. Did I get that right?", "Tenha paciência comigo, ainda estou aprendendo. Eu entendi certo?"],
      ["That's a new one for me. How do you say that where you're from?", "Essa é nova para mim. Como vocês dizem isso de onde você é?"],
    ],
    drift: [
      "O sotaque mais difícil que você já enfrentou",
      "Se você tem vergonha do seu sotaque",
      "Uma palavra que muda de significado entre países",
      "Como é conversar em inglês com outro brasileiro",
    ],
    sounds: [
      ["Inteligibilidade vence imitação", "O objetivo não é soar americano. É ser entendido de primeira. Grave-se e pergunte: dá para entender sem esforço?"],
      ["Sotaques mudam vogais, não consoantes", "Britânico, australiano e indiano mudam principalmente as vogais. Se você ancorar nas consoantes, acompanha qualquer um."],
    ],
    quiz: [
      ["Que proporção das conversas em inglês no mundo é entre não nativos?", ["Cerca de um quarto", "Cerca de metade", "Cerca de três quartos", "Quase nenhuma"], 2, "A maioria esmagadora. Por isso treinar só com voz americana limpa é uma preparação incompleta."],
      ["Qual deve ser o objetivo do seu sotaque?", ["Soar americano", "Ser inteligível", "Eliminar o sotaque brasileiro", "Imitar a rainha"], 1, "Inteligibilidade é o critério. Sotaque é identidade, não defeito: e praticamente ninguém elimina o seu."],
      ["'Bear with me' significa:", ["Fique comigo", "Tenha paciência comigo", "Aguente firme", "Venha comigo"], 1, "É pedir paciência enquanto você resolve ou se explica. Nada a ver com urso."],
      ["'Did I get that right?' serve para:", ["Pedir para repetir", "Confirmar se entendeu corretamente", "Discordar", "Pedir desculpa"], 1, "Confirma o entendimento em vez de assumir. Numa conversa multissotaque, é a frase que evita erro caro."],
    ],
  },

  // ======================================================== 51
  {
    n: 51,
    immersion: [
      ["Ana", "Hi, I have a reservation under Silva. Can I have a table by the window, please?", "Oi, tenho uma reserva no nome de Silva. Pode ser uma mesa na janela, por favor?"],
      ["Host", "Of course. How was your weekend, by the way? You look rested.", "Claro. Como foi seu fim de semana, aliás? Você parece descansada."],
      ["Ana", "It was great! I'm going to take next Friday off too.", "Foi ótimo! Eu vou tirar a próxima sexta de folga também."],
      ["Host", "Smart. Everyone's exhausted lately.", "Inteligente. Todo mundo está exausto ultimamente."],
      ["Ana", "I see your point, but I think it's more about the schedule than the workload.", "Eu entendo seu ponto, mas acho que é mais sobre a agenda do que sobre a carga."],
      ["Host", "Fair enough. Oh, I'm afraid there's been a mistake with your reservation.", "Justo. Ah, receio que houve um engano com sua reserva."],
      ["Ana", "No problem. What can we do about it?", "Sem problema. O que a gente pode fazer sobre isso?"],
      ["Host", "If I were you, I'd take the patio. Better view anyway.", "Se eu fosse você, eu pegaria a varanda. Vista melhor de qualquer jeito."],
      ["Ana", "Let me walk you through what I actually need, and we'll figure it out.", "Deixa eu te explicar o que eu realmente preciso, e a gente resolve."],
    ],
    listening: [
      ["Kate", "Bruno! How's it going? Long time.", "Bruno! Como vai? Quanto tempo."],
      ["Bruno", "Good! I ran into your brother last week, speaking of which.", "Bem! Eu esbarrei no seu irmão semana passada, falando nisso."],
      ["Kate", "No way! Where?", "Sem chance! Onde?"],
      ["Bruno", "At the airport. I'd missed my connection and he was gonna board.", "No aeroporto. Eu tinha perdido minha conexão e ele ia embarcar."],
      ["Kate", "That's rough. Did you make it?", "Isso é duro. Você conseguiu chegar?"],
      ["Bruno", "Eventually. I should have booked the earlier flight, honestly.", "Eventualmente. Eu deveria ter reservado o voo mais cedo, sinceramente."],
      ["Kate", "Live and learn. Anyway, what were you saying?", "Vivendo e aprendendo. Enfim, o que você estava dizendo?"],
      ["Bruno", "Just that we should catch up properly. It's been great talking to you.", "Só que a gente devia colocar o papo em dia de verdade. Foi ótimo falar com você."],
      ["Kate", "Let's do it. I'm looking forward to it.", "Vamos fazer isso. Estou ansiosa."],
    ],
    why: {
      title: "Nenhum bloco novo. Todos os anteriores, juntos",
      body:
        "Leia os dois diálogos de novo e conte: há blocos de pelo menos oito circuitos diferentes em cada um, misturados sem aviso.\n\nÉ assim que conversa real funciona. Ela não respeita a ordem do currículo, não avisa qual situação está usando e não espera você lembrar.\n\nSe você acompanhou os dois diálogos sem parar para traduzir, isso não é sinal de que você é bom em exercício. É sinal de que os blocos **saíram do curso e entraram em você**.",
    },
    swaps: ["Can I have ___, please?", "How was your weekend?", "I'm going to ___.", "I see your point, but ___.", "I'm afraid there's been a mistake.", "If I were you, I'd ___.", "Let me walk you through ___.", "It's been great talking to you."],
    expansion: [
      ["How was your weekend? I'm going to take Friday off, so mine starts early.", "Como foi seu fim de semana? Eu vou tirar sexta de folga, então o meu começa cedo."],
      ["I see your point, but I'm afraid there's been a mistake with the numbers.", "Eu entendo seu ponto, mas receio que houve um engano nos números."],
      ["If I were you, I'd ask first. Let me walk you through what I'd say.", "Se eu fosse você, eu perguntaria primeiro. Deixa eu te explicar o que eu diria."],
      ["I ran into your brother, speaking of which, we should catch up soon.", "Eu esbarrei no seu irmão, falando nisso, a gente devia colocar o papo em dia."],
    ],
    drift: [
      "O que você consegue fazer hoje que não conseguia há um ano",
      "A conversa em inglês de que você mais se orgulha",
      "O que ainda te dá insegurança",
      "Para quem você quer contar que fala inglês",
    ],
    sounds: [
      ["Revisão geral: palavras grudadas", "Grave-se lendo um dos diálogos deste circuito e conte quantas palavras você ainda separa. Esse é seu placar."],
      ["Revisão geral: TH, R, -ING e vogais curtas", "Os quatro sons que o português não tem. Se algum ainda escapa, é aqui que vale insistir mais um mês."],
    ],
    quiz: [
      ["O que os diálogos deste circuito têm de diferente?", ["Vocabulário novo", "Blocos de muitos circuitos misturados sem ordem", "Gramática avançada", "Sotaques diferentes"], 1, "É como conversa real funciona: não respeita a ordem do currículo nem avisa qual situação está usando."],
      ["Se você acompanhou sem traduzir, isso significa:", ["Que você é bom em exercício", "Que os blocos saíram do curso e entraram em você", "Que os diálogos eram fáceis", "Nada em especial"], 1, "Reconhecer fora de contexto, sem aviso, é o teste real. É diferente de acertar um exercício sobre o circuito da semana."],
      ["Qual bloco você usaria numa reunião difícil?", ["How was your weekend?", "I see your point, but ___", "Can I have ___, please?", "I love cooking"], 1, "Discordar com almofada é o bloco de maior retorno no ambiente profissional."],
      ["O que falta agora?", ["Aprender mais blocos", "Usar os que você tem, em condições reais e imprevisíveis", "Estudar gramática", "Melhorar o sotaque"], 1, "Você tem material suficiente para conversar. O que falta é quilometragem em condição real: e isso não se estuda, se faz."],
    ],
  },

  // ======================================================== 52
  {
    n: 52,
    immersion: [
      ["Kate", "So, how long have you been studying English?", "Então, faz quanto tempo que você estuda inglês?"],
      ["Ana", "I've been learning English for a year now.", "Eu estou aprendendo inglês há um ano agora."],
      ["Kate", "Seriously? You sound really comfortable.", "Sério? Você parece muito à vontade."],
      ["Ana", "Thanks. It's changed a lot for me.", "Obrigada. Mudou muita coisa para mim."],
      ["Kate", "In what way?", "De que forma?"],
      ["Ana", "I can hold a conversation now. A year ago I froze at 'hello'.", "Eu consigo manter uma conversa agora. Um ano atrás eu travava no 'hello'."],
      ["Kate", "That's a huge change.", "Isso é uma mudança enorme."],
      ["Ana", "I still make mistakes, but I keep going. I'm proud of how far I've come.", "Eu ainda cometo erros, mas eu sigo em frente. Tenho orgulho do quanto eu avancei."],
      ["Kate", "You should be. What's next?", "Você deveria ter. O que vem agora?"],
      ["Ana", "What's next for me is working in English full time. This is just the beginning.", "O que vem agora para mim é trabalhar em inglês em tempo integral. Isso é só o começo."],
    ],
    listening: [
      ["Mike", "Remember when you couldn't order coffee?", "Lembra quando você não conseguia pedir um café?"],
      ["Bruno", "Don't remind me. I've been learning English for a year now.", "Não me lembre. Eu estou aprendendo inglês há um ano agora."],
      ["Mike", "And now you're running meetings.", "E agora você conduz reuniões."],
      ["Bruno", "It's changed a lot for me, honestly. Not just at work.", "Mudou muita coisa para mim, sinceramente. Não só no trabalho."],
      ["Mike", "How so?", "Como assim?"],
      ["Bruno", "I watch things without subtitles. I can hold a conversation now.", "Eu assisto coisas sem legenda. Eu consigo manter uma conversa agora."],
      ["Mike", "Do you still get nervous?", "Você ainda fica nervoso?"],
      ["Bruno", "All the time. I still make mistakes, but I keep going.", "O tempo todo. Eu ainda cometo erros, mas sigo em frente."],
      ["Mike", "That's the whole trick, isn't it?", "É esse o truque todo, né?"],
      ["Bruno", "I'm proud of how far I've come. And this is just the beginning.", "Tenho orgulho do quanto eu avancei. E isso é só o começo."],
    ],
    why: {
      title: "O que muda depois do último circuito",
      body:
        "Nada, e tudo.\n\nNada porque não existe dia da formatura em idioma. Ninguém acorda fluente. Você vai continuar errando preposição, esquecendo o S da terceira pessoa e perdendo palavra em conversa rápida: nativo também perde.\n\nTudo porque a natureza do seu estudo muda. Até aqui você **construiu** a capacidade de conversar. Daqui em diante você a **usa**, e ela cresce sozinha: cada série, cada reunião, cada conversa vira aula sem esforço deliberado.\n\nÉ por isso que o último bloco do curso é *This is just the beginning*. Não é frase motivacional: é a descrição literal do que acontece agora.",
    },
    swaps: ["I've been learning English for a year now.", "It's changed a lot for me.", "I still make mistakes, but I keep going.", "I can hold a conversation now.", "What's next for me is ___.", "I'm proud of how far I've come.", "This is just the beginning.", "A year ago I couldn't do this."],
    expansion: [
      ["I've been learning English for a year now, and it's changed a lot for me.", "Eu estou aprendendo inglês há um ano agora, e mudou muita coisa para mim."],
      ["I still make mistakes, but I keep going, and I can hold a conversation now.", "Eu ainda cometo erros, mas sigo em frente, e consigo manter uma conversa agora."],
      ["I'm proud of how far I've come, though this is just the beginning.", "Tenho orgulho do quanto avancei, embora isso seja só o começo."],
      ["What's next for me is using it every day, without thinking about it as studying.", "O que vem agora para mim é usar todo dia, sem pensar nisso como estudo."],
    ],
    drift: [
      "Como você era no dia 1 deste curso",
      "A primeira conversa real que você teve em inglês",
      "O que você diria para quem está começando agora",
      "Onde você quer estar daqui a um ano",
    ],
    sounds: [
      ["Grave o dia 1 e o dia 728 juntos", "Se você gravou o áudio do primeiro circuito, ouça os dois em sequência. É a prova mais concreta que existe do quanto mudou."],
      ["O sotaque que sobrou é seu", "Depois de 728 dias, o que restou de sotaque não é falha. É a sua voz em inglês: e ela é inteligível, que era o objetivo."],
    ],
    quiz: [
      ["'I've been learning English for a year' enfatiza:", ["Que terminou", "Que começou há um ano e continua", "Que vai começar", "Que aprendeu num ano"], 1, "É a construção de ação contínua até agora. Perfeita para falar de aprendizado, que nunca termina."],
      ["Existe um ponto em que se 'termina' de aprender um idioma?", ["Sim, o nível C2", "Não, mas a natureza do estudo muda", "Sim, depois de dois anos", "Sim, quando não erra mais"], 1, "Você para de construir e passa a usar. A partir daí cresce sozinho, sem estudo deliberado."],
      ["'I still make mistakes, but I keep going' descreve:", ["Um fracasso", "A atitude que sustenta o progresso", "Falta de método", "Impaciência"], 1, "Quem para para consertar cada erro fala menos e melhora menos. Seguir errando em voz alta é o que funciona."],
      ["Depois do circuito 52, o que mais faz diferença?", ["Refazer o curso", "Usar inglês em situações reais, imprevisíveis", "Estudar gramática avançada", "Decorar mais vocabulário"], 1, "Você tem material suficiente. O que falta não se estuda: se vive."],
    ],
  },
];
