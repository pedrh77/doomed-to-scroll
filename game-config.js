"use strict";

(function exposeConfig(global) {
  const POST_ROOT = "assets/posts/";

  const POST_ASSETS = [
    "7DFA842D-9DC6-4AA9-8D78-4C0B80CB8080.jpeg",
    "A5D7A056-C94C-4E13-8C57-E4059E2CA19C.jpeg",
    "Ampulheta.png",
    "Aranha.png",
    "Baú Mimético Sob o Luar.png",
    "Bolo Pixelado sob a Lua Crescente.png",
    "Bruxa Monstro no Pântano Neon.png",
    "C436C6FB-1867-4F1B-BA4C-07307B1AD882.jpeg",
    "Capa da Invisibilidade.png",
    "Carregador Mágico sob a Lua.png",
    "Clareira Encantada dos Cogumelos Luminosos.png",
    "Coração Mágico +1 no Calabouço.png",
    "Corgi mágico sob a lua encantada.png",
    "Dragãozinho Pixel e Tesouro Luminoso.png",
    "Espada Encantada nas Ruínas Lunares.png",
    "Esqueleto espectral no cemitério neon.png",
    "Gato mágico sob a lua crescente.png",
    "Ladino Élfico sob a Lua Cheia.png",
    "Mercador.png",
    "Mochila Mágica sob a Lua Cheia.png",
    "Ovo Mágico Neon na Noite Pixelada.png",
    "Pacote de moedas.png",
    "Poção Amarela.png",
    "Poção Cósmica na Oficina Encantada.png",
    "Poção Cósmica no Altar Arcano.png",
    "Poção vermelha.png",
    "Portal Místico nas Ruínas Lunares.png",
    "Tesouro Encantado sob a Lua Crescente.png",
    "Vela.png"
  ];

  const RARITY_CONFIG = Object.freeze({
    COMMON: { chance: 55, rewardMultiplier: 1, difficultyMultiplier: 1 },
    UNCOMMON: { chance: 25, rewardMultiplier: 1.2, difficultyMultiplier: 1.08 },
    RARE: { chance: 12, rewardMultiplier: 1.55, difficultyMultiplier: 1.18 },
    EPIC: { chance: 6, rewardMultiplier: 2.1, difficultyMultiplier: 1.3 },
    LEGENDARY: { chance: 2, rewardMultiplier: 3, difficultyMultiplier: 1.45 }
  });

  const TYPE_RARITIES = Object.freeze({
    NORMAL: ["COMMON", "UNCOMMON"],
    LIFE: ["UNCOMMON", "RARE"],
    ENERGY: ["COMMON", "UNCOMMON"],
    ITEM: ["UNCOMMON", "RARE", "EPIC"],
    CHEST: ["RARE", "EPIC"],
    ENEMY: ["COMMON", "UNCOMMON", "RARE"],
    RISK: ["UNCOMMON", "RARE", "EPIC"],
    MYSTERY: ["RARE", "EPIC"],
    EVOLUTION: ["RARE", "EPIC", "LEGENDARY"]
  });

  const CARD_CONFIG = {
    "7DFA842D-9DC6-4AA9-8D78-4C0B80CB8080.jpeg": {
      id: "neon-slime", title: "Slime faminto", description: "Ele percebeu que você parou para olhar.", type: "ENEMY", rarity: "COMMON", weight: 10, energyCost: 1,
      interaction: { type: "TAP_CHALLENGE", duration: 7, target: 15, errorEnergy: 0.5, help: "Toque apenas no slime. Cada erro fora do alvo rouba 0,5 Energia." }, success: { coins: 18, message: "+18 MOEDAS" }, failure: { health: -1, future: { statuses: { hunger: 5 } }, message: "O slime despertou sua Fome. -1 VIDA" }
    },
    "A5D7A056-C94C-4E13-8C57-E4059E2CA19C.jpeg": {
      id: "lost-ghost", title: "Fantasma perdido", description: "Ele repete seus movimentos no escuro.", type: "ENEMY", rarity: "UNCOMMON", weight: 8, energyCost: 2,
      interaction: { type: "SEQUENCE", duration: 11, preview: 2400, length: 6, echoPrevious: true, help: "O fantasma copia cada direção. Memorize os pares repetidos." }, success: { coins: 26, message: "+26 MOEDAS" }, failure: { health: -1, message: "O fantasma atravessou você. -1 VIDA" }
    },
    "Gato mágico sob a lua crescente.png": {
      id: "moon-cat", title: "Gatinho da madrugada", description: "Ele já descobriu como descansar.", type: "NORMAL", rarity: "COMMON", weight: 14, energyCost: 0,
      interaction: { type: "INSTANT" }, success: { message: "Ele acordou, piscou e voltou a dormir." }
    },
    "Corgi mágico sob a lua encantada.png": {
      id: "moon-corgi", title: "Corgi encantado", description: "Um raro post genuinamente saudável.", type: "NORMAL", rarity: "COMMON", weight: 12, energyCost: 0,
      interaction: { type: "REACTION", window: 1200 }, success: { coins: 8, message: "+8 MOEDAS" }, failure: { message: "O corgi perdeu o interesse." }
    },
    "Coração Mágico +1 no Calabouço.png": {
      id: "lost-heart", title: "Coração perdido", description: "Ele tenta escapar antes do amanhecer.", type: "LIFE", rarity: "UNCOMMON", weight: 8, energyCost: 1,
      interaction: { type: "TAP_CHALLENGE", duration: 7, target: 16 }, success: { health: 1, message: "+1 VIDA" }, failure: { message: "O coração escapou." }
    },
    "Carregador Mágico sob a Lua.png": {
      id: "moon-charger", title: "Carregador lunar", description: "Segure firme até completar a carga.", type: "ENERGY", rarity: "COMMON", weight: 11, energyCost: 0,
      interaction: { type: "HOLD", duration: 6, target: 3 }, success: { energy: 4, future: { statuses: { adrenaline: 3 } }, message: "+4 ENERGIA · ADRENALINA" }, failure: { message: "A conexão caiu." }
    },
    "Clareira Encantada dos Cogumelos Luminosos.png": {
      id: "mushroom-rest", title: "Clareira silenciosa", description: "Um lugar improvável para respirar.", type: "ENERGY", rarity: "UNCOMMON", weight: 8, energyCost: 0,
      interaction: { type: "TIMING", duration: 8, zoneSize: 0.3 }, success: { energy: 3, message: "+3 ENERGIA" }, failure: { message: "Você perdeu o momento." }
    },
    "Baú Mimético Sob o Luar.png": {
      id: "moon-mimic", title: "Baú suspeito", description: "Tem dentes demais para ser decoração.", type: "CHEST", rarity: "RARE", weight: 6, energyCost: 2,
      interaction: { type: "SEQUENCE", duration: 9, preview: 2600, length: 4 }, success: { coins: 28, message: "+28 MOEDAS" }, failure: { health: -1, message: "O mímico mordeu. -1 VIDA" }
    },
    "Tesouro Encantado sob a Lua Crescente.png": {
      id: "enchanted-treasure", title: "Tesouro encantado", description: "A fechadura pulsa no ritmo da tela.", type: "CHEST", rarity: "EPIC", weight: 3, energyCost: 2,
      interaction: { type: "LOCKPICK", duration: 13, rounds: 3 }, success: { coins: 45, message: "+45 MOEDAS" }, failure: { message: "A fechadura se fechou." }
    },
    "Esqueleto espectral no cemitério neon.png": {
      id: "neon-skeleton", title: "Esqueleto espectral", description: "Ele desafia você para um duelo de memória.", type: "ENEMY", rarity: "UNCOMMON", weight: 8, energyCost: 2,
      interaction: { type: "MEMORY_GRID", duration: 11, preview: 2600, length: 4, reviveAfterMs: 4200, help: "Repita as células rápido. O esqueleto revive se você demorar." }, success: { coins: 22, message: "+22 MOEDAS" }, failure: { health: -1, message: "Golpe espectral. -1 VIDA" }
    },
    "Bruxa Monstro no Pântano Neon.png": {
      id: "swamp-witch", title: "Bruxa do pântano", description: "Desvie do feitiço na direção certa.", type: "ENEMY", rarity: "RARE", weight: 5, energyCost: 2,
      interaction: { type: "SWIPE_DIRECTION", duration: 10, rounds: 4, invertControls: true, help: "A bruxa inverte o comando. Sempre deslize na direção oposta." }, success: { coins: 32, message: "+32 MOEDAS" }, failure: { health: -1, future: { statuses: { glitch: 4 } }, message: "A bruxa corrompeu o feed. -1 VIDA" }
    },
    "Dragãozinho Pixel e Tesouro Luminoso.png": {
      id: "treasure-dragon", title: "Dragão guardião", description: "Só reflexos rápidos vencem esta disputa.", type: "ENEMY", rarity: "EPIC", weight: 3, energyCost: 3,
      interaction: { type: "MULTI_STAGE", stages: 3, help: "Vença três fases: toque, direção e ataque no tempo certo." }, success: { coins: 55, message: "+55 MOEDAS" }, failure: { health: -1, energy: -1, message: "Chamas! -1 VIDA" }
    },
    "Espada Encantada nas Ruínas Lunares.png": {
      id: "enchanted-sword", title: "Espada encantada", description: "Toque quando a energia cruzar o núcleo.", type: "ITEM", rarity: "RARE", weight: 6, energyCost: 1,
      interaction: { type: "TRACE", duration: 12 }, success: { coins: 25, item: "espada", message: "ESPADA DESCOBERTA" }, failure: { message: "A espada rejeitou você." }
    },
    "Bolo Pixelado sob a Lua Crescente.png": {
      id: "moon-cake", title: "Bolo de procedência duvidosa", description: "Coma rápido antes que ele desapareça.", type: "ITEM", rarity: "UNCOMMON", weight: 7, energyCost: 1, food: true,
      interaction: { type: "RHYTHM", duration: 12, rounds: 5 }, success: { health: 1, energy: 1, message: "+1 VIDA · +1 ENERGIA" }, failure: { message: "Só restaram migalhas." }
    },
    "Ladino Élfico sob a Lua Cheia.png": {
      id: "elven-thief", title: "Ladrão do algoritmo", description: "Ele rouba moedas quando você toca no sinal errado.", type: "ENEMY", rarity: "UNCOMMON", weight: 6, energyCost: 1,
      interaction: { type: "STOP_SIGNAL", duration: 12, target: 12, errorCoins: 3, help: "Toque no verde. Cada toque no vermelho entrega 3 moedas ao ladrão." }, success: { coins: 30, message: "+30 MOEDAS" }, failure: { coins: -10, message: "O ladrão escapou com 10 moedas." }
    },
    "Poção Cósmica no Altar Arcano.png": {
      id: "altar-potion", title: "Poção cósmica", description: "O brilho promete mais do que explica.", type: "MYSTERY", rarity: "RARE", weight: 5, energyCost: 1,
      interaction: { type: "CHOICE" }, success: { randomReward: true, future: { statuses: { curse: 4 } }, message: "MALDIÇÃO ATIVA · PODER DOBRADO" }, failure: { energy: -1, message: "Sabor horrível. -1 ENERGIA" }
    },
    "Poção Cósmica na Oficina Encantada.png": {
      id: "workshop-potion", title: "Poção instável", description: "Segure enquanto a mistura estabiliza.", type: "MYSTERY", rarity: "EPIC", weight: 3, energyCost: 2,
      interaction: { type: "BALANCE", duration: 11, target: 4 }, success: { randomReward: true, future: { statuses: { heavySleep: 4 } }, message: "SONO PESADO · TEMPO DESACELERADO" }, failure: { health: -1, message: "A mistura explodiu. -1 VIDA" }
    },
    "Ovo Mágico Neon na Noite Pixelada.png": {
      id: "neon-egg", title: "Ovo neon", description: "Cada encontro deixa uma nova rachadura.", type: "EVOLUTION", rarity: "LEGENDARY", weight: 2, energyCost: 1, oncePerRun: false,
      interaction: { type: "MULTI_STAGE" }, success: { evolution: "neon-egg", message: "O ovo respondeu ao toque." }, failure: { message: "Nada se moveu. Ainda." }
    },
    "Portal Místico nas Ruínas Lunares.png": {
      id: "lunar-portal", title: "Portal lunar", description: "Uma janela para parte errada do feed.", type: "MYSTERY", rarity: "EPIC", weight: 3, energyCost: 2,
      interaction: { type: "SACRIFICE", options: [
        { label: "ENTRAR", detail: "-2 Energia · Sorte por 5 posts", message: "O portal alterou suas probabilidades.", effects: { energy: -2 }, future: { statuses: { luck: 5 } } },
        { label: "TOCAR A BORDA", detail: "+20 moedas", message: "Você arrancou fragmentos do portal.", effects: { coins: 20 } },
        { label: "RECUAR", detail: "Sem custo", message: "Você permaneceu deste lado." }
      ] }, success: { message: "O portal respondeu à sua escolha." }, failure: { message: "O portal se fechou." }
    },
    "Mochila Mágica sob a Lua Cheia.png": {
      id: "magic-backpack", title: "Mochila mágica", description: "Algo útil se esconde no fundo.", type: "ITEM", rarity: "UNCOMMON", weight: 7, energyCost: 1,
      interaction: { type: "DRAG_ITEM", duration: 11 }, success: { coins: 18, inventoryCapacity: 6, future: { statuses: { luck: 5 } }, message: "BOLSA EQUIPADA · 6 ESPAÇOS · SORTE" }, failure: { message: "O fecho travou." }
    },
    "Ampulheta.png": {
      id: "night-hourglass", title: "Ampulheta lunar", description: "O tempo desacelera por alguns segundos.", type: "ITEM", rarity: "RARE", weight: 5, energyCost: 1,
      interaction: { type: "TIMING", duration: 9, zoneSize: 0.34 }, success: { energy: 2, item: "ampulheta", message: "AMPULHETA DESCOBERTA" }, failure: { message: "A areia acabou." }
    },
    "Aranha.png": {
      id: "web-spider", title: "Aranha do feed", description: "Ela esconde a saída entre botões falsos.", type: "ENEMY", rarity: "UNCOMMON", weight: 7, energyCost: 1,
      interaction: { type: "FAKE_BUTTON", duration: 11, rounds: 4, blockedCells: true, help: "A teia bloqueia botões. Encontre CERTO entre os espaços livres." }, success: { coins: 24, message: "+24 MOEDAS" }, failure: { health: -1, message: "Presa na teia. -1 VIDA" }
    },
    "Capa da Invisibilidade.png": {
      id: "invisibility-cloak", title: "Capa da invisibilidade", description: "Pare no instante em que a capa desaparecer.", type: "ITEM", rarity: "EPIC", weight: 4, energyCost: 2,
      interaction: { type: "STOP_SIGNAL", duration: 12, target: 11 }, success: { item: "capa", coins: 20, message: "CAPA DESCOBERTA" }, failure: { message: "A capa sumiu sem você." }
    },
    "Mercador.png": {
      id: "night-merchant", title: "Mercador da madrugada", description: "Toda oferta altera o que aparece depois.", type: "RISK", rarity: "RARE", weight: 5, energyCost: 0,
      interaction: { type: "BARGAIN", options: [
        { label: "FEED ACELERADO", detail: "12 moedas · 4 interações", cost: 12, message: "Mais velocidade. Recompensas maiores.", effects: { coins: -12 }, future: { statuses: { acceleratedFeed: 4 } } },
        { label: "ECO", detail: "18 moedas · próximo efeito x2", cost: 18, message: "O próximo efeito acontecerá duas vezes.", effects: { coins: -18 }, future: { statuses: { echo: 1 } } },
        { label: "SILÊNCIO", detail: "14 moedas · 4 posts", cost: 14, message: "Os monstros perderam seu rastro.", effects: { coins: -14 }, future: { statuses: { silence: 4 } } },
        { label: "RECUSAR", detail: "Guardar moedas", message: "Você recusou as ofertas." }
      ] }, success: { message: "Negociação concluída." }, failure: { message: "O mercador encerrou a conversa." }
    },
    "Pacote de moedas.png": {
      id: "cursed-coins", title: "Pacote de moedas", description: "Separe as moedas reais das amaldiçoadas.", type: "CHEST", rarity: "UNCOMMON", weight: 7, energyCost: 1,
      interaction: { type: "SORT", duration: 13, rounds: 7 }, success: { coins: 35, message: "+35 MOEDAS" }, failure: { coins: -8, message: "-8 MOEDAS" }
    },
    "Poção Amarela.png": {
      id: "yellow-potion", title: "Poção amarela", description: "Escolha como alterar os próximos posts.", type: "MYSTERY", rarity: "RARE", weight: 5, energyCost: 1,
      interaction: { type: "CHOICE" }, success: { energy: 1, future: { statuses: { focus: 4 } }, message: "FOCO · ÁREAS DE TIMING MAIORES" }, failure: { message: "Nada aconteceu." }
    },
    "Poção vermelha.png": {
      id: "red-potion", title: "Poção vermelha", description: "Poder futuro exige um preço agora.", type: "RISK", rarity: "EPIC", weight: 4, energyCost: 0,
      interaction: { type: "SACRIFICE" }, success: { coins: 20, message: "+20 MOEDAS" }, failure: { message: "Você recusou o ritual." }
    },
    "Vela.png": {
      id: "signal-candle", title: "Vela de sinal", description: "Toque apenas quando a chama responder.", type: "ENERGY", rarity: "COMMON", weight: 9, energyCost: 0,
      interaction: { type: "REACTION", window: 1200 }, success: { energy: 3, message: "+3 ENERGIA" }, failure: { message: "A chama apagou." }
    }
  };

  const GAME_CONFIG = Object.freeze({
    maxHealth: 3,
    maxEnergy: 10,
    startingHealth: 3,
    startingEnergy: 7,
    bossAtCards: 15,
    cardsPerNightStep: 3,
    maxCardsPerNight: 30,
    scrollEnergyCost: 0.25,
    minimumPlayableEnergy: 0.75,
    recentCardLimit: 5,
    maxEnemiesInRecent: 2,
    maxSpecialsInRecent: 2,
    rarity: RARITY_CONFIG,
    typeRarities: TYPE_RARITIES
  });

  const config = { POST_ROOT, POST_ASSETS, CARD_CONFIG, GAME_CONFIG };
  global.DtsConfig = config;
  if (typeof module !== "undefined" && module.exports) module.exports = config;
})(typeof window !== "undefined" ? window : globalThis);
