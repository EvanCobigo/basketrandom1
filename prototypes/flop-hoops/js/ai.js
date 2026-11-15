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
 * defence leans on it gradually: the more it has seen, the more it moves. It steps up to the spot they
 * like to shoot from and leads further against a carrier who keeps driving at the rim. `c.mine` keeps its
 * own record (shots, long shots, fadeaways, dunks), `c.swipes` how its steal swipes fare and `c.dribRec`
 * how many of its dribbles were lost; a level's `learn` sets how much any of it moves the next choice.
 * The match state: the score margin tilts its risk on a smooth curve that steepens toward the end, and
 * `c.mood` (the run of baskets) warms or cools it the way its personality would.
 * Slips: slip() rolls the level's slip rate for a shot, a defensive answer, a dribble tap, a pass and a
 * rebound read; how bad each is shrinks with skill, so a Legend's are rare and small. Press I in a match
 * to see what it thinks (AI.summary, from c.dbg and the books above).
 * Patience: there is no shot clock, so past PATIENCE the waiting option can never win (see offense()).
 * Ball rules (iteration 38): dribbles per possession are HARD-capped (BUDGETS) and never start from a seated player
 * (Physics.seated); under or beyond the basket it DEFENDS it never shoots or dribbles, it passes out (to a teammate
 * ahead, else an outlet: a self-pass at levels 5-6, a medium pass off the wall below); stuck with nothing on target
 * and nobody ahead it takes the same outlet instead of standing; a carrier in a worse spot than an open teammate
 * passes (from level 2). It shoots through pressure more readily, and makes room first with pump fakes (level 2+),
 * fadeaways (3+) and screens (3+). AI.brief() gives the intent in a word or two for the HUD.
 *
 * The Mythic (level 6) is the Legend plus refinements, each a field of its LEVELS entry or an X.m6 test: defence that reads a dunk
 * `rimLead` steps early and drops back only for a near one, a swipe rate capped at the Legend's, a halved-blind-spot personality,
 * trust in a sighting after two (not four), a pump fake that follows how its own fakes have fared, a pass that leads the receiver,
 * a rim protector it always waits out, three seconds of patience (not four) and a way out that takes the best shot left, and the
 * self-pass: from halfway to the rim it throws the ball ahead, hops after it, catches it in the air itself and dunks (selfStep).
 *
 * How it aims: while it holds a cocked shot it asks the physics, every step, where the ball
 * would cross the rim if it let go right now (Physics.previewShot, the engine's own flight maths
 * and the real aim help), and lets go when that reaches the spot it picked. The top level lets go
 * only on a line the preview calls perfect, and pumps out of a shot that never lines up.
 */
