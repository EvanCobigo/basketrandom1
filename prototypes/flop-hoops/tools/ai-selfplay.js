// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-15
'use strict';
/**
 * AI self-play tuning: the AI's own weights (AI.DEFAULT_WEIGHTS) are adjusted by playing it against itself.
 * A (1+1) evolution strategy: each generation a challenger is the champion with every weight nudged by a
 * random factor; they play both sides of the same fresh seeds on neutral personalities, and the
 * challenger replaces the champion only if it wins by at least --margin points. Fresh seeds each generation
 * keep it from learning one match. Mixed with the benchmark (tools/ai-bench.js) afterwards, so a gain
 * that exists only against itself is caught.
 *
 *   node tools/ai-selfplay.js [--gens 12] [--seeds 4] [--secs 60] [--level 5] [--sigma 0.18] [--margin 4] [--label name]
 *
 * The final check plays fresh seeds the search never saw: tuned against the defaults, and then each of them
 * against the frozen reference brain (tools/ai-ref.js, the iteration 32 AI), so a gain that exists only against
 * itself shows up as no gain against the reference.
 * Writes evidence/ai-selfplay-<label>.json: the final weights and every generation's score.
 * The tuned numbers become the defaults in js/ai.js by hand, after the benchmark agrees.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(__dirname, '..');
const gens = Number(arg('gens', 12)), nSeeds = Number(arg('seeds', 4)), secs = Number(arg('secs', 60));
const level = Number(arg('level', 5)), sigma = Number(arg('sigma', 0.18)), margin = Number(arg('margin', 4));
const label = arg('label', 'run');
const BOUNDS = { dribble: [0.2, 0.9], shot: [0.5, 1.8], pass: [0.4, 2], risk: [0.3, 2], press: [0.3, 2], stand: [0.1, 0.6], fake: [0, 2], lob: [0, 2], role: [0, 2.5], budget: [0, 2.5] };

let rs = 20261115;   // a fixed seed: the same search every time
const rand = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());

(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + dir + '/index.html?manual=1');
  await page.addScriptTag({ path: path.join(__dirname, 'ai-ref.js') });   // AIRef: the frozen opponent for the final check
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* no storage */ } });
  const defaults = await page.evaluate(() => AI.DEFAULT_WEIGHTS);
  let champ = Object.assign({}, defaults);
  const history = [];

  /** Points by the first weights minus points by the second, over both sides of each seed (b === 'ref': the reference brain). */
  const duel = (a, b, seeds) => page.evaluate(([a, b, seeds, secs, level]) => {
    CONFIG.win_score.value = 99; CONFIG.game_speed.value = 1; CONFIG.ai_level.value = level;
    const neutral = { name: '', attack: 1, range: 1, pass: 1, flash: 1, guard: 1, scav: 1, read: 1, risk: 0.5, wild: 1 };
    let diff = 0, pa = 0, pb = 0;
    for (const sd of seeds) for (const aSide of [0, 1]) {
      CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
      // team 1 is always the game's own CPU (js/ai.js); team 0 is a second controller, the reference brain when b is 'ref'
      const ref = b === 'ref', Opp = ref ? AIRef : AI;
      if (ref && aSide === 0) continue;   // against the reference, a always plays team 1 (the reference cannot drive the game's CPU)
      const atk = Opp.create(0, rng, tune, 0);
      atk.style = neutral; cpu.style = neutral;
      if (ref) Object.assign(cpu.w, a);
      else { Object.assign(atk.w, aSide === 0 ? a : b); Object.assign(cpu.w, aSide === 1 ? a : b); }
      for (let i = 0; i < 60 * secs; i++) {
        Opp.update(atk, world, tune, 1 / 60 * tune.game_speed, { score: [game.state.score[0], game.state.score[1]] });
        game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
        game.step(1, false);
      }
      game.hold('KeyW', false); game.hold('KeyS', false);
      const sa = game.state.score[aSide], sb = game.state.score[1 - aSide];
      pa += sa; pb += sb; diff += sa - sb;
    }
    return { diff, pa, pb };
  }, [a, b, seeds, secs, level]);

  for (let g = 1; g <= gens; g++) {
    const chall = {};
    for (const k of Object.keys(champ)) {
      const [lo, hi] = BOUNDS[k] || [0, 3];
      chall[k] = +Math.min(hi, Math.max(lo, champ[k] * Math.exp(sigma * gauss()))).toFixed(3);
    }
    const seeds = Array.from({ length: nSeeds }, (_, i) => 100 + g * 17 + i * 5);
    const r = await duel(chall, champ, seeds);   // positive: the challenger won
    const accepted = r.diff >= margin;
    history.push({ gen: g, challenger: chall, challengerPoints: r.pa, championPoints: r.pb, diff: r.diff, accepted });
    if (accepted) champ = chall;
    console.log(`gen ${g}: challenger ${r.pa} - champion ${r.pb} (${r.diff >= 0 ? '+' : ''}${r.diff}) ${accepted ? 'ACCEPTED' : 'kept champion'}  ${JSON.stringify(champ)}`);
  }
  // fresh seeds, never used in the search: the final champion against the shipped defaults
  const finalSeeds = Array.from({ length: nSeeds * 2 }, (_, i) => 900 + i * 7);
  const fin = await duel(champ, defaults, finalSeeds);
  console.log(`final: tuned ${fin.pa} - defaults ${fin.pb} on ${finalSeeds.length} fresh seeds x 2 sides (${fin.diff >= 0 ? '+' : ''}${fin.diff})`);
  const refT = await duel(champ, 'ref', finalSeeds), refD = await duel(defaults, 'ref', finalSeeds);
  console.log(`vs reference: tuned ${refT.pa}-${refT.pb} (${refT.diff >= 0 ? '+' : ''}${refT.diff}), defaults ${refD.pa}-${refD.pb} (${refD.diff >= 0 ? '+' : ''}${refD.diff})`);
  await browser.close();
  const out = path.join(dir, 'evidence', `ai-selfplay-${label}.json`);
  fs.writeFileSync(out, JSON.stringify({ level, secs, sigma, margin, defaults, tuned: champ, final: fin, vsReference: { tuned: refT, defaults: refD }, history }, null, 1) + '\n');
  console.log('written to', path.relative(dir, out));
  if (errs.length) { console.log('PAGE ERRORS', errs); process.exitCode = 1; }
})();
