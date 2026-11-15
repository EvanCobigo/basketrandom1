// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-15
'use strict';
/**
 * AI benchmark: the same fixed seeds and scripted opponents every run, so a change to js/ai.js can be
 * judged by numbers instead of by eye.
 *
 *   node tools/ai-bench.js [--levels 1,2,3,4,5] [--seeds 5,9,23,31,47] [--secs 90] [--mode defense|mirror|versus|all]
 *                          [--weights '{"fake":0}'] [--label name] [--compare evidence/ai-bench-other.tsv]
 *
 * The opponents (team 0) are the FROZEN reference brain, tools/ai-ref.js (the iteration 32 AI), so they stay the
 * same while js/ai.js changes; before iteration 33 they were js/ai.js itself, and every change moved them too.
 * defense: the CPU (team 1) at each level defends against four scripted attackers (a sniper, a dunker,
 *   a passer, a mixed player: the reference AI at level 3 with a one-sided personality). Reports points allowed,
 *   the attackers' shots made over faced, dunks scored over started, and the CPU's blocks, dunk swats and steals.
 *   Against the same attackers at every level, own minus allowed should climb with the level.
 * versus: the CPU at each level plays the reference AI at the same level, both on neutral personalities: how much
 *   better (or worse) than the old brain it is, level for level.
 * mirror: the CPU at each level plays the same level of itself (team 0 driven by a second js/ai.js controller) on
 *   neutral personalities. Reports points, shooting, and how its pump fakes fared (fakes, shots after one, made).
 *
 * Both modes also report how the CPU (team 1) handles the ball, which is where a stall shows first:
 *   holdMax   the longest it held the ball in one go (s); holdAvg the mean hold (s)
 *   stall     % of its holding steps spent on 'LOOKING FOR AN OPENING' (the iteration 28 stall read 21% here)
 *   passes    passes thrown / caught by the teammate (passOk); lobs thrown, oops (alley-oop dunks started)
 *   perfect   shots let go on a line the physics calls perfect; lost: steals and strips against it
 *   behind    % of steps a CPU player stood beyond a rim (the far side of a basket)
 *   slips     plays it got wrong on purpose (its level's slip rate; c.slips)
 * --weights overrides the CPU's AI weights (see AI.DEFAULT_WEIGHTS) for the run.
 * --compare prints each number of this run next to the same cell of an earlier TSV (old -> new).
 * Writes evidence/ai-bench-<label>.tsv next to the table it prints. Needs playwright and a
 * browser (the sandbox has both); the game runs from file://, nothing leaves the machine.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(__dirname, '..');
const levels = arg('levels', '1,2,3,4,5').split(',').map(Number);
const seeds = arg('seeds', '5,9,23,31,47').split(',').map(Number);
const secs = Number(arg('secs', 90));
const mode = arg('mode', 'all');
const weights = JSON.parse(arg('weights', '{}'));
const label = arg('label', 'run');
const compare = arg('compare', null);

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
  await page.addScriptTag({ path: path.join(__dirname, 'ai-ref.js') });   // AIRef: the frozen opponent
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* no storage */ } });
  // one match cell, in the page: team 0 is a second controller (`atkLevel`, `tilt`), team 1 the game's own CPU
  await page.evaluate(() => {
    window.__benchCell = (lv, seeds, secs, weights, atkLevel, tilt, useRef) => {
      const Opp = useRef ? AIRef : AI;
      CONFIG.win_score.value = 99; CONFIG.game_speed.value = 1;
      const neutral = { name: '', attack: 1, range: 1, pass: 1, flash: 1, guard: 1, scav: 1, read: 1, risk: 0.5, wild: 1 };
      const o = { allowed: 0, own: 0, faced: 0, madeShots: 0, dunkStarts: 0, dunks: 0, blocks: 0, swats: 0, steals: 0,
        shots: 0, cpuMade: 0, cpuDunks: 0, fakes: 0, fakeShots: 0, fakeMade: 0,
        holdMax: 0, holdSum: 0, holds: 0, holdSteps: 0, stallSteps: 0, passes: 0, passOk: 0, lobs: 0, oops: 0, perfect: 0, lost: 0, behindSteps: 0, steps: 0, slips: 0 };
      for (const sd of seeds) {
        CONFIG.ai_level.value = lv; CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
        Object.assign(cpu.w, weights);
        if (tilt === null) cpu.style = neutral;
        const atkT = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? (atkLevel || t.ai_level) : t[k] });
        const atk = Opp.create(0, rng, atkT, 0);
        atk.style = Object.assign({}, neutral, tilt || {});
        const n0 = game.events.length; let lastShot = null, prev = game.scene, holdT = 0, pend = null, lastPass = null;
        for (let i = 0; i < 60 * secs; i++) {
          Opp.update(atk, world, atkT, 1 / 60 * tune.game_speed, { score: [game.state.score[0], game.state.score[1]] });
          game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
          const sh = world.ball.shot;
          if (sh && sh !== lastShot && sh.kind !== 'dunk') {
            lastShot = sh;
            if (sh.team === 0) { o.faced++; sh._a = true; } else if (!sh.lob) { o.shots++; sh._c = true; if (sh.perfect) o.perfect++; }
          }
          game.step(1, false);
          if (game.scene === 'scored' && prev !== 'scored' && world.ball.shot) {
            if (game.state.scorer === 0 && world.ball.shot._a) o.madeShots++;
            if (game.state.scorer === 1 && world.ball.shot._c) o.cpuMade++;
          }
          prev = game.scene;
          if (game.scene !== 'play') { holdT = 0; continue; }
          o.steps++;
          const h = world.hold;
          if (h && h.p.team === 1) { holdT += 1 / 60; o.holdSteps++; if (/OPENING/.test(cpu.intent) && cpu.tick - cpu.intentSeen < 2) o.stallSteps++; }
          else if (holdT > 0) { o.holdMax = Math.max(o.holdMax, holdT); o.holdSum += holdT; o.holds++; holdT = 0; }
          const ps = world.pass;
          if (ps && ps !== lastPass && ps.team === 1 && !ps.lob) { lastPass = ps; o.passes++; pend = ps; }
          if (pend && h) { if (h.p.team === 1 && h.p !== pend.from) o.passOk++; pend = null; }
          if (world.players.some(q => q.team === 1 && world.hoops.some(hp => (q.torso.position.x - hp.cx) * (-hp.side) < -10))) o.behindSteps++;
        }
        if (holdT > 0) { o.holdMax = Math.max(o.holdMax, holdT); o.holdSum += holdT; o.holds++; }
        game.hold('KeyW', false); game.hold('KeyS', false);
        o.allowed += game.state.score[0]; o.own += game.state.score[1];
        o.fakes += cpu.fakes.fakes; o.fakeShots += cpu.fakes.shots; o.fakeMade += cpu.fakes.made; o.slips += cpu.slips || 0;
        for (const e of game.events.slice(n0)) {
          if (e.type === 'dunkstart' && e.team === 0) o.dunkStarts++;
          if (e.type === 'dunk' && e.team === 0) o.dunks++;
          if (e.type === 'dunk' && e.team === 1) o.cpuDunks++;
          if (e.type === 'block' && e.team === 1) { o.blocks++; if (e.dunk) o.swats++; }
          if (e.type === 'steal' && e.team === 1) o.steals++;
          if ((e.type === 'steal' || e.type === 'strip') && e.team === 0) o.lost++;
          if (e.type === 'lob' && e.team === 1) o.lobs++;
          if (e.type === 'dunkstart' && e.team === 1 && e.oop) o.oops++;
        }
      }
      return {
        allowed: o.allowed, own: o.own, faced: o.faced, madeShots: o.madeShots, dunkStarts: o.dunkStarts, dunks: o.dunks,
        blocks: o.blocks, swats: o.swats, steals: o.steals, shots: o.shots, cpuMade: o.cpuMade, cpuDunks: o.cpuDunks,
        fakes: o.fakes, fakeShots: o.fakeShots, fakeMade: o.fakeMade,
        holdMax: +o.holdMax.toFixed(1), holdAvg: +(o.holds ? o.holdSum / o.holds : 0).toFixed(2),
        stall: +(o.holdSteps ? 100 * o.stallSteps / o.holdSteps : 0).toFixed(1),
        passes: o.passes, passOk: o.passOk, lobs: o.lobs, oops: o.oops, perfect: o.perfect, lost: o.lost,
        behind: +(o.steps ? 100 * o.behindSteps / o.steps : 0).toFixed(1), slips: o.slips,
      };
    };
  });
  const rows = [];
  for (const lv of levels) {
    const on = m => mode === 'all' || mode === 'both' || mode === m;
    if (on('defense')) for (const [name, tilt] of Object.entries(ATTACKERS)) {
      const r = await page.evaluate(([lv, seeds, secs, weights, tilt]) => window.__benchCell(lv, seeds, secs, weights, 3, tilt, true), [lv, seeds, secs, weights, tilt]);
      rows.push({ mode: 'defense', level: lv, vs: name, ...r });
    }
    if (on('versus')) {
      const r = await page.evaluate(([lv, seeds, secs, weights]) => window.__benchCell(lv, seeds, secs, weights, 0, null, true), [lv, seeds, secs, weights]);
      rows.push({ mode: 'versus', level: lv, vs: 'reference', ...r });
    }
    if (on('mirror')) {
      const r = await page.evaluate(([lv, seeds, secs, weights]) => window.__benchCell(lv, seeds, secs, weights, 0, null, false), [lv, seeds, secs, weights]);
      rows.push({ mode: 'mirror', level: lv, vs: 'same level', ...r });
    }
  }
  await browser.close();

  const cols = ['mode', 'level', 'vs', 'allowed', 'own', 'faced', 'madeShots', 'dunkStarts', 'dunks', 'blocks', 'swats', 'steals', 'shots', 'cpuMade', 'perfect', 'cpuDunks',
    'fakes', 'fakeShots', 'fakeMade', 'holdMax', 'holdAvg', 'stall', 'passes', 'passOk', 'lobs', 'oops', 'lost', 'behind', 'slips'];
  const tsv = [cols.join('\t'), ...rows.map(r => cols.map(c => r[c] === undefined ? '' : r[c]).join('\t'))].join('\n') + '\n';
  const outFile = path.join(dir, 'evidence', `ai-bench-${label}.tsv`);
  fs.writeFileSync(outFile, tsv);
  console.log(tsv);
  if (compare) {   // old -> new, cell by cell, for the columns both runs have
    const [head, ...lines] = fs.readFileSync(path.resolve(compare), 'utf8').trim().split('\n').map(l => l.split('\t'));
    const old = new Map(lines.map(l => [l[0] + '/' + l[1] + '/' + l[2], Object.fromEntries(head.map((h, i) => [h, l[i]]))]));
    const show = cols.slice(3).filter(c => head.includes(c));
    console.log(['cell', ...show].join('\t'));
    for (const r of rows) {
      const o = old.get(r.mode + '/' + r.level + '/' + r.vs);
      console.log([`${r.mode}/${r.level}/${r.vs}`, ...show.map(c => o && o[c] !== '' ? `${o[c]}->${r[c]}` : `${r[c]}`)].join('\t'));
    }
  }
  // the headline: own minus allowed per level, against the frozen attackers and against the reference at the same level
  for (const lv of levels) {
    const d = rows.filter(r => r.level === lv && r.mode === 'defense'), v = rows.find(r => r.level === lv && r.mode === 'versus');
    const net = d.reduce((a, r) => a + r.own - r.allowed, 0);
    console.log(`level ${lv}: net vs the four reference attackers ${d.length ? (net >= 0 ? '+' : '') + net : '-'}` + (v ? `, vs reference level ${lv}: ${v.own}-${v.allowed}` : ''));
  }
  console.log(`seeds ${seeds.join(',')} x ${secs}s per cell, weights ${JSON.stringify(weights)}; written to ${path.relative(dir, outFile)}`);
  if (errs.length) { console.log('PAGE ERRORS', errs); process.exitCode = 1; }
})();
