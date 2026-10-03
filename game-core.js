"use strict";

(function exposeCore(global) {
  const CARD_STATES = Object.freeze({ VISIBLE: "VISIBLE", INTERACTING: "INTERACTING", RESOLVED: "RESOLVED", SKIPPED: "SKIPPED" });
  const SPECIAL_TYPES = new Set(["CHEST", "RISK", "MYSTERY", "EVOLUTION"]);
  const STATUS_TRIGGERS = Object.freeze({
    focus: "interaction", adrenaline: "interaction", luck: "post", curse: "interaction",
    heavySleep: "interaction", acceleratedFeed: "interaction", echo: "resolution",
    glitch: "post", silence: "post", hunger: "interaction"
  });

  function getStatus(run, id) { return run?.statuses?.[id] || null; }
  function hasStatus(run, id) { return Boolean(getStatus(run, id)?.remaining > 0); }

  function applyStatuses(run, statuses = {}) {
    if (!run.statuses) run.statuses = {};
    Object.entries(statuses).forEach(([id, duration]) => {
      const remaining = Math.max(0, Math.floor(Number(duration) || 0));
      if (!remaining) return;
      const current = getStatus(run, id);
      run.statuses[id] = {
        remaining: Math.max(current?.remaining || 0, remaining),
        trigger: STATUS_TRIGGERS[id] || "post",
        grantedAtScroll: run.cardsScrolled
      };
    });
    return run.statuses;
  }

  function consumeStatus(run, id, amount = 1) {
    const status = getStatus(run, id);
    if (!status) return false;
    status.remaining = Math.max(0, status.remaining - amount);
    if (!status.remaining) delete run.statuses[id];
    return true;
  }

  function tickStatuses(run, trigger) {
    Object.entries(run.statuses || {}).forEach(([id, status]) => {
      if (status.trigger !== trigger) return;
      if (trigger === "post" && status.grantedAtScroll === run.cardsScrolled - 1) {
        delete status.grantedAtScroll;
        return;
      }
      consumeStatus(run, id);
    });
  }

  function scaleNumericEffects(effects = {}, multiplier = 1, positivesOnly = false) {
    const scaled = { ...effects };
    ["health", "energy", "coins"].forEach((key) => {
      if (!Number.isFinite(scaled[key]) || (positivesOnly && scaled[key] <= 0)) return;
      scaled[key] = scaled[key] < 0
        ? Math.floor(scaled[key] * multiplier)
        : Math.ceil(scaled[key] * multiplier);
    });
    return scaled;
  }

  function slugify(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function createFallbackCard(filename, root) {
    const cleanName = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const looksGenerated = /^[a-f0-9]{8}(?:\s[a-f0-9]{4}){3}\s[a-f0-9]{12}$/i.test(cleanName);
    const readableName = looksGenerated
      ? "Post misterioso"
      : cleanName.replace(/\b\w/g, (letter) => letter.toUpperCase());
    return {
      id: `post-${slugify(cleanName)}`,
      image: `${root}${filename}`,
      title: readableName,
      description: looksGenerated ? "Uma publicação sem autor apareceu no seu feed." : "Algo novo apareceu no meio da madrugada.",
      type: "NORMAL",
      rarity: "COMMON",
      weight: 10,
      energyCost: 0,
      interaction: { type: "INSTANT" },
      success: { message: "Curtida registrada." },
      failure: {},
      oncePerRun: false
    };
  }

  class CardRegistry {
    constructor(assetNames, definitions, root = "") {
      this.cards = assetNames.map((filename) => ({ ...createFallbackCard(filename, root), ...(definitions[filename] || {}), filename, image: `${root}${filename}` }));
      this.byId = new Map(this.cards.map((card) => [card.id, card]));
    }
    all() { return this.cards.map((card) => ({ ...card })); }
    get(id) { return this.byId.get(id); }
  }

  function weightedPick(entries, getWeight = (entry) => entry.weight, rng = Math.random) {
    if (!entries.length) return null;
    const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(getWeight(entry)) || 0), 0);
    if (total <= 0) return entries[0];
    let roll = rng() * total;
    for (const entry of entries) {
      roll -= Math.max(0, Number(getWeight(entry)) || 0);
      if (roll <= 0) return entry;
    }
    return entries[entries.length - 1];
  }

  function rollRarity(rarityConfig, rng = Math.random, rareBoost = 0) {
    const entries = Object.entries(rarityConfig).map(([name, settings]) => ({
      name,
      weight: settings.chance * (name === "RARE" || name === "EPIC" || name === "LEGENDARY" ? 1 + rareBoost : 1)
    }));
    return weightedPick(entries, (entry) => entry.weight, rng).name;
  }

  class GameDirector {
    constructor(config) { this.config = config; }
    snapshot(run) {
      const targetCards = run.targetCards || this.config.bossAtCards;
      const nightProgress = Math.min(1, run.cardsScrolled / targetCards);
      const nightDifficulty = Math.min(.8, Math.max(0, (run.night - 1) * .08));
      return {
        nightProgress,
        difficulty: 1 + nightProgress * 0.5 + nightDifficulty,
        rareBoost: nightProgress * 0.35 + (run.feedEffects?.rareBoost || 0) + (hasStatus(run, "luck") ? 1.25 : 0),
        bossReady: run.cardsScrolled >= targetCards
      };
    }
    tuneInteraction(interaction, run, raritySettings = {}) {
      const difficulty = this.snapshot(run).difficulty * (raritySettings.difficultyMultiplier || 1);
      const tuned = { ...interaction };
      if (Number.isFinite(tuned.target)) tuned.target = Math.max(1, Math.round(tuned.target * difficulty));
      if (Number.isFinite(tuned.length)) tuned.length = Math.min(7, Math.max(2, Math.round(tuned.length * Math.min(1.3, difficulty))));
      if (Number.isFinite(tuned.rounds)) tuned.rounds = Math.min(7, Math.max(2, Math.round(tuned.rounds * Math.min(1.25, difficulty))));
      if (Number.isFinite(tuned.duration)) tuned.duration /= Math.min(1.45, difficulty);
      if (hasStatus(run, "focus") && tuned.type === "TIMING") tuned.zoneSize = Math.min(.65, (tuned.zoneSize || .28) + .2);
      if (hasStatus(run, "heavySleep")) {
        if (Number.isFinite(tuned.duration)) tuned.duration *= 1.35;
        tuned.pace = .72;
      }
      if (hasStatus(run, "acceleratedFeed")) {
        if (Number.isFinite(tuned.duration)) tuned.duration *= .72;
        tuned.pace = 1.35;
      }
      return tuned;
    }
  }

  class FeedGenerator {
    constructor(registry, config, director, rng = Math.random) {
      this.registry = registry;
      this.config = config;
      this.director = director;
      this.rng = rng;
    }
    next(run) {
      const recent = run.recentCards || [];
      const lastId = recent[recent.length - 1];
      const recentCards = recent.map((id) => this.registry.get(id)).filter(Boolean);
      const enemyCount = recentCards.filter((card) => card.type === "ENEMY").length;
      const specialCount = recentCards.filter((card) => SPECIAL_TYPES.has(card.type)).length;
      const directorState = this.director.snapshot(run);
      const desiredRarity = rollRarity(this.config.rarity, this.rng, directorState.rareBoost);
      let pool = this.registry.all().filter((card) => {
        if (card.id === lastId) return false;
        if (card.oncePerRun && run.seenCards.includes(card.id)) return false;
        if (enemyCount >= this.config.maxEnemiesInRecent && card.type === "ENEMY") return false;
        if (specialCount >= this.config.maxSpecialsInRecent && SPECIAL_TYPES.has(card.type)) return false;
        if (card.success?.item && run.items.length >= (run.inventoryCapacity || 3)) return false;
        if (((run.feedEffects?.safeCards || 0) > 0 || hasStatus(run, "silence")) && card.type === "ENEMY") return false;
        return true;
      });
      const rarityPool = pool.filter((card) => card.rarity === desiredRarity);
      if (rarityPool.length) pool = rarityPool;
      if (!pool.length) pool = this.registry.all().filter((card) => card.id !== lastId);
      const card = weightedPick(pool, (entry) => entry.weight * ((run.savedCards || []).includes(entry.id) ? 1.8 : 1), this.rng);
      if (!card) return null;
      const energyDiscount = run.feedEffects?.energyDiscount || 0;
      return { ...card, energyCost: Math.max(0, card.energyCost - energyDiscount), state: CARD_STATES.VISIBLE };
    }
  }

  function createRunState(config) {
    return {
      health: config.startingHealth,
      maxHealth: config.maxHealth,
      energy: config.startingEnergy,
      maxEnergy: config.maxEnergy,
      minimumPlayableEnergy: Number(config.minimumPlayableEnergy || 0),
      coins: 0,
      cardsScrolled: 0,
      cardsInteracted: 0,
      recentCards: [],
      seenCards: [],
      resolvedCards: [],
      items: [],
      inventoryCapacity: 3,
      inventoryExpanded: false,
      evolution: {},
      feedEffects: { rareBoost: 0, energyDiscount: 0, safeCards: 0, remaining: 0 },
      statuses: {},
      savedCards: [],
      startedAt: Date.now(),
      night: 1,
      targetCards: config.bossAtCards,
      endedReason: null,
      ended: false
    };
  }

  function applyEffects(run, effects = {}, rng = Math.random) {
    const applied = { health: 0, energy: 0, coins: 0, item: null, inventoryCapacity: 0, evolution: null };
    let resolvedEffects = effects;
    if (effects.randomReward) {
      const options = [{ health: 1 }, { energy: 3 }, { coins: 25 }, { coins: 12, energy: 1 }];
      resolvedEffects = { ...effects, ...options[Math.floor(rng() * options.length)] };
      if (Number(effects.randomRewardMultiplier) > 1) {
        resolvedEffects = scaleNumericEffects(resolvedEffects, Number(effects.randomRewardMultiplier), true);
      }
    }
    if (Number.isFinite(resolvedEffects.health)) {
      const before = run.health;
      run.health = Math.max(0, Math.min(run.maxHealth, run.health + resolvedEffects.health));
      applied.health = run.health - before;
    }
    if (Number.isFinite(resolvedEffects.energy)) {
      const before = run.energy;
      run.energy = Math.max(0, Math.min(run.maxEnergy, run.energy + resolvedEffects.energy));
      applied.energy = run.energy - before;
    }
    if (Number.isFinite(resolvedEffects.coins)) {
      const before = run.coins;
      run.coins = Math.max(0, run.coins + resolvedEffects.coins);
      applied.coins = run.coins - before;
    }
    if (resolvedEffects.item && !run.items.includes(resolvedEffects.item) && run.items.length < (run.inventoryCapacity || 3)) {
      run.items.push(resolvedEffects.item);
      applied.item = resolvedEffects.item;
    }
    if (Number.isFinite(resolvedEffects.inventoryCapacity)) {
      const before = run.inventoryCapacity || 3;
      run.inventoryCapacity = Math.max(before, Math.min(6, Math.floor(resolvedEffects.inventoryCapacity)));
      applied.inventoryCapacity = run.inventoryCapacity - before;
    }
    if (resolvedEffects.evolution) {
      const id = resolvedEffects.evolution;
      run.evolution[id] = Math.min(4, (run.evolution[id] || 0) + 1);
      applied.evolution = { id, stage: run.evolution[id] };
    }
    if (run.health <= 0) run.ended = true;
    if (run.health <= 0) run.endedReason = "health";
    if (run.energy <= 0) run.energy = 0;
    if (run.energy < Number(run.minimumPlayableEnergy || 0) || run.energy <= 0) { run.ended = true; run.endedReason = "energy"; }
    return applied;
  }

  function applyFutureEffects(run, future = {}) {
    if (!future || typeof future !== "object") return run.feedEffects;
    if (future.statuses) applyStatuses(run, future.statuses);
    const hasLegacyEffect = ["rareBoost", "energyDiscount", "safeCards", "duration"].some((key) => future[key] !== undefined);
    if (!hasLegacyEffect) return run.feedEffects;
    const duration = Math.max(0, Number(future.duration || future.safeCards || 0));
    run.feedEffects = {
      rareBoost: Math.max(0, Number(future.rareBoost || 0)),
      energyDiscount: Math.max(0, Math.floor(Number(future.energyDiscount || 0))),
      safeCards: future.safeCards ? Math.max(0, Math.floor(Number(future.safeCards))) + 1 : 0,
      remaining: duration > 0 ? duration + 1 : 0
    };
    return run.feedEffects;
  }

  function canInteract(run, card) {
    if (!run || run.ended) return { ok: false, reason: "RUN_ENDED" };
    if (run.energy < Number(run.minimumPlayableEnergy || 0)) return { ok: false, reason: "INSUFFICIENT_ENERGY" };
    if (!card || card.state !== CARD_STATES.VISIBLE) return { ok: false, reason: "CARD_UNAVAILABLE" };
    if (!hasStatus(run, "adrenaline") && run.energy < card.energyCost) return { ok: false, reason: "INSUFFICIENT_ENERGY" };
    return { ok: true };
  }

  function beginInteraction(run, card) {
    const check = canInteract(run, card);
    if (!check.ok) return check;
    card.state = CARD_STATES.INTERACTING;
    if (!hasStatus(run, "adrenaline")) run.energy -= card.energyCost;
    run.cardsInteracted++;
    return { ok: true };
  }

  function resolveCard(run, card, success, rng = Math.random) {
    if (!card || card.state !== CARD_STATES.INTERACTING) return { ok: false, reason: "CARD_NOT_INTERACTING", applied: null };
    const configured = success ? card.success : card.failure;
    let effects = { ...configured };
    let modified = false;
    const curseActive = hasStatus(run, "curse");
    const acceleratedActive = hasStatus(run, "acceleratedFeed");
    if (curseActive) { effects = scaleNumericEffects(effects, 2); modified = true; }
    if (acceleratedActive) { effects = scaleNumericEffects(effects, 1.5, true); modified = true; }
    if (effects.randomReward && (curseActive || acceleratedActive)) {
      effects.randomRewardMultiplier = (curseActive ? 2 : 1) * (acceleratedActive ? 1.5 : 1);
    }
    if (success && card.food && hasStatus(run, "hunger")) {
      effects.health = (Number(effects.health) || 0) + 1;
      modified = true;
    }
    const applied = applyEffects(run, effects, rng);
    const echoed = hasStatus(run, "echo");
    if (echoed) {
      const echoApplied = applyEffects(run, effects, rng);
      ["health", "energy", "coins"].forEach((key) => { applied[key] += echoApplied[key]; });
      applied.item ||= echoApplied.item;
      applied.inventoryCapacity += echoApplied.inventoryCapacity;
      applied.evolution ||= echoApplied.evolution;
      consumeStatus(run, "echo");
    }
    tickStatuses(run, "interaction");
    if (configured.future) applyFutureEffects(run, configured.future);
    card.state = CARD_STATES.RESOLVED;
    if (!run.resolvedCards.includes(card.id)) run.resolvedCards.push(card.id);
    return { ok: true, applied, echoed, modified };
  }

  function skipCard(run, card, recentLimit, scrollEnergyCost = 0) {
    if (!card || card.state !== CARD_STATES.VISIBLE) return false;
    card.state = CARD_STATES.SKIPPED;
    recordScroll(run, card, recentLimit, scrollEnergyCost);
    return true;
  }

  function recordScroll(run, card, recentLimit, scrollEnergyCost = 0) {
    run.cardsScrolled++;
    run.energy = Math.max(0, run.energy - Math.max(0, scrollEnergyCost));
    const minimumEnergy = Number(run.minimumPlayableEnergy || 0);
    if (run.energy < minimumEnergy || run.energy <= 0) { run.ended = true; run.endedReason = "energy"; }
    if (!run.seenCards.includes(card.id)) run.seenCards.push(card.id);
    run.recentCards.push(card.id);
    if (run.recentCards.length > recentLimit) run.recentCards.splice(0, run.recentCards.length - recentLimit);
    if (run.feedEffects?.remaining > 0) {
      run.feedEffects.remaining--;
      if (run.feedEffects.safeCards > 0) run.feedEffects.safeCards--;
      if (run.feedEffects.remaining <= 0) run.feedEffects = { rareBoost: 0, energyDiscount: 0, safeCards: 0, remaining: 0 };
    }
    tickStatuses(run, "post");
  }

  function nightTime(cardsScrolled) {
    const totalMinutes = 3 * 60 + 17 + cardsScrolled * 4;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function nightTarget(config, night = 1) {
    const base = config.bossAtCards;
    const step = config.cardsPerNightStep || 0;
    const limit = config.maxCardsPerNight || Number.POSITIVE_INFINITY;
    return Math.min(limit, base + Math.max(0, night - 1) * step);
  }

  const api = { CARD_STATES, CardRegistry, FeedGenerator, GameDirector, weightedPick, rollRarity, createRunState, applyEffects, applyFutureEffects, applyStatuses, hasStatus, consumeStatus, canInteract, beginInteraction, resolveCard, skipCard, recordScroll, nightTime, nightTarget };
  global.DtsCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
