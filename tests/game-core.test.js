"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../game-config.js");
const core = require("../game-core.js");
const miniGames = require("../minigames.js");

const registry = new core.CardRegistry(config.POST_ASSETS, config.CARD_CONFIG, config.POST_ROOT);

test("registry loads every real post and gives unknown assets a NORMAL fallback", () => {
  assert.equal(registry.all().length, config.POST_ASSETS.length);
  const unknown = registry.all().find((card) => card.filename.startsWith("7DFA"));
  assert.equal(unknown.type, "NORMAL");
  assert.equal(unknown.rarity, "COMMON");
  assert.equal(unknown.title, "Post misterioso");
  assert.match(unknown.image, /^assets\/posts\//);
});

test("rarity roll uses centralized distribution", () => {
  assert.equal(core.rollRarity(config.GAME_CONFIG.rarity, () => 0), "COMMON");
  assert.equal(core.rollRarity(config.GAME_CONFIG.rarity, () => 0.56), "UNCOMMON");
  assert.equal(core.rollRarity(config.GAME_CONFIG.rarity, () => 0.99), "LEGENDARY");
});

test("weighted pick honors weights", () => {
  const entries = [{ id: "a", weight: 1 }, { id: "b", weight: 9 }];
  assert.equal(core.weightedPick(entries, (entry) => entry.weight, () => 0.05).id, "a");
  assert.equal(core.weightedPick(entries, (entry) => entry.weight, () => 0.5).id, "b");
});

test("feed generator never repeats current card consecutively", () => {
  const director = new core.GameDirector(config.GAME_CONFIG);
  const generator = new core.FeedGenerator(registry, config.GAME_CONFIG, director, () => 0);
  const run = core.createRunState(config.GAME_CONFIG);
  const first = generator.next(run);
  core.recordScroll(run, first, config.GAME_CONFIG.recentCardLimit);
  const second = generator.next(run);
  assert.notEqual(second.id, first.id);
});

test("interaction spends energy once and blocks a duplicate reward", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  const source = registry.get("lost-heart");
  const card = { ...source, state: core.CARD_STATES.VISIBLE };
  run.health = 1;
  const energyBefore = run.energy;

  assert.equal(core.beginInteraction(run, card).ok, true);
  assert.equal(run.energy, energyBefore - card.energyCost);
  assert.equal(core.resolveCard(run, card, true).ok, true);
  assert.equal(run.health, 2);

  assert.equal(core.resolveCard(run, card, true).ok, false);
  assert.equal(run.health, 2);
  assert.equal(core.beginInteraction(run, card).ok, false);
  assert.equal(run.energy, energyBefore - card.energyCost);
});

test("insufficient energy blocks interaction without changing card", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  const card = { ...registry.get("moon-mimic"), state: core.CARD_STATES.VISIBLE };
  run.energy = 1;
  const result = core.beginInteraction(run, card);
  assert.equal(result.reason, "INSUFFICIENT_ENERGY");
  assert.equal(card.state, core.CARD_STATES.VISIBLE);
  assert.equal(run.energy, 1);
});

test("effects clamp health, energy and coins", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  run.health = 2;
  run.energy = 9;
  run.coins = 3;
  core.applyEffects(run, { health: 5, energy: 5, coins: -10 });
  assert.equal(run.health, run.maxHealth);
  assert.equal(run.energy, run.maxEnergy);
  assert.equal(run.coins, 0);
});

test("damage ends run at zero health", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  run.health = 1;
  core.applyEffects(run, { health: -1 });
  assert.equal(run.health, 0);
  assert.equal(run.ended, true);
});

test("director raises difficulty gradually and night clock progresses", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  const director = new core.GameDirector(config.GAME_CONFIG);
  const start = director.snapshot(run);
  run.cardsScrolled = Math.floor(config.GAME_CONFIG.bossAtCards / 2);
  const middle = director.snapshot(run);
  assert.ok(middle.difficulty > start.difficulty);
  assert.ok(middle.difficulty < 1.55);
  assert.equal(core.nightTime(0), "03:17");
  assert.equal(core.nightTime(11), "04:01");
});

test("all requested touch minigames are registered", () => {
  assert.deepEqual(miniGames.GAME_TYPES, [
    "TAP_CHALLENGE", "SEQUENCE", "TIMING", "SWIPE_DIRECTION", "HOLD",
    "REACTION", "FAKE_BUTTON", "MEMORY_GRID", "TRACE", "BALANCE",
    "DRAG_ITEM", "SORT", "RHYTHM", "LOCKPICK", "DODGE",
    "STOP_SIGNAL", "MULTI_STAGE", "CHOICE", "BARGAIN", "SACRIFICE"
  ]);
});

test("choices can alter the following feed cards for a limited duration", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  core.applyFutureEffects(run, { rareBoost: 1, energyDiscount: 1, duration: 2 });
  assert.equal(run.feedEffects.rareBoost, 1);
  assert.equal(run.feedEffects.energyDiscount, 1);
  core.recordScroll(run, registry.get("moon-cat"), config.GAME_CONFIG.recentCardLimit);
  assert.equal(run.feedEffects.remaining, 2);
  core.recordScroll(run, registry.get("moon-corgi"), config.GAME_CONFIG.recentCardLimit);
  assert.equal(run.feedEffects.remaining, 1);
  core.recordScroll(run, registry.get("moon-cat"), config.GAME_CONFIG.recentCardLimit);
  assert.equal(run.feedEffects.remaining, 0);
  assert.equal(run.feedEffects.rareBoost, 0);
});
