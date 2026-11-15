// PROTOTYPE - NOT FOR PRODUCTION
// Plays probe (iteration 42): CPU dribble reach (feet and ball, per dribble), and how often the new plays happen: give-and-go tries,
// cuts, give-and-go dunks, putbacks, heat checks, lobs and alley-oops. pts is [opponent, CPU].
// Usage: node tools/ai-plays.js <game dir> <level> <seeds, e.g. 1,2,3> ['{"config_key": value}']
// and how often the new plays happen: cuts, give-and-go dunks, putbacks, heat checks, lobs and alley-oops.
const { chromium } = require('playwright');
const dir = process.argv[2], levels = process.argv[3].split(',').map(Number), seeds = process.argv[4].split(',').map(Number);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + dir + '/index.html?manual=1');
  await pg.addScriptTag({ path: dir + '/tools/ai-ref.js' });
  if (process.argv[5] !== undefined) await pg.evaluate(v => { window.__cfg = JSON.parse(v); }, process.argv[5]);
  for (const lv of levels) {
    const r = await pg.evaluate(([lv, seeds]) => {
      const o = { ggTry: 0, ggHit: 0, passes: 0, dribbles: 0, maxTorso: 0, maxBall: 0, over25: 0, cuts: 0, cpuCuts: 0, giveGoStarts: 0, giveGoDunks: 0, putbackStarts: 0, putbackDunks: 0, hot: 0, lobs: 0, oops: 0, pts: [0, 0] };
      for (const sd of seeds) {
        CONFIG.win_score.value = 99; if (window.__cfg) for (const k in window.__cfg) CONFIG[k].value = window.__cfg[k]; Settings.set('ai_level', lv); CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
        const oT = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? Math.min(5, t.ai_level) : k === 'ai_react' && !(k in t) ? 0.18 : k === 'ai_error' && !(k in t) ? 0.35 : t[k] });
        const atk = AIRef.create(0, rng, oT, 0);
        let d = null;
        for (let i = 0; i < 60 * 90; i++) {
          AIRef.update(atk, world, oT, 1 / 60, { score: game.state.score.slice() });
          game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
          const w = world, evs = [], on = w.onEvent; w.onEvent = e => { evs.push(e); on(e); };
          const n0 = game.events.length;
          game.step(1, false);
          if (world === w) w.onEvent = on; else { d = null; }
          for (const e of game.events.slice(n0)) { if (e.type === 'score') o.pts[e.team] += e.points; if (e.type === 'hot' && e.team === 1) o.hot++; }
          for (const e of evs) {
            if (e.type === 'dribbleout' && e.team === 1) { const p = world.lastBouncer; o.dribbles++; d = { p, tx: (p.legs[0].position.x + p.legs[1].position.x) / 2, bx: world.ball.position.x, dir: p.dir, mt: 0, mb: 0 }; }
            if (e.type === 'cut') { o.cuts++; if (e.team === 1) o.cpuCuts++; }
            if (e.type === 'dunkstart' && e.team === 1 && e.giveGo) o.giveGoStarts++;
            if (e.type === 'dunk' && e.team === 1 && e.giveGo) o.giveGoDunks++;
            if (e.type === 'dunkstart' && e.team === 1 && e.putback) o.putbackStarts++;
            if (e.type === 'dunk' && e.team === 1 && e.putback) o.putbackDunks++;
            if (e.type === 'lob' && e.team === 1) o.lobs++;
            if (e.type === 'dunkstart' && e.team === 1 && e.oop && !e.giveGo) o.oops++;
          }
          if (cpu.intentAt === cpu.tick) { if (/PASS AND CUT/.test(cpu.intent)) o.ggTry++; if (/HITTING THE CUTTER/.test(cpu.intent)) o.ggHit++; if (/PASS/.test(cpu.intent)) o.passes++; }
          if (d && world === w) {
            d.mt = Math.max(d.mt, ((d.p.legs[0].position.x + d.p.legs[1].position.x) / 2 - d.tx) * d.dir);
            if (!world.hold) d.mb = Math.max(d.mb, (world.ball.position.x - d.bx) * d.dir);
            if (world.hold || !world.dribbleBall) { o.maxTorso = Math.max(o.maxTorso, d.mt); o.maxBall = Math.max(o.maxBall, d.mb); if (d.mt > 25 || d.mb > 25) o.over25++; d = null; }
          }
        }
        game.hold('KeyW', false); game.hold('KeyS', false);
      }
      o.maxTorso = Math.round(o.maxTorso); o.maxBall = Math.round(o.maxBall);
      return o;
    }, [lv, seeds]);
    console.log(JSON.stringify({ lv, ...r, errs: errs.length }));
  }
  if (errs.length) console.log(errs.slice(0, 3));
  await b.close();
})();
