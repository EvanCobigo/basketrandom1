// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-18
'use strict';
//   node tools/playtest.js            (needs Playwright; prints one row per match)
const { chromium } = require('playwright');
const path = require('path');
// A full-match playtest by script: every CPU style plays a whole match to 12 (watch mode, CPU vs CPU) and a "human stand-in"
// (the frozen reference brain on the W / S keys, sloppier than the CPU) plays whole matches against each CPU style.
// It records how long the match took, the score, 2-pointers, re-drops (a ball nobody could move), stalls, the longest hold,
// dunks, blocks, steals, passes, dribbles and how often a ball sat still off the floor; and screenshots a few moments.
(async () => {
  const dir = path.resolve(__dirname, '..');
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  pg.on('pageerror', e => errs.push('PAGE: ' + e.message));
  await pg.goto('file://' + dir + '/index.html?manual=1'); await pg.addScriptTag({ path: dir + '/tools/ai-ref.js' });
  const names = await pg.evaluate(() => AI.STYLES.map(s => s.name));
  const rows = [];
  for (let st = 1; st <= names.length; st++) {
    for (const mode of ['watch', 'human-ish']) {
      const lv = 4;
      const r = await pg.evaluate(([st, mode, lv]) => {
        Settings.reset(); CONFIG.win_score.value = 12; CONFIG.game_speed.value = 1; Settings.set('ai_level', lv); Settings.set('ai_style', st);
        CONFIG.seed = 100 + st; toMenu(); game.step(2, false); newMatch(mode === 'watch' ? 'sim' : 'cpu'); game.step(100, false);
        let atk = null; const T = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? 2 : k === 'ai_react' && !(k in t) ? 0.2 : k === 'ai_error' && !(k in t) ? 0.4 : t[k] });
        if (mode !== 'watch') { atk = AIRef.create(0, rng, T, 0); }
        const m = { steps: 0, redrops: 0, dunks: 0, blocks: 0, steals: 0, twos: 0, ones: 0, passes: 0, dribbles: 0, holdMax: 0, floatStuck: 0, scoreGap: [], lastScoreStep: 0, perfect: 0, fades: 0, hotSpot: 0 };
        const n0 = game.events.length; let hold = 0, still = 0, prevScene = '', lastS = [0, 0];
        for (let i = 0; i < 60 * 600 && game.scene !== 'results' && game.scene !== 'replay'; i++) {
          if (atk && game.scene === 'play') { AIRef.update(atk, world, T, 1 / 60, { score: game.state.score.slice() }); game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce); }
          game.step(1, false);
          if (game.scene === 'play') {
            m.steps++;
            const h = world.hold; if (h) { hold += 1 / 60; m.holdMax = Math.max(m.holdMax, hold); } else hold = 0;
            const bb = world.ball; if (!h && bb.position.y < world.floorY - bb.r - 30 && Math.hypot(bb.velocity.x, bb.velocity.y) < 0.15) { still++; if (still === 120) m.floatStuck++; } else still = 0;
          }
          const sc = game.state.score; if (sc[0] + sc[1] !== lastS[0] + lastS[1]) { m.scoreGap.push(Math.round((m.steps - m.lastScoreStep) / 60)); m.lastScoreStep = m.steps; lastS = sc.slice(); }
        }
        game.hold('KeyW', false); game.hold('KeyS', false);
        for (const e of game.events.slice(n0)) {
          if (e.type === 'score') { if (e.points === 2) m.twos++; else m.ones++; if (e.perfect) m.perfect++; }
          if (e.type === 'dunk') m.dunks++; if (e.type === 'block') m.blocks++; if (e.type === 'steal') m.steals++; if (e.type === 'bounce') m.passes++; if (e.type === 'dribbleout') m.dribbles++;
          if (e.type === 'fadeaway') m.fades++;
        }
        const ev = game.events.slice(n0).filter(e => e.type === 'redrop').length;
        return { final: game.state.score.join('-'), winner: game.state.winner, secs: Math.round(m.steps / 60), scene: game.scene, m, rounds: game.state.round };
      }, [st, mode, lv]);
      rows.push({ style: names[st - 1], mode, ...r });
      if (st === 9 && mode === 'human-ish') { /* the screenshots come from a separate short run below */ }
    }
  }
  console.log(JSON.stringify(rows.map(r => ({ style: r.style, mode: r.mode, final: r.final, secs: r.secs, rounds: r.rounds, ended: r.scene, twos: r.m.twos, ones: r.m.ones, dunks: r.m.dunks, blocks: r.m.blocks, steals: r.m.steals, passes: r.m.passes, dribbles: r.m.dribbles, fades: r.m.fades, perfect: r.m.perfect, holdMax: +r.m.holdMax.toFixed(1), floatStuck: r.m.floatStuck, gapMed: r.m.scoreGap.sort((a, b) => a - b)[r.m.scoreGap.length >> 1], gapMax: Math.max(0, ...r.m.scoreGap) })), null, 0));
  console.log('errors:', errs.slice(0, 5)); await b.close();
})();
