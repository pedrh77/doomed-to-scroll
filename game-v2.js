"use strict";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "doomed-to-scroll-v2";
const { POST_ROOT, POST_ASSETS, CARD_CONFIG, GAME_CONFIG } = DtsConfig;
const {
  CARD_STATES, CardRegistry, FeedGenerator, GameDirector, createRunState,
  beginInteraction, resolveCard, applyEffects, applyFutureEffects, hasStatus, skipCard, recordScroll, nightTime, nightTarget
} = DtsCore;

const DEFAULT_META = {
  coins: 0, discoveries: [], bestProgress: 0, runs: 0,
  night: 1,
  ownedCosmetics: ["original"], equippedCosmetic: "original",
  savedPosts: [],
  readComments: [],
  tutorialSeen: false,
  stats: { interactions: 0, victories: 0, defeats: 0 }
};

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

const CARD_ACTIONS = Object.freeze({
  NORMAL: { verb: "CURTIR", icon: "C" }, LIFE: { verb: "RESGATAR", icon: "V" },
  ENERGY: { verb: "RECUPERAR", icon: "E" }, ITEM: { verb: "PEGAR", icon: "I" },
  CHEST: { verb: "ABRIR", icon: "A" }, ENEMY: { verb: "ENFRENTAR", icon: "L" },
  RISK: { verb: "ARRISCAR", icon: "R" }, MYSTERY: { verb: "INVESTIGAR", icon: "?" },
  EVOLUTION: { verb: "DESPERTAR", icon: "EV" }
});

const COMMENT_BANK = Object.freeze({
  NORMAL: ["isso apareceu para mais alguém?", "finalmente um post normal", "não confio nesse algoritmo"],
  ENEMY: ["não toquei e sobrevivi", "ele fica mais rápido a cada noite", "use movimentos curtos"],
  CHEST: ["o último tinha dentes", "vale o risco se ainda tiver energia", "a fechadura muda de padrão"],
  ITEM: ["salva isso para a coleção", "parece raro", "o efeito dura mais de um post"],
  RISK: ["li os termos tarde demais", "a segunda opção muda o feed", "não gaste tudo agora"],
  MYSTERY: ["cada pessoa recebeu um efeito", "isso alterou meus próximos posts", "escolha antes de rolar"],
  DEFAULT: ["como isso chegou no meu feed?", "salvei para ver depois", "tem alguma coisa escondida aqui"]
});

const COMMENT_HINTS = Object.freeze({
  TAP_CHALLENGE: "toques fora do alvo alimentam o slime",
  SEQUENCE: "o fantasma repete cada direção",
  TIMING: "espere o cursor entrar por inteiro na zona",
  SWIPE_DIRECTION: "a bruxa exige o comando oposto",
  MEMORY_GRID: "o esqueleto revive quando você demora",
  FAKE_BUTTON: "a teia bloqueia partes da tela",
  MULTI_STAGE: "o dragão possui três fases",
  DEFAULT: "leia risco e recompensa antes de interagir"
});

const ITEM_ACTIONS = Object.freeze({
  espada: { label: "ESPADA", detail: "Reduz em 1 o custo das próximas 3 interações.", use: (state) => applyFutureEffects(state, { energyDiscount: 1, duration: 3 }) },
  ampulheta: { label: "AMPULHETA", detail: "Remove monstros dos próximos 3 posts.", use: (state) => applyFutureEffects(state, { safeCards: 3 }) },
  capa: { label: "CAPA", detail: "Remove monstros dos próximos 4 posts.", use: (state) => applyFutureEffects(state, { safeCards: 4 }) }
});

const STATUS_LABELS = Object.freeze({
  focus: "FOCO", adrenaline: "ADRENALINA", luck: "SORTE", curse: "MALDIÇÃO",
  heavySleep: "SONO PESADO", acceleratedFeed: "FEED ACELERADO", echo: "ECO",
  glitch: "GLITCH", silence: "SILÊNCIO", hunger: "FOME"
});

const registry = new CardRegistry(POST_ASSETS, CARD_CONFIG, POST_ROOT);
const director = new GameDirector(GAME_CONFIG);
const generator = new FeedGenerator(registry, GAME_CONFIG, director);
const miniGames = new DtsMiniGames.MiniGameManager($("miniGameOverlay"));
const bossGames = new DtsMiniGames.MiniGameManager($("bossBattle"));
const sound = window.DtsSound;

const BOSS_PHASES = Object.freeze([
  { title: "QUEBRE O ESCUDO", type: "TIMING", duration: 7, zoneSize: .24 },
  { title: "INVADA O PADRÃO", type: "SEQUENCE", duration: 8, preview: 1900, length: 5 },
  { title: "CORTE O CICLO", type: "MULTI_STAGE", stages: 3, skipCountdown: true }
]);

