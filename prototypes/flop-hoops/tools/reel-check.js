// PROTOTYPE - NOT FOR PRODUCTION
// Reel check (iteration 46): plays CPU-vs-CPU ('sim') matches and prints, per match, the highlight reel's picks (Replay.reel,
// label score family) and how often each replay mark was made, plus the engine's pump-fake and interception events. Runs on
// any copy of the game (an older one has no families, pump fakes or interceptions: those columns stay empty), so a before
// and an after can be compared on the same seeds. The final scores show whether play itself changed between the two.
// Usage: node tools/reel-check.js <game dir> [seeds, default 1,2,3,4,5,6] [seconds per match, default 90] [levels A,B, default 5,5] [clips, default 5]
const { chromium } = require('playwright');
const dir = process.argv[2];
const seeds = (process.argv[3] || '1,2,3,4,5,6').split(',').map(Number), secs = Number(process.argv[4] || 90);
const levels = (process.argv[5] || '5,5').split(',').map(Number), clips = Number(process.argv[6] || 5);
const EVENTS = ['pumpfake', 'fakebit', 'fakescore', 'intercept', 'block', 'steal', 'dunk', 'hot', 'rimblast', 'score'];
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + dir + '/index.html?manual=1');
  const total = { marks: {}, picks: {}, events: {} }, add = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  for (const sd of seeds) {
    const r = await pg.evaluate(([sd, secs, levels, clips, EVENTS]) => {
      const marks = {}, orig = Replay.mark;
      Replay.mark = function (w, label, score) { if (w === world) { const m = marks[label] = marks[label] || { n: 0, best: 0 }; m.n++; m.best = Math.max(m.best, score); } return orig.apply(this, arguments); };
      try {
        CONFIG.win_score.value = 99; CONFIG.seed = sd; toMenu(); game.step(2, false); newMatch('sim', levels);
        const e0 = game.events.length;
        game.step(Math.round(secs * 60), false);
        const ev = {}; for (const e of game.events.slice(e0)) if (EVENTS.includes(e.type)) ev[e.type + (e.type === 'intercept' ? ':' + e.what : '')] = (ev[e.type + (e.type === 'intercept' ? ':' + e.what : '')] || 0) + 1;
        const opt = CONFIG.replay_label_repeat ? { label: tune.replay_label_repeat, kind: tune.replay_kind_repeat } : undefined;
        const reel = Replay.reel(clips, opt).map(c => ({ label: c.label, score: c.score, kind: c.kind || '-', round: c.round, len: c.len, also: (c.also || []).length }));
        return { score: game.state.score.slice(), rounds: game.state.round, clips: Replay.count(), marks, ev, reel };
      } finally { Replay.mark = orig; }
    }, [sd, secs, levels, clips, EVENTS]);
    console.log(`seed ${sd}  score ${r.score.join('-')}  rounds ${r.rounds}  clips ${r.clips}`);
    console.log('  reel: ' + r.reel.map(c => `${c.label} ${c.score}${c.kind !== '-' ? ' [' + c.kind + ']' : ''}${c.also ? ' (+fake slow-mo)' : ''}`).join(' | '));
    console.log('  marks: ' + Object.entries(r.marks).sort((a, b) => b[1].n - a[1].n).map(([k, m]) => `${k} x${m.n}`).join(', '));
    console.log('  events: ' + Object.entries(r.ev).map(([k, n]) => `${k} ${n}`).join(', '));
    for (const [k, m] of Object.entries(r.marks)) add(total.marks, k, m.n);
    for (const c of r.reel) add(total.picks, c.label);
    for (const [k, n] of Object.entries(r.ev)) add(total.events, k, n);
  }
  const fmt = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
  console.log(`TOTAL over ${seeds.length} matches of ${secs} s (levels ${levels.join(' v ')})`);
  console.log('  marks made: ' + fmt(total.marks));
  console.log('  reel picks: ' + fmt(total.picks));
  console.log('  events: ' + fmt(total.events));
  console.log(`  page errors: ${errs.length}` + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : ''));
  await b.close();
})();
