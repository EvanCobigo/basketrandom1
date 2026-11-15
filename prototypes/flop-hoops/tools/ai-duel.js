// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-15
'use strict';
/**
 * AI duel: two computers of different levels play each other (WATCH CPU mode), once from each side of every
 * seed, and the numbers behind each trait of the AI are counted for both, so "level B is better than level A" can
 * be read off per trait instead of felt.
 *
 *   node tools/ai-duel.js [--a 5] [--b 6] [--seeds 3,17,41,58] [--secs 120] [--neutral 1] [--patch '{"lobGuard":0}'] [--label name]
 *
 * a is the baseline, b the challenger. --neutral 1 gives both a plain personality (so a lucky draw of personalities
 * does not decide it); 0 lets the game pick them as it does in play. Each match is played with the challenger on
 * either side. Prints a table (a, b, and which is better) and writes evidence/ai-duel-<label>.tsv.
 * Needs playwright and a browser; the game runs from file://, nothing leaves the machine.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(__dirname, '..');
const A = Number(arg('a', 5)), B = Number(arg('b', 6));
const seeds = arg('seeds', '3,17,41,58').split(',').map(Number);
const secs = Number(arg('secs', 120));
const neutral = Number(arg('neutral', 1)) === 1;
const label = arg('label', `L${A}-v-L${B}`);
const weightsB = JSON.parse(arg('weights', '{}'));   // AI.DEFAULT_WEIGHTS overrides for the challenger only (--weights '{"dribble":0.6}')
const patch = JSON.parse(arg('patch', '{}'));   // fields to overwrite on the challenger's entry in AI.LEVELS (an ablation: --patch '{"lobGuard":0}')

/** Plays one match inside the page and returns the counts for team 0 and team 1. */
function playMatch([lv0, lv1, seed, secs, neutral, bSide, wB]) {
  CONFIG.win_score.value = 99; CONFIG.game_speed.value = 1; CONFIG.dunk_hitstop.value = 0; CONFIG.seed = seed;
  toMenu(); game.step(2, false); newMatch('sim'); game.step(100, false);
  const ctl = [cpuA, cpu];
  ctl[0].lv = lv0; ctl[1].lv = lv1; Object.assign(ctl[bSide].w, wB);
  if (neutral) for (const c of ctl) c.style = { name: '', attack: 1, range: 1, pass: 1, flash: 1, guard: 1, scav: 1, read: 1, risk: 0.5, wild: 1 };
  const blank = () => ({ points: 0, shots: 0, shotMade: 0, fadeShots: 0, fadeMade: 0, longShots: 0, longMade: 0, perfects: 0, perfectMade: 0, looseMade: 0, dunkStarts: 0, dunks: 0, oopDunks: 0, lobs: 0, lobOop: 0, lobBank: 0, lobLost: 0, lobNone: 0,
    passes: 0, passDone: 0, passPicked: 0, blocks: 0, swats: 0, steals: 0, strips: 0, dribbles: 0, fakes: 0, fakeShots: 0, fakeMade: 0, maxHold: 0, holdsOver3: 0, holds: 0, behindN: 0, samples: 0, possN: 0, steps: 0,
    selfThrows: 0, selfCaught: 0, selfDunks: 0, screens: 0, fastBreaks: 0, rimWaits: 0, forced: 0, boards: 0, timed: 0, reads: 0 });
  const m = [blank(), blank()];
  let holdKeyMax = 0; const log = []; let ei = game.events.length, lastShot = null, lastPass = null, holdKey = null, holdStart = 0;
  const seenAt = [ctl[0].intentAt, ctl[1].intentAt];
  const intents = [[/SETTING A SCREEN/, 'screens'], [/FAST BREAK/, 'fastBreaks'], [/WAITING OUT THE RIM/, 'rimWaits'], [/NOTHING ELSE IS OPEN/, 'forced'], [/GOING UP FOR THE BOARD|CRASHING THE BOARD/, 'boards'], [/TIMING THE STEAL/, 'timed'], [/YOU KEEP DUNKING|YOU SHOOT LONG|IT IS WORKING/, 'reads']];
  for (let i = 0; i < 60 * secs; i++) {
    game.step(1, false);
    for (let t = 0; t < 2; t++) {   // what each computer says it is doing, counted when the line changes
      if (ctl[t].intentAt !== seenAt[t]) { seenAt[t] = ctl[t].intentAt; for (const [re, k] of intents) if (re.test(ctl[t].intent)) m[t][k]++; }
    }
    const n = game.events.length;
    for (; ei < n; ei++) log.push(game.events[ei]);
    const sh = world.ball.shot;
    if (sh && sh !== lastShot && sh.kind !== 'dunk') { lastShot = sh; const t = sh.team, long = (sh.fromX - world.cx) * sh.dir < 0; const q = m[t]; if (sh.kind === 'fade') q.fadeShots++; else if (long) q.longShots++; else q.shots++; if (sh.perfect) q.perfects++; sh._k = sh.kind === 'fade' ? 'fade' : long ? 'long' : 'shot'; log.push({ type: 'shotat', team: t, shot: sh }); }
    const ps = world.pass;
    if (ps && ps !== lastPass) { lastPass = ps; if (!ps.lob) { m[ps.team].passes++; log.push({ type: 'passat', team: ps.team }); } }
    if (game.scene === 'play') {
      const h = world.hold, key = h ? h.p.team : null;
      if (h) { const q = m[h.p.team]; q.possN++; if (h.t > q.maxHold) q.maxHold = h.t; }
      if (key !== holdKey) { if (holdKey !== null) { const q = m[holdKey]; q.holds++; if (holdKeyMax > 3) q.holdsOver3++; } holdKey = key; holdKeyMax = 0; }
      if (h && h.t > holdKeyMax) holdKeyMax = h.t;
      if (i % 20 === 0) for (const p of world.players) for (const hp of world.hoops) { m[p.team].samples++; if ((p.torso.position.x - hp.cx) * (-hp.side) < 20) m[p.team].behindN++; }
    }
  }
  // the log, in order: score the shots, then the lobs and the passes by what came next
  const made = [];
  for (let k = 0; k < log.length; k++) {
    const e = log[k], q = e.team === undefined ? null : m[e.team];
    if (!q) continue;
    if (e.type === 'dunkstart') { q.dunkStarts++; if (e.oop) q.oopDunks++; }
    else if (e.type === 'dunk') q.dunks++;
    else if (e.type === 'block') { q.blocks++; if (e.dunk) q.swats++; }
    else if (e.type === 'steal') q.steals++;
    else if (e.type === 'strip') q.strips++;
    else if (e.type === 'dribbleout') q.dribbles++;
    else if (e.type === 'lob') {
      q.lobs++;
      let out = 'none';
      for (let j = k + 1; j < Math.min(log.length, k + 60); j++) {
        const f = log[j];
        if (f.type === 'lob') break;
        if (f.type === 'dunkstart' && f.team === e.team && f.oop) { out = 'oop'; break; }
        if (f.type === 'score' && f.team === e.team) { out = 'bank'; break; }
        if ((f.type === 'steal' || f.type === 'grab' || f.type === 'score') && f.team !== e.team) { out = 'lost'; break; }
      }
      q[out === 'oop' ? 'lobOop' : out === 'bank' ? 'lobBank' : out === 'lost' ? 'lobLost' : 'lobNone']++;
    } else if (e.type === 'passat') {
      let out = 'none';
      for (let j = k + 1; j < Math.min(log.length, k + 40); j++) {
        const f = log[j];
        if (f.type === 'passat' || f.type === 'shotat') break;
        if (f.type === 'grab') { out = f.team === e.team ? 'done' : 'picked'; break; }
        if (f.type === 'steal') { out = f.team === e.team ? 'done' : 'picked'; break; }
      }
      if (out === 'done') q.passDone++; else if (out === 'picked') q.passPicked++;
    } else if (e.type === 'score') {
      q.points += e.points;
      const kind = e.how === 'dunk' ? 'dunk' : e.lob ? 'lob' : e.how === 'fade' ? 'fade' : e.points === 2 ? 'long' : e.how ? 'shot' : 'loose';
      if (kind === 'shot') q.shotMade++; else if (kind === 'fade') q.fadeMade++; else if (kind === 'long') q.longMade++; else if (kind === 'loose') q.looseMade++;
      if (e.perfect) q.perfectMade++;
    }
  }
  for (let t = 0; t < 2; t++) { m[t].selfEnds = ctl[t].selfEnds; m[t].selfThrows = ctl[t].selfStats.tries; m[t].selfCaught = ctl[t].selfStats.caught; m[t].selfDunks = ctl[t].selfStats.dunks; m[t].fakes = ctl[t].fakes.fakes; m[t].fakeShots = ctl[t].fakes.shots; m[t].fakeMade = ctl[t].fakes.made; m[t].steps = 60 * secs; }
  return m;
}