const AI = (() => {
  const PATIENCE = 4;   // s the CPU holds the ball before it feels pushed to act (it has no shot clock to run out)
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  /**
   * The six difficulty levels. skill: 0..1, how well it reacts and aims. defense: doubles per level.
   * look: how many steps ahead it can read the opponent (0: none). learn: how fast it adapts to them.
   * slip: the chance a play goes wrong on its own (a misread, a rushed shot). noise: how much its
   * choices wobble. Nobody is infallible: even a Legend slips, just rarely and mildly.
   * react: s it pauses between fresh decisions (and after an action), shorter at every step up by a wider margin. error: how far off the rim's
   *   centre it aims a shot (1 is a Rookie's scatter, 0 dead centre), close to none at the top. Both belong to the level; there is no setting.
   * rimLead: steps before a predicted dunk that its rim defender is already up (0: waits for the dunk to be ready).
   * sagWithin: a dunk predicted within this many steps makes it drop back to the rim (the Mythic does not sag for one far off).
   * lobGuard: px from the rim within which a defender stops it lobbing (0: lobs regardless). patience: s it holds before it must act.
   * selfPass: it may throw the ball ahead, hop after it, catch it itself and dunk (see offense).
   * swipeCap: the most a swipe or a timed steal is scaled by (a swing at everything only loses position, so the Mythic keeps them at the Legend's rate).
   * tame: keeps its personality's flavour but halves its blind spots. fakeBase, screenP, screenR: how often it pumps and screens.
   * rimGuard, guardFrac: a carrier within rimGuard px of its rim is met guardFrac of the way back to the rim (a dribbler walks past a man
   *   who only stands in front of him; the rim is what has to be defended).
   */
  const LEVELS = [
    { name: 'ROOKIE', skill: 0.15, react: 0.26, error: 1, defense: 1 / 16, look: 0, learn: 0, slip: 0.5, noise: 0.5, rimLead: 0, sagWithin: 99, rimGuard: 0, guardFrac: 0, does: 'CHASES THE BALL, MISSES A LOT, REACTS SLOWLY. DRIBBLES A LITTLE.' },
    { name: 'AMATEUR', skill: 0.35, react: 0.24, error: 0.8, defense: 1 / 8, look: 4, learn: 0, slip: 0.3, noise: 0.35, rimLead: 0, sagWithin: 99, rimGuard: 0, guardFrac: 0, does: 'KNOWS BASIC SHOOTING AND BLOCKING, AND DRIBBLES UPCOURT.' },
    { name: 'PRO', skill: 0.55, react: 0.21, error: 0.5, defense: 1 / 4, look: 10, learn: 0.25, slip: 0.2, noise: 0.22, rimLead: 0, sagWithin: 99, rimGuard: 0, guardFrac: 0, does: 'DRIBBLES, PASSES AND DUNKS, SPOTS OPEN CHANCES, HAS A PERSONALITY.' },
    { name: 'ALL-STAR', skill: 0.75, react: 0.17, error: 0.2, defense: 1 / 2, look: 22, learn: 0.7, slip: 0.12, noise: 0.12, rimLead: 0, sagWithin: 99, rimGuard: 0, guardFrac: 0, does: 'PREDICTS FLIGHTS, TIMES STEALS, ADAPTS TO HOW YOU PLAY.' },
    { name: 'LEGEND', skill: 0.95, react: 0.10, error: 0.03, defense: 1, look: 40, learn: 1, slip: 0.06, noise: 0.06, rimLead: 0, sagWithin: 99, rimGuard: 0, guardFrac: 0, does: 'PERFECT LINES, FAST BREAKS, READS YOUR PLAYS. STILL MAKES MISTAKES.' },
    { name: 'MYTHIC', skill: 1, react: 0.02, error: 0.005, defense: 2, look: 60, learn: 1.6, slip: 0.025, noise: 0.03, rimLead: 12, sagWithin: 30, rimGuard: 520, guardFrac: 0.62, lobGuard: 0, patience: 3, tame: true, swipeCap: 1, selfPass: true, fakeBase: 0.12, screenP: 0.9, screenR: 220, does: 'SELF-PASS FAST BREAKS, BLOCKS MORE, LEARNS QUICKLY. RARELY SLIPS.' },
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
  const MYTHIC = 6;   // the level that has every refinement below (X.m6)
  const conf = (n, k = 4) => n / (n + k);   // how much to trust a tendency seen n times (k: how many sightings it takes to trust it halfway)
  /** A Mythic keeps its personality's flavour but not its blind spots: a weakness is halved, a wild streak is calmed. */
  const tamed = new WeakMap();
  function tame(st) {
    let t = tamed.get(st);
    if (!t) {
      t = Object.assign({}, st);
      for (const k of ['attack', 'range', 'pass', 'flash', 'guard', 'scav']) if (t[k] < 1) t[k] = 1 - (1 - t[k]) * 0.5;
      t.read = Math.max(1.2, t.read); t.wild = 1 + (t.wild - 1) * 0.5;
      tamed.set(st, t);
    }
    return t;
  }
  /**
   * The weights the AI's own judgement is tuned by (what self-play adjusts: tools/ai-selfplay.js). 1 is
   * neutral except where noted. dribble: the standing taste for dribbling (0.48). shot, pass: scale the
   * value of shooting and passing. risk: scales the penalty for steal and block risk. press: scales how
   * often defence swings at pressure. stand: how far from the carrier toward the rim it stands (0.28).
   * fake: scales how often it pumps against a defender who jumps early. lob: scales how much it likes
   * the alley-oop lob when a teammate waits at the rim. role: scales the front/back tilt (the man nearer
   * the rim leans to the drive, the one behind to the shot; 0 = off). budget: unused since iteration 38 (the
   * possession's budget is a hard cap now). Each controller has its own
   * copy (c.w), so two controllers can play each other with different weights.
   */
  const DEFAULT_WEIGHTS = { dribble: 0.48, shot: 1, pass: 1, risk: 1, press: 1, stand: 0.28, fake: 1, lob: 1, role: 1, budget: 1 };
  const maxDribsOf = level => 2 + Math.round(level * 1.4);
  /**
   * The most dribbles a possession may have, rolled fresh each time it gets the ball: [fewest, most] by level.
   * A HARD cap since iteration 38 (no dribble past it, from the hand or in the air). Iteration 28's hard cap left it
   * standing with nothing to do; that cannot happen now: past its patience waiting never wins, and with no shot
   * on target and nobody ahead it passes the ball out (self-pass or wall pass) instead of standing.
   */
  const BUDGETS = [[2, 4], [2, 5], [3, 7], [4, 9], [5, 10], [5, 10]];
  /** How often a cocked shot may turn into a pump fake, by level (from level 2; a level's own fakeBase wins). */
  const FAKE_BASE = [0, 0.06, 0.1, 0.12, 0.12, 0.12];

  /**
   * A slip: this play goes wrong on its own, at the level's slip rate times `k`. Counted in c.slips (the
   * benchmark reports it). How badly is up to the caller, and every caller scales it by (1 - skill), so a
   * Legend's slips are rare and small: a hair late, a little wide.
   */
  function slip(c, X, k = 1) {
    if (c.rng() >= X.L.slip * k) return false;
    c.slips++; c.slipAt = c.tick; return true;
  }

  /**
   * Make a controller for `team`.
   * @param {number} team the team it plays (0 or 1)
   * @param {() => number} rng seeded random, so a replay of the same match is the same
   * @param {object} T tuning values: the level decides whether it has a personality
   * @param {number} [matchNo] which match of the session this is: successive matches cycle through the personalities
   * @param {object} [weights] overrides of DEFAULT_WEIGHTS
   * @param {number} [level] play at this level whatever the tuning says (two computers of different levels can play each other)
   */
  function create(team, rng, T, matchNo = 0, weights = null, level = 0) {
    const style = T && (level || levelOf(T)) >= 3 ? STYLES[(Math.floor(rng() * STYLES.length) + matchNo) % STYLES.length] : BALANCED;
    return {
      team, rng, style, lv: level, w: Object.assign({}, DEFAULT_WEIGHTS, weights), jump: false, bounce: false, wait: 0, holdT: 0, bholdT: 0, dribs: 0, aim: null, rolls: {},
      tick: 0, intent: '', intentAt: -99, intentSeen: -99, plan: null, press: 0, err: 0, looseOn: false, qCache: null,
      // tactical memory: what the opponent does, how they fare pressed or left open, and how my own plays fare
      profile: { shots: 0, longShots: 0, dunks: 0, passes: 0, dribbles: 0, shotDist: 0, drive: 0, side: 0, pressed: { att: 0, made: 0 }, open: { att: 0, made: 0 } },
      mine: { shot: { att: 0, made: 0 }, long: { att: 0, made: 0 }, fade: { att: 0, made: 0 }, dunk: { att: 0, made: 0 } },
      // how the opponent answers a cocked shot (how often a defender jumps at it early) and how its own fakes fare
      foeReact: { cocks: 0, jumps: 0 }, fakes: { fakes: 0, shots: 0, made: 0 }, afterFake: -999, fakeAt: -999,
      seen: {}, pending: null, myPending: null, myDunk: null, dbg: {}, threat: null,
      self: null, selfEnds: {}, selfCool: 0, selfCaughtAt: -999, selfStats: { tries: 0, caught: 0, dunks: 0 },   // the self-pass in progress and how it has gone
      // the match so far: mood (-1 cold .. +1 hot, from the run of baskets), slips made, this possession's dribble budget
      mood: 0, scoreSeen: [0, 0], slips: 0, slipAt: -999, budget: 4, hadBall: false, possN: 0,
      // how its swipes fare (a swipe that never wins leaves it out of position) and how its dribbles fare near a defender
      swipes: { tries: 0, won: 0 }, swipeAt: -999, dribRec: { n: 0, lost: 0 }, ownDribAir: false,
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

  /**
   * What a shot from here could be (a coarse sweep of the preview over the cock-back):
   * q 2 a perfect line exists, 1 it can go in, 0 neither; `width` 0..1 how much of the sweep goes in. A wide
   * window forgives a release a step early or late, so the same q is worth more when it is wide.
   */
  function quality(c, w, T, p) {
    if (c.qCache && c.qCache.tick > c.tick - 3) return c.qCache;
    let q = 0, hits = 0, n = 0;
    for (let ch = 0.3; ch <= 1.0001; ch += 0.03) {
      const v = Physics.previewShot(w, T, p, ch);
      n++;
      if (v.onTarget) hits++;
      if (v.perfect) q = 2;
      else if (v.onTarget && q < 1) q = 1;
    }
    c.qCache = { tick: c.tick, q, width: hits / n };
    return c.qCache;
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

  /** Whether x is under (within T.ai_own_rim_zone of the rim) or beyond the basket team `c` DEFENDS: it never shoots from there. */
  function underOwnRim(c, w, T, x) {
    const d = w.hoops.find(h => h.team !== c.team);
    return Math.abs(x - d.cx) < T.ai_own_rim_zone || (x - d.cx) * (-d.side) < 0;
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
  function defend(c, w, kind, cond, p, lag, X) {
    const r = c.rolls[kind] || (c.rolls[kind] = { on: false, go: false, at: 0 });
    if (!cond) { r.on = false; return false; }
    if (!r.on) {
      r.on = true; r.go = c.rng() < clamp(p, 0, 1); r.at = w.time + lag * c.rng();
      // a mistimed answer: a little late (a Legend by a few hundredths, a Rookie by a third of a second)
      if (r.go && X && slip(c, X, 0.6)) r.at += 0.06 + 0.3 * (1 - X.skill);
    }
    return r.go && w.time >= r.at;
  }

  // ---------------------------------------------------------------- the frame: what every part reads

  function frame(c, w, T, dt, info) {
    const level = c.lv || levelOf(T), L = LEVELS[level - 1], m6 = level >= MYTHIC, st = L.tame ? tame(c.style) : c.style;
    const win = T.win_score, mine = info ? info.score[c.team] : 0, theirs = info ? info.score[1 - c.team] : 0;
    // the state of the match: how far from the end each side is decides how much risk and defence it wants
    const sit = { behind: theirs - mine, toWin: win - mine, foeToWin: win - theirs };
    const nearEnd = m6 ? 5 : 3;                         // (the Mythic feels the end coming sooner)
    sit.late = sit.toWin <= nearEnd || sit.foeToWin <= nearEnd;
    const protect = sit.behind <= -3 && sit.late;       // ahead near the end: play it safe
    const chase = sit.behind >= 3 && sit.late;          // behind near the end: gamble
    // how much the score moves its appetite for risk: a smooth curve, not a switch. The margin counts more the
    // nearer the end (lateness 0 until someone is 5 from winning, 1 at match point); ahead cools it, behind heats it
    const lateness = clamp((5 - Math.min(sit.toWin, sit.foeToWin)) / 4, 0, 1);
    const scoreTilt = clamp(sit.behind / 4, -1, 1) * 0.25 * (0.35 + 0.65 * lateness);
    // the mood: a hot hand plays bolder; a cold run makes a careful mind more careful and a bold one bolder
    const moodTilt = c.mood > 0 ? 0.12 * c.mood : 0.12 * -c.mood * (st.risk - 0.5) * 2;
    sit.lateness = lateness;
    return {
      c, w, T, dt, info, level, L, st, sit, m6, K: m6 ? 2 : 4, swipeCap: L.swipeCap || 9, selfPass: !!L.selfPass, W: c.w, skill: L.skill, hold: w.hold, ball: w.ball, prof: c.profile,
      def: clamp(L.defense * (sit.foeToWin <= 2 ? 1.25 : 1), 0, L.defense > 1 ? 2.5 : 1),      // (past 1 every answer is already certain: reach and speed stop growing at 1, where a longer lunge only loses position)
      lag: 0.32 * Math.max(0, 1 - L.defense),
      react: L.react, base: L.react,
      tap: dt * 2,
      risk: clamp(st.risk + scoreTilt + moodTilt, 0, 1), protect, chase,
      atk: w.hoops.find(h => h.team === c.team),        // the hoop it shoots at
      dfn: w.hoops.find(h => h.team !== c.team),        // the hoop it guards
      foeTeam: 1 - c.team,
    };
  }

  // ---------------------------------------------------------------- memory

  /** Watch what happens and keep the books: the opponent's tendencies and the fate of its own plays. */
  function observe(c, X) {
    const { w, info, prof, dfn } = X, s = c.seen, ball = w.ball, sh = ball.shot, score = info ? info.score : [0, 0];
    // the run of baskets: each one of ours warms the mood, each of theirs cools it; older ones fade
    for (const t of [0, 1]) if (score[t] > c.scoreSeen[t]) { c.mood = clamp(c.mood * 0.7 + (t === c.team ? 0.3 : -0.3), -1, 1); c.scoreSeen[t] = score[t]; }
    if (score[0] < c.scoreSeen[0] || score[1] < c.scoreSeen[1]) { c.scoreSeen = score.slice(); c.mood = 0; }   // a new match on the same controller
    // a swipe that won the ball within ~0.7 s counts as won
    if (X.hold && X.hold.p.team === c.team && c.tick - c.swipeAt < 45) { c.swipes.won++; c.swipeAt = -999; }
    // my dribble in the air last step, and now they hold it: that dribble was lost
    if (c.ownDribAir && X.hold && X.hold.p.team !== c.team) c.dribRec.lost++;
    const lb0 = w.lastBouncer;
    c.ownDribAir = !X.hold && !!lb0 && lb0.team === c.team && lb0.dribbleT > 0;
    // a foe shot that has finished: did it go in, and was it pressed?
    if (c.pending && ball.shot !== c.pending.shot) {
      const pd = c.pending, made = score[X.foeTeam] > pd.score, bucket = pd.pressed ? prof.pressed : prof.open;
      bucket.att++; if (made) bucket.made++;
      // pressure that is working (they shoot worse pressed) is turned up a little; pressure that is not is eased off
      const pr = prof.pressed, op = prof.open;
      if (pr.att >= (X.m6 ? 2 : 3) && op.att >= (X.m6 ? 1 : 2)) {
        const gain = op.made / op.att - pr.made / pr.att;
        c.press = clamp(c.press + (gain > 0.1 ? (X.m6 ? 0.2 : 0.12) : gain < -0.1 ? -0.1 : 0), 0, 1);
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
    if (w.dunk && w.dunk.p.team === c.team && w.dunk !== s.myDunk) { s.myDunk = w.dunk; c.myDunk = { score: score[c.team], d: w.dunk }; if (c.tick - c.selfCaughtAt < 150) c.selfStats.dunks++; }
    if (c.myDunk && w.dunk !== c.myDunk.d) { c.mine.dunk.att++; if (score[c.team] > c.myDunk.score) c.mine.dunk.made++; c.myDunk = null; }
  }

  /** What the opponent tends to do, and how sure it is (0 = unseen .. 1 = well established). */
  function tendencies(prof, k = 4) {
    const sh = prof.shots, du = prof.dunks, pa = prof.passes, n = sh + du;
    return {
      longShare: sh ? prof.longShots / sh : 0, dunkShare: n ? du / n : 0, passShare: n + pa ? pa / (n + pa) : 0,
      cShot: conf(sh, k), cDunk: conf(n, k), cPass: conf(n + pa, k),
    };
  }
  /** How much it lets what it has learned move it: its level's learning rate times the personality's reading. */
  const adaptOf = X => X.L.learn * X.st.read;
  /** Its own record with a play, as -0.5..+0.5 around even, trusted by how often it has tried it. */
  function form(c, kind, k = 4) { const r = c.mine[kind]; return r.att ? (r.made / r.att - 0.5) * conf(r.att, k) : 0; }
  /** How much its own record moves it: a Rookie barely notices how its plays go, a Legend keeps count (0.3 .. 1). */
  const learnOf = X => 0.3 + 0.7 * Math.min(1, X.L.learn);

  // ---------------------------------------------------------------- aiming

  /**
   * Hold a cocked shot and let go at the right moment (see the header). `a` is the aim state:
   * `off` is where it means to cross relative to the rim's centre (a little off at low skill),
   * `fade` says it is trying a fadeaway, which it starts from a lean back so the hop carries it away.
   */
  function aimStep(c, X) {
    const { w, T, dt, level, skill, base, react } = X, a = c.aim, hold = w.hold;
    a.t += dt;
    if (!hold || hold.p.team !== c.team) { c.aim = null; c.jump = false; return c; }   // the ball is gone
    const p = hold.p, dir = p.dir;
    say(c, a.txt);
    // a shot drifting under the basket it defends: never let go there. With the jump still down (the shot stays
    // cocked) it holds the bounce key for a medium pass, then lets both go: the bounce goes first, so the ball is passed out
    if (a.outPass !== undefined || (hold.cocking && underOwnRim(c, w, T, w.ball.position.x))) {
      if (a.outPass === undefined) { a.outPass = Math.round(0.55 * T.bounce_charge_time / dt); say(c, 'OUTLET PASS FROM UNDER OUR RIM', true); }
      if (a.outPass-- > 0) { c.jump = true; c.bounce = true; return c; }
      c.aim = null; c.jump = false; c.bounce = false; c.wait = X.react * 0.5; return c;
    }
    if (!hold.cocking) {                                  // not pressing yet: pick the moment
      // the jump key is still down from before the catch: the shot cannot charge until it has been let go once
      if (!hold.armed) { c.jump = false; if (a.t > 1) c.aim = null; return c; }
      if (hold.dunkReady || a.t > 2.5) { c.aim = null; c.jump = false; return c; }   // a dunk is on, or the moment never came
      // a fadeaway starts from a lean back; with a defender within reach of the ball it cannot wait long for one
      const reachFoe = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - p.torso.position.x) < 75);
      if (a.fade && !a.pressed && wrap(p.torso.angle) * dir > -0.25 && a.wait < (reachFoe ? 0.4 : 1.6)) { a.wait += dt; c.jump = false; return c; }
      a.pressed = true; c.jump = true; return c;
    }
    if (a.lob) {      // the alley-oop lob: the physics aims it at the board above the rim (hold.lob); it only has to be let go once up
      hold.lob = true; c.dbg.shot = { lob: true, charge: hold.charge };
      // let go once the board is within reach of this arc (the higher the hand, the easier), or at full charge
      if ((hold.charge >= 0.3 && Physics.lobPossible(w, T, p, hold.charge)) || hold.charge >= 0.995 || a.t > 1.6) { c.aim = null; c.jump = false; c.wait = base * 0.4; return c; }
      c.jump = true; return c;
    }
    const pv = Physics.previewShot(w, T, p, hold.charge, level >= 5 ? 1 : 0);   // a Legend reads the line from where the ball will be when it leaves
    const fading = p.sinceGround > 0.1 && (p.torso.velocity.x * dir < -T.fade_speed || wrap(p.torso.angle) * dir < -T.fade_lean);
    c.dbg.shot = { err: pv.err, perfect: pv.perfect, charge: hold.charge };
    if (a.abort) {    // pumping out of a shot: bounce key down for a step, then both up, which dribbles the ball instead of shooting it
      if (a.abort === 1) { a.abort = 2; c.jump = true; c.bounce = true; return c; }
      c.aim = null; c.jump = false; c.bounce = false;
      c.wait = a.fake ? 0.3 + c.rng() * 0.15 : base * 0.5;   // a fake waits for the defender to come back down
      if (a.fake) { c.afterFake = c.tick; c.fakes.fakes++; }
      return c;
    }
    // the bait: a defender near has jumped at a shot not yet let go. Pump (a dribble tap), let him land, then shoot.
    const jumper = w.players.some(q => q.team !== c.team && q.sinceGround > 0.12 && Math.abs(q.torso.position.x - p.torso.position.x) < 190);
    if (jumper && !a.sawJump) { a.sawJump = true; c.foeReact.jumps++; }
    // ...or, to make room, it pumps first with a defender right on it, so he jumps at a shot that is not coming
    const closeFoe = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - p.torso.position.x) < 110);
    if (!jumper && closeFoe && a.fakeRoll && !a.fake && !c.faked && hold.barmed && hold.charge > 0.35 && hold.charge < 0.6) { c.faked = true; a.fake = true; a.abort = 1; c.jump = true; c.fakeAt = c.tick; say(c, 'PUMP FAKE: MAKING ROOM', true); return c; }
    if (jumper && a.fakeRoll && !a.fake && hold.barmed && hold.charge > 0.2 && hold.charge < 0.85) { a.fake = true; a.abort = 1; c.jump = true; c.fakeAt = c.tick; say(c, 'PUMP FAKE: THE DEFENDER JUMPED', true); return c; }
    if (a.perfectOnly && !a.forced) {   // a Mythic with a perfect line on offer prefers it: it lets go only on that line...
      if (pv.perfect && pv.err >= -2 && (!a.fade || fading || a.t > 1.1)) { c.aim = null; c.jump = false; c.wait = base * 0.3; return c; }
      // ...while one is still there: what is left of this cock-back is swept every few steps (twice in a row, since a
      // fadeaway's drift can still bring one). Once none is left, or it has waited long enough, it takes a good line instead
      let gone = hold.charge >= 0.995 || a.t > 1.6;
      if (!gone && hold.barmed && hold.charge > 0.15 && c.tick % 4 === 0) {
        let any = false;
        for (let ch = hold.charge; ch <= 1.0001 && !any; ch += 0.04) if (Physics.previewShot(w, T, p, Math.min(1, ch), 1).perfect) any = true;
        a.noLine = any ? 0 : (a.noLine || 0) + 1;
        gone = a.noLine >= 2;
      }
      if (!gone) { c.jump = true; return c; }
      a.perfectOnly = false; a.slip = 0; say(c, 'NO PERFECT LINE: TAKING A GOOD ONE', true);   // (falls through to the ordinary release)
    }
    const off = a.slip !== undefined ? a.slip : a.off;   // a slipping Legend aims off like anyone else
    let release = hold.charge >= 0.995 || a.t > 2.4;
    if (!release && pv.err !== null && pv.err >= off - 3) {
      if (a.fade) release = fading || a.t > 1.1;   // a fadeaway needs the body drifting or leaning away at the moment of release
      else release = true;
    }
    if (release) { c.aim = null; c.jump = false; c.wait = react * 0.5; return c; }
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
    if (hold.dunkReady && foeUp && level >= 4 && hold.t < (X.m6 ? 3 : 2.2) && (X.m6 || c.rng() < 0.5 + skill * 0.4)) { c.wait = react * 0.3; say(c, 'WAITING OUT THE RIM PROTECTOR'); return c; }
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
    const qi = inRange ? quality(c, w, T, p) : { q: 0, width: 0 }, q = qi.q;
    const patience = Math.min(L.patience || PATIENCE, T.ai_hold_limit - 0.7);       // (the hold limit decides sooner than any level would)
    const urg = clamp((hold.t - 1.0) / Math.max(0.5, patience - 1.0), 0, 1);     // urgency: the longer it holds, the more it must act (there is no shot clock any more: a person may hold forever)
    const pts = Math.min(ownHalf ? 2 : 1, sit.toWin);                               // a basket past the winning mark is worth no more
    const noise = L.noise * st.wild;
    const ops = [];
    const add = (name, u, run, txt, minTicks = 0) => {
      let v = u + (c.rng() * 2 - 1) * noise;
      if (c.plan && c.plan.name === name && c.tick < c.plan.until) v += 0.15;      // a decision cooldown: it does not flip-flop
      ops.push({ name, u: v, run, txt, minTicks });
    };

    // ---- the shots (a Legend takes only perfect lines)
    const forgive = clamp(0.85 + qi.width * 2.5, 0.85, 1.15);   // a wide on-target window is an easier shot
    const pBase = (q === 2 ? lerp(0.5, 0.93, skill) : q === 1 ? lerp(0.25, 0.55, skill) : 0.05) * (ownHalf ? 0.8 : 1) * (q ? forgive : 1);
    // roles (a tilt, never a rule): the man nearer the rim is the front man and leans to the drive; the one
    // behind his teammate leans to the shot from out there. (Both men move on the one key, so this is a taste.)
    const mateGap0 = mate ? (atk.cx - mate.torso.position.x) * dir : 1e9;
    const role = !mate ? 0 : gap < mateGap0 ? 1 : -1;          // +1 front, -1 back
    const roleTilt = 0.07 * X.W.role * (level >= 3 ? 1 : 0);
    // a rim protector at home (on the floor under our rim): the drive is worth less, a shot over him a little more
    const rimHome = level >= 3 && foes.some(f => Math.abs(f.torso.position.x - atk.cx) < T.contest_range && f.sinceGround < 0.05);
    // under (or beyond) the basket it DEFENDS: it never shoots from there, it always passes the ball out
    const underOwn = underOwnRim(c, w, T, px);
    // a Legend or Mythic waits for a perfect line, but not for ever: after 1.5 s it takes a line that can go in
    const takesShot = inRange && !underOwn;   // every level takes good shots; a Mythic still prefers a perfect line (perfectOnly)
    const anyTarget = inRange && q >= 1 && !underOwn;            // some line from here can go in (a Legend's may not be perfect)
    const startAim = (kind, txt, forced = false) => () => {
      const noiseOff = (c.rng() * 2 - 1) * span * 0.55 * L.error;
      const slipped = slip(c, X, 0.5);            // a rushed or misread shot: aimed well off, whoever it is
      c.foeReact.cocks++;
      // how likely a pump is: only from level 4; more against a defender who has jumped at its shots before; a showman likes it
      const rate = c.foeReact.jumps / Math.max(1, c.foeReact.cocks), seen = conf(c.foeReact.cocks, X.K);
      const fk = c.fakes, fakeForm = X.m6 && fk.shots >= 3 ? (fk.made / fk.shots - 0.45) * 0.6 : 0;   // a Mythic does more of what is working
      const fakeP = level >= 2 ? X.W.fake * clamp((L.fakeBase || FAKE_BASE[level - 1]) + 0.6 * rate * seen + 0.2 * (st.flash - 1) + 0.1 * (X.risk - 0.5) + fakeForm, 0, 0.85) : 0;
      c.aim = { t: 0, wait: 0, off: noiseOff + (slipped ? (c.rng() < 0.5 ? -1 : 1) * span * 0.4 : 0), fade: kind === 'fade', pressed: false, txt, fakeRoll: c.rng() < fakeP, forced };
      if (level >= 5 && slipped) c.aim.slip = (c.rng() < 0.5 ? -1 : 1) * 16;
      else if (level >= 6 && q === 2) c.aim.perfectOnly = true;   // a perfect line exists: the Mythic waits for it (see aimStep)
      c.dribs = 0;
      return aimStep(c, X);
    };
    if (takesShot) {
      const pS = pBase * (1 - 0.3 * press);   // (pressure costs a shot less than it did: it shoots through a defender more readily)
      if (ownHalf) {
        const bonus = 0.2 * (st.range - 1) + (sit.behind >= 2 ? 0.15 : 0) + form(c, 'long', X.K) * 0.3 * learnOf(X) + (foeClose ? -0.1 : 0);
        add('long', 0.1 + X.W.shot * pS * pts + bonus + 0.4 * urg + (role < 0 ? roleTilt : 0), startAim('long', 'TAKING A LONG SHOT FOR 2'), 'LONG');
      } else {
        add('shot', 0.1 + X.W.shot * pS * pts + form(c, 'shot', X.K) * 0.3 * learnOf(X) + (screened ? 0.1 : 0) + (baited ? 0.35 : 0) + 0.4 * urg + (role < 0 ? roleTilt : 0) + (rimHome ? 0.05 : 0), startAim('shot', level >= 6 && q === 2 ? 'LINING UP A PERFECT SHOT' : 'GOING UP FOR A JUMP SHOT'), 'SHOT');
      }
      if (level >= 3 && foeClose && Xd < 700) {   // a fadeaway when a defender is on it: the lean takes the ball away from the hand
        const pF = pBase * (1 - 0.2 * press) * 0.92;
        add('fade', 0.1 + X.W.shot * pF * pts + 0.18 * (st.flash - 1) + 0.1 + (baited ? 0.35 : 0) + form(c, 'fade', X.K) * 0.3 * learnOf(X) + 0.4 * urg, startAim('fade', 'FADING AWAY FROM THE DEFENDER'), 'FADE');
      }
    }

    // ---- under or behind the basket: nothing works from there (no dunk, no shot), so it gets the ball out to the teammate
    const behind = gap < T.dunk_min_gap + 10;
    // ---- the dribble: it likes it. It brings the ball upcourt toward a dunk and keeps defenders guessing
    const maxDribs = maxDribsOf(level);
    const zone = T.dunk_ground_x;
    // a HARD cap: this possession's budget (BUDGETS, rolled when the ball is won), and never from a seated player
    if (c.dribs < Math.min(maxDribs, c.budget) && gap > zone + 40 && !behind && !underOwn && !Physics.seated(w, p, T)) {   // (under our own rim it passes, never dribbles)
      const progress = clamp((gap - zone) / 500, 0, 1);
      const reach = foeNear ? 0.3 : foeClose ? 0.6 : 0.85;
      let u = X.W.dribble + 0.5 * clamp(st.attack * 0.62, 0, 1) * reach * (0.4 + 0.6 * progress);   // the standing taste for it is W.dribble
      u -= (1 - X.risk) * 0.35 * X.W.risk * (foeNear ? 1 : foeClose ? 0.4 : 0);                           // a steal risk, dearer to a careful player
      u -= 0.015 * c.dribs + 0.5 * urg;
      if (X.protect) u += 0.1;                                                                  // ahead near the end: run the clock
      u += (role > 0 ? roleTilt : 0) + 0.25 * form(c, 'dunk') * learnOf(X) - (rimHome ? 0.1 : 0);    // the front man drives; my dunks going in (or not) move it
      // dribbles of mine lost near a defender: dribbling into one is worth less (learned)
      const dl = c.dribRec, lossRate = dl.n ? dl.lost / dl.n : 0;
      if (foeClose) u -= 0.5 * lossRate * conf(dl.n / 3) * learnOf(X) * (foeNear ? 1 : 0.5);
      add('dribble', u, () => { c.bounce = true; c.bholdT = tap; c.dribs++; c.dribRec.n++; say(c, gap > zone + 160 ? 'DRIBBLING UPCOURT FOR A DUNK' : 'DRIVING TO THE RIM'); return c; }, 'DRIB', 24);
    }

    // ---- the self-pass, from about halfway to the rim: it throws the ball ahead, hops after it, takes it out of the air near the rim
    // itself and dunks (about 7 in 10 from 310-400 px out in the empty-lane test; further out the catch comes too late). It needs a
    // clear lane: the ball is loose on the floor on the way, so nobody may stand between it and the rim.
    if (X.selfPass && !behind && c.tick > c.selfCool && p.sinceGround < 0.1 && gap >= 310 && gap <= 420 && !foes.some(f => { const fx = (f.torso.position.x - px) * dir; return fx > 20 && fx < gap + 40; })) {
      const ss = c.selfStats, rate = ss.tries >= 3 ? ss.dunks / ss.tries : 0.45;   // its own record with the play
      const u = 0.9 + 0.6 * (rate - 0.4) * conf(ss.tries, 2) + 0.2 * (st.flash - 1) + 0.2 * (st.attack - 1);
      add('self', u, () => {
        const ch = c.selfCharge || 0.8 - 0.05 * clamp((gap - 380) / 40, 0, 1);   // (measured: 0.8 from 310-380 px out, 0.75 a little further; selfCharge lets a test override it)
        c.selfLast = { gap: Math.round(gap), ch };
        c.bounce = true; c.bholdT = ch * T.bounce_charge_time; c.dribs = 0; c.selfCool = c.tick + 120; c.selfStats.tries++;
        c.self = { t0: c.tick, from: p, thrown: false };
        say(c, 'SELF-PASS: THROWING IT AHEAD', true); return c;
      }, 'SELF');
    }

    // ---- the pass
    let catchableMate = false;
    if (mate && level >= 2) {
      const mx = mate.torso.position.x, mateGap = (atk.cx - mx) * dir;
      const open = clamp(Math.min(...foes.map(f => Math.abs(f.torso.position.x - mx))) / 220, 0, 1);
      const mateAhead = (mx - px) * dir > 40;
      const adv = clamp((gap - mateGap) / 300, -0.5, 1);
      const mateAtRim = mateGap >= T.dunk_min_gap && mateGap <= T.dunk_reach_x * T.oop_bonus;
      const runner = mateAhead && adv > 0.5 && !foes.some(f => (f.torso.position.x - mx) * dir > 0 && (atk.cx - f.torso.position.x) * dir > -10);   // a fast break: nobody back
      const passTo = txt => () => {
        c.bounce = true; c.dribs = 0;
        c.bholdT = passHold(T, Math.abs(mx - px)) * (1 + (c.rng() * 2 - 1) * (1 - skill) * 0.18);   // the lower levels throw a little wide
        if (slip(c, X, 0.5)) c.bholdT *= 1 + (c.rng() < 0.5 ? -1 : 1) * (0.08 + 0.3 * (1 - skill));   // a slip: well wide (a Legend: a touch)
        say(c, txt, true); return c;
      };
      // PASS GATE (a pass to nothing is a wasted possession, so it is a last resort, and only to a man who can take it):
      //  - never when a dunk or a jump shot that can go in exists (dunkReady already returned above; here the shot, and a dunk
      //    the carrier is about to be in the zone for). Only when no line works (q === 0: out of range / nothing on target,
      //    or a Legend with no perfect line, which takesShot already excludes)
      //  - the ball is thrown forward only (physics bounce: p.dir), so the teammate must be AHEAD of the carrier, never behind
      //    him (that includes a carrier stuck behind the basket: he has no way to throw it back)
      //  - within the throw: passHold tops out at ~420 px of travel (a runner coming onto it gets a little more), and
      //    not so close that the ball is out of the hand box; and on the ground (a jumping man cannot take a floor pass)
      const shotViable = takesShot && q >= 1, dunkSoon = !behind && gap < zone + 60 && hold.t < 2.4;
      const reachX = (mx - px) * dir + (X.m6 ? clamp(mate.torso.velocity.x * dir * 18, -50, 90) : 0), maxPass = 440 + (runner ? (X.m6 ? 170 : 120) : 0);   // (the Mythic leads the receiver by where he is running)
      const catchable = mateAhead && reachX >= 60 && reachX <= maxPass && mate.sinceGround < 0.12;
      catchableMate = catchable && Math.abs(mx - px) < 800;
      // how good each spot is: mine (the shot I have, or the dunk I am about to get) against his (open, and near
      // enough the rim to dunk or shoot). A carrier in a bad spot gives it up to a teammate in a better one.
      const mine = Math.max(takesShot ? pBase * pts * (1 - 0.3 * press) : 0, dunkSoon ? 0.8 : 0);
      const theirs = open * (mateGap >= T.dunk_min_gap && mateGap <= zone + 60 ? 0.85 : clamp(1 - mateGap / 700, 0, 0.7));
      const better = theirs > mine + 0.3 && open > 0.5, pressedPoor = foeNear && !anyTarget && !dunkSoon;   // (a clear gain only: a pass is a turnover risk)
      if (Math.abs(mx - px) < 800) {
        if (catchable && (underOwn || (!shotViable && !dunkSoon) || pressedPoor || better)) {
          let u = (behind ? 0.7 : 0.18) + 0.3 * Math.max(0, theirs - mine) + (pressedPoor ? 0.1 : 0) + 0.42 * open * Math.max(0, adv) + 0.28 * pressure * open * (mateAhead ? 1 : 0.3) + 0.2 * (st.pass - 1) - (1 - X.risk) * 0.3 * X.W.risk * (1 - open) + 0.4 * urg;
          u *= X.W.pass;
          let txt = better || pressedPoor ? 'PASSING OUT OF A BAD SPOT' : 'PASSING TO THE OPEN TEAMMATE';
          if (runner && hold.t < 2.5) { u += 0.3 * st.scav; txt = 'FAST BREAK: FEEDING THE RUNNER'; }
          if (underOwn) { u = Math.max(u, 1.2); txt = 'OUTLET PASS FROM UNDER OUR RIM'; }   // under the basket it defends: always out
          add('pass', u, passTo(txt), 'PASS');
        }
        // the alley-oop: a teammate waits near the rim, so the ball is lobbed up onto the backboard above it for him to take out of the air
        // the alley-oop: the carrier goes up and lobs it onto the backboard above the rim; the teammate's jump is timed to it
        // (the physics plans his take-off, as it does a dunk's), and he dunks it out of the air
        const lobSafe = !L.lobGuard || !foes.some(f => Math.abs(f.torso.position.x - atk.cx) < L.lobGuard);   // a defender under the board would take it
        if (level >= 4 && lobSafe && !underOwn && mateAhead && gap > 160 && Physics.lobPlan(w, T, p, 1, 110) && Physics.lobReceiver(w, T, p)) {
          add('lob', X.W.lob * (0.78 + 0.35 * open + 0.25 * (st.pass - 1) + 0.25 * (st.flash - 1) + 0.3 * (L.skill - 0.5) + (runner ? 0.15 : 0) + (X.m6 ? form(c, 'dunk', X.K) * 0.3 : 0)),
            () => { c.aim = { t: 0, wait: 0, off: 0, fade: false, pressed: false, lob: true, txt: 'ALLEY-OOP: LOBBING IT OFF THE BOARD' }; c.dribs = 0; return aimStep(c, X); }, 'LOB');
        }
      }
    }

    // ---- the outlet, when nobody is ahead to take a pass: under the basket it defends (it never shoots from there), or
    // stuck lining up with nothing on target. A Legend or Mythic throws it ahead and goes after it (a self-pass);
    // below that it throws a medium pass off the wall and plays the rebound.
    const outlet = () => {
      c.bounce = true; c.dribs = 0;
      if (level >= 5) {
        c.bholdT = clamp(0.55 + gap / 1400, 0.6, 0.85) * T.bounce_charge_time; c.selfCool = c.tick + 120; c.selfStats.tries++;
        c.self = { t0: c.tick, from: p, thrown: false };
        say(c, 'SELF-PASS: THROWING IT AHEAD', true);
      } else { c.bholdT = 0.55 * T.bounce_charge_time; say(c, 'PASSING IT OFF THE WALL', true); }
      return c;
    };
    if (underOwn && !catchableMate) add('outlet', 1.0, outlet, level >= 5 ? 'SELF' : 'WALL');
    else if (hold.t > patience + 0.5 && !anyTarget && !catchableMate && !ops.some(o => o.name !== 'wait')) add('outlet', 5, outlet, level >= 5 ? 'SELF' : 'WALL');   // (no other option left: in place of the forced shot)

    // ---- waiting: near or under the rim and not yet dunk-ready no shot works, so the swing carries it into the zone
    const inZone = !behind && gap < zone + 60 && hold.t < 2.4 && !(far.err !== null && gap > zone + 20 && level < 3);
    add('wait', inZone ? 0.78 - 0.5 * urg : 0.14 - 0.3 * urg, () => { c.wait = react * 0.5; say(c, inZone ? 'WAITING FOR THE DUNK' : 'LOOKING FOR AN OPENING'); return c; }, 'WAIT', 12);

    // the way out: held too long with nothing but waiting on offer (a Legend with no perfect line, nobody to pass to, dribbles used up):
    // with no shot clock to force it, it takes the shot anyway rather than stand there
    if (hold.t > patience + 0.5 && anyTarget && !ops.some(o => o.name !== 'wait')) add('shot', 5, startAim('shot', 'TAKING THE SHOT: NOTHING ELSE IS OPEN', X.m6), 'FORCED');
    if (behind) say(c, 'BEHIND THE BASKET: GETTING OUT OF IT');
    ops.sort((a, b) => b.u - a.u);
    c.dbg.ops = ops.map(o => [o.txt, +o.u.toFixed(2)]);
    let best = ops[0];
    // and past its patience, waiting never wins, even when something else is on offer but scores lower (a dribble
    // past its budget, say: that is how iteration 28 stalled, and how this one did at seed 128 before this line):
    // it takes the best thing that is not waiting
    if (best.name === 'wait' && hold.t > patience + 0.5) best = ops.find(o => o.name !== 'wait') || best;
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
    const tn = tendencies(prof, X.K);
    const mate = w.players.find(q => q.team === foe.team && q !== foe);
    const crowded = w.players.some(q => q.team === c.team && Math.abs(q.torso.position.x - fx) < 110);
    const mateAhead = mate && (mate.torso.position.x - fx) * dir > 40;
    th.pass = hold.bouncing && hold.bcharge >= T.dribble_threshold ? 1 : clamp(0.1 + tn.passShare * tn.cPass * 0.5 + (crowded && mateAhead ? 0.25 : 0), 0, 0.7);
    return th;
  }

  /** Where it wants to stand: between the carrier and its rim, nearer the rim the more they dunk, nearer them the more they shoot long. */
  function stanceTarget(c, X, foe, th) {
    const { prof, dfn, L } = X, tn = tendencies(prof, X.K), adapt = adaptOf(X);
    let frac = X.W.stand;
    frac += adapt * (tn.cDunk * tn.dunkShare * 0.4 - tn.cShot * tn.longShare * 0.3);
    if (th && th.dunk !== null && th.dunk <= L.sagWithin) frac = Math.max(frac, 0.6);   // a dunk is coming: sag back to the rim
    // a carrier running at the rim from a way off: get under it early, the swing is slow (they cannot be caught after)
    const toRim = (dfn.cx - foe.torso.position.x) * foe.dir;
    if (L.look >= 22 && toRim > 0 && toRim < 420 && foe.torso.velocity.x * foe.dir > 0.4) frac = Math.max(frac, 0.55);
    if (L.rimGuard && toRim > 0 && toRim < L.rimGuard) frac = Math.max(frac, L.guardFrac - adapt * tn.cShot * tn.longShare * 0.25);   // near the rim: defend it (less so against a man who shoots long)
    if (X.m6) frac += adapt * 0.12 * clamp(prof.drive, 0, 1) * conf(prof.dribbles, X.K);   // the Mythic has seen which way they drive: a driver is met nearer the rim
    frac -= c.press * 0.15;                                                       // pressure that works: closer
    frac += (0.5 - X.st.risk) * 0.12;                                             // a careful mind sags, a bold one steps up
    // where they like to shoot from (learned): inside that range, step up to the shooter rather than sit on the rim
    const fx = foe.torso.position.x, dist = Math.abs(dfn.cx - fx), sd = prof.shotDist;
    const inTheirRange = tn.cShot > 0.3 && sd > 0 && dist > sd * 0.6 && dist < sd * 1.2 + 40;
    if (inTheirRange && !(th && th.dunk !== null)) frac -= adapt * tn.cShot * 0.14;
    frac = clamp(frac, 0.08, 0.7);
    // where they are going, not where they are; against a carrier who keeps driving at the rim (learned) it leads further
    const towardRim = foe.torso.velocity.x * foe.dir > 0;
    const driveLead = 1 + (towardRim ? adapt * clamp(prof.drive, 0, 1) * 0.6 : 0);
    const lead = L.look > 0 ? foe.torso.velocity.x * Math.min(L.look, 20) * 0.4 * driveLead : 0;
    return { x: fx + lead + (dfn.cx - fx) * frac, frac, inTheirRange };
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
      if (cand && Math.abs(cand.torso.position.x - rimX) < T.contest_range && defend(c, w, 'swat', true, def * 1.5 * st.guard * press, lag, X)) return jumpUp(0.32, 'SWATTING THE DUNK');
    } else delete c.rolls.swat;
    // the carrier is closing on our rim: from level 3 it sees that coming and is up early, before the prompt
    // (a leap long before the dunk starts comes down before the ball goes up: only the Mythic times it, and leaves the ground `rimLead` steps ahead of the carrier being ready)
    const dunkSoon = hold.dunkReady || (L.rimLead > 0 && th.dunk !== null && th.dunk <= L.rimLead);
    const underRim = mine.some(q => Math.abs(q.torso.position.x - X.dfn.cx) < T.contest_range);   // a leap from across the court gets nothing
    if (defend(c, w, 'rim', dunkSoon && underRim, def * 1.2 * st.guard * press, lag, X)) return jumpUp(0.3, 'READING THE DUNK: UP EARLY');
    // a shot being cocked nearby: from level 4 it times the jump to the release it predicts; lower levels jump at a half-cocked shot
    const stand = stanceTarget(c, X, foe, th);
    const reach = 120 + 90 * Math.min(def, 1) + (stand.inTheirRange ? 40 * adaptOf(X) : 0);   // their favourite spot: closed out from further
    const predicted = th.shoot !== null && th.shoot <= lead;
    const early = L.look < 14 && hold.cocking && hold.charge > 0.4;
    if (defend(c, w, 'contest', (predicted || early) && gap < reach, def * 1.3 * st.guard * press, lag, X)) return jumpUp(0.3, 'CONTESTING THE SHOT');
    // right next to the carrier: raise the arm to get a hand on the ball
    // (never a swipe while the carrier is at the rim: that jump comes down before the dunk, and the rim is left open)
    const atRim = (X.dfn.cx - foe.torso.position.x) * foe.dir < T.dunk_reach_x * 1.5 && th.dunk !== null && th.dunk <= L.sagWithin || hold.dunkReady;
    // its own swipes (learned): ones that keep missing leave it out of position, so it swipes less; ones that work, more
    const sw = c.swipes, swRate = sw.tries ? sw.won / sw.tries : 0.2;
    const swipeK = lerp(1, clamp(0.5 + 2.5 * swRate, 0.5, 1.4), conf(sw.tries / 2, X.K) * Math.min(1, X.L.learn));
    if (defend(c, w, 'swipe', gap < 60 + 50 * Math.min(def, 1) && !atRim, Math.min(def, X.swipeCap) * 0.7 * st.guard * press * swipeK, lag, X)) { sw.tries++; c.swipeAt = c.tick; return jumpUp(0.22, 'GOING FOR THE STEAL'); }
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
    if (defend(c, w, 'timed', hit, Math.min(def, X.swipeCap) * 0.9 * st.guard * (1 + c.press * 0.6), lag, X)) { c.jump = true; c.holdT = 0.2; say(c, 'TIMING THE STEAL', true); return true; }
    return false;
  }

  // ---------------------------------------------------------------- loose ball and positioning

  /** Free ball, or closing down the carrier: hop toward where it matters on the swing. */
  function chase(c, X) {
    const { w, T, hold, ball, level, L, skill, def, lag, react, base, dfn, st } = X;
    let target, txt;
    const dead = 22 + (1 - skill) * 40;
    if (hold) {     // they have it: stand between them and our rim; a pass about to go is met at the receiver
      const foe = hold.p, th = c.threat;
      const stand = stanceTarget(c, X, foe, th);
      const stanceW = level >= 3 ? 1 : level === 2 ? 0.5 : 0;                // a Rookie just chases the carrier
      target = lerp(foe.torso.position.x, stand.x, stanceW);
      const fmate = w.players.find(q => q.team === foe.team && q !== foe);
      if (L.look > 0 && th && th.pass >= 0.7 && fmate) target = fmate.torso.position.x;
      const tn = tendencies(c.profile, X.K), adapt = adaptOf(X);
      txt = th && th.pass >= 0.7 ? 'WATCHING THE PASS'
        : th && th.dunk !== null ? 'PROTECTING THE RIM'
        : adapt > 0.2 && tn.cDunk > 0.5 && tn.dunkShare > 0.45 ? 'GUARDING THE RIM: YOU KEEP DUNKING'
        : adapt > 0.2 && tn.cShot > 0.5 && tn.longShare > 0.5 ? 'DEFENDING DEEP: YOU SHOOT LONG'
        : c.press > 0.4 ? 'PRESSURING YOU: IT IS WORKING' : stanceW > 0 ? 'STANDING BETWEEN YOU AND THE RIM' : 'CHASING THE BALL';
      c.dbg.target = target;
    } else {
      // the ball is loose: where it will come down, with the error a lower level makes in reading it
      if (!c.looseOn) { c.looseOn = true; c.err = (c.rng() * 2 - 1) * (1 - skill) * 110 + (slip(c, X, 0.4) ? (c.rng() * 2 - 1) * (30 + 60 * (1 - skill)) : 0); }   // a misjudged bounce: a Legend's is a few dozen px
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
      if (defend(c, w, 'board', !!highBall, (0.3 + 0.7 * def) * (0.9 + 0.1 * st.scav), lag, X)) { c.jump = true; c.holdT = 0.32; say(c, 'GOING UP FOR THE BOARD', true); return c; }   // a full jump for a high ball
    }
    if (hold && Math.abs(target - p.torso.position.x) < dead) { c.wait = react * 0.25; return c; }   // in position: stand
    const leaningToward = a * s > 0.22 && p.sinceFoot < 0.1;                    // the swing is tipping toward it
    if (leaningToward) { c.jump = true; c.holdT = 0.06 + c.rng() * 0.08; return c; }
    c.wait = (hold ? base * Math.max(0.2, 1.7 - 1.5 * Math.min(def, 1)) : react) * 0.25;           // closing a carrier down: quicker the better the defence
    return c;
  }

  /**
   * Out of time with the ball (the hold limit): a dunk if one is ready, the cocked shot if it is legal, otherwise a
   * pass (charged past the dribble threshold, so neither the seated rule nor the dribble cap can stop it). With the
   * shot cocked the jump stays down while the bounce charges, and both go up together: the bounce goes first.
   */
  function outOfTime(c, X) {
    const { w, T, hold, dt } = X;
    let d = c.deadline;
    if (!d) {
      c.aim = null; c.wait = 0; c.holdT = 0; c.bholdT = 0; c.self = null;
      const kind = hold.dunkReady ? 'dunk' : hold.cocking && !underOwnRim(c, w, T, w.ball.position.x) ? 'shoot' : 'pass';
      d = c.deadline = { hold, kind, step: 0, n: Math.ceil(Math.max(T.dribble_threshold + 0.05, 0.3) * T.bounce_charge_time / dt) + 1, keepJump: hold.cocking };
      say(c, kind === 'pass' ? 'OUT OF TIME: PASSING' : kind === 'shoot' ? 'OUT OF TIME: SHOOTING' : 'GOING UP FOR THE DUNK', true);
    }
    d.step++;
    if (d.kind === 'dunk') { c.jump = d.step === 2; return c; }       // a fresh tap: up for a step, then down
    if (d.kind === 'shoot') { c.jump = false; return c; }             // letting go of a cocked shot shoots it
    if (!hold.barmed && !d.armed) { c.jump = d.keepJump; c.bounce = false; return c; }   // the bounce key must be up once first
    d.armed = true;
    const on = d.n-- > 0;
    c.bounce = on; c.jump = on && d.keepJump;
    return c;
  }

  // ---------------------------------------------------------------- the self-pass

  /**
   * A self-pass is on: it has thrown the ball ahead and the same player goes after it. Each time he is on the floor with the ball
   * ahead of him he hops (a held jump, so the hand gets high); the catch is the physics' own. Caught, he lets go of the key and the
   * ordinary offense takes the dunk if it is in reach (or plays on if not). It gives up when a foe is nearer the ball, the ball is past the rim, or time runs out.
   * @returns {boolean} true when it handled this step
   */
  function selfStep(c, X) {
    const { w, hold, ball, atk, tap } = X, s = c.self, p = s.from, dir = p.dir;
    if (hold) {
      if (!s.thrown) return false;                                           // (still holding it: the throw has not left yet)
      if (hold.p === p) { c.selfStats.caught++; c.selfCaughtAt = c.tick; c.self = null; c.holdT = 0; c.wait = tap; say(c, 'SELF-PASS: GOT IT', true); return true; }   // caught: the key goes up, the offense decides
      c.self = null; c.selfWhy = 'taken'; c.selfEnds.taken = (c.selfEnds.taken || 0) + 1; return false;                       // somebody else has it
    }
    s.thrown = true;
    const bx = ball.position.x, dx = (bx - p.torso.position.x) * dir;
    const foeCloser = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - bx) < 90 && Math.abs(q.torso.position.x - bx) < Math.abs(p.torso.position.x - bx));
    if (c.tick - s.t0 > 160 || !w.pass || w.pass.from !== p || (atk.cx - bx) * dir < -90 || foeCloser) { c.selfWhy = c.tick - s.t0 > 160 ? 'late' : !w.pass ? 'nopass' : w.pass.from !== p ? 'otherpass' : (atk.cx - bx) * dir < -90 ? 'past' : 'foe'; c.selfEnds[c.selfWhy] = (c.selfEnds[c.selfWhy] || 0) + 1; c.self = null; return false; }
    say(c, 'SELF-PASS: HOPPING AFTER IT');
    if (p.sinceGround < 0.1 && dx > 10) { c.jump = true; c.holdT = 0.3; }
    return true;
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

    // a new possession (we hold it, or our dribble or pass is up, after they had it or it was loose): roll its dribble budget
    const lb0 = w.lastBouncer;
    const ours = (hold && hold.p.team === c.team) || (!hold && ((lb0 && lb0.team === c.team && lb0.dribbleT > 0) || (w.pass && w.pass.team === c.team)));
    if (ours && !c.hadBall) { const [lo, hi] = BUDGETS[Math.min(level, BUDGETS.length) - 1]; c.budget = lo + Math.floor(c.rng() * (hi - lo + 1)); c.dribs = 0; c.faked = false; c.possN++; }
    c.hadBall = !!ours;
    // THE HOLD LIMIT: the CPU never holds the ball longer than T.ai_hold_limit. Near it, whatever it was doing, it gets rid of it
    if (hold && hold.p.team === c.team && !w.dunk) {
      if (c.deadline && c.deadline.hold !== hold) c.deadline = null;
      if (c.deadline || hold.t >= T.ai_hold_limit - 0.32) return outOfTime(c, X);
    } else c.deadline = null;
    if (c.aim) return aimStep(c, X);
    if (c.self && c.self.thrown && hold && hold.p === c.self.from) selfStep(c, X);   // caught it: let go of the jump key now, not when its hop runs out
    // a key being held on purpose stays down until its time is up; letting go is the action
    if (c.bholdT > 0) { c.bholdT -= dt; c.bounce = c.bholdT > 0; return c; }
    if (c.holdT > 0) { c.holdT -= dt; c.jump = c.holdT > 0; if (c.holdT <= 0) c.wait = X.react * 0.5; return c; }
    if (c.wait > 0) { c.wait -= dt; return c; }

    if (hold && hold.p.team === c.team) return offense(c, X);             // ---- we have the ball
    if (c.self && selfStep(c, X)) return c;                              // ---- our self-pass is in the air

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
      // past the budget it mostly catches it and thinks again (a taste, not a cap)
      const keepOn = (X.atk.cx - lb.torso.position.x) * lb.dir > T.dunk_ground_x && c.dribs < maxDribsOf(level) && !lb.queued && c.dribs < c.budget;   // (the hard cap)
      // level 4+ taps in rhythm, as the ball rises (a slip taps it on the way down: a sloppy one); below that it taps whenever
      if (keepOn && (level >= 4 ? ball.velocity.y < -0.5 || (ball.velocity.y > 0.5 && slip(c, X, 0.08)) : c.rng() < 0.12)) { c.bounce = true; c.bholdT = tap; c.dribs++; c.dribRec.n++; }
      // a screen: from level 4, with the ball up, the teammate hops toward the defender to cut him off from the carrier
      const mate = w.players.find(q => q.team === c.team && q !== lb);
      const f = w.players.filter(q => q.team !== c.team && (q.torso.position.x - lb.torso.position.x) * lb.dir > 0).sort((a, b) => Math.abs(a.torso.position.x - lb.torso.position.x) - Math.abs(b.torso.position.x - lb.torso.position.x))[0];
      if (level >= 3 && mate && f && Math.abs(f.torso.position.x - lb.torso.position.x) < (L.screenR || 170) && c.rng() < (L.screenP || 0.5) * Math.min(1.3, st.read) * L.skill) {
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
    if (/PUMP FAKE/.test(text)) return 'fake';
    if (/SCREEN/.test(text)) return 'screen';
    if (/STEAL/.test(text)) return 'steal';
    if (/SWATTING|CONTESTING|PROTECTING THE RIM|GUARDING THE RIM|DEFENDING DEEP|STANDING BETWEEN|PRESSURING|READING THE DUNK|WATCHING THE PASS/.test(text)) return 'shield';
    if (/GOING UP TO DUNK/.test(text)) return 'dunk';
    if (/LOB/.test(text)) return 'lob';
    if (/PASS|ALLEY|FEEDING/.test(text)) return 'pass';
    if (/DUNK|RIM PROTECTOR/.test(text)) return 'dunk';
    if (/SHOT|FADING/.test(text)) return 'shot';
    if (/DRIBBL|DRIVING/.test(text)) return 'ball';
    if (/BOARD/.test(text)) return 'board';
    return null;
  }
  /**
   * The intent in a word or two, for the line under the scoreboard (the full sentence stays in the I panel).
   * First match wins, so the specific plays come before the general ones.
   */
  const BRIEF = [
    [/OUT OF TIME/, 'OUT OF TIME'], [/TAKING A GOOD ONE/, 'JUMP SHOT'], [/PUMP FAKE/, 'PUMP FAKE'], [/SELF-PASS/, 'SELF-PASS'], [/OFF THE WALL/, 'WALL PASS'], [/OUTLET/, 'OUTLET PASS'],
    [/FAST BREAK/, 'FAST BREAK'], [/ALLEY-OOP: GOING UP/, 'ALLEY-OOP'], [/LOB/, 'LOB'], [/WATCHING THE PASS/, 'READING PASS'],
    [/MEETING THE PASS/, 'CATCHING'], [/PASS/, 'PASS'], [/SCREEN/, 'SCREEN'], [/STEAL/, 'STEAL'], [/SWATTING/, 'SWAT'],
    [/CONTESTING/, 'CONTEST'], [/READING THE DUNK|PROTECTING THE RIM|GUARDING THE RIM/, 'RIM GUARD'], [/DEFENDING DEEP/, 'DEEP D'],
    [/PRESSURING/, 'PRESSURE'], [/STANDING BETWEEN/, 'GUARDING'], [/RIM PROTECTOR|WAITING FOR THE DUNK/, 'WAITING'],
    [/GOING UP FOR THE DUNK/, 'DUNK'], [/FADING/, 'FADEAWAY'], [/LONG SHOT/, 'LONG SHOT'], [/PERFECT SHOT/, 'LINING UP'],
    [/JUMP SHOT|TAKING THE SHOT/, 'JUMP SHOT'], [/NO PERFECT LINE/, 'DRIBBLE OUT'], [/DRIBBLING/, 'DRIBBLING'], [/DRIVING/, 'DRIVE'],
    [/BOARD/, 'REBOUND'], [/LOOSE BALL/, 'LOOSE BALL'], [/CHASING/, 'CHASING'], [/BEHIND THE BASKET/, 'RESETTING'], [/LOOKING/, 'LOOKING'],
  ];
  function brief(text) {
    if (!text) return '';
    for (const [re, s] of BRIEF) if (re.test(text)) return s;
    return text.split(/[ :]+/).slice(0, 2).join(' ');
  }
  /** The icon to show now and which of its players it goes over (null when it has gone stale or means nothing). */
  function marker(c, w) {
    let icon = c.tick - c.intentSeen < 45 ? iconOf(c.intent) : null;
    if (c.tick - c.fakeAt < 40) icon = 'fake';   // a pump fake is over in a blink: hold its picture a little so it reads
    if (!icon) return null;
    const mine = w.players.filter(q => q.team === c.team), lb = w.lastBouncer, hold = w.hold;
    let who;
    if (icon === 'screen') { const base = lb && lb.team === c.team ? lb : mine[0]; who = mine.find(q => q !== base) || base; }   // the teammate, not the dribbler
    else if (hold && hold.p.team === c.team && icon !== 'shield' && icon !== 'steal' && icon !== 'board') who = hold.p;
    else if (!hold && icon === 'lob' && w.pass && w.pass.team === c.team) who = w.pass.lob && /UNDER/.test(c.intent) ? nearest(w, c.team, w.ball.position.x) : w.pass.from;
    else if (!hold && lb && lb.team === c.team && (icon === 'ball' || icon === 'shot' || icon === 'fake')) who = lb;
    else who = nearest(w, c.team, hold ? hold.p.torso.position.x : w.ball.position.x);
    return who ? { icon, who } : null;
  }

  /**
   * The AI vision panel (I in a match): its options with their scores, what it reads from you, what it has
   * learned about you, and how its own plays are going. One string per line.
   */
  function summary(c, T) {
    const lv = c.lv || levelOf(T), d = c.dbg || {}, pf = c.profile, tn = tendencies(pf), L = LEVELS[lv - 1], lines = [];
    const rec = k => `${c.mine[k].made}/${c.mine[k].att}`, pct = v => `${Math.round(v * 100)}%`;
    const mood = c.mood > 0.25 ? 'HOT' : c.mood < -0.25 ? 'COLD' : 'EVEN';
    lines.push(`LEVEL ${lv} ${L.name}${c.style.name ? '  ' + c.style.name : ''}  MOOD ${mood} (${c.mood >= 0 ? '+' : ''}${c.mood.toFixed(2)})  DRIBBLE BUDGET ${c.dribs}/${c.budget}  SLIPS ${c.slips}`);
    if (d.ops) lines.push('OPTIONS ' + d.ops.map(o => `${o[0]} ${o[1]}`).join('  '));
    if (d.threat) lines.push(`READS  SHOT IN ${d.threat.shoot === null ? '-' : d.threat.shoot}  DUNK IN ${d.threat.dunk === null ? '-' : d.threat.dunk}  PASS ${pct(d.threat.pass)}`);
    lines.push(`LEARNED  SHOTS ${pf.shots} (LONG ${pct(tn.longShare)}, FROM ~${Math.round(pf.shotDist)} PX)  DUNKS ${pf.dunks}  PASSES ${pf.passes}  DRIBBLES ${pf.dribbles}  DRIVES ${pf.drive >= 0 ? '+' : ''}${pf.drive.toFixed(2)}  PRESSURE ${pct(c.press)}`);
    const pr = pf.pressed, op = pf.open;
    lines.push(`YOU PRESSED ${pr.made}/${pr.att}  OPEN ${op.made}/${op.att}  ·  MINE SHOT ${rec('shot')} LONG ${rec('long')} FADE ${rec('fade')} DUNK ${rec('dunk')}  FAKES ${c.fakes.fakes}  SWIPES ${c.swipes.won}/${c.swipes.tries}  DRIBBLES LOST ${c.dribRec.lost}/${c.dribRec.n}`);
    if (c.selfStats && c.selfStats.tries) lines.push(`SELF-PASS  THROWN ${c.selfStats.tries}  CAUGHT BY HIMSELF ${c.selfStats.caught}  DUNKS AFTER ${c.selfStats.dunks}`);
    return lines;
  }

  return { create, update, LEVELS, STYLES, levelOf, tendencies, DEFAULT_WEIGHTS, BUDGETS, iconOf, marker, summary, brief };
})();
