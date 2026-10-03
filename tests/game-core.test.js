"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../game-config.js");
const core = require("../game-core.js");
const miniGames = require("../minigames.js");

const registry = new core.CardRegistry(config.POST_ASSETS, config.CARD_CONFIG, config.POST_ROOT);

test("registry loads every real post and gives unknown assets a NORMAL fallback", () => {
  assert.equal(registry.all().length, config.POST_ASSETS.length);
  const fallbackRegistry = new core.CardRegistry(["0F0F0F0F-1111-2222-3333-444444444444.jpeg"], {}, config.POST_ROOT);
  const unknown = fallbackRegistry.all()[0];
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

test("slime and ghost are automatic enemy encounters", () => {
  assert.equal(registry.get("neon-slime").type, "ENEMY");
  assert.equal(registry.get("lost-ghost").type, "ENEMY");
  assert.notEqual(registry.get("neon-slime").interaction.type, "INSTANT");
  assert.notEqual(registry.get("lost-ghost").interaction.type, "INSTANT");
});

test("scrolling drains a small amount of energy", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  const before = run.energy;
  core.recordScroll(run, registry.get("moon-cat"), config.GAME_CONFIG.recentCardLimit, config.GAME_CONFIG.scrollEnergyCost);
  assert.equal(run.energy, before - 0.25);
});

test("night target starts at 15 and increases by three", () => {
  assert.equal(core.nightTarget(config.GAME_CONFIG, 1), 15);
  assert.equal(core.nightTarget(config.GAME_CONFIG, 2), 18);
  assert.equal(core.nightTarget(config.GAME_CONFIG, 20), 30);
});

test("adrenaline protects energy for exactly three interactions", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  core.applyFutureEffects(run, { statuses: { adrenaline: 3 } });
  const energyBefore = run.energy;
  for (let index = 0; index < 3; index++) {
    const card = { ...registry.get("lost-heart"), state: core.CARD_STATES.VISIBLE };
    assert.equal(core.beginInteraction(run, card).ok, true);
    core.resolveCard(run, card, false);
  }
  assert.equal(run.energy, energyBefore);
  assert.equal(core.hasStatus(run, "adrenaline"), false);
  const fourth = { ...registry.get("lost-heart"), state: core.CARD_STATES.VISIBLE };
  core.beginInteraction(run, fourth);
  assert.equal(run.energy, energyBefore - fourth.energyCost);
});

test("focus enlarges timing zones and sleep slows interactions", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  const director = new core.GameDirector(config.GAME_CONFIG);
  core.applyFutureEffects(run, { statuses: { focus: 4, heavySleep: 4 } });
  const tuned = director.tuneInteraction({ type: "TIMING", duration: 8, zoneSize: .3 }, run, { difficultyMultiplier: 1 });
  assert.equal(tuned.zoneSize, .5);
  assert.equal(tuned.duration, 10.8);
  assert.equal(tuned.pace, .72);
});

test("luck raises rarity and silence removes enemies from the feed", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  const director = new core.GameDirector(config.GAME_CONFIG);
  core.applyFutureEffects(run, { statuses: { luck: 5, silence: 4 } });
  assert.ok(director.snapshot(run).rareBoost >= 1.25);
  const generator = new core.FeedGenerator(registry, config.GAME_CONFIG, director, () => 0);
  assert.notEqual(generator.next(run).type, "ENEMY");
});

test("curse doubles damage and echo repeats the next effect once", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  run.health = 3;
  core.applyFutureEffects(run, { statuses: { curse: 2, echo: 1 } });
  const card = { ...registry.get("neon-slime"), state: core.CARD_STATES.VISIBLE };
  core.beginInteraction(run, card);
  const result = core.resolveCard(run, card, false);
  assert.equal(result.echoed, true);
  assert.equal(run.health, 0);
  assert.equal(core.hasStatus(run, "echo"), false);
});

test("hunger grants extra health when a food card succeeds", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  run.health = 1;
  core.applyFutureEffects(run, { statuses: { hunger: 5 } });
  const card = { ...registry.get("moon-cake"), state: core.CARD_STATES.VISIBLE };
  core.beginInteraction(run, card);
  core.resolveCard(run, card, true);
  assert.equal(run.health, 3);
});

test("energy below 0.75 ends the night before the feed becomes unusable", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  run.energy = 0.8;
  core.recordScroll(run, registry.get("moon-cat"), config.GAME_CONFIG.recentCardLimit, config.GAME_CONFIG.scrollEnergyCost);
  assert.equal(run.energy, 0.55);
  assert.equal(run.ended, true);
  assert.equal(run.endedReason, "energy");
});

test("later nights increase difficulty beyond feed progress", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  const director = new core.GameDirector(config.GAME_CONFIG);
  const firstNight = director.snapshot(run).difficulty;
  run.night = 6;
  assert.ok(director.snapshot(run).difficulty > firstNight);
});

test("enemy cards expose distinct mechanics", () => {
  assert.equal(registry.get("neon-slime").interaction.errorEnergy, 0.5);
  assert.equal(registry.get("lost-ghost").interaction.echoPrevious, true);
  assert.equal(registry.get("swamp-witch").interaction.invertControls, true);
  assert.equal(registry.get("web-spider").interaction.blockedCells, true);
  assert.equal(registry.get("neon-skeleton").interaction.reviveAfterMs, 4200);
  assert.equal(registry.get("treasure-dragon").interaction.stages, 3);
  assert.equal(registry.get("elven-thief").type, "ENEMY");
  assert.equal(registry.get("elven-thief").interaction.errorCoins, 3);
});

test("inventory starts with three slots and the magic bag expands it to six", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  assert.equal(run.inventoryCapacity, 3);
  const applied = core.applyEffects(run, { inventoryCapacity: 6 });
  assert.equal(applied.inventoryCapacity, 3);
  assert.equal(run.inventoryCapacity, 6);
});

test("inventory refuses new items when all slots are occupied", () => {
  const run = core.createRunState(config.GAME_CONFIG);
  run.items = ["espada", "ampulheta", "capa"];
  const applied = core.applyEffects(run, { item: "extra" });
  assert.equal(applied.item, null);
  assert.deepEqual(run.items, ["espada", "ampulheta", "capa"]);
});