const NAMES = [
  ['points', 'POINTS', 1], ['shots', 'jump shots', 1], ['shotMade', '  made', 1], ['fadeShots', 'fadeaways', 1], ['fadeMade', '  made', 1], ['longShots', 'long shots', 1], ['longMade', '  made', 1], ['perfects', 'perfect lines', 1], ['perfectMade', '  made', 1], ['looseMade', 'baskets off scrambles', 1],
  ['dunkStarts', 'dunks started', 1], ['dunks', 'dunks made', 1], ['oopDunks', 'alley-oop dunks', 1], ['lobs', 'lobs thrown', 1], ['lobOop', '  became an alley-oop', 1], ['lobBank', '  banked in', 1], ['lobLost', '  lost to the foe', 1],
  ['passes', 'passes', 1], ['passDone', '  completed', 1], ['passPicked', '  picked off', -1],
  ['blocks', 'blocks (all)', 1], ['swats', '  of dunks', 1], ['steals', 'steals', 1], ['strips', 'strips', 1], ['dribbles', 'dribbles', 1], ['fakes', 'pump fakes', 1], ['fakeShots', '  shots after', 1], ['fakeMade', '  made', 1],
  ['selfThrows', 'self-passes thrown', 1], ['selfCaught', '  caught by himself', 1], ['selfDunks', '  dunk after', 1], ['screens', 'screens set', 1], ['fastBreaks', 'fast breaks', 1], ['rimWaits', 'rim protector waits', 1], ['forced', 'forced shots (stalls)', -1], ['boards', 'rebound jumps', 1], ['timed', 'timed steals', 1], ['reads', 'learned reads shown', 1],
  ['maxHold', 'longest hold (s)', -1], ['holdsOver3', 'holds over 3 s', -1], ['behind', 'time behind a basket %', -1],
];

