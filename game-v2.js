"use strict";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "doomed-to-scroll-v1";
const defaults = {
  coins: 0,
  discoveries: [],
  bestCombo: 0,
  runs: 0,
  ownedCosmetics: ["original"],
  equippedCosmetic: "original"
};

let meta = loadSave();
let run = null;
let current = null;
let locked = false;
let touchStart = null;

const ITEMS = {
  egg: { name: "Ovo", sprite: "egg" },
  dragon: { name: "Dragão", sprite: "dragon" },
  key: { name: "Chave", sprite: "key" },
  candle: { name: "Vela", sprite: "candle" },
  magnet: { name: "Ímã", sprite: "magnet" },
  ghost: { name: "Fantasma", sprite: "ghost" }
};

const BOSSES = [
  { id: "algorithm", name: "ALGORITMO", taunt: "Eu aprendi seu padrão. Quer arriscar só mais um?", chance: .58, reward: 28, damage: 18 },
  { id: "loop", name: "LOOP INFINITO", taunt: "Você já viu isto. Mesmo assim, quer repetir?", chance: .48, reward: 36, damage: 15 },
  { id: "queen", name: "RAINHA DA NOTIFICAÇÃO", taunt: "Uma nova notificação espera. Talvez seja importante.", chance: .62, reward: 24, damage: 20 },
  { id: "insomnia", name: "INSÔNIA", taunt: "Dormir pode esperar. A madrugada ainda tem segredos.", chance: .45, reward: 42, damage: 14 }
];

const COSMETICS = [
  { id: "original", name: "Clássico", price: 0, pos: "0 0" },
  { id: "violet", name: "Noite Violeta", price: 80, pos: "33.333% 0" },
  { id: "coral", name: "Pôr do Sol", price: 80, pos: "66.666% 0" },
  { id: "glitch", name: "Glitch Ciano", price: 110, pos: "100% 0" },
  { id: "wizard", name: "Mago Estelar", price: 140, pos: "0 100%" },
  { id: "pajamas", name: "Pijama Lunar", price: 140, pos: "33.333% 100%" },
  { id: "crown", name: "Pequena Coroa", price: 180, pos: "66.666% 100%" },
  { id: "glasses", name: "Óculos Estelares", price: 160, pos: "100% 100%" }
];

