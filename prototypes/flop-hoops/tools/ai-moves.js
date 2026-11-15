// PROTOTYPE - NOT FOR PRODUCTION
// Move probe (iteration 40): per CPU move, how often it is tried and how it ends, against the frozen reference brain (tools/ai-ref.js).
// Usage: node tools/ai-moves.js <game dir> <levels, e.g. 3,4,5,6> [seeds per level, default 10]
// Prints, per level, points for-against, own goals (the CPU's pass or carry into its own basket), clearing shots, its shot records and,
// per move, tries:ok/bad (what counts as ok or bad for each move is in M below; a try that ends neither way is not counted).
const { chromium } = require('playwright');
const dir = process.argv[2], levels = process.argv[3].split(',').map(Number), nSeeds = Number(process.argv[4] || 10);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + dir + '/index.html?manual=1');
  await pg.addScriptTag({ path: dir + '/tools/ai-ref.js' });
  for (const lv of levels) {
    const r = await pg.evaluate(([lv, nSeeds]) => {
      // move: [intent regex, window s, success test(ev), fail test(ev)]  (events seen: physics events + score)
      const M = {
        lob: [/ALLEY-OOP: LOBBING/, 3, e => e.type === 'dunk' && e.team === 1 && e.oop, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal')],
        screen: [/SETTING A SCREEN/, 1.5, e => (e.type === 'grab' || e.type === 'dribble') && e.team === 1, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal')],
        fake: [/PUMP FAKE/, 2.5, e => e.type === 'score' && e.team === 1, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal' || e.type === 'block')],
        fade: [/FADING AWAY/, 3, e => e.type === 'score' && e.team === 1, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal' || e.type === 'block')],
        long: [/LONG SHOT/, 3, e => e.type === 'score' && e.team === 1, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal' || e.type === 'block')],
        jump: [/JUMP SHOT|TAKING A GOOD ONE|PERFECT SHOT/, 3, e => e.type === 'score' && e.team === 1, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal' || e.type === 'block')],
        self: [/SELF-PASS: THROWING/, 3, e => e.type === 'score' && e.team === 1, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal' || e.type === 'block')],
        fastbreak: [/FAST BREAK/, 4, e => e.type === 'score' && e.team === 1, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal' || e.type === 'block')],
        outlet: [/OUTLET|OFF THE WALL/, 3, e => e.type === 'grab' && e.team === 1, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal') || e.type === 'score' && e.team === 0],
        waitout: [/WAITING OUT THE RIM/, 2.5, e => e.type === 'score' && e.team === 1, e => e.team === 0 && (e.type === 'grab' || e.type === 'steal' || e.type === 'block')],
        swat: [/SWATTING THE DUNK/, 1.2, e => e.type === 'block' && e.team === 1, e => e.type === 'score' && e.team === 0],
        rimread: [/READING THE DUNK/, 1.8, e => e.type === 'block' && e.team === 1 || e.type === 'steal' && e.team === 1, e => e.type === 'score' && e.team === 0],
        timed: [/TIMING THE STEAL/, 0.9, e => e.type === 'steal' && e.team === 1, e => e.team === 0 && e.type === 'grab'],
        swipe: [/GOING FOR THE STEAL/, 0.9, e => e.type === 'steal' && e.team === 1, e => e.type === 'score' && e.team === 0],
        crash: [/CRASHING THE BOARD/, 3, e => (e.type === 'grab' || e.type === 'steal') && e.team === 1, e => (e.type === 'grab' || e.type === 'steal') && e.team === 0 || e.type === 'score'],
        contest: [/CONTESTING THE SHOT/, 2.5, e => e.type === 'block' && e.team === 1 || (e.type === 'grab' || e.type === 'steal') && e.team === 1, e => e.type === 'score' && e.team === 0],
      };
      const S = {}; for (const k in M) S[k] = { n: 0, ok: 0, bad: 0 };
      const tot = { pts: [0, 0], ownGoals: 0, carriedOwn: 0, clears: 0, mine: null };
      const mine = { shot: [0, 0], long: [0, 0], fade: [0, 0], dunk: [0, 0] }, self = { tries: 0, caught: 0, dunks: 0 }, fk = { fakes: 0, shots: 0, made: 0 };
      for (let sd = 1; sd <= nSeeds; sd++) {
        CONFIG.win_score.value = 99; CONFIG.game_speed.value = 1; Settings.set('ai_level', lv); CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
        const oT = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? Math.min(5, t.ai_level) : k === 'ai_react' && !(k in t) ? 0.18 : k === 'ai_error' && !(k in t) ? 0.35 : t[k] });
        const atk = AIRef.create(0, rng, oT, 0);
        const open = [];
        let lastIntent = null;
        for (let i = 0; i < 60 * 90; i++) {
          AIRef.update(atk, world, oT, 1 / 60, { score: game.state.score.slice() });
          game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
          const w = world, evs = [], on = w.onEvent; w.onEvent = e => { evs.push(e); on(e); };
          const n0 = game.events.length, pre = { x: w.ball.position.x, y: w.ball.position.y }, hold0 = w.hold ? w.hold.p.team : null;
          game.step(1, false);
          if (world === w) w.onEvent = on; else { open.length = 0; continue; }
          for (const e of game.events.slice(n0)) if (e.type === 'score') { evs.push(e); tot.pts[e.team] += e.points; }
          const h = Scoring.basket(pre, { x: w.ball.position.x, y: w.ball.position.y }, w.hoops);
          if (h && h.team === 0 && !(w.ball.shot && w.ball.shot.team === 0)) { if (hold0 === 1) tot.carriedOwn++; else if (w.lastBouncer && w.lastBouncer.team === 1) tot.ownGoals++; }
          // resolve open tries
          for (let k = open.length - 1; k >= 0; k--) {
            const o = open[k], m = M[o.k];
            let done = null;
            for (const e of evs) { if (m[2](e)) { done = 'ok'; break; } if (m[3](e)) { done = 'bad'; break; } }
            if (!done && w.time - o.t > m[1]) done = 'none';
            if (done) { if (done !== 'none') S[o.k][done]++; open.splice(k, 1); }
          }
          if (cpu.intent !== lastIntent) {
            lastIntent = cpu.intent;
            for (const k in M) if (M[k][0].test(cpu.intent || '')) { S[k].n++; open.push({ k, t: w.time }); }
          }
        }
        game.hold('KeyW', false); game.hold('KeyS', false);
        for (const k in mine) { mine[k][0] += cpu.mine[k].att; mine[k][1] += cpu.mine[k].made; }
        self.tries += cpu.selfStats.tries; self.caught += cpu.selfStats.caught; self.dunks += cpu.selfStats.dunks;
        tot.clears += cpu.clears || 0; fk.fakes += cpu.fakes.fakes; fk.shots += cpu.fakes.shots || 0; fk.made += cpu.fakes.made || 0;
      }
      return { S, tot, mine, self, fk };
    }, [lv, nSeeds]);
    const row = Object.entries(r.S).map(([k, v]) => `${k} ${v.n}:${v.ok}/${v.bad}`).join('  ');
    console.log(`L${lv} pts ${r.tot.pts[1]}-${r.tot.pts[0]} own ${r.tot.ownGoals} carried ${r.tot.carriedOwn} clears ${r.tot.clears} | mine ${JSON.stringify(r.mine)} self ${JSON.stringify(r.self)} fk ${JSON.stringify(r.fk)}`);
    console.log('   ' + row);
  }
  if (errs.length) console.log('ERRS', errs.slice(0, 3));
  await b.close();
})();
