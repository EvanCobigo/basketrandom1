// PROTOTYPE - NOT FOR PRODUCTION
// Dunk probe (iteration 46): how each dunk style fares.
//  scripted: a carrier is put at the rim (40-70 px out, both teams' directions, nobody else near), takes the ball, and taps jump
//    once the dunk prompt is on, with the style forced (w.forceDunkStyle); per style: starts, slams, baskets, misses by reason.
//  match: the game's CPU (team 1) at each level plays the frozen reference (tools/ai-ref.js, team 0) as ai-bench does; per style
//    (both teams together): dunk starts, slams (`dunk` events), misses (`dunkmiss`, by reason) and swats (`block` with dunk: true).
// Usage: node tools/ai-dunks.js <game dir> [--mode scripted|match|both] [--styles tomahawk,windmill,elbow,hammer] [--tries 30]
//                               [--levels 4,5,6] [--seeds 1,...,20] [--secs 90] [--pre '<js run in the page first>']
const { chromium } = require('playwright');
const path = require('path');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const mode = arg('mode', 'both'), tries = Number(arg('tries', 30)), secs = Number(arg('secs', 90));
const levels = arg('levels', '4,5,6').split(',').map(Number);
const seeds = arg('seeds', Array.from({ length: 20 }, (_, i) => i + 1).join(',')).split(',').map(Number);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + dir + '/index.html?manual=1');
  await pg.addScriptTag({ path: path.join(dir, 'tools', 'ai-ref.js') });
  await pg.evaluate(() => { try { localStorage.clear(); } catch (e) { /* no storage */ } });
  if (arg('pre', null)) await pg.evaluate(arg('pre'));   // --pre '<js>': run in the page first (e.g. "CONFIG.dunk_dip.value = 0.3")
  // (the styles this build has: read from the game's own names, so the same probe runs on an older build)
  const styles = arg('styles', null) ? arg('styles').split(',') : await pg.evaluate(() => Object.keys(DUNK_NAMES));
  const blank = () => ({ starts: 0, slams: 0, scored: 0, misses: 0, swats: 0, why: {} });
  if (mode === 'scripted' || mode === 'both') {
    const r = await pg.evaluate(([styles, tries]) => {
      const out = {};
      for (const style of styles) {
        const o = out[style] = { starts: 0, slams: 0, scored: 0, misses: 0, swats: 0, noPrompt: 0, why: {}, hang: 0, air: 0, airMade: 0, close: [] };
        for (let i = 0; i < tries; i++) {
          CONFIG.win_score.value = 99; CONFIG.seed = 500 + i * 37; toMenu(); game.step(2, false); newMatch('2p');
          for (let k = 0; k < 200 && game.scene !== 'play'; k++) game.step(1, false);
          const w = world, team = i % 2, p = w.players.find(q => q.team === team && q.idx === 0), hoop = w.hoops.find(h => h.team === team);
          const gap = 40 + (i * 11) % 31;                                     // 40-70 px out, on the court side
          const move = (q, x) => { const dx = x - q.torso.position.x; for (const part of q.parts) { Matter.Body.setPosition(part, { x: part.position.x + dx, y: part.position.y }); Matter.Body.setVelocity(part, { x: 0, y: 0 }); Matter.Body.setAngularVelocity(part, 0); } };
          move(p, hoop.cx - p.dir * gap);
          for (const q of w.players) if (q !== p) move(q, w.cx - p.dir * (q.team === team ? 120 : 260));   // everybody else far upcourt
          w.forceDunkStyle = style;
          game.step(20, false);                                               // settle on the new spot
          const hp = Physics.handPos(p);
          Matter.Body.setPosition(w.ball, hp); Matter.Body.setVelocity(w.ball, { x: 0, y: 0 }); w.ball.shot = null;
          let k = 0; while (k++ < 30 && !(w.hold && w.hold.p === p)) game.step(1, false);
          if (!(w.hold && w.hold.p === p)) { o.noPrompt++; continue; }
          const wait = 4 + (i * 7) % 25;                                       // pressed some steps into the prompt: the swing is anywhere
          let seen = 0; k = 0;
          while (k++ < 90 && w.hold && !w.dunk) { if (w.hold.dunkReady && ++seen >= wait) break; game.step(1, false); }
          if (!(w.hold && w.hold.dunkReady)) { o.noPrompt++; continue; }
          const n0 = game.events.length;
          game.hold(team ? 'ArrowUp' : 'KeyW', true); game.step(2, false); game.hold(team ? 'ArrowUp' : 'KeyW', false);
          const ground = !!(w.dunk && w.dunk.grounded);   // (from the floor, or from the air: a hop off the new spot)
          let scored = false;
          for (let s = 0; s < 150 && world === w; s++) { game.step(1, false); if (game.scene === 'scored') { scored = true; break; } }
          const evs = game.events.slice(n0);
          const st = evs.find(e => e.type === 'dunkstart' && e.team === team);
          if (!st) { o.noPrompt++; continue; }
          o.starts++; if (!ground) o.air++;
          const slam = evs.find(e => e.type === 'dunk' && e.team === team), miss = evs.find(e => e.type === 'dunkmiss' && e.team === team);
          if (slam) { o.slams++; if (slam.hang) o.hang++; }
          if (scored && slam) { o.scored++; if (!ground) o.airMade++; }
          if (miss) { o.misses++; o.why[miss.reason] = (o.why[miss.reason] || 0) + 1; if (miss.best) o.close.push(`${miss.grounded ? 'g' : 'a'}${miss.best.dx},${miss.best.dy}`); }
          if (evs.some(e => e.type === 'block' && e.dunk)) o.swats++;
        }
      }
      return out;
    }, [styles, tries]);
    console.log('scripted: ' + tries + ' tries per style, 40-70 px out, both directions, nobody near');
    console.log(['style', 'starts', 'slams', 'scored', 'make%', 'misses', 'reasons', 'hang', 'noPrompt', 'air (made)', 'closest miss (g ground / a air: ball dx,dy from the slot)'].join('\t'));
    for (const s of styles) { const o = r[s]; console.log([s, o.starts, o.slams, o.scored, o.starts ? Math.round(100 * o.scored / o.starts) : '-', o.misses, JSON.stringify(o.why), o.hang, o.noPrompt, `${o.air} (${o.airMade})`, o.close.join(' ')].join('\t')); }
  }
  if (mode === 'match' || mode === 'both') {
    const tot = {}, byLv = {};
    for (const lv of levels) {
      const r = await pg.evaluate(([lv, seeds, secs, styles]) => {
        const out = {}; for (const s of styles) out[s] = { starts: 0, slams: 0, scored: 0, misses: 0, swats: 0, why: {} };
        for (const sd of seeds) {
          CONFIG.win_score.value = 99; CONFIG.game_speed.value = 1; Settings.set('ai_level', lv); CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('cpu'); game.step(100, false);
          const oT = new Proxy(tune, { get: (t, k) => k === 'ai_level' ? Math.min(5, lv) : k === 'ai_react' && !(k in t) ? 0.18 : k === 'ai_error' && !(k in t) ? 0.35 : t[k] });
          const atk = AIRef.create(0, rng, oT, 0);
          let cur = null;   // the dunk in the air: its style, so a swat or a basket is put down to it
          for (let i = 0; i < 60 * secs; i++) {
            AIRef.update(atk, world, oT, 1 / 60, { score: game.state.score.slice() });
            game.hold('KeyW', atk.jump); game.hold('KeyS', atk.bounce);
            const n0 = game.events.length, before = game.scene;
            game.step(1, false);
            for (const e of game.events.slice(n0)) {
              if (e.type === 'dunkstart' && out[e.style]) { out[e.style].starts++; cur = e.style; }
              if (e.type === 'dunk' && out[e.style]) { out[e.style].slams++; cur = e.style; }
              if (e.type === 'dunkmiss' && out[e.style]) { const o = out[e.style]; o.misses++; o.why[e.reason] = (o.why[e.reason] || 0) + 1; cur = null; }
              if (e.type === 'block' && e.dunk && cur) { out[cur].swats++; cur = null; }
              if (e.type === 'score' && cur && e.how === 'dunk') { out[cur].scored++; cur = null; }
            }
            if (before === 'play' && game.scene !== 'play' && game.scene !== 'scored') cur = null;
          }
          game.hold('KeyW', false); game.hold('KeyS', false);
        }
        return out;
      }, [lv, seeds, secs, styles]);
      byLv[lv] = r;
      for (const s of styles) { const t = tot[s] || (tot[s] = blank()); for (const k of ['starts', 'slams', 'scored', 'misses', 'swats']) t[k] += r[s][k]; for (const [why, n] of Object.entries(r[s].why)) t.why[why] = (t.why[why] || 0) + n; }
    }
    console.log(`match: CPU vs the frozen reference, levels ${levels.join(',')}, ${seeds.length} seeds x ${secs} s each, both teams' dunks`);
    console.log(['level', 'style', 'starts', 'slams', 'scored', 'make%', 'misses', 'swats', 'reasons'].join('\t'));
    const row = (lv, s, o) => console.log([lv, s, o.starts, o.slams, o.scored, o.starts ? Math.round(100 * o.scored / o.starts) : '-', o.misses, o.swats, JSON.stringify(o.why)].join('\t'));
    for (const lv of levels) for (const s of styles) row(lv, s, byLv[lv][s]);
    for (const s of styles) row('all', s, tot[s]);
  }
  if (errs.length) { console.log('PAGE ERRORS', errs.slice(0, 5)); process.exitCode = 1; }
  await b.close();
})();
