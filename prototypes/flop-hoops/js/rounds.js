// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * Rounds: rolls one round's settings. Pure: it reads only the rng and tune it is given.
 * Every round plays to the same rules: no modifiers. Only the venue's colours and the players'
 * looks change from round to round.
 */
const Rounds = (() => {
  const VENUES = ['gym', 'rooftop', 'beach', 'street'];
  const VENUE_NAMES = { gym: 'School Gym', rooftop: 'Rooftop at Dusk', beach: 'Beach Court', street: 'Night Street' };
  const SKINS = ['#f3cba5', '#e2a77a', '#c4864f', '#93603d', '#62402a', '#f6dcc6'];
  const SHOES = ['#ffffff', '#2a2740', '#f4e04d', '#e64b6b', '#7ad0ff'];
  const KITS = [
    [{ jersey: '#ff9a3c', shorts: '#d8601f' }, { jersey: '#ffad4a', shorts: '#c9521f' }, { jersey: '#ff8a3a', shorts: '#b5461b' }],
    [{ jersey: '#1fc2b1', shorts: '#118580' }, { jersey: '#2ab4c8', shorts: '#166f8f' }, { jersey: '#27c79b', shorts: '#14796a' }],
  ];
  const pick = (rng, a) => a[Math.floor(rng() * a.length) % a.length];

  /**
   * Roll the settings for round `round` (1-based).
   * @param {() => number} rng seeded random in [0, 1)
   * @param {number} round round number
   * @param {string} prevVenue last round's venue (never repeated back to back)
   * @param {object} T live tuning values
   */
  function roll(rng, round, prevVenue, T) {
    const s = {
      round,
      // the rule values the physics reads: all at their plain base
      grav: 1, jump: 1, ballR: T.ball_radius, bounce: T.ball_bounce, courtW: T.court_width,
      head: 1, leg: 1, torso: 1, arm: 1, hoop: 1,
      venue: pick(rng, VENUES.filter(v => v !== prevVenue)),
      kits: [pick(rng, KITS[0]), pick(rng, KITS[1])],
      looks: [0, 1].map(() => [0, 1].map(() => ({ skin: pick(rng, SKINS), shoe: pick(rng, SHOES) }))),
    };
    s.venueName = VENUE_NAMES[s.venue];
    return s;
  }

  return { roll, VENUES, VENUE_NAMES };
})();
