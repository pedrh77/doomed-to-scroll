"use strict";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "doomed-to-scroll-v2";
const { POST_ROOT, POST_ASSETS, CARD_CONFIG, GAME_CONFIG } = DtsConfig;
const {
  CARD_STATES, CardRegistry, FeedGenerator, GameDirector, createRunState,
  beginInteraction, resolveCard, applyEffects, applyFutureEffects, skipCard, recordScroll, nightTime
} = DtsCore;

const DEFAULT_META = {
  coins: 0, discoveries: [], bestProgress: 0, runs: 0,
  ownedCosmetics: ["original"], equippedCosmetic: "original",
  savedPosts: [],
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
  NORMAL: { verb: "CURTIR", icon: "♥" }, LIFE: { verb: "RESGATAR", icon: "+" },
  ENERGY: { verb: "RECUPERAR", icon: "E" }, ITEM: { verb: "PEGAR", icon: "I" },
  CHEST: { verb: "ABRIR", icon: "□" }, ENEMY: { verb: "ENFRENTAR", icon: "!" },
  RISK: { verb: "ARRISCAR", icon: "?" }, MYSTERY: { verb: "INVESTIGAR", icon: "*" },
  EVOLUTION: { verb: "DESPERTAR", icon: "^" }
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

const registry = new CardRegistry(POST_ASSETS, CARD_CONFIG, POST_ROOT);
const director = new GameDirector(GAME_CONFIG);
const generator = new FeedGenerator(registry, GAME_CONFIG, director);
const miniGames = new DtsMiniGames.MiniGameManager($("miniGameOverlay"));

let meta = loadSave();
let run = null;
let current = null;
let transitionLocked = false;
let gestureStart = null;
let lastTapAt = 0;
let wheelLocked = false;
let tutorialIndex = 0;

const TUTORIAL_STEPS = [
  { icon: "01", title: "ROLE O FEED", text: "Deslize para cima ou para baixo. Passar um post não gasta Energia." },
  { icon: "02", title: "ESCOLHA A AÇÃO", text: "O botão lateral muda conforme o card. Dois toques na imagem também executam a ação." },
  { icon: "03", title: "POUPE ENERGIA", text: "Veja risco e recompensa antes de agir. Monstros iniciam disputas automaticamente." }
];

function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    return {
      ...DEFAULT_META, ...saved,
      discoveries: Array.isArray(saved.discoveries) ? saved.discoveries : [],
      savedPosts: Array.isArray(saved.savedPosts) ? saved.savedPosts : [],
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
  run = createRunState(GAME_CONFIG);
  run.tutorialPending = !meta.tutorialSeen;
  tutorialIndex = 0;
  current = null;
  transitionLocked = false;
  document.body.classList.remove("critical-health");
  showScreen("game");
  nextCard();
}

function nextCard() {
  if (!run || run.ended) { endRun(false); return; }
  miniGames.cancel();
  current = generator.next(run);
  if (!current) { endRun(true); return; }
  discover(current.id);
  renderCard();
  renderHud();
  if (run.tutorialPending) showTutorial();
  else if (current.type === "ENEMY") startMonsterEncounter();
}

function renderCard() {
  const action = CARD_ACTIONS[current.type] || CARD_ACTIONS.NORMAL;
  $("card").className = `post-card rarity-${current.rarity.toLowerCase()}`;
  $("postImage").src = current.image;
  $("postImage").alt = current.title;
  $("eventName").textContent = current.title;
  $("eventText").textContent = current.description;
  $("rarity").textContent = current.rarity;
  $("category").textContent = current.type;
  $("energyCost").textContent = current.energyCost ? `ENERGIA -${current.energyCost}` : "SEM CUSTO";
  $("energyCost").classList.toggle("free", !current.energyCost);
  $("riskText").textContent = describeRisk(current);
  $("rewardText").textContent = describeReward(current);
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
}

function startMonsterEncounter() {
  transitionLocked = true;
  miniGames.showEncounterCountdown(current.title, () => {
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
  $("nightPercent").textContent = `${Math.round(state.nightProgress * 100)}%`;
  $("energyValue").textContent = `${run.energy}/${run.maxEnergy}`;
  $("healthValue").textContent = `${run.health}/${run.maxHealth}`;
  $("energyPips").innerHTML = Array.from({ length: run.maxEnergy }, (_, index) => `<i class="${index < run.energy ? "full" : ""}"></i>`).join("");
  $("healthHearts").innerHTML = Array.from({ length: run.maxHealth }, (_, index) => `<i class="${index < run.health ? "full" : ""}">♥</i>`).join("");
  $("mascot").dataset.sprite = run.health <= 1 ? "frightened" : run.energy <= 2 ? "sleepy" : current && current.type === "ENEMY" ? "curious" : "neutral";
  document.body.classList.toggle("critical-health", run.health <= 1);
}

function showHeartFeedback() {
  const heart = $("heartBurst");
  heart.textContent = (CARD_ACTIONS[current?.type] || CARD_ACTIONS.NORMAL).icon;
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
  const interaction = { ...director.tuneInteraction(current.interaction, run, rarity), skipCountdown: Boolean(options.skipCountdown) };
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
  const message = miniGameResult.message || describeResult(configured, resolution.applied);
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
    if (run.ended) endRun(false);
  }, { instant: Boolean(miniGameResult.instant) });
}

function describeResult(configured = {}, applied = {}) {
  if (configured.randomReward) {
    const parts = [];
    if (applied.health) parts.push(`${applied.health > 0 ? "+" : ""}${applied.health} VIDA`);
    if (applied.energy) parts.push(`${applied.energy > 0 ? "+" : ""}${applied.energy} ENERGIA`);
    if (applied.coins) parts.push(`${applied.coins > 0 ? "+" : ""}${applied.coins} MOEDAS`);
    return parts.join(" · ") || configured.message || "Nada aconteceu.";
  }
  if (applied.evolution) return `OVO · ESTÁGIO ${applied.evolution.stage}/4`;
  return configured.message || "Carta resolvida.";
}

function skipOrContinue() {
  if (!run || !current || transitionLocked || !$("miniGameOverlay").hidden || !$("tutorialOverlay").hidden) return;
  if (current.state === CARD_STATES.INTERACTING) return;
  if (current.state === CARD_STATES.VISIBLE) skipCard(run, current, GAME_CONFIG.recentCardLimit);
  else if (current.state === CARD_STATES.RESOLVED) recordScroll(run, current, GAME_CONFIG.recentCardLimit);
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

function endRun(voluntary) {
  if (!run) return;
  miniGames.cancel();
  $("tutorialOverlay").hidden = true;
  run.ended = true;
  const keptCoins = voluntary ? run.coins : Math.ceil(run.coins * 0.7);
  meta.coins += keptCoins;
  meta.bestProgress = Math.max(meta.bestProgress, run.cardsScrolled);
  meta.runs++;
  save();
  $("resultTitle").textContent = voluntary ? "VOCÊ FECHOU O FEED" : "A NOITE VENCEU";
  $("resultSubtitle").textContent = voluntary ? "O algoritmo perdeu sua atenção. Por enquanto." : "A madrugada cobrou o último coração.";
  $("resultCoins").textContent = keptCoins;
  $("resultPosts").textContent = run.cardsScrolled;
  $("resultCombo").textContent = run.cardsInteracted;
  $("resultDiscoveries").textContent = meta.discoveries.length;
  $("resultMascot").dataset.sprite = voluntary ? "happy" : "sleepy";
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
    return `<article class="collection-item ${found ? "" : "locked"} ${saved ? "saved" : ""}">${found ? `<img src="${card.image}" alt="">` : "<span class=unknown>?</span>"}<small>${found ? card.title.toUpperCase() : "???"}</small>${saved ? "<b>SALVO</b>" : ""}</article>`;
  }).join("");
}