const EVENTS = [
  { id: "chest", name: "Baú suspeito", category: "TESOURO", sprite: "chest", rarity: "COMUM", weight: 12, action: "ABRIR", text: "Pode guardar moedas. Pode guardar dentes.", hint: "Abra para descobrir se é seguro.", effect: openChest },
  { id: "egg", name: "Ovo de dragão", category: "CRIATURA", sprite: "egg", rarity: "INCOMUM", weight: 7, action: "GUARDAR", text: "Ele racha depois de 9 novos posts.", hint: "O progresso fica visível acima da mochila.", requires: () => !has("egg") && !has("dragon"), effect: takeEgg },
  { id: "cat", name: "Gatinho sonolento", category: "DESCANSO", sprite: "cat", rarity: "COMUM", weight: 9, action: "DESCANSAR", text: "Um minuto quieto faz diferença.", hint: "Recupere 20 de Energia.", effect: () => recoverEnergy(20, "O descanso recuperou 20 de Energia.") },
  { id: "coffee", name: "Café esquecido", category: "DESCANSO", sprite: "coffee", rarity: "COMUM", weight: 8, action: "BEBER", text: "Frio, forte e estranhamente eficaz.", hint: "Recupere 15 de Energia.", effect: () => recoverEnergy(15, "O café recuperou 15 de Energia.") },
  { id: "coin", name: "Moedas sob a cama", category: "TESOURO", sprite: "coin", rarity: "COMUM", weight: 9, action: "PEGAR", text: "Alguém deixou um pequeno brilho no escuro.", hint: "Ganhe 8 Moon Coins.", effect: () => gainCoins(8, "Você encontrou {value} Moon Coins.") },
  { id: "charger", name: "Carregador lunar", category: "ITEM", sprite: "charger", rarity: "INCOMUM", weight: 6, action: "USAR", text: "Energia grátis por alguns minutos.", hint: "Os próximos 2 avanços não gastam Energia.", effect: () => { run.freePosts += 2; showOutcome("Dois próximos avanços não gastarão Energia.", "good"); } },
  { id: "rain", name: "Chuva na janela", category: "DESCANSO", sprite: "rain", rarity: "COMUM", weight: 7, action: "PAUSAR", text: "O feed espera. A chuva não.", hint: "Recupere 10 de Energia.", effect: () => recoverEnergy(10, "A pausa recuperou 10 de Energia.") },
  { id: "letter", name: "Carta brilhante", category: "MISTÉRIO", sprite: "letter", rarity: "INCOMUM", weight: 5, action: "ABRIR", text: "Seu nome está escrito do lado de dentro.", hint: "Contém uma recompensa direta.", effect: () => gainCoins(12, "A carta continha {value} Moon Coins.") },
  { id: "gift", name: "Presente cósmico", category: "RARIDADE", sprite: "gift", rarity: "RARO", weight: 3, action: "ABRIR", text: "Não há remetente. Há uma fita perfeita.", hint: "Pode liberar um cosmético.", effect: openGift },
  { id: "owl", name: "Mercador da madrugada", category: "ENCONTRO", sprite: "owl", rarity: "INCOMUM", weight: 4, action: "TROCAR", text: "Seis moedas por uma bebida revigorante.", hint: "Pague 6 moedas e recupere 18 de Energia.", requires: () => run.coins >= 6, effect: () => { run.coins -= 6; recoverEnergy(18, "Troca feita. Você recuperou 18 de Energia."); } },
  { id: "remote", name: "Controle perdido", category: "DESCANSO", sprite: "remote", rarity: "COMUM", weight: 6, action: "DESLIGAR", text: "A TV ilumina um quarto vazio.", hint: "Desligar recupera 12 de Energia.", effect: () => recoverEnergy(12, "O silêncio recuperou 12 de Energia.") },
  { id: "key", name: "A chave sem porta", category: "ITEM", sprite: "key", rarity: "INCOMUM", weight: 5, action: "GUARDAR", text: "Agora parece inútil. Mais tarde talvez não.", hint: "Ocupa um espaço na mochila.", requires: () => !has("key"), effect: () => takeItem("key", "Chave guardada. Procure uma porta.") },
  { id: "door", name: "Porta sem parede", category: "ENCONTRO", sprite: "door", rarity: "RARO", weight: 4, action: "ABRIR", text: "Uma fechadura espera alguma coisa.", hint: "Uma chave transforma o resultado.", effect: openDoor },
  { id: "candle", name: "Vela reveladora", category: "ITEM", sprite: "candle", rarity: "INCOMUM", weight: 5, action: "GUARDAR", text: "A chama revela baús perigosos.", hint: "Protege você de um mímico.", requires: () => !has("candle"), effect: () => takeItem("candle", "Vela guardada. Próximo mímico será revelado.") },
  { id: "magnet", name: "Ímã lunar", category: "ITEM", sprite: "magnet", rarity: "INCOMUM", weight: 5, action: "GUARDAR", text: "Atrai moedas durante 4 posts.", hint: "Recompensas de moedas ficam 50% maiores.", requires: () => !has("magnet"), effect: () => takeItem("magnet", "Ímã ativo por 4 posts.", 5) },
  { id: "thief", name: "Ladrão de madrugada", category: "PERIGO", sprite: "thief", rarity: "INCOMUM", weight: 4, action: "ENFRENTAR", text: "Ele já escolheu um bolso.", hint: "Pode roubar item ou moedas.", effect: meetThief },
  { id: "ghost", name: "Fantasma amigável", category: "CRIATURA", sprite: "ghost", rarity: "RARO", weight: 3, action: "ACEITAR", text: "Ele só quer acompanhar uma boa história.", hint: "Entra na mochila e assusta ladrões.", requires: () => !has("ghost"), effect: () => takeItem("ghost", "Fantasma agora acompanha a noite.") },
  { id: "mirror", name: "Espelho duplicador", category: "MISTÉRIO", sprite: "mirror", rarity: "RARO", weight: 3, action: "TOCAR", text: "A próxima recompensa aparece duas vezes.", hint: "Duplica a próxima recompensa em moedas.", effect: () => { run.doubleNext = true; showOutcome("Próxima recompensa em moedas será duplicada.", "good"); } },
  { id: "machine", name: "Máquina da sorte", category: "ENCONTRO", sprite: "hourglass", rarity: "INCOMUM", weight: 4, action: "JOGAR", text: "Custa 8 moedas. O resultado aparece agora.", hint: "Ganhe até 30 moedas ou não receba nada.", requires: () => run.coins >= 8, effect: playMachine }
];

