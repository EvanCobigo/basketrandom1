// PROTOTYPE - NOT FOR PRODUCTION
// Dribble probe (iteration 45): every CPU dribble from release to its end. Usage: node tools/ai-dribbles.js <game dir> <level> <seeds, e.g. 1,2,3>
// loose (nobody had it when the dribble window ran out), other. Also: steps to the catch, closest ball-hand distance on the
// way up, sloppy share, chains, seated taps, and taps the AI makes while its own dribble is down (queued) or never caught.
const { chromium } = require('playwright');
const dir = process.argv[2], lv = +process.argv[3], seeds = process.argv[4].split(',').map(Number);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + dir + '/index.html?manual=1');
  await pg.addScriptTag({ path: dir + '/tools/ai-ref.js' });
  const r = await pg.evaluate(([lv, seeds]) => {
    const o = { n: 0, ends: {}, catchSteps: [], loseIntents: {}, sloppy: 0, clean: 0, seatedTaps: 0, chainMax: 0, looseDist: [], stuckHolds: 0, foeDist: [], wildVx: 0, ballBehind: 0 };
    const tally = (m, k) => m[k] = (m[k] || 0) + 1;
    for (const sd of seeds) {
      CONFIG.win_score.value = 99; Settings.set('ai_level', lv); CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
      const oT = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? Math.min(5, lv) : k === 'ai_react' && !(k in t) ? 0.18 : k === 'ai_error' && !(k in t) ? 0.35 : t[k] });
      const atk = AIRef.create(0, rng, oT, 0);
      let d = null;
      for (let i = 0; i < 60 * 90; i++) {
        AIRef.update(atk, world, oT, 1 / 60, { score: game.state.score.slice() });
        game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
        const w = world, evs = [], on = w.onEvent; w.onEvent = e => { evs.push({ e, hold: w.hold ? w.hold.p : null }); on(e); };
        game.step(1, false);
        if (world === w) w.onEvent = on; else { d = null; continue; }
        for (const { e, hold } of evs) {
          if (e.type === 'seatedtap' && e.team === 1) o.seatedTaps++;
          if (e.type === 'dribbleout' && e.team === 1) {
            if (d && !d.end) { d.end = 'rebounced'; }
            const p = w.lastBouncer; o.n++;
            if (e.quality === 'sloppy') o.sloppy++; else if (e.quality === 'clean') o.clean++;
            o.chainMax = Math.max(o.chainMax, e.chain || 0);
            const bvx = w.ball.velocity.x * p.dir; if (bvx < -0.5) o.ballBehind++; if (Math.abs(w.ball.velocity.x) > 4) o.wildVx++;
            d = { p, t: 0, minHand: 1e9, intent: cpu.intent };
          } else if (d && !d.end && (e.type === 'dribble' || e.type === 'grab' || e.type === 'steal')) {
            const h = w.hold ? w.hold.p : null;
            d.end = e.type === 'dribble' ? 'own' : !h ? 'other' : h === d.p ? 'own' : h.team === 1 ? 'mate' : 'foe';
            if (d.end === 'own') o.catchSteps.push(d.t);
            if (d.end === 'foe') { tally(o.loseIntents, d.intent); o.foeDist.push(Math.round(d.minHand)); }
            tally(o.ends, d.end); d = null;
          }
        }
        if (d) {
          d.t++;
          const hp = Physics.handPos(d.p), bl = w.ball.position;
          d.minHand = Math.min(d.minHand, Math.hypot(hp.x - bl.x, hp.y - bl.y));
          if (!w.dribbleBall && !w.hold) { tally(o.ends, 'loose'); o.looseDist.push(Math.round(Math.abs(bl.x - d.p.torso.position.x))); tally(o.loseIntents, 'LOOSE:' + d.intent); d = null; }
          else if (d.t > 120) { tally(o.ends, 'timeout'); d = null; }
        }
      }
      game.hold('KeyW', false); game.hold('KeyS', false);
    }
    const cs = o.catchSteps.sort((a, b) => a - b);
    o.catchSteps = cs.length ? [cs[0], cs[Math.floor(cs.length / 2)], cs[cs.length - 1]] : [];
    o.looseDist = o.looseDist.sort((a, b) => a - b);
    o.foeDist = o.foeDist.sort((a, b) => a - b);
    return o;
  }, [lv, seeds]);
  console.log(JSON.stringify({ lv, ...r, errs: errs.slice(0, 2) }));
  await b.close();
})();
