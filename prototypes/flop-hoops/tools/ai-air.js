// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-17
'use strict';
/**
 * Air time and shot accuracy by height (iteration 49): the game's CPU (team 1) plays the frozen reference brain (tools/ai-ref.js)
 * at the same level on neutral personalities, and this counts, for the CPU:
 *   air%      share of its steps with a player off the floor (all, and while the other team has the ball: defending)
 *   shots     its jump shots by how high its shooter was at the release: ground (feet within 14 px), low, high (more than 60 px up),
 *             each as made/taken
 *   near*     the same, for shots from within 330 px of the rim (so range does not hide the effect of height)
 *   err*      the mean miss, in px from the rim's centre, of the line each shot was on at the release (capped at 120), by the same heights
 *   defence   points allowed, blocks, steals
 *   node tools/ai-air.js [--levels 3,5] [--seeds 5,9,23,31] [--secs 60] [--style 0] [--label name]
 * --style picks the CPU's style (1-9, 0 = neutral). Writes evidence/ai-air-<label>.tsv.
 */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(__dirname, '..');
const levels = arg('levels', '3,5').split(',').map(Number), seeds = arg('seeds', '5,9,23,31').split(',').map(Number), secs = Number(arg('secs', 60));
const style = Number(arg('style', 0)), label = arg('label', 'run'), sets = (arg('set', '') || '').split(',').filter(Boolean).map(x => x.split('='));   // --set ai_air_miss=0,ai_hop_rest=0
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + dir + '/index.html?manual=1');
  await page.addScriptTag({ path: path.join(__dirname, 'ai-ref.js') });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* no storage */ } });
  const rows = [];
  for (const lv of levels) {
    const r = await page.evaluate(([lv, seeds, secs, style, sets]) => {
      for (const [k, v] of sets) CONFIG[k].value = Number(v);
      CONFIG.win_score.value = 99; CONFIG.game_speed.value = 1;
      const neutral = { name: '', attack: 1, range: 1, pass: 1, flash: 1, guard: 1, scav: 1, read: 1, risk: 0.5, wild: 1 };
      const o = { steps: 0, air: 0, defSteps: 0, defAir: 0, own: 0, allowed: 0, blocks: 0, steals: 0, g: [0, 0], l: [0, 0], h: [0, 0], ng: [0, 0], nl: [0, 0], nh: [0, 0], eg: [0, 0], el: [0, 0], eh: [0, 0], ev: {}, it: {} };
      const feetUp = p => Math.max(0, world.floorY - Math.max(...p.legs.map(l => l.position.y + Math.abs(Math.cos(l.angle)) * p.dims.legL / 2)));
      for (const sd of seeds) {
        Settings.set('ai_level', lv); if ('ai_style' in CONFIG) CONFIG.ai_style.value = 0;
        CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
        cpu.style = style > 0 && AI.STYLES[style - 1] ? AI.STYLES[style - 1] : neutral;
        const T = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? Math.min(5, lv) : k === 'ai_react' && !(k in t) ? 0.18 : k === 'ai_error' && !(k in t) ? 0.35 : t[k] });
        const atk = AIRef.create(0, rng, T, 0); atk.style = neutral;
        const n0 = game.events.length; let lastShot = null;
        for (let i = 0; i < 60 * secs; i++) {
          AIRef.update(atk, world, T, 1 / 60 * tune.game_speed, { score: [game.state.score[0], game.state.score[1]] });
          game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
          const hb = world.hold, shooter = hb && hb.p.team === 1 && hb.cocking ? hb.p : null, up0 = shooter ? feetUp(shooter) : 0, gap0 = shooter ? Math.abs(shooter.torso.position.x - world.hoops.find(h => h.team === 1).cx) : 999;
          game.step(1, false);
          const sh = world.ball.shot;
          if (sh && sh !== lastShot && sh.kind !== 'dunk' && !sh.lob && sh.team === 1) {
            lastShot = sh; const up = up0, b = up <= 14 ? o.g : up <= 60 ? o.l : o.h, nb = up <= 14 ? o.ng : up <= 60 ? o.nl : o.nh; b[1]++; sh._b = b; if (gap0 <= 330) { nb[1]++; sh._n = nb; }
            { const hp = world.hoops.find(h => h.team === 1), ln = Physics.predictLine(world, tune, hp), e = ln.crossX === null ? 120 : Math.min(120, Math.abs(ln.crossX - hp.cx)), eb = up <= 14 ? o.eg : up <= 60 ? o.el : o.eh; eb[0] += e; eb[1]++; }
          }
          if (game.scene === 'scored' && world.ball.shot && world.ball.shot._b && game.state.scorer === 1) { world.ball.shot._b[0]++; world.ball.shot._b = null; if (world.ball.shot._n) world.ball.shot._n[0]++; }
          { const tx = (cpu.intent || '').slice(0, 24); if (tx !== o._last) { o._last = tx; for (const [k, re] of [['deflect', /DEFLECTING/], ['strip', /STRIPPING/], ['recover', /RECOVERING/], ['street', /STREET BALL/], ['selfpass', /SELF-PASS: THROWING/], ['fakeI', /PUMP FAKE/], ['lobI', /ALLEY-OOP: LOBBING/]]) if (re.test(tx)) o.it[k] = (o.it[k] || 0) + 1; } }
          if (game.scene !== 'play') continue;
          o.steps++;
          const mine = world.players.filter(q => q.team === 1), air = mine.filter(q => q.sinceGround > 0.08).length;
          o.air += air / 2;
          if (world.hold && world.hold.p.team === 0) { o.defSteps++; o.defAir += air / 2; }
        }
        game.hold('KeyW', false); game.hold('KeyS', false);
        o.allowed += game.state.score[0]; o.own += game.state.score[1];
        for (const e of game.events.slice(n0)) { if (e.team === 1 && ['dribbleout', 'lob', 'fadeaway', 'pumpfake', 'dunk', 'dunkstart'].includes(e.type)) o.ev[e.type] = (o.ev[e.type] || 0) + 1; if (e.type === 'block' && e.team === 1) o.blocks++; if (e.type === 'steal' && e.team === 1) o.steals++; }
      }
      return { air: +(100 * o.air / o.steps).toFixed(1), defAir: +(100 * o.defAir / Math.max(1, o.defSteps)).toFixed(1), own: o.own, allowed: o.allowed, blocks: o.blocks, steals: o.steals,
        ground: o.g.join('/'), low: o.l.join('/'), high: o.h.join('/'), nearGround: o.ng.join('/'), nearLow: o.nl.join('/'), nearHigh: o.nh.join('/'),
        errGround: +(o.eg[0] / Math.max(1, o.eg[1])).toFixed(1), errLow: +(o.el[0] / Math.max(1, o.el[1])).toFixed(1), errHigh: +(o.eh[0] / Math.max(1, o.eh[1])).toFixed(1),
        events: Object.entries(o.ev).map(([k, v]) => k + ':' + v).join(' '), intents: Object.entries(o.it).map(([k, v]) => k + ':' + v).join(' ') };
    }, [lv, seeds, secs, style, sets]);
    rows.push({ level: lv, ...r });
  }
  const head = Object.keys(rows[0]); const tsv = [head.join('\t'), ...rows.map(r => head.map(k => r[k]).join('\t'))].join('\n');
  fs.writeFileSync(path.join(dir, 'evidence', `ai-air-${label}.tsv`), tsv + '\n');
  console.log(tsv); if (errs.length) console.log('page errors:', errs.slice(0, 3));
  await browser.close();
})();