function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    return { ...defaults, ...saved, ownedCosmetics: saved.ownedCosmetics || ["original"] };
  } catch {
    return { ...defaults };
  }
}

function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(meta)); }
function has(id) { return run.inventory.some((item) => item.id === id); }
function getItem(id) { return run.inventory.find((item) => item.id === id); }
function removeItem(id) { const index = run.inventory.findIndex((item) => item.id === id); if (index >= 0) run.inventory.splice(index, 1); }
function addItem(id, extra = {}) { if (run.inventory.length >= 3) return false; run.inventory.push({ id, ...extra }); return true; }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 1800);
}

function discover(id) {
  if (meta.discoveries.includes(id)) return;
  meta.discoveries.push(id);
  run.newDiscoveries++;
  save();
  toast("NOVA DESCOBERTA");
}

function newRun() {
  if (run && run.reactionTimer) clearTimeout(run.reactionTimer);
  run = {
    energy: 100,
    coins: 0,
    posts: 0,
    streak: 0,
    maxStreak: 0,
    inventory: [],
    freePosts: 0,
    doubleNext: false,
    mascotMood: "neutral",
    mascotReaction: null,
    reactionTimer: null,
    newDiscoveries: 0,
    nextBoss: 9 + Math.floor(Math.random() * 4),
    tutorialQueue: meta.runs === 0 ? ["chest", "cat", "egg"] : []
  };
  document.body.classList.remove("sleep-low");
  showScreen("game");
  nextEvent();
}

function weightedEvent() {
  if (run.tutorialQueue.length) return EVENTS.find((event) => event.id === run.tutorialQueue.shift());
  const pool = EVENTS.filter((event) => !event.requires || event.requires());
  let roll = Math.random() * pool.reduce((sum, event) => sum + event.weight, 0);
  return pool.find((event) => (roll -= event.weight) <= 0) || pool[0];
}

function nextEvent() {
  if (run.posts >= run.nextBoss) { startBoss(); return; }
  run.posts++;
  tickPersistentItems();
  current = { ...weightedEvent(), resolved: false };
  run.mascotReaction = null;
  run.mascotMood = eventMood(current);
  $("mascot").classList.remove("mascot-reacting");
  discover(current.id);

  $("card").className = "post-card" + (current.rarity === "RARO" ? " rare" : "");
  $("eventSprite").dataset.sprite = current.sprite;
  $("eventSprite").dataset.phase = "0";
  $("eventName").textContent = current.name;
  $("eventText").textContent = current.text;
  $("decisionHint").textContent = current.hint;
  $("rarity").textContent = current.rarity;
  $("category").textContent = current.category;
  $("outcome").className = "outcome";
  $("outcome").innerHTML = "";
  $("interactBtn").textContent = current.action;
  $("skipBtn").hidden = false;
  $("interactBtn").disabled = false;
  render();
}

