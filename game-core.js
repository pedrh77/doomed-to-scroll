"use strict";

(function exposeCore(global) {
  const CARD_STATES = Object.freeze({ VISIBLE: "VISIBLE", INTERACTING: "INTERACTING", RESOLVED: "RESOLVED", SKIPPED: "SKIPPED" });
  const SPECIAL_TYPES = new Set(["CHEST", "RISK", "MYSTERY", "EVOLUTION"]);

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
      return {
        nightProgress,
        difficulty: 1 + nightProgress * 0.55,
        rareBoost: nightProgress * 0.35 + (run.feedEffects?.rareBoost || 0),
        bossReady: run.cardsScrolled >= targetCards
      };
    }
    tuneInteraction(interaction, run, raritySettings = {}) {
      const difficulty = this.snapshot(run).difficulty * (raritySettings.difficultyMultiplier || 1);
      const tuned = { ...interaction };
      if (Number.isFinite(tuned.target)) tuned.target = Math.max(1, Math.round(tuned.target * difficulty));
      if (Number.isFinite(tuned.length)) tuned.length = Math.min(7, Math.max(2, Math.round(tuned.length * Math.min(1.3, difficulty))));
      if (Number.isFinite(tuned.rounds)) tuned.rounds = Math.min(7, Math.max(2, Math.round(tuned.rounds * Math.min(1.25, difficulty))));
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
        if ((run.feedEffects?.safeCards || 0) > 0 && card.type === "ENEMY") return false;
        return true;
      });
      const rarityPool = pool.filter((card) => card.rarity === desiredRarity);
      if (rarityPool.length) pool = rarityPool;
      if (!pool.length) pool = this.registry.all().filter((card) => card.id !== lastId);
      const card = weightedPick(pool, (entry) => entry.weight, this.rng);
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
      coins: 0,
      cardsScrolled: 0,
      cardsInteracted: 0,
      recentCards: [],
      seenCards: [],
      resolvedCards: [],
      items: [],
      evolution: {},
      feedEffects: { rareBoost: 0, energyDiscount: 0, safeCards: 0, remaining: 0 },
      startedAt: Date.now(),
      night: 1,
      targetCards: config.bossAtCards,
      endedReason: null,
      ended: false
    };
  }

  function applyEffects(run, effects = {}, rng = Math.random) {
    const applied = { health: 0, energy: 0, coins: 0, item: null, evolution: null };
    let resolvedEffects = effects;
    if (effects.randomReward) {
      const options = [{ health: 1 }, { energy: 3 }, { coins: 25 }, { coins: 12, energy: 1 }];
      resolvedEffects = { ...effects, ...options[Math.floor(rng() * options.length)] };
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
    if (resolvedEffects.item && !run.items.includes(resolvedEffects.item)) {
      run.items.push(resolvedEffects.item);
      applied.item = resolvedEffects.item;
    }
    if (resolvedEffects.evolution) {
      const id = resolvedEffects.evolution;
      run.evolution[id] = Math.min(4, (run.evolution[id] || 0) + 1);
      applied.evolution = { id, stage: run.evolution[id] };
    }
    if (run.health <= 0) run.ended = true;
    if (run.health <= 0) run.endedReason = "health";
    if (run.energy <= 0) { run.energy = 0; run.ended = true; run.endedReason = "energy"; }
    return applied;
  }

  function applyFutureEffects(run, future = {}) {
    if (!future || typeof future !== "object") return run.feedEffects;
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
    if (!card || card.state !== CARD_STATES.VISIBLE) return { ok: false, reason: "CARD_UNAVAILABLE" };
    if (run.energy < card.energyCost) return { ok: false, reason: "INSUFFICIENT_ENERGY" };
    return { ok: true };
  }

  function beginInteraction(run, card) {
    const check = canInteract(run, card);
    if (!check.ok) return check;
    card.state = CARD_STATES.INTERACTING;
    run.energy -= card.energyCost;
    run.cardsInteracted++;
    return { ok: true };
  }

  function resolveCard(run, card, success, rng = Math.random) {
    if (!card || card.state !== CARD_STATES.INTERACTING) return { ok: false, reason: "CARD_NOT_INTERACTING", applied: null };
    const applied = applyEffects(run, success ? card.success : card.failure, rng);
    card.state = CARD_STATES.RESOLVED;
    if (!run.resolvedCards.includes(card.id)) run.resolvedCards.push(card.id);
    return { ok: true, applied };
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
    if (run.energy <= 0) { run.ended = true; run.endedReason = "energy"; }
    if (!run.seenCards.includes(card.id)) run.seenCards.push(card.id);
    run.recentCards.push(card.id);
    if (run.recentCards.length > recentLimit) run.recentCards.splice(0, run.recentCards.length - recentLimit);
    if (run.feedEffects?.remaining > 0) {
      run.feedEffects.remaining--;
      if (run.feedEffects.safeCards > 0) run.feedEffects.safeCards--;
      if (run.feedEffects.remaining <= 0) run.feedEffects = { rareBoost: 0, energyDiscount: 0, safeCards: 0, remaining: 0 };
    }
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

  const api = { CARD_STATES, CardRegistry, FeedGenerator, GameDirector, weightedPick, rollRarity, createRunState, applyEffects, applyFutureEffects, canInteract, beginInteraction, resolveCard, skipCard, recordScroll, nightTime, nightTarget };
  global.DtsCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