function toggleComments() {
  if (!current) return;
  const panel = $("commentsPanel");
  if (!panel.hidden) { panel.hidden = true; return; }
  const comments = COMMENT_BANK[current.type] || COMMENT_BANK.DEFAULT;
  panel.innerHTML = comments.map((comment, index) => `<p><b>@noite${index + 1}</b> ${comment}</p>`).join("");
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
    toast("REMOVIDO DOS SALVOS");
  } else {
    meta.savedPosts.push(current.id);
    discover(current.id);
    toast("SALVO NA COLEÇÃO");
  }
  save();
  renderEngagement();
});
$("tutorialNext").addEventListener("click", advanceTutorial);
$("collectionBtn").addEventListener("click", () => { renderCollection(); showScreen("collection"); });
$("collectionBack").addEventListener("click", () => showScreen("home"));
$("storeBtn").addEventListener("click", () => { renderStore(); showScreen("store"); });
$("storeBack").addEventListener("click", () => showScreen("home"));

$("artStage").addEventListener("pointerdown", (event) => {
  if (event.target.closest(".social-actions")) { gestureStart = null; return; }
  gestureStart = { x: event.clientX, y: event.clientY, time: performance.now() };
});
$("artStage").addEventListener("pointerup", handleTapGesture);

$("feed").addEventListener("touchstart", (event) => {
  if (!event.touches.length) return;
  gestureStart = { x: event.touches[0].clientX, y: event.touches[0].clientY, time: performance.now() };
}, { passive: true });

$("feed").addEventListener("touchend", (event) => {
  if (!gestureStart || !event.changedTouches.length || !$("miniGameOverlay").hidden) return;
  const dx = event.changedTouches[0].clientX - gestureStart.x;
  const dy = event.changedTouches[0].clientY - gestureStart.y;
  if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
    gestureStart = null;
    skipOrContinue();
  }
}, { passive: true });

$("feed").addEventListener("wheel", (event) => {
  if (wheelLocked || Math.abs(event.deltaY) < 18) return;
  wheelLocked = true;
  skipOrContinue();
  setTimeout(() => { wheelLocked = false; }, 450);
}, { passive: true });

updateMeta();