function interact() {
  if (locked) return;
  if (current.resolved) {
    if (performance.now() - current.resolvedAt < 450) return;
    advance("up");
    return;
  }
  run.streak++;
  run.maxStreak = Math.max(run.maxStreak, run.streak);
  reactMascot("curious", 360);
  $("card").classList.add("interacting");
  setTimeout(() => $("card").classList.remove("interacting"), 320);
  current.effect();
}

function passEvent() {
  if (locked) return;
  if (current.resolved) { advance("up"); return; }
  run.streak = 0;
  reactMascot("annoyed", 300);
  advance("left");
}

function showOutcome(message, tone = "neutral", phase = null) {
  current.resolved = true;
  current.resolvedAt = performance.now();
  if (phase !== null) $("eventSprite").dataset.phase = String(phase);
  $("outcome").innerHTML = `<strong>RESULTADO</strong><span>${message}</span>`;
  $("outcome").className = `outcome show ${tone}`;
  $("decisionHint").textContent = "Resultado revelado. Continue quando quiser.";
  $("interactBtn").textContent = "CONTINUAR";
  $("skipBtn").hidden = true;
  run.mascotMood = tone === "good" ? "happy" : tone === "bad" ? "sad" : "curious";
  reactMascot(tone === "good" ? (current.rarity === "RARO" ? "excited" : "happy") : tone === "bad" ? "frightened" : "curious", 900);
  if (tone === "good") spawnFx();
  render();
}

function advance(direction) {
  if (locked) return;
  locked = true;
  const free = run.freePosts > 0;
  if (free) run.freePosts--;
  else run.energy = Math.max(0, run.energy - 5);

  const card = $("card");
  card.classList.add(direction === "left" ? "swipe-left" : "swipe-up");
  setTimeout(() => {
    card.classList.remove("swipe-left", "swipe-up");
    locked = false;
    if (run.energy <= 0) endRun(false);
    else nextEvent();
  }, 320);
}

function tickPersistentItems() {
  const egg = getItem("egg");
  if (egg) {
    egg.age++;
    const previous = egg.stage;
    egg.stage = Math.min(3, Math.floor(egg.age / 3));
    if (egg.stage > previous && egg.stage < 3) toast(egg.stage === 1 ? "O OVO GANHOU UMA RACHADURA" : "O OVO ESTÁ QUASE ABRINDO");
    if (egg.age >= 9) {
      removeItem("egg");
      addItem("dragon");
      discover("dragon");
      toast("O DRAGÃO NASCEU");
    }
  }

  const magnet = getItem("magnet");
  if (magnet && typeof magnet.uses === "number") {
    magnet.uses--;
    if (magnet.uses <= 0) { removeItem("magnet"); toast("O ÍMÃ PERDEU A FORÇA"); }
  }
}

function takeEgg() {
  if (!addItem("egg", { age: 0, stage: 0 })) { showOutcome("Mochila cheia. Passe ou troque um item em outro post.", "bad"); return; }
  showOutcome("Ovo guardado. Ele abrirá depois de 9 novos posts.", "good", 0);
}

function takeItem(id, message, uses = null) {
  if (!addItem(id, uses === null ? {} : { uses })) { showOutcome("Mochila cheia. Não foi possível guardar.", "bad"); return; }
  showOutcome(message, "good");
}

function openChest() {
  const wouldBeEvil = Math.random() < .28;
  if (wouldBeEvil && !has("candle")) {
    run.energy = Math.max(0, run.energy - 14);
    showOutcome("Era um mímico. Você perdeu 14 de Energia.", "bad", 2);
    return;
  }
  if (wouldBeEvil && has("candle")) removeItem("candle");
  const value = awardCoins(10 + Math.floor(Math.random() * 11));
  showOutcome(`Era seguro. Você ganhou ${value} Moon Coins.`, "good", 3);
}

function recoverEnergy(value, message) {
  run.energy = Math.min(100, run.energy + value);
  showOutcome(message, "good");
}

