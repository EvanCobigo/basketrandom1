// PROTOTYPE - NOT FOR PRODUCTION
// Long-shot defence probe (iteration 43): the frozen reference brain (tools/ai-ref.js) attacks the CPU at a level; for each of its
// jump shots: long (from its own half, worth 2) or near, made, perfect, contested (a CPU player within 130 px of the release, or
// in the air within 200 px), blocked. Also points for-against.
// Usage: node tools/ai-longd.js <game dir> <levels, e.g. 3,4,5> [seeds per level, default 10]
const { chromium } = require('playwright');
const dir = process.argv[2], levels = process.argv[3].split(',').map(Number), nSeeds = Number(process.argv[4] || 10);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + dir + '/index.html?manual=1');
  await pg.addScriptTag({ path: dir + '/tools/ai-ref.js' });
  for (const lv of levels) {
    const r = await pg.evaluate(([lv, nSeeds]) => {
      const row = () => ({ att: 0, made: 0, perfect: 0, contested: 0, blocked: 0 });
      const o = { long: row(), near: row(), pts: { cpu: 0, opp: 0 }, closeouts: 0 };
      for (let sd = 1; sd <= nSeeds; sd++) {
        CONFIG.win_score.value = 99; Settings.set('ai_level', lv); CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
        const oT = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? Math.min(5, lv) : k === 'ai_react' && !(k in t) ? 0.18 : k === 'ai_error' && !(k in t) ? 0.35 : t[k] });
        const atk = AIRef.create(0, rng, oT, 0);
        let last = null, pend = null, lastIntent = '';
        for (let i = 0; i < 60 * 90; i++) {
          AIRef.update(atk, world, oT, 1 / 60, { score: game.state.score.slice() });
          game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
          const n0 = game.events.length;
          game.step(1, false);
          const w = world, sh = w.ball.shot;
          if (cpu.intent !== lastIntent) { lastIntent = cpu.intent; if (/CLOSING OUT/.test(lastIntent)) o.closeouts++; }
          if (sh && sh !== last && sh.team === 0 && sh.kind !== 'dunk' && !sh.lob) {
            last = sh;
            const k = (sh.fromX - w.cx) * sh.dir < 0 ? o.long : o.near;
            const mine = w.players.filter(q => q.team === 1);
            k.att++;
            if (mine.some(q => Math.abs(q.torso.position.x - sh.fromX) < 130 || (q.sinceGround > 0.1 && Math.abs(q.torso.position.x - sh.fromX) < 200))) k.contested++;
            pend = { k, sh };
          }
          for (const e of game.events.slice(n0)) {
            if (e.type === 'block' && e.team === 1 && pend && !e.dunk) { pend.k.blocked++; pend = null; }
            if (e.type === 'score') {
              if (e.team === 1) o.pts.cpu += e.points; else o.pts.opp += e.points;
              if (e.team === 0 && pend && e.how !== 'dunk') { pend.k.made++; if (e.perfect) pend.k.perfect++; }
              pend = null;
            }
          }
        }
        game.hold('KeyW', false); game.hold('KeyS', false);
      }
      return o;
    }, [lv, nSeeds]);
    const f = k => `${k.att} shots, ${k.made} made (${k.att ? Math.round(100 * k.made / k.att) : 0}%), ${k.perfect} perfect, ${k.contested} contested, ${k.blocked} blocked`;
    console.log(`L${lv} pts cpu ${r.pts.cpu} - opp ${r.pts.opp} | LONG ${f(r.long)} | NEAR ${f(r.near)} | closeouts ${r.closeouts}`);
  }
  if (errs.length) console.log('ERRS', errs.slice(0, 3));
  await b.close();
})();