(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + dir + '/index.html?manual=1');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* no storage */ } });
  await page.evaluate(([lv, patch]) => Object.assign(AI.LEVELS[lv - 1], patch), [B, patch]);
  const sum = { a: {}, b: {} }, rows = []; const ends = {}; let aWins = 0, bWins = 0, ties = 0, diff = 0, n = 0;
  const maxKeys = new Set(['maxHold']);
  for (const sd of seeds) for (const bSide of [0, 1]) {
    const lv = bSide === 0 ? [B, A] : [A, B];
    const m = await page.evaluate(playMatch, [lv[0], lv[1], sd, secs, neutral, bSide, weightsB]).catch(e => { console.log('ERR', e.message.slice(0, 300)); return null; });
    if (!m) continue;
    const mb = m[bSide], ma = m[1 - bSide];
    mb.behind = 100 * mb.behindN / Math.max(1, mb.samples); ma.behind = 100 * ma.behindN / Math.max(1, ma.samples);
    for (const [who, src] of [['a', ma], ['b', mb]]) for (const k of Object.keys(src)) sum[who][k] = maxKeys.has(k) ? Math.max(sum[who][k] || 0, src[k]) : (sum[who][k] || 0) + src[k];
    for (const k of Object.keys(mb.selfEnds || {})) ends[k] = (ends[k] || 0) + mb.selfEnds[k];
    n++; diff += mb.points - ma.points; if (mb.points > ma.points) bWins++; else if (mb.points < ma.points) aWins++; else ties++;
    console.log(`seed ${sd} L${B} on team ${bSide}: L${B} ${mb.points} - ${ma.points} L${A}`);
  }
  if (sum.a.behind !== undefined) { sum.a.behind /= n; sum.b.behind /= n; }
  const f = v => v === undefined ? '' : Number.isInteger(v) ? String(v) : v.toFixed(1);
  const out = [['trait', `L${A}`, `L${B}`, 'better'].join('\t')];
  for (const [k, name, good] of NAMES) {
    const a = sum.a[k] || 0, b = sum.b[k] || 0;
    out.push([name, f(a), f(b), a === b ? '=' : (b > a) === (good > 0) ? `L${B}` : `L${A}`].join('\t'));
  }
  out.push(['MATCHES', `L${A} won ${aWins}`, `L${B} won ${bWins}`, `ties ${ties}; L${B} point difference per match ${(diff / Math.max(1, n)).toFixed(1)}`].join('\t'));
  console.log(out.join('\n'));
  if (Object.keys(ends).length) console.log('self-pass chases that ended without a catch, by reason: ' + JSON.stringify(ends));
  fs.writeFileSync(path.join(dir, 'evidence', `ai-duel-${label}.tsv`), out.join('\n') + '\n');
  if (errs.length) { console.log('PAGE ERRORS', errs); process.exitCode = 1; }
  await browser.close();
})();