function awardCoins(base) {
  let value = base;
  if (has("magnet")) value = Math.ceil(value * 1.5);
  if (run.doubleNext) { value *= 2; run.doubleNext = false; }
  run.coins += value;
  return value;
}

function gainCoins(base, message) {
  const value = awardCoins(base);
  showOutcome(message.replace("{value}", value), "good");
}

function openDoor() {
  if (!has("key")) { run.energy = Math.max(0, run.energy - 5); showOutcome("A porta estava trancada. Você perdeu 5 de Energia.", "bad"); return; }
  removeItem("key");
  const value = awardCoins(25);
  showOutcome(`A chave serviu. Atrás da porta havia ${value} Moon Coins.`, "good");
}

function meetThief() {
  if (has("ghost") || has("dragon")) { showOutcome(has("dragon") ? "O dragão espantou o ladrão. Nada foi perdido." : "O fantasma assustou o ladrão. Nada foi perdido.", "good"); return; }
  if (run.inventory.length) {
    const stolen = run.inventory.splice(Math.floor(Math.random() * run.inventory.length), 1)[0];
    showOutcome(`O ladrão levou: ${ITEMS[stolen.id].name}.`, "bad");
  } else {
    const lost = Math.min(6, run.coins);
    run.coins -= lost;
    showOutcome(`O ladrão levou ${lost} Moon Coins.`, "bad");
  }
}

function playMachine() {
  run.coins -= 8;
  if (Math.random() < .55) { const value = awardCoins(18 + Math.floor(Math.random() * 13)); showOutcome(`A máquina pagou ${value} Moon Coins.`, "good"); }
  else showOutcome("A máquina não devolveu nada.", "bad");
}

function openGift() {
  const lockedCosmetics = COSMETICS.filter((cosmetic) => !meta.ownedCosmetics.includes(cosmetic.id));
  if (!lockedCosmetics.length) { const value = awardCoins(20); showOutcome(`Coleção completa. Presente convertido em ${value} moedas.`, "good"); return; }
  const cosmetic = lockedCosmetics[Math.floor(Math.random() * lockedCosmetics.length)];
  meta.ownedCosmetics.push(cosmetic.id);
  save();
  showOutcome(`Cosmético liberado: ${cosmetic.name}.`, "good");
}

function startBoss() {
  run.activeBoss = BOSSES[(meta.runs + Math.floor(Math.random() * BOSSES.length)) % BOSSES.length];
  $("bossTitle").textContent = run.activeBoss.name;
  $("bossSprite").dataset.boss = run.activeBoss.id;
  $("bossTaunt").textContent = run.activeBoss.taunt;
  $("bossChoices").innerHTML = `<button class="boss-choice hot" id="oneMoreBoss">SÓ MAIS UM <small>arrisca prêmio e Energia</small></button>`;
  $("oneMoreBoss").onclick = chooseOneMore;
  $("bossStop").textContent = "DORMIR E GUARDAR TUDO";
  showScreen("boss");
}

function chooseOneMore() {
  const boss = run.activeBoss;
  $("oneMoreBoss").disabled = true;
  $("bossStop").disabled = true;
  let message;
  if (Math.random() < boss.chance) {
    const value = awardCoins(boss.reward);
    message = `Você ganhou ${value} Moon Coins.`;
  } else {
    run.energy = Math.max(0, run.energy - boss.damage);
    message = `Você perdeu ${boss.damage} de Energia.`;
  }
  $("bossTaunt").textContent = message;
  discover(`boss-${boss.id}`);
  run.nextBoss = run.posts + 8 + Math.floor(Math.random() * 4);
  setTimeout(() => {
    $("bossStop").disabled = false;
    if (run.energy <= 0) { endRun(false); return; }
    showScreen("game");
    nextEvent();
  }, 900);
}

