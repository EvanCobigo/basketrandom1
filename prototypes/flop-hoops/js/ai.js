// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-15
'use strict';
/**
 * AI: a CPU opponent that plays one team with exactly what a person has: one jump key and one
 * bounce key, pressed and released over time. It reads the world each step and returns the two
 * keys' states, and a line saying what it is trying to do (`c.intent`, drawn under the scoreboard).
 *
 * The brain is split in three, each in its own function:
 *   offense()  it has the ball: it scores every option (dunk, shot, long shot, fadeaway, dribble, pass,
 *              alley-oop, wait) as expected points minus risk, plus its personality's taste, plus a
 *              little noise (more at low levels), and takes the best, sticking to it for a moment.
 *   defense()  they have the ball: it predicts what they are about to do (release a shot, enter the dunk
 *              zone, pass) up to LEVELS[].look steps ahead, and answers before they act; every answer is
 *              rolled once per incident at DEFENSE x its weight, then waits out a reaction delay.
 *   chase()    positioning and loose balls: it stands between the carrier and its rim, works out where a
 *              loose ball will be (Physics.ballPath), and times steals against a dribble in the air.
 * What it learns: `c.profile` remembers what the opponent does this match (shots, long shots, dunks,
 * passes, how far out they shoot, which way they drive, how they score when pressed vs left open) and
 * defence leans on it gradually: the more it has seen, the more it moves. `c.mine` does the same for
 * its own shots. Press I in a match to see what it thinks (c.dbg).
 *
 * How it aims: while it holds a cocked shot it asks the physics, every step, where the ball
 * would cross the rim if it let go right now (Physics.previewShot, the engine's own flight maths
 * and the real aim help), and lets go when that reaches the spot it picked. The top level lets go
 * only on a line the preview calls perfect, and pumps out of a shot that never lines up.
 */