const BOSSES = Object.freeze([
  { id: "algorithm", title: "ALGORITMO", taunt: "Eu escolhi cada post que trouxe você até aqui." },
  { id: "loop", title: "LOOP INFINITO", taunt: "Você já viveu esta noite. Só não lembra." },
  { id: "queen", title: "RAINHA DAS NOTIFICAÇÕES", taunt: "Cada alerta exige sua atenção." },
  { id: "insomnia", title: "INSÔNIA", taunt: "O amanhecer não chega enquanto eu estiver acordada." }
]);

let meta = loadSave();
let run = null;
let current = null;
let transitionLocked = false;
let gestureStart = null;
let lastTapAt = 0;
let wheelLocked = false;
let tutorialIndex = 0;
let lastRenderedEnergy = null;
let bossBattleToken = 0;

const TUTORIAL_STEPS = [
  { icon: "01", title: "ROLE O FEED", text: "Deslize para cima ou para baixo. Cada novo post gasta 0,25 de Energia." },
  { icon: "02", title: "ESCOLHA A AÇÃO", text: "O botão lateral muda conforme o card. Dois toques na imagem também executam a ação." },
  { icon: "03", title: "POUPE ENERGIA", text: "Cada rolagem gasta um pouco. Interações gastam mais. Monstros iniciam disputas automaticamente." }
];

function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    return {
      ...DEFAULT_META, ...saved,
      discoveries: Array.isArray(saved.discoveries) ? saved.discoveries : [],
      savedPosts: Array.isArray(saved.savedPosts) ? saved.savedPosts : [],
      readComments: Array.isArray(saved.readComments) ? saved.readComments : [],
      ownedCosmetics: Array.isArray(saved.ownedCosmetics) ? saved.ownedCosmetics : ["original"],
      stats: { ...DEFAULT_META.stats, ...(saved.stats || {}) }
    };
  } catch {
    return { ...DEFAULT_META, stats: { ...DEFAULT_META.stats } };
  }
}

function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(meta)); }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
}

function toast(message) {
  clearTimeout(toast.timer);
  $("toast").textContent = message;
  $("toast").classList.add("show");
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 1700);
}

function discover(id) {
  if (meta.discoveries.includes(id)) return;
  meta.discoveries.push(id);
  save();
  toast("NOVA DESCOBERTA");
}

function newRun() {
  miniGames.cancel();
  bossGames.cancel();
  sound?.unlock();
  run = createRunState(GAME_CONFIG);
  run.savedCards = [...meta.savedPosts];
  run.night = Math.max(1, Number(meta.night) || 1);
  run.targetCards = nightTarget(GAME_CONFIG, run.night);
  run.tutorialPending = !meta.tutorialSeen;
  tutorialIndex = 0;
  current = null;
  transitionLocked = false;
  lastRenderedEnergy = null;
  $("itemNotice").hidden = true;
  document.body.classList.remove("critical-health");
  showScreen("game");
  nextCard();
}

function nextCard() {
  if (!run || run.ended) { endRun(false); return; }
  miniGames.cancel();
  if (director.snapshot(run).bossReady) { startBossBattle(); return; }
  current = generator.next(run);
  if (!current) { endRun(true); return; }
  discover(current.id);
  renderCard();
  renderHud();
  if (run.tutorialPending) showTutorial();
  else if (current.type === "ENEMY") startMonsterEncounter();
}

function renderCard() {
  const glitchActive = hasStatus(run, "glitch");
  const action = glitchActive ? { verb: "INTERAGIR", icon: "?" } : CARD_ACTIONS[current.type] || CARD_ACTIONS.NORMAL;
  $("card").className = `post-card rarity-${current.rarity.toLowerCase()}`;
  $("card").classList.add("card-enter");
  requestAnimationFrame(() => requestAnimationFrame(() => $("card").classList.remove("card-enter")));
  $("postImage").src = current.image;
  $("postImage").alt = current.title;
  $("eventName").textContent = current.title;
  $("eventText").textContent = current.description;
  $("rarity").textContent = glitchActive ? "???" : current.rarity;
  $("category").textContent = glitchActive ? "???" : current.type;
  $("energyCost").textContent = hasStatus(run, "adrenaline") ? "ADRENALINA" : current.energyCost ? `ENERGIA -${current.energyCost}` : "SEM CUSTO";
  $("energyCost").classList.toggle("free", !current.energyCost || hasStatus(run, "adrenaline"));
  $("riskText").textContent = glitchActive ? "???" : describeRisk(current);
  $("rewardText").textContent = glitchActive ? "???" : describeReward(current);
  $("decisionHint").textContent = `Role para passar ou toque para ${action.verb.toLowerCase()}.`;
  $("outcome").className = "outcome";
  $("outcome").innerHTML = "";
  $("heartBtn").disabled = false;
  $("heartBtn").className = `social-button heart-button action-${current.type.toLowerCase()}`;
  $("heartBtn").setAttribute("aria-label", `${action.verb}: ${current.title}`);
  $("heartBtn").querySelector("span").textContent = action.icon;
  $("commentsPanel").hidden = true;
  $("commentsPanel").innerHTML = "";
  $("saveBtn").classList.remove("saved");
  $("saveBtn").setAttribute("aria-pressed", "false");
  renderEngagement();
}