function endRun(voluntary) {
  if (!run) return;
  voluntary = Boolean(voluntary && run.energy > 0);
  const kept = voluntary ? run.coins : Math.floor(run.coins / 2);
  meta.coins += kept;
  meta.bestCombo = Math.max(meta.bestCombo || 0, run.maxStreak);
  meta.runs++;
  save();

  $("resultTitle").textContent = voluntary ? "VOCÊ PAROU A TEMPO" : "VOCÊ APAGOU";
  $("resultSubtitle").textContent = voluntary ? "Você guardou todas as moedas desta noite." : "Metade das moedas ficou no feed.";
  $("resultCoins").textContent = kept;
  $("resultPosts").textContent = run.posts;
  $("resultCombo").textContent = run.maxStreak;
  $("resultDiscoveries").textContent = run.newDiscoveries;
  $("resultMascot").dataset.sprite = voluntary ? "happy" : "sleepy";
  showScreen("result");
  updateMeta();
}

function render() {
  if (!run) return;
  $("sleepBar").style.width = `${run.energy}%`;
  $("sleepText").textContent = run.energy;
  $("runCoins").textContent = run.coins;
  $("post").textContent = run.posts;
  const minutes = (17 + run.posts * 2) % 60;
  $("clock").textContent = `${String(2 + Math.floor((17 + run.posts * 2) / 60)).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  $("ruleHint").textContent = run.freePosts > 0 ? `${run.freePosts} post(s) sem custo de Energia.` : "Interaja ou passe. Cada avanço custa 5 de Energia.";
  renderMascot();
  document.body.classList.toggle("sleep-low", run.energy < 30);
  renderInventory();
  renderProgress();
}

function eventMood(event) {
  if (["PERIGO"].includes(event.category)) return "suspicious";
  if (["MISTÉRIO", "RARIDADE", "CRIATURA"].includes(event.category)) return "curious";
  if (event.category === "DESCANSO") return "sleepy";
  return "neutral";
}

function renderMascot() {
  if (!run) return;
  const state = run.mascotReaction || (run.energy < 25 ? "sleepy" : run.mascotMood || (run.streak >= 4 ? "happy" : "neutral"));
  $("mascot").dataset.sprite = state;
}

function reactMascot(state, duration = 800) {
  if (!run) return;
  clearTimeout(run.reactionTimer);
  run.mascotReaction = state;
  $("mascot").classList.add("mascot-reacting");
  renderMascot();
  run.reactionTimer = setTimeout(() => {
    if (!run) return;
    run.mascotReaction = null;
    $("mascot").classList.remove("mascot-reacting");
    renderMascot();
  }, duration);
}

function renderInventory() {
  $("slots").innerHTML = Array.from({ length: 3 }, (_, index) => {
    const item = run.inventory[index];
    if (!item) return `<div class="slot empty"><small>VAZIO</small></div>`;
    return `<div class="slot">${spriteMarkup(ITEMS[item.id].sprite)}<small>${ITEMS[item.id].name}${item.uses ? ` ${item.uses}` : ""}</small></div>`;
  }).join("");
}

function renderProgress() {
  const tracker = $("progressTracker");
  const egg = getItem("egg");
  if (egg) {
    tracker.hidden = false;
    tracker.innerHTML = `<span class="egg-progress-art" data-stage="${egg.stage}"></span><div><strong>OVO DE DRAGÃO</strong><small>${9 - egg.age} post(s) para nascer</small></div>`;
    return;
  }
  if (has("dragon")) {
    tracker.hidden = false;
    tracker.innerHTML = `${spriteMarkup("dragon")}<div><strong>DRAGÃO NASCEU</strong><small>Ele protege sua mochila.</small></div>`;
    return;
  }
  tracker.hidden = true;
  tracker.innerHTML = "";
}

function spriteMarkup(sprite) { return `<span class="mini-sprite" data-sprite="${sprite}"></span>`; }

function spawnFx() {
  const fx = $("fx");
  fx.innerHTML = "";
  for (let index = 0; index < 10; index++) {
    const spark = document.createElement("i");
    spark.className = "spark";
    const angle = Math.PI * 2 * index / 10;
    const distance = 45 + Math.random() * 55;
    spark.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    fx.appendChild(spark);
  }
  setTimeout(() => { fx.innerHTML = ""; }, 800);
}

function updateMeta() {
  $("bankCoins").textContent = meta.coins;
  $("discoveryCount").textContent = meta.discoveries.length;
  document.body.dataset.cosmetic = meta.equippedCosmetic || "original";
}

function renderCollection() {
  const all = [
    ...EVENTS.map((event) => ({ id: event.id, name: event.name, sprite: event.sprite })),
    { id: "dragon", name: "Dragão bebê", sprite: "dragon" },
    ...BOSSES.map((boss) => ({ id: `boss-${boss.id}`, name: boss.name, boss: boss.id }))
  ];
  $("collectionGrid").innerHTML = all.map((entry) => {
    const found = meta.discoveries.includes(entry.id);
    const art = entry.boss ? `<span class="boss-mini" data-boss="${entry.boss}"></span>` : spriteMarkup(entry.sprite);
    return `<div class="collection-item ${found ? "" : "locked"}">${found ? art : "<span class=unknown>?</span>"}<small>${found ? entry.name.toUpperCase() : "???"}</small></div>`;
  }).join("");
}

function renderStore() {
  $("storeCoins").textContent = meta.coins;
  $("storeGrid").innerHTML = COSMETICS.map((cosmetic) => {
    const owned = meta.ownedCosmetics.includes(cosmetic.id);
    const equipped = meta.equippedCosmetic === cosmetic.id;
    const label = equipped ? "EQUIPADO" : owned ? "EQUIPAR" : `${cosmetic.price} MOON COINS`;
    return `<article class="store-item"><span class="cosmetic-preview" style="background-position:${cosmetic.pos}"></span><h3>${cosmetic.name}</h3><button data-cosmetic="${cosmetic.id}" ${equipped ? "disabled" : ""}>${label}</button></article>`;
  }).join("");
  document.querySelectorAll("#storeGrid [data-cosmetic]").forEach((button) => { button.onclick = () => buyCosmetic(button.dataset.cosmetic); });
}

function buyCosmetic(id) {
  const cosmetic = COSMETICS.find((entry) => entry.id === id);
  if (!meta.ownedCosmetics.includes(id)) {
    if (meta.coins < cosmetic.price) { toast("MOON COINS INSUFICIENTES"); return; }
    meta.coins -= cosmetic.price;
    meta.ownedCosmetics.push(id);
  }
  meta.equippedCosmetic = id;
  save();
  updateMeta();
  renderStore();
  toast("COSMÉTICO EQUIPADO");
}

$("startBtn").onclick = newRun;
$("againBtn").onclick = newRun;
$("stopBtn").onclick = () => endRun(run && run.energy > 0);
$("bossStop").onclick = () => endRun(true);
$("homeBtn").onclick = () => showScreen("home");
$("interactBtn").onclick = interact;
$("skipBtn").onclick = passEvent;
$("collectionBtn").onclick = () => { renderCollection(); showScreen("collection"); };
$("collectionBack").onclick = () => showScreen("home");
$("storeBtn").onclick = () => { renderStore(); showScreen("store"); };
$("storeBack").onclick = () => showScreen("home");

$("feed").addEventListener("touchstart", (event) => {
  touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });

$("feed").addEventListener("touchend", (event) => {
  if (!touchStart || locked || current.resolved) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  if ((dx < -55 && Math.abs(dx) > Math.abs(dy)) || dy < -70) passEvent();
  touchStart = null;
}, { passive: true });

document.addEventListener("keydown", (event) => {
  if (!$("game").classList.contains("active")) return;
  if (event.target.closest && event.target.closest("button")) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") passEvent();
  if (event.key === "Enter" || event.key === " ") interact();
});

updateMeta();
