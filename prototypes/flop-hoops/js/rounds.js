// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * Rounds: rolls one round's settings. Pure: it reads only the rng and tune it is given.
 * Every twist applies to both teams alike, and every value is clamped to a playable range.
 */
const Rounds = (() => {
  /** Each twist multiplies (or adds to) the base values; strength scales how far. */
  const TWISTS = [
    { id: 'normal', name: 'Regulation', sub: 'Just basketball. Probably.' },
    { id: 'giant_ball', name: 'Giant Ball', sub: 'Hard to miss. Hard to steer.', ballR: 1.6 },
    { id: 'pea_ball', name: 'Pea Ball', sub: 'Tiny ball, tiny margin.', ballR: 0.65 },
    { id: 'moon', name: 'Moon Gravity', sub: 'Float... float... clang.', grav: 0.55, jump: 1.2 },
    { id: 'heavy', name: 'Heavy Day', sub: 'Everything falls faster.', grav: 1.45, jump: 0.92 },
    { id: 'bouncy', name: 'Super Bounce', sub: 'The ball is pure rubber.', bounceAdd: 0.15 },
    { id: 'flat', name: 'Flat Ball', sub: 'It barely bounces at all.', bounceAdd: -0.36 },
    { id: 'big_heads', name: 'Big Heads', sub: 'Big brains. Big headers.', head: 1.55 },
    { id: 'stilts', name: 'Stilt Legs', sub: 'Tall, proud and tippy.', leg: 1.7 },
    { id: 'stubby', name: 'Stubbies', sub: 'Short legs, low and sturdy.', leg: 0.6, torso: 0.85, jump: 1.08 },
    { id: 'noodle', name: 'Noodle Arms', sub: 'Long reach. Wild slaps.', arm: 1.7 },
    { id: 'tiny_court', name: 'Phone Booth', sub: 'A cramped little court.', court: 0.84 },
    { id: 'wide_court', name: 'Big Barn', sub: 'Room to run.', court: 1.07 },
  ];
  const VENUES = ['gym', 'rooftop', 'beach', 'street'];
  const VENUE_NAMES = { gym: 'School Gym', rooftop: 'Rooftop at Dusk', beach: 'Beach Court', street: 'Night Street' };
  const SKINS = ['#f3cba5', '#e2a77a', '#c4864f', '#93603d', '#62402a', '#f6dcc6'];
  const HAIR = ['#2b1d16', '#6b3d1f', '#e3b04b', '#1d1a2b', '#b5452f', '#efe4cf'];
  const SHOES = ['#ffffff', '#2a2740', '#f4e04d', '#e64b6b', '#7ad0ff'];
  // Each team's hair and hats come from its own pool, so the two teams never share a silhouette.
  const STYLES = [['spikes', 'cap', 'mohawk'], ['puff', 'bun', 'band']];
  const KITS = [
    [{ jersey: '#ff9a3c', shorts: '#d8601f', trim: '#fff1c9' },
     { jersey: '#ffad4a', shorts: '#c9521f', trim: '#2f2a4a' },
     { jersey: '#ff8a3a', shorts: '#b5461b', trim: '#ffe08a' }],
    [{ jersey: '#1fc2b1', shorts: '#118580', trim: '#e9fffb' },
     { jersey: '#2ab4c8', shorts: '#166f8f', trim: '#fff3c4' },
     { jersey: '#27c79b', shorts: '#14796a', trim: '#1d1a2b' }],
  ];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pick = (rng, a) => a[Math.floor(rng() * a.length) % a.length];

  /**
   * Roll the settings for round `round` (1-based).
   * @param {() => number} rng seeded random in [0, 1)
   * @param {number} round round number; round 1 is always Regulation
   * @param {string[]} prevTwists twist ids used last round (never repeated back to back)
   * @param {string} prevVenue last round's venue (never repeated back to back)
   * @param {object} T live tuning values
   */
  function roll(rng, round, prevTwists, prevVenue, T) {
    const twists = [];
    if (round > 1) {
      const pool = TWISTS.filter(t => t.id !== 'normal' && !prevTwists.includes(t.id));
      const first = pick(rng, pool);
      twists.push(first);
      if (round >= 3 && rng() < T.double_twist_chance) {
        const clash = k => (first[k] !== undefined);
        const rest = pool.filter(t => t !== first && !Object.keys(t).some(k => !['id', 'name', 'sub'].includes(k) && clash(k)));
        if (rest.length) twists.push(pick(rng, rest));
      }
    } else twists.push(TWISTS[0]);

    const k = T.twist_strength, j = () => 1 + (rng() * 2 - 1) * T.jitter;
    const mul = key => twists.reduce((m, t) => m * (t[key] !== undefined ? 1 + (t[key] - 1) * k : 1), 1);
    const add = key => twists.reduce((s, t) => s + (t[key] || 0) * k, 0);

    const leg = clamp(mul('leg') * j(), 0.55, 1.8);
    const s = {
      round,
      twists: twists.map(t => t.id),
      title: twists.map(t => t.name).join(' + '),
      sub: twists.length > 1 ? 'Two twists at once!' : twists[0].sub,
      grav: clamp(mul('grav') * j(), 0.5, 1.6),
      jump: clamp(mul('jump') * j(), 0.85, 1.3),
      ballR: clamp(T.ball_radius * mul('ballR') * j(), 17, 52),
      bounce: clamp(T.ball_bounce + add('bounceAdd') + (rng() * 2 - 1) * 0.04, 0.4, 0.95),
      courtW: clamp(T.court_width * mul('court') * (1 + (rng() * 2 - 1) * 0.03), 940, 1240),
      head: clamp(mul('head') * j(), 0.8, 1.65),
      leg,
      torso: clamp(mul('torso') * j(), 0.8, 1.25),
      arm: clamp(mul('arm') * j(), 0.8, 1.8),
      hoop: clamp(0.9 + 0.1 * leg, 0.94, 1.07),
      venue: pick(rng, VENUES.filter(v => v !== prevVenue)),
      deco: Array.from({ length: 24 }, () => rng()),
      kits: [pick(rng, KITS[0]), pick(rng, KITS[1])],
      looks: [0, 1].map(team => {
        const styles = STYLES[team].slice();
        return [0, 1].map(() => {
          const style = styles.splice(Math.floor(rng() * styles.length) % styles.length, 1)[0];
          return { skin: pick(rng, SKINS), hair: pick(rng, HAIR), shoe: pick(rng, SHOES), style, num: 1 + Math.floor(rng() * 99) };
        });
      }),
    };
    s.venueName = VENUE_NAMES[s.venue];
    return s;
  }

  return { roll, TWISTS, VENUES, VENUE_NAMES };
})();
