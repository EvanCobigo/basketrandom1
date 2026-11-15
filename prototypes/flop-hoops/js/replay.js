// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-15
'use strict';
/**
 * Replay: the best moments of a match, shown after it.
 *
 * While a round plays, every physics step is copied into a ring buffer: the pose of every dynamic
 * body (players' parts and the ball) plus the few things the renderer reads (time, crowd, hoop sway,
 * arm form, trail colour). When something worth showing happens (an alley-oop, a dunk, a perfect shot,
 * a fadeaway, a long shot, a block) `mark` tags that moment; a little after it, the stretch around it is
 * copied out as a clip. Clips from one moment merge. At the end `reel` picks the best few (by how
 * special each is, mixing kinds) in the order they happened, and `apply` puts a clip's frame back on
 * its world's bodies so Render.world can draw it. Nothing here steps the physics.
 */
const Replay = (() => {
  const RING = 420, PRE = 170, POST = 85, MAX_CLIPS = 16, MERGE = 150;
  const EXTRA = 17;                                   // time, hype, sparks, flash, 4 hoop numbers, 8 player numbers, trail code
  const MODES = [null, 'white', 'rainbow', 'green', 'blue', 'lob'];
  let rec = null;                                     // the recorder of the round being played
  let clips = [];                                     // finished clips of this match
  let live = null;                                    // the live world's state, kept while a replay borrows its bodies

  const lerp = (a, b, t) => a + (b - a) * t;

  function attach(w) {
    const nb = w.dynamic.length, F = 3 * nb + EXTRA;
    rec = { w, nb, F, buf: new Float32Array(RING * F), n: 0, pending: [], round: clips.length };
  }

  /** Copy this step of `w` into the ring. */
  function record(w, round) {
    if (!rec || rec.w !== w) { flush(); attach(w); }
    rec.round = round;
    const o = (rec.n % RING) * rec.F, b = rec.buf;
    w.dynamic.forEach((body, k) => { b[o + 3 * k] = body.position.x; b[o + 3 * k + 1] = body.position.y; b[o + 3 * k + 2] = body.angle; });
    let e = o + 3 * rec.nb;
    b[e++] = w.time; b[e++] = w.hype || 0; b[e++] = w.sparkT || 0; b[e++] = w.flash ? w.flash.t : 0;
    for (const h of w.hoops) { b[e++] = h.sway || 0; b[e++] = h.wobble || 0; }
    for (const p of w.players.slice(0, 4)) { b[e++] = p.back || 0; b[e++] = p.followT || 0; }
    while (e < o + rec.F - 1) b[e++] = 0;
    b[o + rec.F - 1] = w.trail ? Math.max(1, MODES.indexOf(w.trail.mode)) : 0;
    rec.n++;
    for (const p of rec.pending.slice()) if (rec.n - 1 >= p.end) finish(p);
  }

  /**
   * Tag a moment that just happened. `score` says how special it is (an alley-oop 100 .. a steal 25);
   * moments within MERGE steps of one another share a clip, which keeps the best one's name.
   */
  function mark(w, label, score, team, round) {
    if (!rec || rec.w !== w || rec.n < 10) return;
    const at = rec.n - 1;
    const near = rec.pending.find(p => at - p.at < MERGE && at + POST - p.start < RING - 60);
    if (near) {
      near.end = at + POST;
      if (score > near.score) Object.assign(near, { label, score, team, at });
      return;
    }
    rec.pending.push({ label, score, team, round, at, start: Math.max(0, at - PRE), end: at + POST });
  }

  /** Cut a pending clip out of the ring (with whatever frames exist so far). */
  function finish(p) {
    const r = rec; r.pending.splice(r.pending.indexOf(p), 1);
    const start = Math.max(p.start, r.n - RING), end = Math.min(p.end, r.n - 1), len = end - start + 1;
    if (len < 30) return;
    const frames = new Float32Array(len * r.F);
    for (let i = 0; i < len; i++) frames.set(r.buf.subarray(((start + i) % RING) * r.F, ((start + i) % RING + 1) * r.F), i * r.F);
    clips.push({ w: r.w, nb: r.nb, F: r.F, frames, len, focus: p.at - start, label: p.label, score: p.score, team: p.team, round: p.round, order: clips.length });
    if (clips.length > MAX_CLIPS) clips.splice(clips.indexOf(clips.slice().sort((a, b) => a.score - b.score)[0]), 1);
  }
  function flush() { if (rec) for (const p of rec.pending.slice()) finish(p); }

  /** Start a fresh match: forget every clip and the recorder. */
  function reset() { rec = null; clips = []; live = null; }

  /** The best `n` clips of the match, mixing kinds, in the order they happened. */
  function reel(n) {
    flush();
    const left = clips.slice().sort((a, b) => b.score - a.score), pick = [], seen = {};
    while (pick.length < n && left.length) {
      left.forEach(c => { c._adj = c.score - 18 * (seen[c.label] || 0); });
      left.sort((a, b) => b._adj - a._adj);
      const c = left.shift(); pick.push(c); seen[c.label] = (seen[c.label] || 0) + 1;
    }
    return pick.sort((a, b) => a.order - b.order);
  }
  const count = () => { flush(); return clips.length; };

  /** Save the live world's bodies, so a replay can borrow them and give them back. */
  function borrow(w) {
    live = { w, bodies: w.dynamic.map(b => ({ b, x: b.position.x, y: b.position.y, px: b.positionPrev.x, py: b.positionPrev.y, a: b.angle, pa: b.anglePrev })),
      extras: { hype: w.hype, sparkT: w.sparkT, time: w.time, flash: w.flash && w.flash.t, hoops: w.hoops.map(h => [h.sway, h.wobble]), players: w.players.map(p => [p.back, p.followT]) } };
  }
  function giveBack() {
    if (!live) return;
    const w = live.w;
    for (const s of live.bodies) { s.b.position.x = s.x; s.b.position.y = s.y; s.b.positionPrev.x = s.px; s.b.positionPrev.y = s.py; s.b.angle = s.a; s.b.anglePrev = s.pa; }
    const e = live.extras; w.hype = e.hype; w.sparkT = e.sparkT; w.time = e.time; if (w.flash) w.flash.t = e.flash;
    w.hoops.forEach((h, i) => { h.sway = e.hoops[i][0]; h.wobble = e.hoops[i][1]; });
    w.players.forEach((p, i) => { p.back = e.players[i][0]; p.followT = e.players[i][1]; });
    live = null;
  }

  /**
   * Put frame `f` (fractional: it is blended with the next) of a clip on its world's bodies and return a view of the
   * world to draw: the same world, with no held ball marker, the trail of that moment and the recorded clock.
   */
  function apply(clip, f, trailLength) {
    const w = clip.w, F = clip.F, nb = clip.nb;
    f = Math.max(0, Math.min(clip.len - 1, f));
    const i0 = Math.floor(f), i1 = Math.min(clip.len - 1, i0 + 1), k = f - i0, A = clip.frames, a = i0 * F, b = i1 * F;
    w.dynamic.forEach((body, j) => {
      body.position.x = lerp(A[a + 3 * j], A[b + 3 * j], k); body.position.y = lerp(A[a + 3 * j + 1], A[b + 3 * j + 1], k);
      body.angle = lerp(A[a + 3 * j + 2], A[b + 3 * j + 2], k); body._px = undefined;
    });
    let e = 3 * nb;
    w.time = A[a + e]; w.hype = A[a + e + 1]; w.sparkT = A[a + e + 2]; if (w.flash) w.flash.t = A[a + e + 3]; e += 4;
    for (const h of w.hoops) { h.sway = A[a + e]; h.wobble = A[a + e + 1]; e += 2; }
    for (const p of w.players.slice(0, 4)) { p.back = A[a + e]; p.followT = A[a + e + 1]; e += 2; }
    const view = Object.create(w);
    view.hold = null;
    const code = A[a + F - 1];
    if (code > 0) {   // a shot in flight: its trail is the ball's last positions since the shot began
      const pts = [];
      for (let t = i0; t >= 0 && pts.length < trailLength && A[t * F + F - 1] > 0; t--) pts.unshift({ x: A[t * F], y: A[t * F + 1] });
      view.trail = { pts, mode: MODES[code], t: 0, shot: null };
    } else view.trail = null;
    return view;
  }

  return { record, mark, reset, reel, count, borrow, giveBack, apply };
})();
