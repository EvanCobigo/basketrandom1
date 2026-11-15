// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-15
'use strict';
/**
 * AI benchmark: the same fixed seeds and scripted opponents every run, so a change to js/ai.js can be
 * judged by numbers instead of by eye.
 *
 *   node tools/ai-bench.js [--levels 1,2,3,4,5] [--seeds 5,9,23] [--secs 90] [--mode defense|mirror|both]
 *                          [--weights '{"fake":0}'] [--label name]
 *
 * defense: the CPU (team 1) at each level defends against four scripted attackers (a sniper, a dunker,
 *   a passer, a mixed player: the AI itself at level 3 with a one-sided personality). Reports points allowed,
 *   the attackers' shots made over faced, dunks scored over started, and the CPU's blocks, dunk swats and steals.
 * mirror: the CPU at each level plays the same level (team 0 driven by a second controller) on neutral
 *   personalities. Reports points, shooting, and how its pump fakes fared (fakes, shots after one, made).
 * --weights overrides the CPU's AI weights (see AI.DEFAULT_WEIGHTS) for the run.
 * Writes evidence/ai-bench-<label>.tsv next to the table it prints. Needs playwright and a
 * browser (the sandbox has both); the game runs from file://, nothing leaves the machine.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(__dirname, '..');
const levels = arg('levels', '1,2,3,4,5').split(',').map(Number);
const seeds = arg('seeds', '5,9,23').split(',').map(Number);
const secs = Number(arg('secs', 90));
const mode = arg('mode', 'both');
const weights = JSON.parse(arg('weights', '{}'));
const label = arg('label', 'run');

const ATTACKERS = {
  sniper: { range: 6, attack: 0.2 },
  dunker: { attack: 3, range: 0.2 },
  passer: { pass: 3, attack: 0.8 },
  mixed: {},
};

(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + dir + '/index.html?manual=1');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* no storage */ } });
  const rows = [];
  for (const lv of levels) {
    if (mode !== 'mirror') for (const [name, tilt] of Object.entries(ATTACKERS)) {
      const r = await page.evaluate(([lv, seeds, secs, tilt, weights]) => {
        CONFIG.win_score.value = 99; CONFIG.game_speed.value = 1;
        const out = { allowed: 0, own: 0, faced: 0, madeShots: 0, dunkStarts: 0, dunks: 0, blocks: 0, swats: 0, steals: 0 };
        for (const sd of seeds) {
          CONFIG.ai_level.value = lv; CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
          Object.assign(cpu.w, weights);
          const atkT = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? 3 : t[k] });
          const atk = AI.create(0, rng, atkT, 0);
          atk.style = Object.assign({ name: '', attack: 1, range: 1, pass: 1, flash: 1, guard: 1, scav: 1, read: 1, risk: 0.5, wild: 1 }, tilt);
          const n0 = game.events.length; let lastShot = null, prev = game.scene;
          for (let i = 0; i < 60 * secs; i++) {
            AI.update(atk, world, atkT, 1 / 60 * tune.game_speed, { score: [game.state.score[0], game.state.score[1]] });
            game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
            const sh = world.ball.shot; if (sh && sh.team === 0 && sh !== lastShot && sh.kind !== 'dunk') { lastShot = sh; out.faced++; sh._a = true; }
            game.step(1, false);
            if (game.scene === 'scored' && prev !== 'scored' && game.state.scorer === 0 && world.ball.shot && world.ball.shot._a) out.madeShots++;
            prev = game.scene;
          }
          game.hold('KeyW', false); game.hold('KeyS', false);
          out.allowed += game.state.score[0]; out.own += game.state.score[1];
          for (const e of game.events.slice(n0)) {
            if (e.type === 'dunkstart' && e.team === 0) out.dunkStarts++;
            if (e.type === 'dunk' && e.team === 0) out.dunks++;
            if (e.type === 'block' && e.team === 1) { out.blocks++; if (e.dunk) out.swats++; }
            if (e.type === 'steal' && e.team === 1) out.steals++;
          }
        }
        return out;
      }, [lv, seeds, secs, tilt, weights]);
      rows.push({ mode: 'defense', level: lv, vs: name, ...r });
    }
    if (mode !== 'defense') {
      const r = await page.evaluate(([lv, seeds, secs, weights]) => {
        CONFIG.win_score.value = 99; CONFIG.game_speed.value = 1;
        const out = { own: 0, allowed: 0, shots: 0, madeShots: 0, fakes: 0, fakeShots: 0, fakeMade: 0, dunks: 0 };
        const neutral = { name: '', attack: 1, range: 1, pass: 1, flash: 1, guard: 1, scav: 1, read: 1, risk: 0.5, wild: 1 };
        for (const sd of seeds) {
          CONFIG.ai_level.value = lv; CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
          Object.assign(cpu.w, weights); cpu.style = neutral;
          const atkT = new Proxy(tune, { get: (t, k) => t[k] });
          const atk = AI.create(0, rng, atkT, 0); atk.style = neutral;
          const n0 = game.events.length; let lastShot = null, prev = game.scene;
          for (let i = 0; i < 60 * secs; i++) {
            AI.update(atk, world, atkT, 1 / 60 * tune.game_speed, { score: [game.state.score[0], game.state.score[1]] });
            game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
            const sh = world.ball.shot; if (sh && sh.team === 1 && sh !== lastShot && sh.kind !== 'dunk') { lastShot = sh; out.shots++; sh._c = true; }
            game.step(1, false);
            if (game.scene === 'scored' && prev !== 'scored' && game.state.scorer === 1 && world.ball.shot && world.ball.shot._c) out.madeShots++;
            prev = game.scene;
          }
          game.hold('KeyW', false); game.hold('KeyS', false);
          out.own += game.state.score[1]; out.allowed += game.state.score[0];
          out.fakes += cpu.fakes.fakes; out.fakeShots += cpu.fakes.shots; out.fakeMade += cpu.fakes.made;
          for (const e of game.events.slice(n0)) if (e.type === 'dunk' && e.team === 1) out.dunks++;
        }
        return out;
      }, [lv, seeds, secs, weights]);
      rows.push({ mode: 'mirror', level: lv, vs: 'same level', ...r });
    }
  }
  await browser.close();

  const cols = ['mode', 'level', 'vs', 'allowed', 'own', 'faced', 'madeShots', 'dunkStarts', 'dunks', 'blocks', 'swats', 'steals', 'shots', 'fakes', 'fakeShots', 'fakeMade'];
  const tsv = [cols.join('\t'), ...rows.map(r => cols.map(c => r[c] === undefined ? '' : r[c]).join('\t'))].join('\n') + '\n';
  const outFile = path.join(dir, 'evidence', `ai-bench-${label}.tsv`);
  fs.writeFileSync(outFile, tsv);
  console.log(tsv);
  console.log(`seeds ${seeds.join(',')} x ${secs}s per cell, weights ${JSON.stringify(weights)}; written to ${path.relative(dir, outFile)}`);
  if (errs.length) { console.log('PAGE ERRORS', errs); process.exitCode = 1; }
})();
