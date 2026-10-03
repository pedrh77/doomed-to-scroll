"use strict";

(function exposeMiniGames(global) {
  const DIRECTIONS = [
    { key: "LEFT", label: "ESQUERDA" }, { key: "DOWN", label: "BAIXO" },
    { key: "UP", label: "CIMA" }, { key: "RIGHT", label: "DIREITA" }
  ];
  const GAME_HELP = Object.freeze({
    TAP_CHALLENGE: "Toque no alvo até completar a barra.", SEQUENCE: "Memorize as direções e repita na ordem.",
    TIMING: "Toque quando o cursor estiver na área verde.", SWIPE_DIRECTION: "Deslize na direção mostrada.",
    HOLD: "Mantenha o alvo pressionado sem soltar.", REACTION: "Espere o sinal mudar e toque imediatamente.",
    FAKE_BUTTON: "Toque apenas no botão marcado como CERTO.", MEMORY_GRID: "Memorize as células iluminadas e repita.",
    TRACE: "Arraste pelo caminho, do início ao fim.", BALANCE: "Use os lados para manter o indicador na zona.",
    DRAG_ITEM: "Arraste o objeto até o destino correto.", SORT: "Separe itens seguros e amaldiçoados.",
    RHYTHM: "Toque quando a batida cruzar o marcador.", LOCKPICK: "Pare cada pino dentro da área verde.",
    DODGE: "Mova o personagem para evitar os obstáculos.", STOP_SIGNAL: "Toque no verde. Pare no vermelho.",
    MULTI_STAGE: "Conclua duas provas curtas em sequência.", CHOICE: "Escolha. A consequência continua no feed.",
    BARGAIN: "Escolha quanto arriscar na negociação.", SACRIFICE: "Troque um recurso por uma vantagem futura."
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
  const playSound = (name) => global.DtsSound?.play(name);
  const directionIcon = (item, showLabel = true) => `<span class="direction-arrow direction-${item.key.toLowerCase()}" aria-hidden="true"></span>${showLabel ? `<small>${item.label}</small>` : ""}`;

  class BaseMiniGame {
    constructor(root, settings, onFinish) {
      this.root = root; this.settings = settings; this.onFinish = onFinish; this.finished = false;
      this.timeouts = new Set(); this.frames = new Set(); this.abortController = new AbortController();
    }
    timeout(callback, delay) { const id = setTimeout(() => { this.timeouts.delete(id); callback(); }, delay); this.timeouts.add(id); return id; }
    frame(callback) { const id = requestAnimationFrame((time) => { this.frames.delete(id); callback(time); }); this.frames.add(id); return id; }
    listen(target, event, handler, options = {}) { if (target) target.addEventListener(event, handler, { ...options, signal: this.abortController.signal }); }
    render(title, body, className = "") {
      this.root.hidden = false;
      this.root.innerHTML = `<div class="minigame-panel ${className}"><div class="minigame-kicker">DISPUTA DA MADRUGADA</div><h3>${title}</h3><div class="minigame-body">${body}</div></div>`;
    }
    prepare(callback) {
      if (this.settings.skipCountdown) { callback(); return; }
      const help = this.settings.help || GAME_HELP[this.settings.type] || "Complete o desafio antes do tempo acabar.";
      this.render("COMO JOGAR", `<p class="mini-instruction">${help}</p><div class="countdown" id="miniCountdown">3</div>`);
      playSound("countdown");
      let value = 3;
      const tick = () => {
        value--; const label = this.root.querySelector("#miniCountdown"); if (!label) return;
        label.textContent = value > 0 ? value : "VAI";
        playSound("countdown");
        value > 0 ? this.timeout(tick, 800) : this.timeout(callback, 520);
      };
      this.timeout(tick, 800);
    }
    runTimer(seconds, onTick, onExpire) {
      const started = performance.now(), duration = seconds * 1000;
      const update = () => {
        const elapsed = performance.now() - started, remaining = Math.max(0, duration - elapsed);
        const timer = this.root.querySelector("#miniTimer"); if (timer) timer.textContent = `${(remaining / 1000).toFixed(1)}s`;
        if (onTick) onTick(elapsed, remaining, duration);
        if (!this.finished && remaining > 0) this.frame(update); else if (!this.finished) onExpire(elapsed);
      };
      update(); return started;
    }
    finish(success, details = {}) {
      if (this.finished) return; this.finished = true; this.clearScheduled(); this.abortController.abort();
      playSound(success ? "success" : "error");
      this.onFinish({ success, score: details.score || 0, accuracy: details.accuracy || 0, time: details.time || 0, message: details.message, effects: details.effects, future: details.future, choice: details.choice });
    }
    clearScheduled() { this.timeouts.forEach(clearTimeout); this.frames.forEach(cancelAnimationFrame); this.timeouts.clear(); this.frames.clear(); }
    cancel() { if (!this.finished) { this.finished = true; this.clearScheduled(); this.abortController.abort(); } this.root.hidden = true; this.root.innerHTML = ""; }
  }

  class TapChallenge extends BaseMiniGame {
    start() { this.prepare(() => {
      const target = this.settings.target || 14, duration = this.settings.duration || 6; let taps = 0, errors = 0; const started = performance.now();
      this.render("TOQUE RÁPIDO", `<p>Meta: <b>${target}</b> toques</p><button class="tap-target" id="tapTarget">TOQUE</button><div class="mini-progress"><i id="tapProgress"></i></div><strong id="tapCount">0 / ${target}</strong><small id="tapErrors"></small><small id="miniTimer"></small>`);
      const details = () => ({ score: taps, accuracy: taps / Math.max(1, taps + errors), time: (performance.now() - started) / 1000, effects: errors && this.settings.errorEnergy ? { energy: -errors * this.settings.errorEnergy } : undefined });
      this.listen(this.root.querySelector(".minigame-panel"), "pointerdown", (event) => {
        if (!this.settings.errorEnergy || event.target.closest("#tapTarget")) return;
        errors++;
        this.root.querySelector("#tapErrors").textContent = `ERROS: ${errors} · -${errors * this.settings.errorEnergy} ENERGIA`;
        playSound("energyLoss");
      });
      this.listen(this.root.querySelector("#tapTarget"), "pointerdown", (event) => {
        event.preventDefault(); taps++; this.root.querySelector("#tapCount").textContent = `${taps} / ${target}`;
        this.root.querySelector("#tapProgress").style.width = `${Math.min(100, taps / target * 100)}%`;
        if (taps >= target) this.finish(true, details());
      });
      this.runTimer(duration, null, () => this.finish(false, details()));
    }); }
  }

  class SequenceGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const length = this.settings.length || 4;
      const sequence = this.settings.echoPrevious
        ? Array.from({ length: Math.ceil(length / 2) }, () => randomItem(DIRECTIONS)).flatMap((item) => [item, item]).slice(0, length)
        : Array.from({ length }, () => randomItem(DIRECTIONS));
      this.render("MEMORIZE", `<div class="sequence-preview">${sequence.map((item) => `<span aria-label="${item.label}">${directionIcon(item, false)}</span>`).join("")}</div><small>Você tem 2,5 segundos</small>`);
      this.timeout(() => this.play(sequence), (this.settings.preview || 2500) / (this.settings.pace || 1));
    }); }
    play(sequence) {
      const duration = this.settings.duration || 8, started = performance.now(); let index = 0;
      this.render("REPITA A SEQUÊNCIA", `<div class="sequence-slots" id="sequenceSlots">${sequence.map(() => "<i></i>").join("")}</div><div class="direction-grid">${DIRECTIONS.map((item) => `<button data-direction="${item.key}" aria-label="${item.label}">${directionIcon(item)}</button>`).join("")}</div><small id="miniTimer"></small>`);
      const choose = (key) => {
        if (sequence[index].key !== key) { this.finish(false, { score: index, accuracy: index / sequence.length }); return; }
        this.root.querySelectorAll("#sequenceSlots i")[index++].classList.add("done");
        if (index >= sequence.length) this.finish(true, { score: index, accuracy: 1, time: (performance.now() - started) / 1000 });
      };
      this.root.querySelectorAll("[data-direction]").forEach((button) => this.listen(button, "click", () => choose(button.dataset.direction)));
      this.runTimer(duration, null, () => this.finish(false, { score: index, accuracy: index / sequence.length }));
    }
  }

  class TimingGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const duration = this.settings.duration || 7, size = this.settings.zoneSize || .28, start = .15 + Math.random() * (.7 - size); let position = 0;
      this.render("ACERTE A ZONA", `<p>Toque quando o cursor entrar na área verde</p><div class="timing-track"><i class="timing-zone" style="left:${start * 100}%;width:${size * 100}%"></i><b id="timingCursor"></b></div><button class="mini-action" id="timingHit">AGORA</button><small id="miniTimer"></small>`);
      this.listen(this.root.querySelector("#timingHit"), "click", () => this.finish(position >= start && position <= start + size, { score: 100 }));
      this.runTimer(duration, (elapsed) => { position = (Math.sin(elapsed / (540 / (this.settings.pace || 1)) - Math.PI / 2) + 1) / 2; this.root.querySelector("#timingCursor").style.left = `${position * 100}%`; }, () => this.finish(false));
    }); }
  }

  class SwipeDirectionGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const rounds = this.settings.rounds || 4, duration = this.settings.duration || 9; let completed = 0, expected, pointerStart;
      this.render(this.settings.invertControls ? "COMANDOS INVERTIDOS" : "DESLIZE NA DIREÇÃO", `<div class="swipe-prompt" id="swipePrompt"></div>${this.settings.invertControls ? "<p class=inverse-warning>FAÇA O OPOSTO</p>" : ""}<strong id="swipeScore">0 / ${rounds}</strong><div class="direction-grid compact">${DIRECTIONS.map((item) => `<button data-direction="${item.key}" aria-label="${item.label}">${directionIcon(item)}</button>`).join("")}</div><small id="miniTimer"></small>`);
      const opposite = { LEFT: "RIGHT", RIGHT: "LEFT", UP: "DOWN", DOWN: "UP" };
      const next = () => { const shown = randomItem(DIRECTIONS); expected = this.settings.invertControls ? DIRECTIONS.find((item) => item.key === opposite[shown.key]) : shown; this.root.querySelector("#swipePrompt").innerHTML = directionIcon(shown); };
      const choose = (key) => { if (key !== expected.key) { this.finish(false, { score: completed, accuracy: completed / rounds }); return; } completed++; this.root.querySelector("#swipeScore").textContent = `${completed} / ${rounds}`; completed >= rounds ? this.finish(true, { score: completed, accuracy: 1 }) : next(); };
      this.root.querySelectorAll("[data-direction]").forEach((button) => this.listen(button, "click", () => choose(button.dataset.direction)));
      this.listen(this.root, "pointerdown", (event) => { pointerStart = { x: event.clientX, y: event.clientY }; });
      this.listen(this.root, "pointerup", (event) => { if (!pointerStart) return; const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y; pointerStart = null; if (Math.max(Math.abs(dx), Math.abs(dy)) >= 35) choose(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "RIGHT" : "LEFT") : (dy > 0 ? "DOWN" : "UP")); });
      next(); this.runTimer(duration, null, () => this.finish(false, { score: completed, accuracy: completed / rounds }));
    }); }
  }

  class HoldGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const duration = this.settings.duration || 5, target = (this.settings.target || 2.5) * 1000; let holding = false, holdStarted = 0, held = 0;
      this.render("NÃO SOLTE", `<button class="hold-target" id="holdTarget">SEGURE</button><div class="mini-progress"><i id="holdProgress"></i></div><strong id="holdLabel">0%</strong><small id="miniTimer"></small>`);
      const button = this.root.querySelector("#holdTarget");
      this.listen(button, "pointerdown", (event) => { event.preventDefault(); holding = true; holdStarted = performance.now(); button.setPointerCapture?.(event.pointerId); button.classList.add("holding"); });
      const release = () => { if (holding) { held += performance.now() - holdStarted; holding = false; button.classList.remove("holding"); } };
      this.listen(button, "pointerup", release); this.listen(button, "pointercancel", release);
      this.runTimer(duration, () => { const total = held + (holding ? performance.now() - holdStarted : 0), progress = Math.min(1, total / target); this.root.querySelector("#holdProgress").style.width = `${progress * 100}%`; this.root.querySelector("#holdLabel").textContent = `${Math.round(progress * 100)}%`; if (total >= target) this.finish(true, { score: 100, accuracy: 1 }); }, () => this.finish(false, { score: Math.round(held / target * 100), accuracy: held / target }));
    }); }
  }

  class ReactionGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const delay = 1200 + Math.random() * 2200, windowMs = this.settings.window || 1000; let armed = false; const started = performance.now();
      this.render("ESPERE O SINAL", `<button class="reaction-target" id="reactionTarget">ESPERE</button><small id="reactionStatus">Não toque antes da hora</small>`);
      const button = this.root.querySelector("#reactionTarget");
      this.listen(button, "pointerdown", () => { if (!armed) { this.finish(false, { message: "Você tocou cedo demais." }); return; } const reaction = performance.now() - started - delay; this.finish(reaction <= windowMs, { score: Math.max(0, Math.round(1000 - reaction)), time: reaction / 1000 }); });
      this.timeout(() => { armed = true; button.textContent = "AGORA"; button.classList.add("ready"); this.root.querySelector("#reactionStatus").textContent = "TOQUE"; }, delay);
      this.timeout(() => this.finish(false, { message: "O sinal passou." }), delay + windowMs);
    }); }
  }

  class FakeButtonGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const rounds = this.settings.rounds || 4; let round = 0;
      this.render("ENCONTRE O CERTO", `<p>Toque apenas em CERTO</p><div class="fake-grid" id="fakeGrid"></div><strong id="fakeScore">0 / ${rounds}</strong><small id="miniTimer"></small>`);
      const draw = () => { const blocked = this.settings.blockedCells ? new Set(Array.from({ length: 2 }, () => Math.floor(Math.random() * 6))) : new Set(); const available = Array.from({ length: 6 }, (_, index) => index).filter((index) => !blocked.has(index)); const correct = randomItem(available); this.root.querySelector("#fakeGrid").innerHTML = Array.from({ length: 6 }, (_, i) => blocked.has(i) ? `<button class="web-blocked" disabled>TEIA</button>` : `<button data-correct="${i === correct}">${i === correct ? "CERTO" : randomItem(["FALSO", "NÃO", "ERRO"])}</button>`).join(""); this.root.querySelectorAll("#fakeGrid button:not(:disabled)").forEach((button) => this.listen(button, "click", () => { if (button.dataset.correct !== "true") { this.finish(false, { score: round, accuracy: round / rounds }); return; } round++; this.root.querySelector("#fakeScore").textContent = `${round} / ${rounds}`; round >= rounds ? this.finish(true, { score: round, accuracy: 1 }) : draw(); })); };
      draw(); this.runTimer(this.settings.duration || 10, null, () => this.finish(false, { score: round, accuracy: round / rounds }));
    }); }
  }

  class MemoryGridGame extends BaseMiniGame {
    start() { this.prepare(() => { const size = this.settings.size || 9, count = this.settings.length || 4, cells = []; while (cells.length < count) { const value = Math.floor(Math.random() * size); if (!cells.includes(value)) cells.push(value); } this.render("MEMORIZE AS LUZES", `<div class="memory-grid preview">${Array.from({ length: size }, (_, i) => `<button class="${cells.includes(i) ? "lit" : ""}"></button>`).join("")}</div><small>Observe o padrão</small>`); this.timeout(() => this.play(cells, size), (this.settings.preview || 2500) / (this.settings.pace || 1)); }); }
    play(cells, size, revived = false) { let selected = 0; const started = performance.now(); this.render(revived ? "VENÇA OUTRA VEZ" : "REPITA O PADRÃO", `<div class="memory-grid" id="memoryGrid">${Array.from({ length: size }, (_, i) => `<button data-cell="${i}"></button>`).join("")}</div><strong id="memoryScore">0 / ${cells.length}</strong><small id="miniTimer"></small>`); this.root.querySelectorAll("[data-cell]").forEach((button) => this.listen(button, "click", () => { const cell = Number(button.dataset.cell); if (!cells.includes(cell) || button.classList.contains("selected")) { this.finish(false, { score: selected, accuracy: selected / cells.length }); return; } button.classList.add("selected"); selected++; this.root.querySelector("#memoryScore").textContent = `${selected} / ${cells.length}`; if (selected !== cells.length) return; if (!revived && this.settings.reviveAfterMs && performance.now() - started > this.settings.reviveAfterMs) { this.clearScheduled(); const nextCells = []; while (nextCells.length < cells.length) { const value = Math.floor(Math.random() * size); if (!nextCells.includes(value)) nextCells.push(value); } this.render("O ESQUELETO REVIVEU", `<p>Você demorou. Memorize novamente.</p><div class="memory-grid preview">${Array.from({ length: size }, (_, i) => `<button class="${nextCells.includes(i) ? "lit" : ""}"></button>`).join("")}</div>`); this.timeout(() => this.play(nextCells, size, true), 1500); return; } this.finish(true, { score: selected, accuracy: 1 }); })); this.runTimer(this.settings.duration || 10, null, () => this.finish(false, { score: selected, accuracy: selected / cells.length })); }
  }

  class TraceGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const points = [[10, 80], [25, 50], [45, 65], [65, 30], [88, 18]]; let index = 0, dragging = false;
      this.render("TRACE O CAMINHO", `<div class="trace-board" id="traceBoard">${points.map((position, i) => `<i data-trace="${i}" style="left:${position[0]}%;top:${position[1]}%">${i + 1}</i>`).join("")}</div><strong id="traceScore">0 / ${points.length}</strong><small id="miniTimer"></small>`);
      const board = this.root.querySelector("#traceBoard"), visit = (x, y) => { const target = board.querySelector(`[data-trace="${index}"]`); if (!target) return; const rect = target.getBoundingClientRect(); if (x >= rect.left - 16 && x <= rect.right + 16 && y >= rect.top - 16 && y <= rect.bottom + 16) { target.classList.add("done"); index++; this.root.querySelector("#traceScore").textContent = `${index} / ${points.length}`; if (index === points.length) this.finish(true, { score: index, accuracy: 1 }); } };
      this.listen(board, "pointerdown", (event) => { dragging = true; board.setPointerCapture?.(event.pointerId); visit(event.clientX, event.clientY); }); this.listen(board, "pointermove", (event) => { if (dragging) visit(event.clientX, event.clientY); }); this.listen(board, "pointerup", () => { dragging = false; });
      this.runTimer(this.settings.duration || 12, null, () => this.finish(false, { score: index, accuracy: index / points.length }));
    }); }
  }

  class BalanceGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const targetTime = (this.settings.target || 4) * 1000; let position = .5, velocity = .005, safeTime = 0, last = performance.now();
      this.render("MANTENHA O EQUILÍBRIO", `<div class="balance-track"><i class="balance-zone"></i><b id="balanceCursor"></b></div><div class="balance-controls"><button data-push="-1">ESQUERDA</button><button data-push="1">DIREITA</button></div><div class="mini-progress"><i id="balanceProgress"></i></div><small id="miniTimer"></small>`);
      this.root.querySelectorAll("[data-push]").forEach((button) => this.listen(button, "pointerdown", () => { velocity += Number(button.dataset.push) * .018; }));
      this.runTimer(this.settings.duration || 10, () => { const now = performance.now(), delta = now - last; last = now; velocity += (Math.random() - .5) * .002; position = clamp(position + velocity * delta / 16, 0, 1); velocity *= .985; if (position >= .38 && position <= .62) safeTime += delta; this.root.querySelector("#balanceCursor").style.left = `${position * 100}%`; this.root.querySelector("#balanceProgress").style.width = `${Math.min(100, safeTime / targetTime * 100)}%`; if (safeTime >= targetTime) this.finish(true, { score: 100, accuracy: 1 }); }, () => this.finish(false, { score: Math.round(safeTime / targetTime * 100), accuracy: safeTime / targetTime }));
    }); }
  }

  class DragItemGame extends BaseMiniGame {
    start() { this.prepare(() => {
      this.render("LEVE AO DESTINO", `<div class="drag-board" id="dragBoard"><div class="drag-item" id="dragItem">ITEM</div><div class="drag-target" id="dragTarget">DESTINO</div></div><small id="miniTimer"></small>`);
      const item = this.root.querySelector("#dragItem"), target = this.root.querySelector("#dragTarget"), board = this.root.querySelector("#dragBoard"); let dragging = false;
      this.listen(item, "pointerdown", (event) => { dragging = true; item.setPointerCapture?.(event.pointerId); }); this.listen(item, "pointermove", (event) => { if (!dragging) return; const rect = board.getBoundingClientRect(); item.style.left = `${clamp(event.clientX - rect.left, 25, rect.width - 25)}px`; item.style.top = `${clamp(event.clientY - rect.top, 25, rect.height - 25)}px`; }); this.listen(item, "pointerup", () => { dragging = false; const a = item.getBoundingClientRect(), b = target.getBoundingClientRect(); if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) this.finish(true, { score: 100, accuracy: 1 }); });
      this.runTimer(this.settings.duration || 10, null, () => this.finish(false));
    }); }
  }

  class SortGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const rounds = this.settings.rounds || 7, items = Array.from({ length: rounds }, () => ({ cursed: Math.random() > .5 })); let index = 0, correct = 0;
      this.render("SEPARE OS ITENS", `<div class="sort-zones"><button data-sort="safe">SEGURO</button><div class="sort-item" id="sortItem"></div><button data-sort="cursed">AMALDIÇOADO</button></div><strong id="sortScore">0 / ${rounds}</strong><small id="miniTimer"></small>`);
      const draw = () => { const item = items[index]; this.root.querySelector("#sortItem").textContent = item.cursed ? randomItem(["SOMBRA", "RUNA", "FRASCO"]) : randomItem(["MOEDA", "CHAVE", "LUZ"]); };
      this.root.querySelectorAll("[data-sort]").forEach((button) => this.listen(button, "click", () => { if ((button.dataset.sort === "cursed") === items[index].cursed) correct++; index++; this.root.querySelector("#sortScore").textContent = `${index} / ${rounds}`; if (index >= rounds) this.finish(correct >= Math.ceil(rounds * .7), { score: correct, accuracy: correct / rounds }); else draw(); }));
      draw(); this.runTimer(this.settings.duration || 12, null, () => this.finish(false, { score: correct, accuracy: correct / rounds }));
    }); }
  }

  class RhythmGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const beats = this.settings.rounds || 5; let completed = 0, position = 0;
      this.render("SIGA A BATIDA", `<div class="rhythm-track"><i class="rhythm-zone"></i><b id="rhythmBeat"></b></div><button class="mini-action" id="rhythmTap">TOCAR</button><strong id="rhythmScore">0 / ${beats}</strong><small id="miniTimer"></small>`);
      this.listen(this.root.querySelector("#rhythmTap"), "pointerdown", () => { if (position < .78 || position > .96) { this.finish(false, { score: completed, accuracy: completed / beats }); return; } completed++; this.root.querySelector("#rhythmScore").textContent = `${completed} / ${beats}`; if (completed >= beats) this.finish(true, { score: completed, accuracy: 1 }); });
      this.runTimer(this.settings.duration || 12, (elapsed) => { const beatDuration = 1700 / (this.settings.pace || 1); position = elapsed % beatDuration / beatDuration; this.root.querySelector("#rhythmBeat").style.left = `${position * 100}%`; }, () => this.finish(false, { score: completed, accuracy: completed / beats }));
    }); }
  }

  class LockpickGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const pins = this.settings.rounds || 3; let pin = 0, position = 0, zoneStart;
      this.render("ALINHE OS PINOS", `<div class="timing-track"><i id="lockZone" class="timing-zone"></i><b id="lockCursor"></b></div><button class="mini-action" id="lockHit">ALINHAR</button><strong id="lockScore">0 / ${pins}</strong><small id="miniTimer"></small>`);
      const next = () => { zoneStart = .12 + Math.random() * .65; this.root.querySelector("#lockZone").style.cssText = `left:${zoneStart * 100}%;width:18%`; };
      this.listen(this.root.querySelector("#lockHit"), "click", () => { if (position < zoneStart || position > zoneStart + .18) { this.finish(false, { score: pin, accuracy: pin / pins }); return; } pin++; this.root.querySelector("#lockScore").textContent = `${pin} / ${pins}`; pin >= pins ? this.finish(true, { score: pin, accuracy: 1 }) : next(); });
      next(); this.runTimer(this.settings.duration || 12, (elapsed) => { position = (Math.sin(elapsed / (500 / (this.settings.pace || 1)) - Math.PI / 2) + 1) / 2; this.root.querySelector("#lockCursor").style.left = `${position * 100}%`; }, () => this.finish(false, { score: pin, accuracy: pin / pins }));
    }); }
  }

  class DodgeGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const rounds = this.settings.rounds || 6; let lane = 1, step = 0, obstacle = Math.floor(Math.random() * 3);
      this.render("DESVIE", `<div class="dodge-board"><div class="dodge-obstacle" id="dodgeObstacle"></div><div class="dodge-player" id="dodgePlayer"></div></div><div class="dodge-controls"><button data-move="-1">ESQUERDA</button><button data-move="1">DIREITA</button></div><strong id="dodgeScore">0 / ${rounds}</strong><small id="miniTimer"></small>`);
      const stepDelay = 1100 / (this.settings.pace || 1), paint = () => { this.root.querySelector("#dodgePlayer").style.left = `${16 + lane * 34}%`; this.root.querySelector("#dodgeObstacle").style.left = `${16 + obstacle * 34}%`; }, advance = () => { if (lane === obstacle) { this.finish(false, { score: step, accuracy: step / rounds }); return; } step++; this.root.querySelector("#dodgeScore").textContent = `${step} / ${rounds}`; if (step >= rounds) { this.finish(true, { score: step, accuracy: 1 }); return; } obstacle = Math.floor(Math.random() * 3); paint(); this.timeout(advance, stepDelay); };
      this.root.querySelectorAll("[data-move]").forEach((button) => this.listen(button, "click", () => { lane = clamp(lane + Number(button.dataset.move), 0, 2); paint(); }));
      paint(); this.timeout(advance, 1400 / (this.settings.pace || 1)); this.runTimer(this.settings.duration || 10, null, () => this.finish(false, { score: step, accuracy: step / rounds }));
    }); }
  }

  class StopSignalGame extends BaseMiniGame {
    start() { this.prepare(() => {
      const target = this.settings.target || 12; let taps = 0, errors = 0, green = true;
      this.render("TOQUE E PARE", `<div class="stop-signal green" id="stopSignal">TOQUE</div><button class="tap-target small" id="stopTap">TOQUE</button><strong id="stopScore">0 / ${target}</strong><small id="stopPenalty"></small><small id="miniTimer"></small>`);
      const details = () => ({ score: taps, accuracy: taps / Math.max(1, taps + errors), effects: errors && this.settings.errorCoins ? { coins: -errors * this.settings.errorCoins } : undefined });
      const switchSignal = () => { green = !green; const signal = this.root.querySelector("#stopSignal"); signal.className = `stop-signal ${green ? "green" : "red"}`; signal.textContent = green ? "TOQUE" : "PARE"; const delay = green ? 900 + Math.random() * 700 : 650 + Math.random() * 650; this.timeout(switchSignal, delay / (this.settings.pace || 1)); };
      this.listen(this.root.querySelector("#stopTap"), "pointerdown", () => { if (!green) { if (!this.settings.errorCoins) { this.finish(false, details()); return; } errors++; this.root.querySelector("#stopPenalty").textContent = `ROUBO: -${errors * this.settings.errorCoins} MOEDAS`; playSound("error"); return; } taps++; this.root.querySelector("#stopScore").textContent = `${taps} / ${target}`; if (taps >= target) this.finish(true, details()); });
      this.timeout(switchSignal, 1200); this.runTimer(this.settings.duration || 12, null, () => this.finish(false, details()));
    }); }
  }

  class MultiStageGame extends BaseMiniGame {
    start() { this.prepare(() => this.stageOne()); }
    stageOne() { let taps = 0; const target = 6, stages = this.settings.stages || 2; this.render(`ETAPA 1 DE ${stages}`, `<p>Complete ${target} toques</p><button class="tap-target small" id="multiTap">TOQUE</button><strong id="multiScore">0 / ${target}</strong>`); this.listen(this.root.querySelector("#multiTap"), "pointerdown", () => { taps++; this.root.querySelector("#multiScore").textContent = `${taps} / ${target}`; if (taps >= target) this.stageTwo(); }); this.timeout(() => this.finish(false, { score: taps, accuracy: taps / target }), 6000); }
    stageTwo() { this.clearScheduled(); this.abortController.abort(); this.abortController = new AbortController(); const expected = randomItem(DIRECTIONS), stages = this.settings.stages || 2; this.render(`ETAPA 2 DE ${stages}`, `<p>Escolha a direção indicada</p><div class="swipe-prompt">${directionIcon(expected)}</div><div class="direction-grid">${DIRECTIONS.map((item) => `<button data-direction="${item.key}" aria-label="${item.label}">${directionIcon(item)}</button>`).join("")}</div>`); this.root.querySelectorAll("[data-direction]").forEach((button) => this.listen(button, "click", () => { if (button.dataset.direction !== expected.key) { this.finish(false, { score: 1, accuracy: .5 }); return; } stages >= 3 ? this.stageThree() : this.finish(true, { score: 2, accuracy: 1 }); })); this.timeout(() => this.finish(false, { score: 1, accuracy: .5 }), 6500); }
    stageThree() { this.clearScheduled(); this.abortController.abort(); this.abortController = new AbortController(); let position = 0; this.render("ETAPA 3 DE 3", `<p>Acerte o núcleo</p><div class="timing-track"><i class="timing-zone" style="left:72%;width:20%"></i><b id="multiCursor"></b></div><button class="mini-action" id="multiFinish">ATACAR</button><small id="miniTimer"></small>`); this.listen(this.root.querySelector("#multiFinish"), "click", () => this.finish(position >= .72 && position <= .92, { score: 3, accuracy: position >= .72 && position <= .92 ? 1 : .66 })); this.runTimer(6, (elapsed) => { position = elapsed % 1400 / 1400; this.root.querySelector("#multiCursor").style.left = `${position * 100}%`; }, () => this.finish(false, { score: 2, accuracy: .66 })); }
  }

  class DecisionGame extends BaseMiniGame {
    start() { this.prepare(() => { const options = this.getOptions(), coins = Number(this.settings.availableCoins || 0); this.render(this.settings.title || "FAÇA SUA ESCOLHA", `<p>${this.settings.prompt || "Esta decisão altera os próximos posts."}</p><div class="choice-grid">${options.map((option, index) => `<button data-choice="${index}" ${option.cost > coins ? "disabled" : ""}><b>${option.label}</b><small>${option.cost > coins ? "MOEDAS INSUFICIENTES" : option.detail || ""}</small></button>`).join("")}</div>`); this.root.querySelectorAll("[data-choice]").forEach((button) => this.listen(button, "click", () => { const option = options[Number(button.dataset.choice)]; this.finish(option.success !== false, { score: 1, accuracy: 1, message: option.message, effects: option.effects, future: option.future, choice: option.label }); })); }); }
    getOptions() { return this.settings.options || [{ label: "CAMINHO SEGURO", detail: "Menos risco por 3 posts", message: "O feed ficou mais calmo.", future: { safeCards: 3 } }, { label: "CAMINHO RARO", detail: "Mais raridade por 3 posts", message: "O algoritmo percebeu sua ambição.", future: { rareBoost: .8, duration: 3 } }]; }
  }
  class ChoiceGame extends DecisionGame {}
  class BargainGame extends DecisionGame { getOptions() { return this.settings.options || [{ label: "OFERTA BAIXA", detail: "Pague 5 moedas", message: "Negócio seguro.", effects: { coins: -5, energy: 1 } }, { label: "OFERTA ALTA", detail: "Pague 12 moedas", message: "Estoque raro liberado.", effects: { coins: -12 }, future: { rareBoost: 1, duration: 4 } }, { label: "RECUSAR", detail: "Sem custo", message: "Você guardou seus recursos." }]; } }
  class SacrificeGame extends DecisionGame { getOptions() { return this.settings.options || [{ label: "1 VIDA", detail: "Menor custo por 4 posts", message: "O sacrifício alterou o feed.", effects: { health: -1 }, future: { energyDiscount: 1, duration: 4 } }, { label: "2 ENERGIA", detail: "Mais raridade por 4 posts", message: "A noite aceitou sua Energia.", effects: { energy: -2 }, future: { rareBoost: 1.2, duration: 4 } }, { label: "RECUAR", detail: "Nada muda", message: "Você recusou o ritual." }]; } }

  const GAMES = Object.freeze({
    TAP_CHALLENGE: TapChallenge, SEQUENCE: SequenceGame, TIMING: TimingGame, SWIPE_DIRECTION: SwipeDirectionGame, HOLD: HoldGame,
    REACTION: ReactionGame, FAKE_BUTTON: FakeButtonGame, MEMORY_GRID: MemoryGridGame, TRACE: TraceGame, BALANCE: BalanceGame,
    DRAG_ITEM: DragItemGame, SORT: SortGame, RHYTHM: RhythmGame, LOCKPICK: LockpickGame, DODGE: DodgeGame,
    STOP_SIGNAL: StopSignalGame, MULTI_STAGE: MultiStageGame, CHOICE: ChoiceGame, BARGAIN: BargainGame, SACRIFICE: SacrificeGame
  });

  class MiniGameManager {
    constructor(root) { this.root = root; this.active = null; this.pendingResolve = null; this.previewTimers = new Set(); }
    start(type, settings = {}) { this.cancel(); return new Promise((resolve) => { const Game = GAMES[type]; if (!Game) { resolve({ success: true, score: 0, accuracy: 1, time: 0 }); return; } this.pendingResolve = resolve; const finish = (result) => { this.active = null; this.pendingResolve = null; resolve(result); }; this.active = new Game(this.root, { ...settings, type }, finish); this.active.start(); }); }
    cancel() { if (this.active) this.active.cancel(); this.active = null; if (this.pendingResolve) { const resolve = this.pendingResolve; this.pendingResolve = null; resolve({ success: false, cancelled: true }); } this.previewTimers.forEach(clearTimeout); this.previewTimers.clear(); this.root.hidden = true; this.root.innerHTML = ""; }
    schedule(callback, delay) { const timer = setTimeout(() => { this.previewTimers.delete(timer); callback(); }, delay); this.previewTimers.add(timer); }
    showEncounterCountdown(title, image, onComplete) { this.cancel(); playSound("monster"); this.root.hidden = false; this.root.innerHTML = `<div class="minigame-panel encounter-alert"><div class="encounter-label">MONSTRO ENCONTRADO</div><img class="encounter-monster" src="${image}" alt="${title}"><h3>${title}</h3><p>EMBATE COMEÇA EM</p><div class="encounter-count" id="encounterCount">3</div></div>`; let count = 3; playSound("countdown"); const tick = () => { count--; const counter = this.root.querySelector("#encounterCount"); if (!counter) return; counter.textContent = count > 0 ? String(count) : "VAI"; playSound("countdown"); count > 0 ? this.schedule(tick, 950) : this.schedule(() => { this.root.hidden = true; this.root.innerHTML = ""; onComplete(); }, 650); }; this.schedule(tick, 1100); }
    showResult(success, message, onComplete, options = {}) { this.cancel(); if (options.instant) { onComplete(); return; } this.root.hidden = false; this.root.innerHTML = `<div class="minigame-panel result compact ${success ? "success" : "failure"}"><div class="result-burst">${success ? "VITÓRIA" : "RESULTADO"}</div><p>${message}</p><small>Voltando ao feed</small></div>`; this.schedule(() => { this.cancel(); onComplete(); }, options.duration || 1200); }
  }

  const api = { MiniGameManager, GAME_TYPES: Object.keys(GAMES), GAME_HELP };
  global.DtsMiniGames = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