function describeReward(card) {
  const reward = card.success || {};
  const parts = [];
  if (reward.randomReward) return "EFEITO ALEATÓRIO";
  if (reward.health > 0) parts.push(`+${reward.health} VIDA`);
  if (reward.energy > 0) parts.push(`+${reward.energy} ENERGIA`);
  if (reward.coins > 0) parts.push(`+${reward.coins} MOEDAS`);
  if (reward.item) parts.push("ITEM");
  if (reward.evolution) parts.push("EVOLUÇÃO");
  return parts.join(" / ") || (card.type === "NORMAL" ? "DESCOBERTA" : "EFEITO ESPECIAL");
}

function describeRisk(card) {
  if (!card.energyCost && card.type === "NORMAL") return "NENHUM";
  const failure = card.failure || {}, parts = [];
  if (card.energyCost) parts.push(`${card.energyCost} ENERGIA`);
  if (failure.health < 0) parts.push(`${Math.abs(failure.health)} VIDA`);
  if (failure.coins < 0) parts.push(`${Math.abs(failure.coins)} MOEDAS`);
  return parts.join(" / ") || "TEMPO";
}

function showTutorial() {
  const step = TUTORIAL_STEPS[tutorialIndex];
  $("tutorialOverlay").hidden = false;
  $("tutorialIcon").textContent = step.icon;
  $("tutorialStep").textContent = `PASSO ${tutorialIndex + 1} DE ${TUTORIAL_STEPS.length}`;
  $("tutorialTitle").textContent = step.title;
  $("tutorialText").textContent = step.text;
  $("tutorialDots").innerHTML = TUTORIAL_STEPS.map((_, index) => `<i class="${index === tutorialIndex ? "active" : ""}"></i>`).join("");
  $("tutorialNext").textContent = tutorialIndex === TUTORIAL_STEPS.length - 1 ? "COMEÇAR A NOITE" : "PRÓXIMO";
}

function advanceTutorial() {
  if (!run || !run.tutorialPending) return;
  if (tutorialIndex < TUTORIAL_STEPS.length - 1) {
    tutorialIndex++;
    showTutorial();
    return;
  }
  run.tutorialPending = false;
  meta.tutorialSeen = true;
  save();
  $("tutorialOverlay").hidden = true;
  if (current && current.type === "ENEMY") startMonsterEncounter();
}

