// PROTOTYPE - NOT FOR PRODUCTION
// Rule probe (iteration 44): a CPU dunk started by a player whose last ball action was his own dribble (no pass, self-pass, shot
// or other player's touch since) is a violation. Also counts CPU dunks by what came before them, and the NO DUNK intents.
// Usage: node tools/ai-nodunk.js <game dir> <level> <seeds, e.g. 1,2,3>
const { chromium } = require('playwright');
const dir = process.argv[2], lv = +process.argv[3], seeds = process.argv[4].split(',').map(Number);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + dir + '/index.html?manual=1');
  await pg.addScriptTag({ path: dir + '/tools/ai-ref.js' });
  const r = await pg.evaluate(([lv, seeds]) => {
    const o = { violations: 0, dunkStarts: 0, after: {}, blocked: 0, pts: [0, 0] };
    for (const sd of seeds) {
      CONFIG.win_score.value = 99; Settings.set('ai_level', lv); CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
      const oT = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? Math.min(5, lv) : k === 'ai_react' && !(k in t) ? 0.18 : k === 'ai_error' && !(k in t) ? 0.35 : t[k] });
      const atk = AIRef.create(0, rng, oT, 0);
      let last = new Map(), lastIntent = '';
      for (let i = 0; i < 60 * 90; i++) {
        AIRef.update(atk, world, oT, 1 / 60, { score: game.state.score.slice() });
        game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
        const w = world, evs = [], on = w.onEvent, holder = w.hold ? w.hold.p : null, lb = w.lastBouncer;
        w.onEvent = e => { evs.push({ e, holder: w.hold ? w.hold.p : null, lb: w.lastBouncer }); on(e); };
        const n0 = game.events.length;
        game.step(1, false);
        if (world === w) w.onEvent = on; else { last = new Map(); continue; }
        for (const e of game.events.slice(n0)) if (e.type === 'score') o.pts[e.team] += e.points;
        if (cpu.intent !== lastIntent) { lastIntent = cpu.intent; if (/NO DUNK OFF THE DRIBBLE/.test(lastIntent)) o.blocked++; }
        for (const { e, holder: h2, lb: lb2 } of evs) {
          if (e.type === 'dribbleout' && lb2) last.set(lb2, 'dribble');
          else if (e.type === 'bounce' && lb2) last.set(lb2, 'pass');
          else if (['shoot', 'fadeaway', 'lob'].includes(e.type) && holder) last.set(holder, 'shot');
          else if ((e.type === 'grab' || e.type === 'steal') && h2) { for (const q of w.players) if (q !== h2) last.set(q, 'none'); last.set(h2, last.get(h2) === 'pass' ? 'self-pass' : 'caught'); }
          else if (e.type === 'dunkstart' && e.team === 1 && w.dunk) { o.dunkStarts++; const k = last.get(w.dunk.p) || 'none'; o.after[k] = (o.after[k] || 0) + 1; if (k === 'dribble') o.violations++; }
        }
      }
      game.hold('KeyW', false); game.hold('KeyS', false);
    }
    return o;
  }, [lv, seeds]);
  console.log(JSON.stringify({ lv, ...r, errs: errs.slice(0, 2) }));
  await b.close();
})();
