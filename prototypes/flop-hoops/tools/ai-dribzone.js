// PROTOTYPE - NOT FOR PRODUCTION
// Dribble zone and pump probe (iteration 46): the CPU (team 1) against the frozen reference brain (tools/ai-ref.js).
// Usage: node tools/ai-dribzone.js <game dir> <levels, e.g. 2,3,4> <seeds, e.g. 1,2,3> [secs = 90] ['{"config_key": value}']
// Zone: every CPU dribble, its feet (the average x of the two legs) and the ball each step from the tap to the catch, against the
//   middle third of [world.L, world.R] (worked out here, so the probe runs on code that has no w.dribZone too):
//   startOut = taps made with feet or ball outside it, feetOut / ballOut = steps outside it (feetOutCatch: of those, at the catch),
//   handOutCatch = catches where the hand that took the ball back reached past the edge (the ball snaps to it: the hand, not the dribble),
//   over = the furthest feet or ball outside (px), overCatch = the furthest feet or hand at a catch,
//   slide = how far the feet go past the edge after the catch while the dribble's slide lasts (on the floor, not cocking a shot),
//   zoneTaps = taps the physics refused for the zone (queued: the re-dribble at a catch).
// Pumps: every CPU dribble out of a cocked shot, a fake (cpu.aim.fake) or a pump-out (line gone long, no lob). air = made with the
//   carrier off the floor (sinceGround > 0.05, or no foot within 10 px of the floor); lost = the opponent held the ball within 1 s.
// Also: the longest CPU hold (s) and page errors. One JSON line per level.
const { chromium } = require('playwright');
const dir = process.argv[2], levels = process.argv[3].split(',').map(Number), seeds = process.argv[4].split(',').map(Number), secs = +(process.argv[5] || 90), cfg = JSON.parse(process.argv[6] || '{}');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + dir + '/index.html?manual=1');
  await pg.addScriptTag({ path: dir + '/tools/ai-ref.js' });
  for (const lv of levels) {
    const r = await pg.evaluate(([lv, seeds, secs, cfg]) => {
      const o = { dribbles: 0, startOut: 0, feetOut: 0, ballOut: 0, feetOutCatch: 0, handOutCatch: 0, steps: 0, over: 0, overCatch: 0, slide: 0, zoneTaps: 0, zoneTapsQueued: 0, zoneMismatch: 0, ends: {},
        fakes: 0, fakesAir: 0, fakesLost: 0, pumpOuts: 0, pumpOutsAir: 0, pumpOutsLost: 0, holdMax: 0, cpuPts: 0, refPts: 0 };
      const tally = (m, k) => { m[k] = (m[k] || 0) + 1; };
      const feetX = p => (p.legs[0].position.x + p.legs[1].position.x) / 2;
      const footGap = (w, p) => Math.min(...p.legs.map(l => w.floorY - (l.position.y + Math.abs(Math.cos(l.angle)) * p.dims.legL / 2)));
      for (const sd of seeds) {
        CONFIG.win_score.value = 99; CONFIG.game_speed.value = 1; for (const k in cfg) CONFIG[k].value = cfg[k]; Settings.set('ai_level', lv); CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
        const oT = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? Math.min(5, lv) : k === 'ai_react' && !(k in t) ? 0.18 : k === 'ai_error' && !(k in t) ? 0.35 : t[k] });
        const atk = AIRef.create(0, rng, oT, 0);
        let d = null, slideP = null, curH = null, hT = 0;
        const pumps = [];
        for (let i = 0; i < 60 * secs; i++) {
          AIRef.update(atk, world, oT, 1 / 60, { score: game.state.score.slice() });
          game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
          const w = world, third = (w.R - w.L) / 3, lo = w.L + third, hi = w.R - third;
          const out = x => x < lo ? lo - x : x > hi ? x - hi : 0;
          if (w.dribZone && w.dribZone[1] && (Math.abs(w.dribZone[1].lo - lo) > 0.01 || Math.abs(w.dribZone[1].hi - hi) > 0.01)) o.zoneMismatch++;
          const h0 = w.hold, cocked = !!(h0 && h0.p.team === 1 && h0.cocking), fakeAim = !!(cpu.aim && cpu.aim.fake);
          const evs = [], on = w.onEvent; w.onEvent = e => {
            // the catch (a queued re-dribble catches and taps again inside one step, so it is read here): feet, and the ball now in the hand
            if (d && w.hold && (e.type === 'dribble' || e.type === 'grab' || e.type === 'steal')) {
              const f = out(feetX(d.p)), bo = out(w.ball.position.x), k = w.hold.p === d.p ? 'own' : w.hold.p.team === 1 ? 'mate' : 'foe';
              o.steps++; if (f > 0) { o.feetOut++; o.feetOutCatch++; } if (bo > 0) o.handOutCatch++; o.over = Math.max(o.over, f); o.overCatch = Math.max(o.overCatch, f, bo);
              tally(o.ends, k); if (k === 'own') slideP = d.p; d = null;
            }
            if (e.type === 'dribbleout' && e.team === 1) {   // (the ball has just left the hand: where it is now is where the tap was made)
              const p = w.lastBouncer, f = out(feetX(p)), bo = out(w.ball.position.x);
              o.dribbles++; if (f > 0 || bo > 0) o.startOut++;
              o.over = Math.max(o.over, f, bo);
              d = { p, t: 0 };
              if (cocked) {   // a dribble out of a cocked shot: a pump
                const air = p.sinceGround > 0.05 || footGap(w, p) > 10;
                pumps.push({ fake: fakeAim, air, t: 0, lost: false });
                if (fakeAim) { o.fakes++; if (air) o.fakesAir++; } else { o.pumpOuts++; if (air) o.pumpOutsAir++; }
              }
            }
            if (e.type === 'zonetap' && e.team === 1) { o.zoneTaps++; if (e.queued) o.zoneTapsQueued++; }
            evs.push(e); on(e);
          };
          game.step(1, false);
          if (world === w) w.onEvent = on; else { d = null; slideP = null; pumps.length = 0; continue; }
          // the dribble in the air, tap to catch: feet and ball each step (the catch itself is read in the wrapper above)
          if (d) {
            d.t++;
            if (w.hold) { tally(o.ends, 'other'); d = null; }   // (taken without a catch event: should not happen)
            else if (!w.dribbleBall) { tally(o.ends, 'loose'); d = null; }   // the dribble window ran out: a loose ball, no longer a dribble
            else {
              const f = out(feetX(d.p)), bo = out(w.ball.position.x);
              o.steps++; if (f > 0) o.feetOut++; if (bo > 0) o.ballOut++; o.over = Math.max(o.over, f, bo);
              if (d.t > 150) { tally(o.ends, 'timeout'); d = null; }
            }
          }
          if (slideP) {   // after its own catch: the dribble's slide goes on while dribbleT lasts
            if (w.hold && w.hold.p === slideP && slideP.dribbleT > 0) { if (!w.hold.cocking && slideP.sinceGround < 0.1) o.slide = Math.max(o.slide, out(feetX(slideP))); }   // (on the floor, not a shot's hop)
            else slideP = null;
          }
          for (const pm of pumps) if (!pm.done) {
            pm.t++;
            if (w.hold && w.hold.p.team === 0) { pm.lost = true; pm.done = true; if (pm.fake) o.fakesLost++; else o.pumpOutsLost++; }
            else if (pm.t >= 60 || game.scene !== 'play') pm.done = true;
          }
          const h = w.hold;
          if (game.scene === 'play' && h && h.p.team === 1) { if (curH !== h) { curH = h; hT = 0; } hT += 1 / 60; o.holdMax = Math.max(o.holdMax, hT); if (hT > 2.45 && !curH.logged) { curH.logged = true; (o.longHolds = o.longHolds || []).push({ sd, i, intent: cpu.intent, cock: curH.cocking, bouncing: curH.bouncing, dl: cpu.deadline && cpu.deadline.kind, sg: +curH.p.sinceGround.toFixed(2) }); } } else curH = null;
        }
        game.hold('KeyW', false); game.hold('KeyS', false);
        o.refPts += game.state.score[0]; o.cpuPts += game.state.score[1];
      }
      o.over = +o.over.toFixed(1); o.overCatch = +o.overCatch.toFixed(1); o.slide = +o.slide.toFixed(1); o.holdMax = +o.holdMax.toFixed(2);
      return o;
    }, [lv, seeds, secs, cfg]);
    console.log(JSON.stringify({ lv, ...r, errs: errs.length }));
  }
  if (errs.length) console.log('PAGE ERRORS', errs.slice(0, 3));
  await b.close();
})();