function engagementForCard(card) {
  let hash = 0;
  for (const character of card.id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return {
    likes: 780 + hash % 14200,
    comments: 38 + hash % 930,
    saves: 110 + hash % 3800
  };
}

function compactNumber(value) {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(".0", "")}K`;
}

function renderEngagement() {
  const engagement = engagementForCard(current);
  const saved = meta.savedPosts.includes(current.id);
  $("likeCount").textContent = compactNumber(engagement.likes);
  $("commentCount").textContent = compactNumber(engagement.comments);
  $("saveCount").textContent = compactNumber(engagement.saves + (saved ? 1 : 0));
  $("saveBtn").classList.toggle("saved", saved);
  $("saveBtn").setAttribute("aria-pressed", String(saved));
  $("commentBtn").classList.toggle("viewed", meta.readComments.includes(current.id));
}

function startMonsterEncounter() {
  transitionLocked = true;
  miniGames.showEncounterCountdown(current.title, current.image, () => {
    transitionLocked = false;
    interactWithCard({ skipCountdown: true });
  });
}

function renderHud() {
  if (!run) return;
  $("clock").textContent = nightTime(run.cardsScrolled);
  $("runCoins").textContent = run.coins;
  $("post").textContent = run.cardsScrolled + 1;
  const state = director.snapshot(run);
  $("nightNumber").textContent = run.night;
  const difficultyLevel = Math.min(5, Math.max(1, Math.ceil((state.difficulty - 1) * 3) + 1));
  $("difficultyLevel").textContent = difficultyLevel;
  document.body.dataset.danger = difficultyLevel;
  $("nightPercent").textContent = `${Math.min(run.cardsScrolled, run.targetCards)}/${run.targetCards}`;
  $("energyValue").textContent = `${formatEnergy(run.energy)}/${run.maxEnergy}`;
  $("healthValue").textContent = `${run.health}/${run.maxHealth}`;
  $("energyFill").style.width = `${Math.max(0, run.energy / run.maxEnergy * 100)}%`;
  const meter = $("energyPips");
  meter.classList.remove("energy-drain", "energy-gain");
  if (lastRenderedEnergy !== null && run.energy !== lastRenderedEnergy) {
    meter.classList.add(run.energy < lastRenderedEnergy ? "energy-drain" : "energy-gain");
    if (run.energy < lastRenderedEnergy) sound?.play("energyLoss");
    setTimeout(() => meter.classList.remove("energy-drain", "energy-gain"), 420);
  }
  lastRenderedEnergy = run.energy;
  $("healthHearts").innerHTML = Array.from({ length: run.maxHealth }, (_, index) => `<i class="${index < run.health ? "full" : ""}" aria-hidden="true"></i>`).join("");
  renderStatuses();
  $("mascot").dataset.sprite = run.health <= 1 ? "frightened" : run.energy <= 2 ? "sleepy" : current && current.type === "ENEMY" ? "curious" : "neutral";
  document.body.classList.toggle("critical-health", run.health <= 1);
  renderInventory();
}

function renderStatuses() {
  const entries = Object.entries(run?.statuses || {}).filter(([, status]) => status.remaining > 0);
  $("statusEffects").hidden = !entries.length;
  $("statusEffects").innerHTML = entries.map(([id, status]) => `<span data-status="${id}"><b>${STATUS_LABELS[id] || id.toUpperCase()}</b><small>${status.remaining}</small></span>`).join("");
}

function formatEnergy(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}

function renderInventory() {
  if (!run) return;
  const items = run.items.filter((id) => ITEM_ACTIONS[id]);
  const capacity = run.inventoryCapacity || 3;
  const visibleSlots = capacity > 3 && run.inventoryExpanded ? 6 : 3;
  $("slots").classList.toggle("expanded", visibleSlots > 3);
  $("slots").innerHTML = Array.from({ length: visibleSlots }, (_, index) => {
    const id = items[index];
    return id
      ? `<button data-item="${id}" aria-label="Ativar ${ITEM_ACTIONS[id].label}"><b>${ITEM_ACTIONS[id].label}</b><small>${ITEM_ACTIONS[id].detail}</small></button>`
      : `<span class="empty-slot"><i>${index + 1}</i><small>VAZIO</small></span>`;
  }).join("");
  $("inventoryExpand").disabled = capacity < 6;
  $("inventoryExpand").classList.toggle("unlocked", capacity >= 6);
  $("inventoryExpand").setAttribute("aria-expanded", String(Boolean(run.inventoryExpanded)));
  $("inventoryExpand").setAttribute("aria-label", capacity < 6 ? "Encontre a bolsa para liberar 6 espaços" : run.inventoryExpanded ? "Recolher mochila" : "Expandir mochila para 6 espaços");
  $("inventoryCount").textContent = capacity < 6 ? "3" : run.inventoryExpanded ? "6" : "+3";
}

function useInventoryItem(id) {
  if (!run || transitionLocked) return;
  const item = ITEM_ACTIONS[id];
  const index = run.items.indexOf(id);
  if (!item || index < 0) return;
  item.use(run);
  run.items.splice(index, 1);
  toast(`${item.label} ATIVADA · ${item.detail}`);
  sound?.play("item");
  renderHud();
}

function showItemAcquired(applied) {
  const expanded = applied.inventoryCapacity > 0;
  const item = applied.item ? ITEM_ACTIONS[applied.item] : null;
  if (!expanded && !item) return;
  const label = expanded ? "BOLSA" : item.label;
  const detail = expanded ? "Mochila ampliada de 3 para 6 espaços. Use o botão inferior para abrir ou recolher." : item.detail;
  animateItemToInventory(label);
  transitionLocked = true;
  $("itemNoticeTitle").textContent = expanded ? "BOLSA EQUIPADA" : `${label} GUARDADA`;
  $("itemNoticeText").textContent = detail;
  $("itemNoticeHint").textContent = expanded ? "MELHORIA PASSIVA · NÃO PRECISA SER ATIVADA" : "PODE SER ATIVADO A QUALQUER MOMENTO PELA MOCHILA";
  $("itemNotice").hidden = false;
  sound?.play("item");
}

function animateItemToInventory(label) {
  const source = $("postImage").getBoundingClientRect();
  const target = $("inventoryExpand").getBoundingClientRect();
  const flyer = document.createElement("div");
  flyer.className = "item-fly";
  flyer.textContent = label;
  flyer.style.setProperty("--from-x", `${source.left + source.width / 2}px`);
  flyer.style.setProperty("--from-y", `${source.top + source.height / 2}px`);
  flyer.style.setProperty("--to-x", `${target.left + target.width / 2}px`);
  flyer.style.setProperty("--to-y", `${target.top + target.height / 2}px`);
  document.body.appendChild(flyer);
  setTimeout(() => flyer.remove(), 900);
}

function showHeartFeedback() {
  const heart = $("heartBurst");
  heart.textContent = (CARD_ACTIONS[current?.type] || CARD_ACTIONS.NORMAL).verb;
  heart.classList.remove("show");
  void heart.offsetWidth;
  heart.classList.add("show");
  setTimeout(() => heart.classList.remove("show"), 720);
}

async function interactWithCard(options = {}) {
  if (!run || !current || transitionLocked || !$("tutorialOverlay").hidden) return;
  const started = beginInteraction(run, current);
  if (!started.ok) {
    if (started.reason === "INSUFFICIENT_ENERGY") {
      toast("ENERGIA INSUFICIENTE");
      $("card").classList.add("denied");
      setTimeout(() => $("card").classList.remove("denied"), 360);
    }
    return;
  }

  showHeartFeedback();
  spawnFx("like");
  $("card").classList.add("interacting");
  $("heartBtn").disabled = true;
  renderHud();

  const rarity = GAME_CONFIG.rarity[current.rarity] || GAME_CONFIG.rarity.COMMON;
  const interaction = { ...director.tuneInteraction(current.interaction, run, rarity), availableCoins: run.coins, skipCountdown: Boolean(options.skipCountdown) };
  const result = interaction.type === "INSTANT"
    ? { success: true, score: 0, accuracy: 1, time: 0, instant: true }
    : await miniGames.start(interaction.type, interaction);

  if (!run || !current || current.state !== CARD_STATES.INTERACTING) return;
  finishInteraction(result);
}

function finishInteraction(miniGameResult) {
  const resolution = resolveCard(run, current, miniGameResult.success);
  if (!resolution.ok) return;
  if (miniGameResult.effects) applyEffects(run, miniGameResult.effects);
  if (miniGameResult.future) applyFutureEffects(run, miniGameResult.future);
  meta.stats.interactions++;
  meta.stats[miniGameResult.success ? "victories" : "defeats"]++;
  save();

  const configured = miniGameResult.success ? current.success : current.failure;
  const message = miniGameResult.message || describeResult(configured, resolution.applied, resolution);
  $("card").classList.remove("interacting");
  $("card").classList.add(miniGameResult.success ? "success" : "failure");
  const resultLabel = miniGameResult.instant ? "CURTIDO" : miniGameResult.success ? "VITÓRIA" : "RESULTADO";
  $("outcome").innerHTML = `<strong>${resultLabel}</strong><span>${message}</span>`;
  $("outcome").className = `outcome show ${miniGameResult.success ? "good" : "bad"}`;
  $("decisionHint").textContent = "Resolvido. Role para continuar.";
  renderHud();
  if (miniGameResult.success) spawnFx("success");

  miniGames.showResult(miniGameResult.success, message, () => {
    renderHud();
    if (resolution.applied.item || resolution.applied.inventoryCapacity) showItemAcquired(resolution.applied);
    else if (run.ended) endRun(false);
  }, { instant: Boolean(miniGameResult.instant) });
}

function describeResult(configured = {}, applied = {}, resolution = {}) {
  if (configured.randomReward || resolution.modified || resolution.echoed) {
    const parts = [];
    if (applied.health) parts.push(`${applied.health > 0 ? "+" : ""}${applied.health} VIDA`);
    if (applied.energy) parts.push(`${applied.energy > 0 ? "+" : ""}${applied.energy} ENERGIA`);
    if (applied.coins) parts.push(`${applied.coins > 0 ? "+" : ""}${applied.coins} MOEDAS`);
    if (applied.item) parts.push("ITEM");
    if (resolution.echoed) parts.push("ECO x2");
    return parts.join(" · ") || configured.message || "Nada aconteceu.";
  }
  if (applied.evolution) return `OVO · ESTÁGIO ${applied.evolution.stage}/4`;
  return configured.message || "Carta resolvida.";
}

function skipOrContinue() {
  if (!run || !current || transitionLocked || !$("miniGameOverlay").hidden || !$("tutorialOverlay").hidden) return;
  if (current.state === CARD_STATES.INTERACTING) return;
  if (current.state === CARD_STATES.VISIBLE) skipCard(run, current, GAME_CONFIG.recentCardLimit, GAME_CONFIG.scrollEnergyCost);
  else if (current.state === CARD_STATES.RESOLVED) recordScroll(run, current, GAME_CONFIG.recentCardLimit, GAME_CONFIG.scrollEnergyCost);
  else return;

  transitionLocked = true;
  $("card").classList.add("scroll-away");
  setTimeout(() => {
    $("card").classList.remove("scroll-away", "success", "failure");
    transitionLocked = false;
    if (run.ended) endRun(false);
    else nextCard();
  }, 300);
}

function completeNight() {
  if (!run || run.ended) return;
  meta.night = run.night + 1;
  endRun(false, true);
}

const BOSS_ANIMATION_CLASSES = ["is-entering", "is-charging", "is-attacking", "is-hit", "is-defeated"];

function animateBoss(state, duration) {
  const arena = $("bossArena");
  BOSS_ANIMATION_CLASSES.forEach((name) => arena.classList.remove(name));
  void arena.offsetWidth;
  arena.classList.add(state);
  return new Promise((resolve) => setTimeout(() => {
    if (state !== "is-defeated") arena.classList.remove(state);
    resolve();
  }, duration));
}

function animateBossAttack() {
  $("boss").classList.add("boss-danger");
  sound?.play("boss");
  return animateBoss("is-attacking", 620).then(() => $("boss").classList.remove("boss-danger"));
}

async function startBossBattle() {
  if (!run || run.bossStarted || run.ended) return;
  run.bossStarted = true;
  transitionLocked = true;
  const token = ++bossBattleToken;
  const boss = BOSSES[(run.night - 1) % BOSSES.length];
  $("bossTitle").textContent = `${boss.title} · NOITE ${run.night}`;
  $("bossSprite").dataset.boss = boss.id;
  $("bossTaunt").textContent = boss.taunt;
  $("bossHealthFill").style.width = "100%";
  BOSS_ANIMATION_CLASSES.forEach((name) => $("bossArena").classList.remove(name));
  $("boss").classList.remove("boss-danger");
  showScreen("boss");
  sound?.play("boss");
  await animateBoss("is-entering", 900);
  if (!run || token !== bossBattleToken) return;

  let phase = 0;
  while (phase < BOSS_PHASES.length && run && !run.ended && token === bossBattleToken) {
    const settings = BOSS_PHASES[phase];
    $("bossPhase").textContent = `FASE ${phase + 1}/${BOSS_PHASES.length}`;
    $("bossTaunt").textContent = settings.title;
    await animateBoss("is-charging", 720);
    if (!run || token !== bossBattleToken) return;
    const result = await bossGames.start(settings.type, { ...settings, skipCountdown: phase > 0 });
    if (!run || token !== bossBattleToken) return;
    bossGames.cancel();
    if (!result.success) {
      await animateBossAttack();
      if (!run || token !== bossBattleToken) return;
      run.health = 0;
      run.ended = true;
      run.endedReason = "boss";
      meta.night = 1;
      save();
      $("bossTaunt").textContent = "O chefe encerrou sua sequência.";
      sound?.play("defeat");
      await showBossResult(false, "DERROTA · RETORNO À NOITE 1");
      endRun(false);
      return;
    }
    phase++;
    $("bossHealthFill").style.width = `${Math.max(0, 100 - phase / BOSS_PHASES.length * 100)}%`;
    sound?.play("victory");
    await animateBoss(phase === BOSS_PHASES.length ? "is-defeated" : "is-hit", phase === BOSS_PHASES.length ? 1200 : 680);
    if (!run || token !== bossBattleToken) return;
    await showBossResult(true, phase === BOSS_PHASES.length ? "NÚCLEO DESTRUÍDO" : "CAMADA ROMPIDA");
  }

  if (!run || token !== bossBattleToken || run.ended) return;
  applyEffects(run, { coins: 50 + run.night * 10 });
  transitionLocked = false;
  completeNight();
}

function showBossResult(success, message) {
  return new Promise((resolve) => bossGames.showResult(success, message, resolve, { duration: 850 }));
}

function endRun(voluntary, completed = false) {
  if (!run) return;
  miniGames.cancel();
  bossGames.cancel();
  bossBattleToken++;
  $("tutorialOverlay").hidden = true;
  run.ended = true;
  const keptCoins = voluntary || completed ? run.coins : Math.ceil(run.coins * 0.7);
  meta.coins += keptCoins;
  meta.bestProgress = Math.max(meta.bestProgress, run.cardsScrolled);
  meta.runs++;
  save();
  const bossDefeat = run.endedReason === "boss";
  $("resultTitle").textContent = completed ? `NOITE ${run.night} CONCLUÍDA` : bossDefeat ? "VOCÊ MORREU NO CHEFE" : voluntary ? "VOCÊ FECHOU O FEED" : "A NOITE VENCEU";
  $("resultSubtitle").textContent = completed
    ? `Próxima noite: ${nightTarget(GAME_CONFIG, run.night + 1)} posts.`
    : bossDefeat
      ? "A sequência foi perdida. Recomece na noite 1 ou volte ao quarto."
    : voluntary
      ? "O algoritmo perdeu sua atenção. Por enquanto."
      : run.endedReason === "energy" ? "Sua Energia acabou antes do amanhecer." : "A madrugada cobrou o último coração.";
  $("resultCoins").textContent = keptCoins;
  $("resultPosts").textContent = run.cardsScrolled;
  $("resultCombo").textContent = run.cardsInteracted;
  $("resultDiscoveries").textContent = meta.discoveries.length;
  $("resultMascot").dataset.sprite = voluntary ? "happy" : "sleepy";
  $("againBtn").textContent = bossDefeat ? "RECOMEÇAR NOITE 1" : "NOVA NOITE";
  sound?.play(completed ? "victory" : voluntary ? "save" : "defeat");
  showScreen("result");
  updateMeta();
}

function spawnFx(kind) {
  const fx = $("fx");
  fx.innerHTML = "";
  const count = kind === "success" ? 18 : 10;
  for (let index = 0; index < count; index++) {
    const spark = document.createElement("i");
    spark.className = `spark ${kind}`;
    const angle = Math.PI * 2 * index / count;
    const distance = 48 + Math.random() * 90;
    spark.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    fx.appendChild(spark);
  }
  setTimeout(() => { fx.innerHTML = ""; }, 850);
}

function updateMeta() {
  $("bankCoins").textContent = meta.coins;
  $("discoveryCount").textContent = meta.discoveries.length;
  document.body.dataset.cosmetic = meta.equippedCosmetic || "original";
}

function renderCollection() {
  $("collectionGrid").innerHTML = registry.all().map((card) => {
    const found = meta.discoveries.includes(card.id);
    const saved = meta.savedPosts.includes(card.id);
    return `<article class="collection-item ${found ? "" : "locked"} ${saved ? "saved" : ""}">${found ? `<img src="${card.image}" alt=""><small>${card.title.toUpperCase()}</small><span>${card.rarity} · ${card.type}</span><p>${card.description}</p>` : "<span class=unknown>?</span><small>???</small>"}${saved ? "<b>SALVO · CHANCE AUMENTADA</b>" : ""}</article>`;
  }).join("");
}

function toggleComments() {
  if (!current) return;
  const panel = $("commentsPanel");
  if (!panel.hidden) { panel.hidden = true; return; }
  const comments = COMMENT_BANK[current.type] || COMMENT_BANK.DEFAULT;
  const hint = COMMENT_HINTS[current.interaction?.type] || COMMENT_HINTS.DEFAULT;
  const savedNote = meta.savedPosts.includes(current.id) ? "este post salvo aparece com mais frequência" : "salvar aumenta a chance de reencontrar este post";
  panel.innerHTML = [
    `<p class="comment-pinned"><b>COMUNIDADE</b> ${hint}</p>`,
    ...comments.map((comment, index) => `<p><b>@noite${index + 1 + run.night}</b> ${comment}</p>`),
    `<p><b>@arquivista</b> ${savedNote}</p>`
  ].join("");
  if (!meta.readComments.includes(current.id)) {
    meta.readComments.push(current.id);
    save();
  }
  $("commentBtn").classList.add("viewed");
  panel.hidden = false;
}

function renderStore() {
  $("storeCoins").textContent = meta.coins;
  $("storeGrid").innerHTML = COSMETICS.map((cosmetic) => {
    const owned = meta.ownedCosmetics.includes(cosmetic.id);
    const equipped = meta.equippedCosmetic === cosmetic.id;
    return `<article class="store-item"><span class="cosmetic-preview" style="background-position:${cosmetic.pos}"></span><h3>${cosmetic.name}</h3><button data-cosmetic="${cosmetic.id}" ${equipped ? "disabled" : ""}>${equipped ? "EQUIPADO" : owned ? "EQUIPAR" : `${cosmetic.price} MOON COINS`}</button></article>`;
  }).join("");
  document.querySelectorAll("#storeGrid [data-cosmetic]").forEach((button) => button.addEventListener("click", () => buyCosmetic(button.dataset.cosmetic)));
}

function buyCosmetic(id) {
  const cosmetic = COSMETICS.find((entry) => entry.id === id);
  if (!cosmetic) return;
  if (!meta.ownedCosmetics.includes(id)) {
    if (meta.coins < cosmetic.price) { toast("MOON COINS INSUFICIENTES"); return; }
    meta.coins -= cosmetic.price;
    meta.ownedCosmetics.push(id);
  }
  meta.equippedCosmetic = id;
  save();
  updateMeta();
  renderStore();
}

function handleTapGesture(event) {
  if (event.target.closest(".social-actions")) { gestureStart = null; return; }
  if (!gestureStart || !current || !run) return;
  const distance = Math.hypot(event.clientX - gestureStart.x, event.clientY - gestureStart.y);
  const elapsed = performance.now() - gestureStart.time;
  gestureStart = null;
  if (distance > 16 || elapsed > 280) return;
  const now = performance.now();
  if (now - lastTapAt < 320) { lastTapAt = 0; interactWithCard(); }
  else lastTapAt = now;
}

function resetCardDrag() {
  const card = $("card");
  card.classList.remove("dragging", "swipe-ready");
  card.style.removeProperty("--drag-y");
  card.style.removeProperty("--drag-opacity");
  $("dragCost").classList.remove("show", "danger");
}

function handleCardPointerDown(event) {
  if (event.target.closest(".social-actions") || !$('miniGameOverlay').hidden || transitionLocked) {
    gestureStart = null;
    return;
  }
  gestureStart = { x: event.clientX, y: event.clientY, time: performance.now(), pointerId: event.pointerId, soundAt: 0 };
  $("artStage").setPointerCapture?.(event.pointerId);
  $("card").classList.add("dragging");
  $("dragCost").textContent = "ARRASTAR: -0,25 ENERGIA";
  $("dragCost").classList.add("show");
  sound?.play("drag");
}

function handleCardPointerMove(event) {
  if (!gestureStart || gestureStart.pointerId !== event.pointerId) return;
  const dx = event.clientX - gestureStart.x;
  const dy = event.clientY - gestureStart.y;
  if (Math.abs(dy) <= Math.abs(dx)) return;
  event.preventDefault();
  const dragY = Math.max(-170, Math.min(24, dy));
  $("card").style.setProperty("--drag-y", `${dragY}px`);
  $("card").style.setProperty("--drag-opacity", String(Math.max(.42, 1 - Math.abs(Math.min(0, dragY)) / 260)));
  $("card").classList.toggle("swipe-ready", dy < -58);
  if (Math.abs(dragY - gestureStart.soundAt) >= 34) {
    gestureStart.soundAt = dragY;
    sound?.play("drag");
  }
  const remaining = run.energy - GAME_CONFIG.scrollEnergyCost;
  $("dragCost").classList.toggle("danger", remaining < GAME_CONFIG.minimumPlayableEnergy);
  $("dragCost").textContent = remaining < GAME_CONFIG.minimumPlayableEnergy ? "ARRASTAR: FIM DA NOITE" : `ARRASTAR: -${formatEnergy(GAME_CONFIG.scrollEnergyCost)} ENERGIA`;
}

function handleCardPointerUp(event) {
  if (!gestureStart || gestureStart.pointerId !== event.pointerId) { resetCardDrag(); return; }
  const dx = event.clientX - gestureStart.x;
  const dy = event.clientY - gestureStart.y;
  if (dy < -58 && Math.abs(dy) > Math.abs(dx)) {
    gestureStart = null;
    resetCardDrag();
    skipOrContinue();
    return;
  }
  resetCardDrag();
  handleTapGesture(event);
}

$("startBtn").addEventListener("click", newRun);
$("againBtn").addEventListener("click", newRun);
$("stopBtn").addEventListener("click", () => endRun(true));
$("bossStop").addEventListener("click", () => endRun(true));
$("homeBtn").addEventListener("click", () => showScreen("home"));
$("heartBtn").addEventListener("click", interactWithCard);
$("commentBtn").addEventListener("click", toggleComments);
$("saveBtn").addEventListener("click", () => {
  if (!run || !current) return;
  const index = meta.savedPosts.indexOf(current.id);
  if (index >= 0) {
    meta.savedPosts.splice(index, 1);
    run.savedCards = run.savedCards.filter((id) => id !== current.id);
    toast("REMOVIDO DOS SALVOS");
  } else {
    meta.savedPosts.push(current.id);
    if (!run.savedCards.includes(current.id)) run.savedCards.push(current.id);
    discover(current.id);
    toast("SALVO · CHANCE DE REENCONTRO AUMENTADA");
    sound?.play("save");
  }
  save();
  renderEngagement();
});
$("slots").addEventListener("click", (event) => {
  const button = event.target.closest("[data-item]");
  if (button) useInventoryItem(button.dataset.item);
});
$("inventoryExpand").addEventListener("click", () => {
  if (!run || run.inventoryCapacity < 6) return;
  run.inventoryExpanded = !run.inventoryExpanded;
  renderInventory();
});
$("itemNoticeClose").addEventListener("click", () => {
  $("itemNotice").hidden = true;
  transitionLocked = false;
  if (run?.ended) endRun(false);
});
$("tutorialNext").addEventListener("click", advanceTutorial);
$("collectionBtn").addEventListener("click", () => { renderCollection(); showScreen("collection"); });
$("collectionBack").addEventListener("click", () => showScreen("home"));
$("storeBtn").addEventListener("click", () => { renderStore(); showScreen("store"); });
$("storeBack").addEventListener("click", () => showScreen("home"));

$("artStage").addEventListener("pointerdown", handleCardPointerDown);
$("artStage").addEventListener("pointermove", handleCardPointerMove);
$("artStage").addEventListener("pointerup", handleCardPointerUp);
$("artStage").addEventListener("pointercancel", () => { gestureStart = null; resetCardDrag(); });

$("feed").addEventListener("wheel", (event) => {
  if (wheelLocked || Math.abs(event.deltaY) < 18) return;
  wheelLocked = true;
  skipOrContinue();
  setTimeout(() => { wheelLocked = false; }, 450);
}, { passive: true });

updateMeta();