const AI = (() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  /**
   * The five difficulty levels. skill: 0..1, how well it reacts and aims. defense: doubles per level.
   * look: how many steps ahead it can read the opponent (0: none). learn: how fast it adapts to them.
   * slip: the chance a play goes wrong on its own (a misread, a rushed shot). noise: how much its
   * choices wobble. Nobody is infallible: even a Legend slips, just rarely and mildly.
   */
  const LEVELS = [
    { name: 'ROOKIE', skill: 0.15, defense: 1 / 16, look: 0, learn: 0, slip: 0.5, noise: 0.5, does: 'CHASES THE BALL, MISSES A LOT, REACTS SLOWLY. DRIBBLES A LITTLE.' },
    { name: 'AMATEUR', skill: 0.35, defense: 1 / 8, look: 4, learn: 0, slip: 0.3, noise: 0.35, does: 'KNOWS BASIC SHOOTING AND BLOCKING, AND DRIBBLES UPCOURT.' },
    { name: 'PRO', skill: 0.55, defense: 1 / 4, look: 10, learn: 0.25, slip: 0.2, noise: 0.22, does: 'DRIBBLES, PASSES AND DUNKS, SPOTS OPEN CHANCES, HAS A PERSONALITY.' },
    { name: 'ALL-STAR', skill: 0.75, defense: 1 / 2, look: 22, learn: 0.7, slip: 0.12, noise: 0.12, does: 'PREDICTS FLIGHTS, TIMES STEALS, ADAPTS TO HOW YOU PLAY.' },
    { name: 'LEGEND', skill: 0.95, defense: 1, look: 40, learn: 1, slip: 0.06, noise: 0.06, does: 'PERFECT LINES, FAST BREAKS, READS YOUR PLAYS. STILL MAKES MISTAKES.' },
  ];
  /**
   * Personalities (level 3+). Each weight is 1 for an even taste: attack (drives, dunks), range (long
   * shots), pass (passing, alley-oops), flash (fadeaways and showy plays), guard (blocks and steals),
   * scav (rebounds, loose balls, fast breaks), read (how much it studies the opponent), risk (0 careful
   * .. 1 bold), wild (how erratic its choices are). They tilt the scores; they never dictate a play.
   */
  const STYLES = [
    { name: 'AGGRESSIVE', attack: 1.6, range: 0.7, pass: 0.7, flash: 1.0, guard: 1.0, scav: 1.0, read: 0.8, risk: 0.65, wild: 1.0 },
    { name: 'SNIPER', attack: 0.6, range: 1.9, pass: 0.9, flash: 0.8, guard: 0.9, scav: 0.9, read: 1.0, risk: 0.5, wild: 0.8 },
    { name: 'PLAYMAKER', attack: 1.0, range: 0.7, pass: 1.9, flash: 0.7, guard: 0.9, scav: 1.0, read: 1.1, risk: 0.4, wild: 0.8 },
    { name: 'SHOWBOAT', attack: 1.2, range: 1.3, pass: 0.6, flash: 1.9, guard: 0.7, scav: 0.8, read: 0.6, risk: 0.7, wild: 1.2 },
    { name: 'DEFENSIVE', attack: 0.8, range: 0.8, pass: 0.9, flash: 0.5, guard: 1.9, scav: 1.2, read: 1.2, risk: 0.3, wild: 0.7 },
    { name: 'RECKLESS', attack: 1.3, range: 1.2, pass: 0.8, flash: 1.3, guard: 1.0, scav: 1.0, read: 0.4, risk: 1.0, wild: 2.4 },
    { name: 'TACTICIAN', attack: 1.0, range: 1.0, pass: 1.1, flash: 0.8, guard: 1.1, scav: 1.0, read: 2.0, risk: 0.5, wild: 0.6 },
    { name: 'OPPORTUNIST', attack: 1.1, range: 0.9, pass: 1.0, flash: 0.9, guard: 1.2, scav: 1.9, read: 1.0, risk: 0.55, wild: 1.0 },
  ];
  const BALANCED = { name: '', attack: 1, range: 1, pass: 1, flash: 1, guard: 1, scav: 1, read: 1, risk: 0.5, wild: 1 };
  const levelOf = T => clamp(Math.round(T.ai_level), 1, LEVELS.length);
  const conf = n => n / (n + 4);   // how much to trust a tendency seen n times
  /**
   * The weights the AI's own judgement is tuned by (what self-play adjusts: tools/ai-selfplay.js). 1 is
   * neutral except where noted. dribble: the standing taste for dribbling (0.48). shot, pass: scale the
   * value of shooting and passing. risk: scales the penalty for steal and block risk. press: scales how
   * often defence swings at pressure. stand: how far from the carrier toward the rim it stands (0.28).
   * fake: scales how often it pumps against a defender who jumps early. lob: scales how much it likes
   * the alley-oop lob when a teammate waits at the rim. Each controller has its own
   * copy (c.w), so two controllers can play each other with different weights.
   */
  const DEFAULT_WEIGHTS = { dribble: 0.48, shot: 1, pass: 1, risk: 1, press: 1, stand: 0.28, fake: 1, lob: 1 };
  const maxDribsOf = level => 2 + Math.round(level * 1.4);

  /**
   * Make a controller for `team`.
   * @param {number} team the team it plays (0 or 1)
   * @param {() => number} rng seeded random, so a replay of the same match is the same
   * @param {object} T tuning values: the level decides whether it has a personality
   * @param {number} [matchNo] which match of the session this is: successive matches cycle through the personalities
   * @param {object} [weights] overrides of DEFAULT_WEIGHTS
   */
  function create(team, rng, T, matchNo = 0, weights = null) {
    const style = T && levelOf(T) >= 3 ? STYLES[(Math.floor(rng() * STYLES.length) + matchNo) % STYLES.length] : BALANCED;
    return {
      team, rng, style, w: Object.assign({}, DEFAULT_WEIGHTS, weights), jump: false, bounce: false, wait: 0, holdT: 0, bholdT: 0, dribs: 0, aim: null, rolls: {},
      tick: 0, intent: '', intentAt: -99, intentSeen: -99, plan: null, press: 0, err: 0, looseOn: false, qCache: null,
      // tactical memory: what the opponent does, how they fare pressed or left open, and how my own plays fare
      profile: { shots: 0, longShots: 0, dunks: 0, passes: 0, dribbles: 0, shotDist: 0, drive: 0, side: 0, pressed: { att: 0, made: 0 }, open: { att: 0, made: 0 } },
      mine: { shot: { att: 0, made: 0 }, long: { att: 0, made: 0 }, fade: { att: 0, made: 0 }, dunk: { att: 0, made: 0 } },
      // how the opponent answers a cocked shot (how often a defender jumps at it early) and how its own fakes fare
      foeReact: { cocks: 0, jumps: 0 }, fakes: { fakes: 0, shots: 0, made: 0 }, afterFake: -999,
      seen: {}, pending: null, myPending: null, myDunk: null, dbg: {}, threat: null,
    };
  }

  /** The player of its team nearest x. */
  function nearest(w, team, x) {
    let best = null, bd = 1e9;
    for (const p of w.players) if (p.team === team) {
      const d = Math.abs(p.torso.position.x - x);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /**
   * The bounce-key hold for a pass over `d` px. A longer hold throws it harder; this is the
   * distance estimate that tested best (a flown-out model of the bounces did worse: the ball
   * keeps bouncing and rolling past the first bounce in ways it does not capture).
   */
  function passHold(T, d) { return clamp(0.3 + d / 600, T.dribble_threshold + 0.05, 1) * T.bounce_charge_time; }

  /** What a shot from here could be: 2 a perfect line exists, 1 it can go in, 0 neither (a coarse sweep of the preview). */
  function quality(c, w, T, p) {
    if (c.qCache && c.qCache.tick > c.tick - 3) return c.qCache.q;
    let q = 0;
    for (let ch = 0.3; ch <= 1.0001; ch += 0.03) {
      const v = Physics.previewShot(w, T, p, ch);
      if (v.perfect) { q = 2; break; }
      if (v.onTarget && q < 1) q = 1;
    }
    c.qCache = { tick: c.tick, q };
    return q;
  }

  /**
   * x kept on the court side of both rims. Behind a basket nothing can be done (no dunk, no shot, nobody to pass to),
   * so the AI never walks there on purpose: its targets stop `margin` px short of either rim.
   */
  function courtSide(w, x, margin = 40) {
    let lo = -1e9, hi = 1e9;
    for (const h of w.hoops) { if (h.side < 0) lo = h.cx + margin; else hi = h.cx - margin; }
    return clamp(x, lo, hi);
  }

  /** Say what it is doing, but not flickering: a line stays on for about half a second. */
  function say(c, text, force) {
    c.intentSeen = c.tick;                           // (still saying it: the icon over its head stays up)
    if (c.intent !== text && (force || c.tick - c.intentAt > 30)) { c.intent = text; c.intentAt = c.tick; }
  }

  /**
   * One defensive roll per incident. `cond` says the incident is on (a shot is being cocked, a dunk is
   * under way); the first step it is true the dice are thrown with chance `p`, and the answer stands
   * until the incident ends. A yes also carries a reaction delay: the move waits until `at`.
   * @returns {boolean} true once it has been decided yes and the reaction time has passed
   */
  function defend(c, w, kind, cond, p, lag) {
    const r = c.rolls[kind] || (c.rolls[kind] = { on: false, go: false, at: 0 });
    if (!cond) { r.on = false; return false; }
    if (!r.on) { r.on = true; r.go = c.rng() < clamp(p, 0, 1); r.at = w.time + lag * c.rng(); }
    return r.go && w.time >= r.at;
  }

  // ---------------------------------------------------------------- the frame: what every part reads

  function frame(c, w, T, dt, info) {
    const level = levelOf(T), L = LEVELS[level - 1], st = c.style;
    const win = T.win_score, mine = info ? info.score[c.team] : 0, theirs = info ? info.score[1 - c.team] : 0;
    // the state of the match: how far from the end each side is decides how much risk and defence it wants
    const sit = { behind: theirs - mine, toWin: win - mine, foeToWin: win - theirs };
    sit.late = sit.toWin <= 3 || sit.foeToWin <= 3;
    const protect = sit.behind <= -3 && sit.late;       // ahead near the end: play it safe
    const chase = sit.behind >= 3 && sit.late;          // behind near the end: gamble
    return {
      c, w, T, dt, info, level, L, st, sit, W: c.w, skill: L.skill, hold: w.hold, ball: w.ball, prof: c.profile,
      def: clamp(L.defense * (sit.foeToWin <= 2 ? 1.25 : 1), 0, 1),
      lag: 0.32 * (1 - L.defense),
      react: T.ai_react * (1.6 - L.skill),
      tap: dt * 2,
      risk: clamp(st.risk + (chase ? 0.2 : 0) - (protect ? 0.2 : 0), 0, 1),
      atk: w.hoops.find(h => h.team === c.team),        // the hoop it shoots at
      dfn: w.hoops.find(h => h.team !== c.team),        // the hoop it guards
      foeTeam: 1 - c.team,
    };
  }

  // ---------------------------------------------------------------- memory

  /** Watch what happens and keep the books: the opponent's tendencies and the fate of its own plays. */
  function observe(c, X) {
    const { w, info, prof, dfn } = X, s = c.seen, ball = w.ball, sh = ball.shot, score = info ? info.score : [0, 0];
    // a foe shot that has finished: did it go in, and was it pressed?
    if (c.pending && ball.shot !== c.pending.shot) {
      const pd = c.pending, made = score[X.foeTeam] > pd.score, bucket = pd.pressed ? prof.pressed : prof.open;
      bucket.att++; if (made) bucket.made++;
      // pressure that is working (they shoot worse pressed) is turned up a little; pressure that is not is eased off
      const pr = prof.pressed, op = prof.open;
      if (pr.att >= 3 && op.att >= 2) {
        const gain = op.made / op.att - pr.made / pr.att;
        c.press = clamp(c.press + (gain > 0.1 ? 0.12 : gain < -0.1 ? -0.1 : 0), 0, 1);
      }
      c.pending = null;
    }
    if (sh && sh.team !== c.team && sh.kind !== 'dunk' && sh !== s.shot) {
      s.shot = sh; prof.shots++;
      const dist = Math.abs(sh.fromX - dfn.cx);
      prof.shotDist = prof.shots === 1 ? dist : lerp(prof.shotDist, dist, 0.25);
      if ((sh.fromX - w.cx) * sh.dir < 0) prof.longShots++;
      const pressed = w.players.some(q => q.team === c.team && Math.abs(q.torso.position.x - sh.fromX) < 130);
      c.pending = { shot: sh, pressed, score: score[X.foeTeam] };
    }
    if (w.dunk && w.dunk.p.team !== c.team && w.dunk !== s.dunk) { s.dunk = w.dunk; prof.dunks++; }
    if (w.pass && w.pass.team !== c.team && w.pass !== s.pass) { s.pass = w.pass; prof.passes++; }
    const lb = w.lastBouncer;
    if (lb && lb.team !== c.team && lb.dribbleT > 0 && lb.lastDribble !== s.drib) { s.drib = lb.lastDribble; prof.dribbles++; }
    if (X.hold && X.hold.p.team !== c.team) {   // the way their carrier runs: toward our rim (+) or away, and which side of the court
      const f = X.hold.p, v = f.torso.velocity.x * f.dir;
      prof.drive = lerp(prof.drive, clamp(v / 3, -1, 1), 0.01);
      prof.side = lerp(prof.side, Math.sign(f.torso.position.x - w.cx), 0.01);
    }
    // my own plays
    if (c.myPending && ball.shot !== c.myPending.shot) {
      const mp = c.myPending, rec = c.mine[mp.kind], gotIt = score[c.team] > mp.score;
      rec.att++; if (gotIt) rec.made++;
      if (mp.bait) { c.fakes.shots++; if (gotIt) c.fakes.made++; }
      c.myPending = null;
    }
    if (sh && sh.team === c.team && sh.kind !== 'dunk' && sh !== s.myShot) {
      s.myShot = sh;
      const kind = sh.kind === 'fade' ? 'fade' : (sh.fromX - w.cx) * sh.dir < 0 ? 'long' : 'shot';
      c.myPending = { shot: sh, kind, score: score[c.team], bait: c.tick - c.afterFake < 150 };   // a shot soon after a pump fake
    }
    if (w.dunk && w.dunk.p.team === c.team && w.dunk !== s.myDunk) { s.myDunk = w.dunk; c.myDunk = { score: score[c.team], d: w.dunk }; }
    if (c.myDunk && w.dunk !== c.myDunk.d) { c.mine.dunk.att++; if (score[c.team] > c.myDunk.score) c.mine.dunk.made++; c.myDunk = null; }
  }

  /** What the opponent tends to do, and how sure it is (0 = unseen .. 1 = well established). */
  function tendencies(prof) {
    const sh = prof.shots, du = prof.dunks, pa = prof.passes, n = sh + du;
    return {
      longShare: sh ? prof.longShots / sh : 0, dunkShare: n ? du / n : 0, passShare: n + pa ? pa / (n + pa) : 0,
      cShot: conf(sh), cDunk: conf(n), cPass: conf(n + pa),
    };
  }
  /** How much it lets what it has learned move it: its level's learning rate times the personality's reading. */
  const adaptOf = X => X.L.learn * X.st.read;
  /** Its own record with a play, as -0.5..+0.5 around even, trusted by how often it has tried it. */
  function form(c, kind) { const r = c.mine[kind]; return r.att ? (r.made / r.att - 0.5) * conf(r.att) : 0; }

  // ---------------------------------------------------------------- aiming

  /**
   * Hold a cocked shot and let go at the right moment (see the header). `a` is the aim state:
   * `off` is where it means to cross relative to the rim's centre (a little off at low skill),
   * `fade` says it is trying a fadeaway, which it starts from a lean back so the hop carries it away.
   */
  function aimStep(c, X) {
    const { w, T, dt, level, skill } = X, a = c.aim, hold = w.hold;
    a.t += dt;
    if (!hold || hold.p.team !== c.team) { c.aim = null; c.jump = false; return c; }   // the ball is gone
    const p = hold.p, dir = p.dir;
    say(c, a.txt);
    if (!hold.cocking) {                                  // not pressing yet: pick the moment
      if (a.fade && !a.pressed && wrap(p.torso.angle) * dir > -0.25 && a.wait < 1.6) { a.wait += dt; c.jump = false; return c; }
      a.pressed = true; c.jump = true; return c;
    }
    if (a.lob) {      // the alley-oop lob: the physics aims it at the board above the rim (hold.lob); it only has to be let go once up
      hold.lob = true; c.dbg.shot = { lob: true, charge: hold.charge };
      // let go once the board is within reach of this arc (the higher the hand, the easier), or at full charge
      if ((hold.charge >= 0.3 && Physics.lobPossible(w, T, p, hold.charge)) || hold.charge >= 0.995 || a.t > 1.6) { c.aim = null; c.jump = false; c.wait = T.ai_react * 0.4; return c; }
      c.jump = true; return c;
    }
    const pv = Physics.previewShot(w, T, p, hold.charge, level >= 5 ? 1 : 0);   // a Legend reads the line from where the ball will be when it leaves
    const fading = p.sinceGround > 0.1 && (p.torso.velocity.x * dir < -T.fade_speed || wrap(p.torso.angle) * dir < -T.fade_lean);
    c.dbg.shot = { err: pv.err, perfect: pv.perfect, charge: hold.charge };
    if (a.abort) {    // pumping out of a shot: bounce key down for a step, then both up, which dribbles the ball instead of shooting it
      if (a.abort === 1) { a.abort = 2; c.jump = true; c.bounce = true; return c; }
      c.aim = null; c.jump = false; c.bounce = false;
      c.wait = a.fake ? 0.3 + c.rng() * 0.15 : T.ai_react * 0.5;   // a fake waits for the defender to come back down
      if (a.fake) { c.afterFake = c.tick; c.fakes.fakes++; }
      return c;
    }
    // the bait: a defender near has jumped at a shot not yet let go. Pump (a dribble tap), let him land, then shoot.
    const jumper = w.players.some(q => q.team !== c.team && q.sinceGround > 0.12 && Math.abs(q.torso.position.x - p.torso.position.x) < 190);
    if (jumper && !a.sawJump) { a.sawJump = true; c.foeReact.jumps++; }
    if (jumper && a.fakeRoll && !a.fake && hold.barmed && hold.charge > 0.2 && hold.charge < 0.85) { a.fake = true; a.abort = 1; c.jump = true; say(c, 'PUMP FAKE: THE DEFENDER JUMPED', true); return c; }
    if (level >= 5 && a.slip === undefined) {   // Legend: it lets go only on a line the preview calls perfect, and pumps out of one that never comes
      if (pv.perfect && pv.err >= -2 && (!a.fade || fading || a.t > 1.1)) { c.aim = null; c.jump = false; c.wait = T.ai_react * 0.3; return c; }
      if ((hold.charge >= 0.995 || a.t > 2.4) && hold.barmed) { a.abort = 1; c.jump = true; return c; }
      c.jump = true; return c;
    }
    const off = a.slip !== undefined ? a.slip : a.off;   // a slipping Legend aims off like anyone else
    let release = hold.charge >= 0.995 || a.t > 2.4;
    if (!release && pv.err !== null && pv.err >= off - 3) {
      if (a.fade) release = fading || a.t > 1.1;   // a fadeaway needs the body drifting or leaning away at the moment of release
      else release = true;
    }
    if (release) { c.aim = null; c.jump = false; c.wait = T.ai_react * (1.6 - skill) * 0.5; return c; }
    c.jump = true; return c;
  }

  // ---------------------------------------------------------------- offense

  /** It has the ball: score the options and take the best. */
  function offense(c, X) {
    const { w, T, hold, ball, level, L, skill, st, sit, react, tap, atk } = X;
    const p = hold.p, dir = p.dir, span = atk.span, px = p.torso.position.x;
    const mate = w.players.find(q => q.team === c.team && q !== p);
    const foes = w.players.filter(q => q.team !== c.team);
    const gap = (atk.cx - px) * dir;                                    // court side of the rim is positive
    const Xd = Math.abs(atk.cx - ball.position.x);

    // a defender up at the rim with a hand raised would swat the dunk: level 4+ waits for them to come down (or goes around)
    const rimFoe = foes.find(q => Math.abs(q.torso.position.x - atk.cx) < T.contest_range * 0.8);
    const foeUp = rimFoe && (rimFoe.sinceGround > 0.04 || Math.abs(rimFoe.torso.position.x - atk.cx) < 50);
    if (hold.dunkReady && foeUp && level >= 4 && hold.t < 2.2 && c.rng() < 0.5 + skill * 0.4) { c.wait = react * 0.3; say(c, 'WAITING OUT THE RIM PROTECTOR'); return c; }
    if (hold.dunkReady) { c.jump = true; c.holdT = tap; c.dribs = 0; say(c, 'GOING UP FOR THE DUNK', true); return c; }   // at the rim: a tap dunks
    if (!hold.armed || !hold.barmed) return c;                                      // let go once after the catch

    const near = q => Math.min(...foes.map(f => Math.abs(f.torso.position.x - q.torso.position.x)));
    const foeNear = near(p) < 90, foeClose = near(p) < 150;
    const pressure = foeNear ? 1 : foeClose ? 0.5 : 0;
    // a screen: the teammate stands between the carrier and the nearest defender ahead, so the defender is slowed
    const ahead = foes.filter(f => (f.torso.position.x - px) * dir > 0).sort((a, b) => Math.abs(a.torso.position.x - px) - Math.abs(b.torso.position.x - px))[0];
    const screened = !!(mate && ahead && (mate.torso.position.x - px) * dir > 10 && (ahead.torso.position.x - mate.torso.position.x) * dir > 0 && Math.abs(mate.torso.position.x - px) < 120);
    // a defender baited by a pump fake is out of the play for a moment
    const baited = c.tick - c.afterFake < 90;
    const press = pressure * (screened ? 0.4 : 1) * (baited ? 0.35 : 1);
    const ownHalf = (ball.position.x - w.cx) * dir < 0;
    const far = Physics.previewShot(w, T, p, 1);
    const inRange = far.err !== null && far.err >= -span * 0.9;
    const q = inRange ? quality(c, w, T, p) : 0;
    const urg = clamp((hold.t - 1.0) / Math.max(0.5, T.hold_max - 1.0), 0, 1);     // the clock: the longer it holds, the more it must act
    const pts = Math.min(ownHalf ? 2 : 1, sit.toWin);                               // a basket past the winning mark is worth no more
    const noise = L.noise * st.wild;
    const ops = [];
    const add = (name, u, run, txt, minTicks = 0) => {
      let v = u + (c.rng() * 2 - 1) * noise;
      if (c.plan && c.plan.name === name && c.tick < c.plan.until) v += 0.15;      // a decision cooldown: it does not flip-flop
      ops.push({ name, u: v, run, txt, minTicks });
    };

    // ---- the shots (a Legend takes only perfect lines)
    const pBase = (q === 2 ? lerp(0.5, 0.93, skill) : q === 1 ? lerp(0.18, 0.5, skill) : 0.05) * (ownHalf ? 0.8 : 1);
    const takesShot = inRange && (level < 5 || q === 2);
    const startAim = (kind, txt) => () => {
      const noiseOff = (c.rng() * 2 - 1) * span * 0.55 * (1.15 - skill) * (T.ai_error / 0.35);
      const slipped = c.rng() < L.slip * 0.5;     // a rushed or misread shot: aimed well off, whoever it is
      c.foeReact.cocks++;
      // how likely a pump is: only from level 4; more against a defender who has jumped at its shots before; a showman likes it
      const rate = c.foeReact.jumps / Math.max(1, c.foeReact.cocks), seen = conf(c.foeReact.cocks);
      const fakeP = level >= 4 ? X.W.fake * clamp(0.12 + 0.6 * rate * seen + 0.2 * (st.flash - 1) + 0.1 * (X.risk - 0.5), 0, 0.8) : 0;
      c.aim = { t: 0, wait: 0, off: noiseOff + (slipped ? (c.rng() < 0.5 ? -1 : 1) * span * 0.4 : 0), fade: kind === 'fade', pressed: false, txt, fakeRoll: c.rng() < fakeP };
      if (level >= 5 && slipped) c.aim.slip = (c.rng() < 0.5 ? -1 : 1) * 16;
      c.dribs = 0;
      return aimStep(c, X);
    };
    if (takesShot) {
      const pS = pBase * (1 - 0.5 * press);
      if (ownHalf) {
        const bonus = 0.2 * (st.range - 1) + (sit.behind >= 2 ? 0.15 : 0) + form(c, 'long') * 0.3 + (foeClose ? -0.1 : 0);
        add('long', X.W.shot * pS * pts + bonus + 0.4 * urg, startAim('long', 'TAKING A LONG SHOT FOR 2'), 'LONG');
      } else {
        add('shot', X.W.shot * pS * pts + form(c, 'shot') * 0.3 + (screened ? 0.1 : 0) + (baited ? 0.35 : 0) + 0.4 * urg, startAim('shot', level >= 5 ? 'LINING UP A PERFECT SHOT' : 'GOING UP FOR A JUMP SHOT'), 'SHOT');
      }
      if (level >= 4 && foeClose && Xd < 700) {   // a fadeaway when a defender is on it: the lean takes the ball away from the hand
        const pF = pBase * (1 - 0.2 * press) * 0.92;
        add('fade', X.W.shot * pF * pts + 0.18 * (st.flash - 1) + 0.1 + (baited ? 0.35 : 0) + form(c, 'fade') * 0.3 + 0.4 * urg, startAim('fade', 'FADING AWAY FROM THE DEFENDER'), 'FADE');
      }
    }

    // ---- under or behind the basket: nothing works from there (no dunk, no shot), so it gets the ball out to the teammate
    const behind = gap < T.dunk_min_gap + 10;
    // ---- the dribble: it likes it. It brings the ball upcourt toward a dunk and keeps defenders guessing
    const maxDribs = maxDribsOf(level);
    const zone = T.dunk_ground_x;
    if (c.dribs < maxDribs && gap > zone + 40 && !behind) {
      const progress = clamp((gap - zone) / 500, 0, 1);
      const reach = foeNear ? 0.3 : foeClose ? 0.6 : 0.85;
      let u = X.W.dribble + 0.5 * clamp(st.attack * 0.62, 0, 1) * reach * (0.4 + 0.6 * progress);   // the standing taste for it is W.dribble
      u -= (1 - X.risk) * 0.35 * X.W.risk * (foeNear ? 1 : foeClose ? 0.4 : 0);                           // a steal risk, dearer to a careful player
      u -= 0.015 * c.dribs + 0.5 * urg;
      if (X.risk < st.risk) u += 0.1;                                                           // ahead near the end: run the clock
      add('dribble', u, () => { c.bounce = true; c.bholdT = tap; c.dribs++; say(c, gap > zone + 160 ? 'DRIBBLING UPCOURT FOR A DUNK' : 'DRIVING TO THE RIM'); return c; }, 'DRIB', 24);
    }

    // ---- the pass
    if (mate && level >= 3) {
      const mx = mate.torso.position.x, mateGap = (atk.cx - mx) * dir;
      const open = clamp(Math.min(...foes.map(f => Math.abs(f.torso.position.x - mx))) / 220, 0, 1);
      const mateAhead = (mx - px) * dir > 40;
      const adv = clamp((gap - mateGap) / 300, -0.5, 1);
      const mateAtRim = mateGap >= T.dunk_min_gap && mateGap <= T.dunk_reach_x * T.oop_bonus;
      const runner = mateAhead && adv > 0.5 && !foes.some(f => (f.torso.position.x - mx) * dir > 0 && (atk.cx - f.torso.position.x) * dir > -10);   // a fast break: nobody back
      const passTo = txt => () => {
        c.bounce = true; c.dribs = 0;
        c.bholdT = passHold(T, Math.abs(mx - px)) * (1 + (c.rng() * 2 - 1) * (1 - skill) * 0.18);   // the lower levels throw a little wide
        say(c, txt, true); return c;
      };
      if (Math.abs(mx - px) < 800) {
        let u = (behind ? 0.7 : 0.18) + 0.42 * open * Math.max(0, adv) + 0.28 * pressure * open * (mateAhead ? 1 : 0.3) + 0.2 * (st.pass - 1) - (1 - X.risk) * 0.3 * X.W.risk * (1 - open) + 0.4 * urg;
        u *= X.W.pass;
        let txt = 'PASSING TO THE OPEN TEAMMATE';
        if (runner && hold.t < 2.5) { u += 0.3 * st.scav; txt = 'FAST BREAK: FEEDING THE RUNNER'; }
        add('pass', u, passTo(txt), 'PASS');
        // the alley-oop: a teammate waits near the rim, so the ball is lobbed up onto the backboard above it for him to take out of the air
        // the alley-oop: the carrier goes up and lobs it onto the backboard above the rim; the teammate's jump is timed to it
        // (the physics plans his take-off, as it does a dunk's), and he dunks it out of the air
        if (level >= 4 && mateAhead && gap > 160 && Physics.lobPlan(w, T, p, 1, 110) && Physics.lobReceiver(w, T, p)) {
          add('lob', X.W.lob * (0.78 + 0.35 * open + 0.25 * (st.pass - 1) + 0.25 * (st.flash - 1) + 0.3 * (L.skill - 0.5) + (runner ? 0.15 : 0)),
            () => { c.aim = { t: 0, wait: 0, off: 0, fade: false, pressed: false, lob: true, txt: 'ALLEY-OOP: LOBBING IT OFF THE BOARD' }; c.dribs = 0; return aimStep(c, X); }, 'LOB');
        }
      }
    }

    // ---- waiting: near or under the rim and not yet dunk-ready no shot works, so the swing carries it into the zone
    const inZone = !behind && gap < zone + 60 && hold.t < 2.4 && !(far.err !== null && gap > zone + 20 && level < 3);
    add('wait', inZone ? 0.78 - 0.5 * urg : 0.14 - 0.3 * urg, () => { c.wait = react * 0.5; say(c, inZone ? 'WAITING FOR THE DUNK' : 'LOOKING FOR AN OPENING'); return c; }, 'WAIT', 12);

    if (behind) say(c, 'BEHIND THE BASKET: GETTING OUT OF IT');
    ops.sort((a, b) => b.u - a.u);
    c.dbg.ops = ops.map(o => [o.txt, +o.u.toFixed(2)]);
    const best = ops[0];
    c.plan = { name: best.name, until: c.tick + best.minTicks };
    return best.run();
  }

  // ---------------------------------------------------------------- defense

  /**
   * What the carrier is about to do, as far ahead as this level can see.
   * shoot: steps until the cocked shot leaves (it is let go when the line is on). dunk: steps until
   * they are in the dunk zone. pass: 0..1 how likely a pass is now. conf: how sure the read is.
   */
  function threat(c, X, foe) {
    const { w, T, hold, L, prof, dfn } = X, look = L.look;
    const th = { shoot: null, dunk: null, pass: 0, conf: 0 };
    const dir = foe.dir, fx = foe.torso.position.x, vx = foe.torso.velocity.x;
    if (look > 0 && hold.cocking) {
      const dc = X.dt / T.shot_charge_time;
      for (let k = 0; k <= look; k++) {
        const ch = Math.min(1, hold.charge + k * dc), pv = Physics.previewShot(w, T, foe, ch);
        if ((pv.err !== null && pv.err >= 0) || ch >= 1) { th.shoot = k; break; }
      }
      th.conf = 0.6;
    }
    if (look > 0) {
      if (hold.dunkReady) th.dunk = 0;
      else for (let k = 0; k <= look; k++) {
        const gap = (dfn.cx - (fx + vx * k)) * dir;
        if (gap >= T.dunk_min_gap && gap <= T.dunk_reach_x) { th.dunk = k; break; }
      }
      if (th.dunk !== null && vx * dir < 0.2) th.dunk = null;                  // not actually running at the rim
    }
    const tn = tendencies(prof);
    const mate = w.players.find(q => q.team === foe.team && q !== foe);
    const crowded = w.players.some(q => q.team === c.team && Math.abs(q.torso.position.x - fx) < 110);
    const mateAhead = mate && (mate.torso.position.x - fx) * dir > 40;
    th.pass = hold.bouncing && hold.bcharge >= T.dribble_threshold ? 1 : clamp(0.1 + tn.passShare * tn.cPass * 0.5 + (crowded && mateAhead ? 0.25 : 0), 0, 0.7);
    return th;
  }

  /** Where it wants to stand: between the carrier and its rim, nearer the rim the more they dunk, nearer them the more they shoot long. */
  function stanceTarget(c, X, foe, th) {
    const { prof, dfn, L } = X, tn = tendencies(prof), adapt = adaptOf(X);
    let frac = X.W.stand;
    frac += adapt * (tn.cDunk * tn.dunkShare * 0.4 - tn.cShot * tn.longShare * 0.3);
    if (th && th.dunk !== null) frac = Math.max(frac, 0.6);                      // a dunk is coming: sag back to the rim
    // a carrier running at the rim from a way off: get under it early, the swing is slow (they cannot be caught after)
    const toRim = (dfn.cx - foe.torso.position.x) * foe.dir;
    if (L.look >= 22 && toRim > 0 && toRim < 420 && foe.torso.velocity.x * foe.dir > 0.4) frac = Math.max(frac, 0.55);
    frac -= c.press * 0.15;                                                       // pressure that works: closer
    frac = clamp(frac, 0.08, 0.7);
    const fx = foe.torso.position.x, lead = L.look > 0 ? foe.torso.velocity.x * Math.min(L.look, 20) * 0.4 : 0;   // where they are going, not where they are
    return { x: fx + lead + (dfn.cx - fx) * frac, frac };
  }

  /** They have the ball: read them and answer before they act. Returns true when it acted. */
  function defense(c, X) {
    const { w, T, hold, L, def, lag, st } = X, foe = hold.p;
    const mine = w.players.filter(q => q.team === c.team);
    const gap = Math.min(...mine.map(q => Math.abs(q.torso.position.x - foe.torso.position.x)));
    const th = threat(c, X, foe); c.threat = th; c.dbg.threat = th;
    const press = (1 + c.press * 0.8) * X.W.press;         // pressure that is working makes it likelier to swing
    const jumpUp = (len, txt) => { c.jump = true; c.holdT = len; say(c, txt, true); return true; };
    const lead = Math.min(L.look, 14);                      // the jump takes about this long to get a hand up
    c.dribs = 0;
    // a dunk is coming at our rim: jump with a straight arm to meet it (a hand or the head on the ball swats it away)
    if (w.dunk && !w.dunk.slammed && w.dunk.p === foe) {
      const rimX = w.dunk.hoop.cx, cand = mine.slice().sort((q1, q2) => Math.abs(q1.torso.position.x - rimX) - Math.abs(q2.torso.position.x - rimX))[0];
      if (cand && Math.abs(cand.torso.position.x - rimX) < T.contest_range && defend(c, w, 'swat', true, def * 1.5 * st.guard * press, lag)) return jumpUp(0.32, 'SWATTING THE DUNK');
    } else delete c.rolls.swat;
    // the carrier is closing on our rim: from level 3 it sees that coming and is up early, before the prompt
    const dunkSoon = hold.dunkReady;   // (the prediction does the positioning: a leap before the dunk starts comes down before the ball goes up)
    const underRim = mine.some(q => Math.abs(q.torso.position.x - X.dfn.cx) < T.contest_range);   // a leap from across the court gets nothing
    if (defend(c, w, 'rim', dunkSoon && underRim, def * 1.2 * st.guard * press, lag)) return jumpUp(0.3, 'READING THE DUNK: UP EARLY');
    // a shot being cocked nearby: from level 4 it times the jump to the release it predicts; lower levels jump at a half-cocked shot
    const reach = 120 + 90 * def;
    const predicted = th.shoot !== null && th.shoot <= lead;
    const early = L.look < 14 && hold.cocking && hold.charge > 0.4;
    if (defend(c, w, 'contest', (predicted || early) && gap < reach, def * 1.3 * st.guard * press, lag)) return jumpUp(0.3, 'CONTESTING THE SHOT');
    // right next to the carrier: raise the arm to get a hand on the ball
    // (never a swipe while the carrier is at the rim: that jump comes down before the dunk, and the rim is left open)
    const atRim = (X.dfn.cx - foe.torso.position.x) * foe.dir < T.dunk_reach_x * 1.5 && th.dunk !== null || hold.dunkReady;
    if (defend(c, w, 'swipe', gap < 60 + 50 * def && !atRim, def * 0.7 * st.guard * press, lag)) return jumpUp(0.22, 'GOING FOR THE STEAL');
    return false;
  }

  /** A dribble in the air, theirs: when will the ball pass within a raised hand's reach? Jump so the hand is there then. */
  function timedSteal(c, X) {
    const { w, T, def, lag, st } = X;
    const path = Physics.ballPath(w, T, 30);
    c.dbg.path = path.filter((_, i) => i % 3 === 0);
    const q = nearest(w, c.team, w.ball.position.x);
    if (!q) return false;
    let hit = false;
    for (let k = 9; k <= 22 && !hit; k++) {
      const b = path[k]; if (!b) break;
      if (Math.abs(b.x - q.torso.position.x) < 55 && b.y < w.floorY - 110 && b.y > w.floorY - 330) hit = true;
    }
    if (defend(c, w, 'timed', hit, def * 0.9 * st.guard * (1 + c.press * 0.6), lag)) { c.jump = true; c.holdT = 0.2; say(c, 'TIMING THE STEAL', true); return true; }
    return false;
  }

  // ---------------------------------------------------------------- loose ball and positioning

  /** Free ball, or closing down the carrier: hop toward where it matters on the swing. */
  function chase(c, X) {
    const { w, T, hold, ball, level, L, skill, def, lag, react, dfn, st } = X;
    let target, txt;
    const dead = 22 + (1 - skill) * 40;
    if (hold) {     // they have it: stand between them and our rim; a pass about to go is met at the receiver
      const foe = hold.p, th = c.threat;
      const stand = stanceTarget(c, X, foe, th);
      const stanceW = level >= 3 ? 1 : level === 2 ? 0.5 : 0;                // a Rookie just chases the carrier
      target = lerp(foe.torso.position.x, stand.x, stanceW);
      const fmate = w.players.find(q => q.team === foe.team && q !== foe);
      if (L.look > 0 && th && th.pass >= 0.7 && fmate) target = fmate.torso.position.x;
      const tn = tendencies(c.profile), adapt = adaptOf(X);
      txt = th && th.pass >= 0.7 ? 'WATCHING THE PASS'
        : th && th.dunk !== null ? 'PROTECTING THE RIM'
        : adapt > 0.2 && tn.cDunk > 0.5 && tn.dunkShare > 0.45 ? 'GUARDING THE RIM: YOU KEEP DUNKING'
        : adapt > 0.2 && tn.cShot > 0.5 && tn.longShare > 0.5 ? 'DEFENDING DEEP: YOU SHOOT LONG'
        : c.press > 0.4 ? 'PRESSURING YOU: IT IS WORKING' : stanceW > 0 ? 'STANDING BETWEEN YOU AND THE RIM' : 'CHASING THE BALL';
      c.dbg.target = target;
    } else {
      // the ball is loose: where it will come down, with the error a lower level makes in reading it
      if (!c.looseOn) { c.looseOn = true; c.err = (c.rng() * 2 - 1) * (1 - skill) * 110 + (c.rng() < L.slip * 0.4 ? (c.rng() * 2 - 1) * 80 : 0); }
      const path = Physics.ballPath(w, T, 100);
      c.dbg.path = path.filter((_, i) => i % 4 === 0);
      let land = null;
      for (const b of path) if (b.y >= w.floorY - ball.r - 1) { land = b.x; break; }
      if (land === null) land = path[path.length - 1].x;
      target = ball.position.y < w.floorY - 70 ? land + c.err * (level >= 3 ? 1 : 0.5) : ball.position.x;
      txt = 'CHASING THE LOOSE BALL';
      // a foe shot in the air that will miss: go to where the rebound comes off
      const sh = ball.shot;
      if (sh && sh.team !== c.team && level >= 3) {
        const line = Physics.predictLine(w, T, dfn);
        if (line.crossX === null || !line.onTarget) { target = dfn.cx - dfn.side * dfn.span * (0.9 + 0.5 * (1 - skill)) + c.err * 0.5; txt = 'CRASHING THE BOARD'; }
      }
      c.dbg.target = target;
    }
    target = courtSide(w, target);                      // (never to the far side of a basket)
    say(c, txt);
    let p = nearest(w, c.team, target);
    if (!p) return c;
    // a player stranded behind a basket is brought back before anything else that is not urgent (the swing only moves the one it follows)
    const behindRim = q => w.hoops.some(h => (q.torso.position.x - h.cx) * (-h.side) < -10);
    const stray = w.players.find(q => q.team === c.team && behindRim(q));
    if (stray && stray !== p && (hold ? Math.abs(target - p.torso.position.x) < dead + 30 : Math.abs(ball.position.x - stray.torso.position.x) > 320)) { p = stray; target = courtSide(w, p.torso.position.x < w.cx ? w.L : w.R, 90); say(c, 'GETTING BACK FROM BEHIND THE BASKET'); }
    const s = Math.sign(target - p.torso.position.x) || 1, a = wrap(p.torso.angle);
    // a high ball: from level 4 the leap is timed to where the path puts it within reach
    if (!hold) {
      const path = level >= 4 ? Physics.ballPath(w, T, 24) : null;
      const near = path && path.some((b, k) => k >= 6 && k <= 18 && Math.abs(b.x - p.torso.position.x) < 60 && b.y < w.floorY - 200);
      const highBall = level >= 4 ? near : ball.position.y < w.floorY - 220 && Math.abs(ball.position.x - p.torso.position.x) < 140;
      if (defend(c, w, 'board', !!highBall, (0.3 + 0.7 * def) * (0.9 + 0.1 * st.scav), lag)) { c.jump = true; c.holdT = 0.32; say(c, 'GOING UP FOR THE BOARD', true); return c; }   // a full jump for a high ball
    }
    if (hold && Math.abs(target - p.torso.position.x) < dead) { c.wait = react * 0.25; return c; }   // in position: stand
    const leaningToward = a * s > 0.22 && p.sinceFoot < 0.1;                    // the swing is tipping toward it
    if (leaningToward) { c.jump = true; c.holdT = 0.06 + c.rng() * 0.08; return c; }
    c.wait = (hold ? T.ai_react * (1.7 - 1.5 * def) : react) * 0.25;           // closing a carrier down: quicker the better the defence
    return c;
  }

  // ---------------------------------------------------------------- the step

  /**
   * Decide this step's keys.
   * @param {object} c controller from create
   * @param {object} w the physics world
   * @param {object} T live tuning values
   * @param {number} dt step length in seconds
   * @param {{score: number[]}} [info] the match state it may look at: the score
   * @returns {{jump: boolean, bounce: boolean}}
   */
  function update(c, w, T, dt, info) {
    c.tick++;
    const X = frame(c, w, T, dt, info), { hold, ball, level, L, st, tap } = X;
    observe(c, X);
    c.jump = false; c.bounce = false;
    c.dbg = { path: null, target: null, ops: null, threat: null, shot: null };
    if (hold) c.looseOn = false;
    if (!(hold && hold.p.team !== c.team)) { for (const k of ['swat', 'rim', 'contest', 'swipe']) delete c.rolls[k]; c.threat = null; }   // the opponent lost the ball: the next incident is rolled fresh

    if (c.aim) return aimStep(c, X);
    // a key being held on purpose stays down until its time is up; letting go is the action
    if (c.bholdT > 0) { c.bholdT -= dt; c.bounce = c.bholdT > 0; return c; }
    if (c.holdT > 0) { c.holdT -= dt; c.jump = c.holdT > 0; if (c.holdT <= 0) c.wait = X.react * 0.5; return c; }
    if (c.wait > 0) { c.wait -= dt; return c; }

    if (hold && hold.p.team === c.team) return offense(c, X);             // ---- we have the ball

    // ---- our own pass is in the air: send the receiver up to meet it
    if (!hold && w.pass && w.pass.team === c.team && w.time < w.pass.until) {
      const mate = w.players.find(q => q.team === c.team && q !== w.pass.from);
      if (w.pass.lob) {   // an alley-oop lob in the air: the physics takes the teammate up for it; this just says so, and shows the ball path
        c.dbg.path = Physics.ballPath(w, T, 70).filter((_, i) => i % 3 === 0);
        say(c, w.lobPlay ? 'ALLEY-OOP: GOING UP TO DUNK IT' : 'ALLEY-OOP: WAITING UNDER THE LOB', true);
        return c;
      }
      if (mate && Math.abs(ball.position.x - mate.torso.position.x) < 190 && Math.abs(ball.position.y - mate.torso.position.y) < 160 && ball.velocity.x * mate.dir >= -1) {
        c.jump = true; c.holdT = 0.3; say(c, 'MEETING THE PASS'); return c;
      }
    }

    // ---- our own dribble is in the air: keep it going (the tap is queued and fires on the catch)
    const lb = w.lastBouncer;
    if (!hold && lb && lb.team === c.team && lb.dribbleT > 0) {
      const keepOn = (X.atk.cx - lb.torso.position.x) * lb.dir > T.dunk_ground_x && c.dribs < maxDribsOf(level) && !lb.queued;
      // level 4+ taps in rhythm, as the ball rises; below that it taps whenever, so its dribble gets sloppy
      if (keepOn && (level >= 4 ? ball.velocity.y < -0.5 : c.rng() < 0.12)) { c.bounce = true; c.bholdT = tap; c.dribs++; }
      // a screen: from level 4, with the ball up, the teammate hops toward the defender to cut him off from the carrier
      const mate = w.players.find(q => q.team === c.team && q !== lb);
      const f = w.players.filter(q => q.team !== c.team && (q.torso.position.x - lb.torso.position.x) * lb.dir > 0).sort((a, b) => Math.abs(a.torso.position.x - lb.torso.position.x) - Math.abs(b.torso.position.x - lb.torso.position.x))[0];
      if (level >= 4 && mate && f && Math.abs(f.torso.position.x - lb.torso.position.x) < 170 && c.rng() < 0.5 * st.read * L.skill) {
        const spot = (f.torso.position.x + lb.torso.position.x) / 2, s = Math.sign(spot - mate.torso.position.x) || 1;
        if (Math.abs(spot - mate.torso.position.x) > 45 && wrap(mate.torso.angle) * s > 0.22 && mate.sinceFoot < 0.1) { c.jump = true; c.holdT = 0.06 + c.rng() * 0.08; say(c, 'SETTING A SCREEN'); }
      }
      return c;
    }

    // ---- they dribble in the air: a timed steal (level 4+)
    if (!hold && lb && lb.team !== c.team && lb.dribbleT > 0 && level >= 4 && timedSteal(c, X)) return c;

    if (hold && hold.p.team !== c.team && defense(c, X)) return c;        // ---- they have it
    return chase(c, X);
  }

  /**
   * The little picture over a player's head for what the AI is doing: ball (dribbling), shot (a jump shot,
   * long shot, fadeaway, pump fake), shield (a block, a rim guard, standing in the way), screen (setting
   * one), pass, dunk, steal, board (rebound), or null (just chasing).
   */
  function iconOf(text) {
    if (!text) return null;
    if (/SCREEN/.test(text)) return 'screen';
    if (/STEAL/.test(text)) return 'steal';
    if (/SWATTING|CONTESTING|PROTECTING THE RIM|GUARDING THE RIM|DEFENDING DEEP|STANDING BETWEEN|PRESSURING|READING THE DUNK|WATCHING THE PASS/.test(text)) return 'shield';
    if (/GOING UP TO DUNK/.test(text)) return 'dunk';
    if (/LOB/.test(text)) return 'lob';
    if (/PASS|ALLEY|FEEDING/.test(text)) return 'pass';
    if (/DUNK|RIM PROTECTOR/.test(text)) return 'dunk';
    if (/SHOT|FADING|PUMP FAKE/.test(text)) return 'shot';
    if (/DRIBBL|DRIVING/.test(text)) return 'ball';
    if (/BOARD/.test(text)) return 'board';
    return null;
  }
  /** The icon to show now and which of its players it goes over (null when it has gone stale or means nothing). */
  function marker(c, w) {
    const icon = c.tick - c.intentSeen < 45 ? iconOf(c.intent) : null;
    if (!icon) return null;
    const mine = w.players.filter(q => q.team === c.team), lb = w.lastBouncer, hold = w.hold;
    let who;
    if (icon === 'screen') { const base = lb && lb.team === c.team ? lb : mine[0]; who = mine.find(q => q !== base) || base; }   // the teammate, not the dribbler
    else if (hold && hold.p.team === c.team && icon !== 'shield' && icon !== 'steal' && icon !== 'board') who = hold.p;
    else if (!hold && icon === 'lob' && w.pass && w.pass.team === c.team) who = w.pass.lob && /UNDER/.test(c.intent) ? nearest(w, c.team, w.ball.position.x) : w.pass.from;
    else if (!hold && lb && lb.team === c.team && (icon === 'ball' || icon === 'shot')) who = lb;
    else who = nearest(w, c.team, hold ? hold.p.torso.position.x : w.ball.position.x);
    return who ? { icon, who } : null;
  }

  return { create, update, LEVELS, STYLES, levelOf, tendencies, DEFAULT_WEIGHTS, iconOf, marker };
})();
