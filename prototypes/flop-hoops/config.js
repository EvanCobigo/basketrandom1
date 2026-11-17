// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (index.html); the tweak panel, an add-on, writes them back here.
// Physics units follow Matter.js: px, and px per step / rad per step for speeds (60 steps a second).
window.CONFIG = {
  seed: 1, // every gameplay random call reads rng(), seeded from this (or ?seed= in the address)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // ---- Match ----
  win_score: { value: 12, min: 1, max: 30, step: 1 },         // points to win (long shots score 2, everything else 1)
  ai_level: { value: 3, min: 1, max: 6, step: 1 },               // CPU difficulty: 1 Rookie, 2 Amateur, 3 Pro, 4 All-Star, 5 Legend, 6 Mythic (what each does is in js/ai.js)
  ai_hold_limit: { value: 2.5, min: 1, max: 5, step: 0.1 },    // s the CPU may hold the ball before it must shoot, dunk or pass (people have no limit)
  ai_own_rim_zone: { value: 70, min: 0, max: 300, step: 10 },  // px either side of the rim it defends where the CPU never shoots (it passes out instead)
  ai_dribble_reach: { value: 20, min: 0, max: 200, step: 5 },  // px: the most one CPU dribble carries the ball and the dribbler toward the rim it attacks (0: no limit)
  ai_no_dribble_dunk: { value: 1, min: 0, max: 1, step: 1 },   // 1: a CPU player who has dribbled may not dunk until the ball leaves him (a pass, a self-pass, a shot)
  ai_fade_room: { value: 260, min: 0, max: 600, step: 10 },     // px the CPU needs between it and the rim it defends to fade away (the fade drifts back)
  ai_lob_guard: { value: 150, min: 0, max: 400, step: 10 },     // px: a defender this near the board stops a CPU alley-oop lob (levels 4+)
  game_speed: { value: 0.9, min: 0.3, max: 1.2, step: 0.02 }, // physics steps per real step: below 1 is slower
  card_time: { value: 1.0, min: 0.5, max: 4, step: 0.1 },      // s the round card shows before play
  replay_clips: { value: 5, min: 0, max: 10, step: 1 },           // best moments shown in the replay after a match (0 = none)
  replay_slow: { value: 0.35, min: 0.1, max: 1, step: 0.05 },      // replay speed around the big moment (1 = normal)
  replay_label_repeat: { value: 18, min: 0, max: 60, step: 1 },     // reel: points off a moment for each one of the same name already picked
  replay_kind_repeat: { value: 12, min: 0, max: 60, step: 1 },      // reel: points off for each one of its family already picked (dunk, shot, defence, fake, flashy)
  score_time: { value: 1.4, min: 0.8, max: 4, step: 0.1 },     // s of celebration after a basket
  stall_time: { value: 3.5, min: 2, max: 10, step: 0.5 },      // s a still ball waits before a re-drop

  // ---- Jumping (one key) ----
  jump_height: { value: 210, min: 60, max: 320, step: 5 },     // px a fully held jump rises
  jump_tap_frac: { value: 0.6, min: 0.3, max: 1, step: 0.02 }, // share of full take-off speed a tap gives
  jump_hold_time: { value: 0.28, min: 0.05, max: 0.6, step: 0.01 }, // s of holding that lifts a jump to full height
  jump_forward: { value: 1.0, min: 0, max: 8, step: 0.1 },     // px/step push toward the hoop you attack
  jump_chase: { value: 0.9, min: 0, max: 8, step: 0.1 },       // px/step pull toward the play on each hop
  hop_reach: { value: 6, min: 0, max: 12, step: 0.5 },            // px/step sideways a hop gets when leaning a full swing that way
  jump_spin: { value: 0.075, min: 0, max: 0.3, step: 0.005 },  // rad/step forward tip on each jump
  jump_tilt_mix: { value: 0.6, min: 0, max: 1, step: 0.05 },   // 0 = straight up, 1 = along the body
  jump_jitter: { value: 0.08, min: 0, max: 0.3, step: 0.01 },  // +- fraction of random jump strength
  jump_cooldown: { value: 0.32, min: 0.1, max: 1, step: 0.02 },// s between jumps while the key is held
  coyote_time: { value: 0.09, min: 0, max: 0.3, step: 0.01 },  // s after leaving ground a jump still counts
  spread_distance: { value: 100, min: 0, max: 160, step: 2 },   // px apart below which players are eased apart
  spread_push: { value: 0.5, min: 0, max: 2, step: 0.05 },    // px/step of that easing at zero distance

  // ---- Ball handling: grab, shoot, fadeaway, dunk, block ----
  regrab_delay: { value: 0.4, min: 0, max: 1.5, step: 0.05 },   // s before a player who let go can grab again
  palm_offset: { value: 0.55, min: 0, max: 1.2, step: 0.05 },    // ball centre past the hand, in ball radii: held in the palm
  belly_margin: { value: 6, min: 0, max: 30, step: 1 },          // px the abdomen catch reaches past the torso
  hand_box: { value: 78, min: 20, max: 120, step: 2 },          // px side of the square catch box around each hand
  shot_charge_time: { value: 1.0, min: 0.2, max: 2.5, step: 0.05 }, // s of holding to reach full shot power
  shot_vx_min: { value: 3.5, min: 0, max: 15, step: 0.5 },      // px/step forward speed on a quick release
  shot_vx_max: { value: 14, min: 4, max: 24, step: 0.5 },       // px/step forward speed fully cocked
  shot_vy_min: { value: 11, min: 4, max: 20, step: 0.5 },       // px/step upward speed on a quick release
  shot_vy_max: { value: 13, min: 4, max: 22, step: 0.5 },       // px/step upward speed fully cocked (barely more)
  aim_bias: { value: 5, min: -10, max: 15, step: 1 },              // px toward the backboard that the aim help aims past the rim's centre (a swish needs room at the front rim)
  lob_height: { value: 85, min: 30, max: 200, step: 5 },           // px above the rim where an alley-oop lob touches the board (the teammate takes it from the air there)
  shot_assist: { value: 0.6, min: 0, max: 1, step: 0.05 },     // pull toward the speed that drops the ball on the rim's centre (1 = always)
  fade_speed: { value: 0.8, min: 0, max: 5, step: 0.1 },        // px/step drifting away from the hoop that counts
  fade_lean: { value: 0.3, min: 0, max: 1.2, step: 0.05 },      // rad leaning back that counts
  fake_min_charge: { value: 0.05, min: 0, max: 0.5, step: 0.01 }, // cock-back a shot needs for a bounce out of it to be a pump fake
  fake_window: { value: 3, min: 0.5, max: 6, step: 0.1 },         // s after a pump fake that its team's next shot counts as set up by it
  fake_bit_window: { value: 0.6, min: 0.1, max: 1.5, step: 0.05 }, // s after a pump fake that a defender near who leaves the floor has bitten
  fake_bit_range: { value: 220, min: 50, max: 500, step: 10 },    // px sideways from the faker within which a jumping defender has bitten
  dunk_speed: { value: 12, min: 4, max: 24, step: 0.5 },        // px/step the ball is slammed down
  dunk_slot: { value: 4, min: 0, max: 20, step: 1 },              // px above the rim the ball's centre is carried to before the slam
  dunk_arm_dx: { value: 0.55, min: 0.2, max: 0.9, step: 0.05 },   // how far short of the rim (in arm lengths) the dunker tops out
  dunk_arm_ext: { value: 0.9, min: 0.6, max: 1, step: 0.02 },     // how far the arm is stretched at the top (1 = fully)
  dunk_vx_max: { value: 8, min: 2, max: 14, step: 0.5 },          // px/step of sideways speed a dunk jump may need at most
  dunk_apex_vy: { value: 2.5, min: 0.5, max: 8, step: 0.5 },      // px/step of rising speed under which the slam may come (near the top)
  dunk_slot_tol: { value: 6, min: 0, max: 20, step: 1 },          // px of margin inside the rim's opening the ball must be within
  dunk_timeout: { value: 1.1, min: 0.4, max: 2.5, step: 0.05 },   // s a dunk may take before the ball is given up
  dunk_arm_speed: { value: 0.9, min: 0.1, max: 0.9, step: 0.05 },  // rad/step the arm may turn at most while carrying the ball up in a dunk
  dunk_pop: { value: 18, min: 6, max: 40, step: 1 },              // px the ball may be knocked from the hand (by the rim) before it flies free
  dunk_toward_vx: { value: -0.3, min: -3, max: 1, step: 0.1 },    // px/step: an airborne carrier moving away from the rim faster than this gets no dunk
  dunk_lean_min: { value: -0.2, min: -1, max: 0.5, step: 0.05 },  // rad: an airborne carrier leaning back more than this gets no dunk
  contest_range: { value: 150, min: 50, max: 300, step: 10 },     // px from the rim within which a defender's arm goes straight up for a dunk
  swat_speed: { value: 10, min: 3, max: 20, step: 0.5 },          // px/step a dunk blocked by a hand or head is swatted away at
  dunk_min_gap: { value: 24, min: 0, max: 80, step: 2 },          // px a dunker must be from the rim, on the court side (under or behind it never dunks)
  dunk_ground_x: { value: 70, min: 20, max: 160, step: 2 },       // px from the rim a standing carrier may start a dunk
  dunk_reach_x: { value: 110, min: 40, max: 220, step: 5 },       // px from the rim a jump may top out and still dunk
  dunk_fall_limit: { value: 9, min: 0, max: 14, step: 0.5 },      // px/step downward speed above which a falling dunker is too late
  dunk_air_assist: { value: 0.7, min: 0, max: 1, step: 0.05 },    // how strongly a dunk started in the air steers the body over the rim and holds it up (falling dunkers need it)
  dunk_air_slack: { value: 60, min: 0, max: 120, step: 5 },       // px lower than the rim a falling carrier's hand may be and still get the prompt (scaled by the assist)
  lob_reach: { value: 340, min: 150, max: 500, step: 10 },        // px from the rim an alley-oop lob's receiver may stand and still be sent up for it
  give_go_window: { value: 2.2, min: 0.5, max: 4, step: 0.1 },    // s after a pass that the passer's cut can take a return pass as a give-and-go (an alley-oop catch)
  cut_rise: { value: 40, min: 20, max: 160, step: 5 },             // px the passer's cut hop rises as he heads for the rim
  cut_vx_max: { value: 13, min: 2, max: 16, step: 0.5 },            // px/step of sideways speed a cut may take at most
  putback_window: { value: 1.5, min: 0.2, max: 4, step: 0.1 },     // s after a shot that a player catching the miss in the air dunks it straight back (a putback)
  heat_streak: { value: 3, min: 2, max: 8, step: 1 },              // baskets in a row by one player that make him hot (a heat check)
  heat_assist: { value: 0.85, min: 0, max: 1, step: 0.05 },        // a hot player's shot help (instead of shot_assist) until the other team scores
  oop_bonus: { value: 1.3, min: 1, max: 2, step: 0.05 },          // an alley-oop catch gets this much more dunk reach
  dunk_hang: { value: 0.18, min: 0, max: 0.6, step: 0.02 },      // s the dunker hangs on the rim after the slam
  dunk_hang_chance: { value: 0.5, min: 0, max: 1, step: 0.05 },   // chance a tomahawk, windmill or hammer ends hanging on the rim
  dunk_rim_hang: { value: 0.9, min: 0.2, max: 2, step: 0.05 },    // s of hanging on the rim when it happens
  // ---- Dunk animation: every style is a swing of the arm timed to the jump (clock 0 at take-off, 1 at the top) ----
  dunk_dip: { value: 0.45, min: 0, max: 1.2, step: 0.05 },        // rad the arm first dips back, the other way to its swing (anticipation)
  dunk_dip_time: { value: 0.14, min: 0.04, max: 0.3, step: 0.01 }, // share of the jump the dip takes
  dunk_cock_at: { value: 0.25, min: 0.15, max: 0.6, step: 0.01 },  // share of the jump by which the ball is up over the head (later, raised up the front, it snags under the rim)
  dunk_strike_at: { value: 0.72, min: 0.5, max: 1, step: 0.01 },   // share of the jump by which every swing has the ball over the rim (later: short of it more often)
  dunk_strike_steps: { value: 5, min: 2, max: 12, step: 1 },     // steps a tomahawk's or hammer's whip takes, from cocked to over the rim (it starts near the top of the jump)
  dunk_track: { value: 1, min: 0.3, max: 1, step: 0.05 },       // share of the gap to the swing's next angle the arm closes in one step
  dunk_air_steps: { value: 18, min: 8, max: 40, step: 1 },          // steps the swing takes in a dunk started in the air (no planned jump)
  dunk_lean: { value: 0.16, min: 0, max: 0.6, step: 0.02 },         // rad the body leans into the swing: back as the ball goes back, forward into the slam
  tomahawk_cock: { value: 0.45, min: 0, max: 1.2, step: 0.05 },     // rad past straight up a tomahawk cocks the ball behind the head
  hammer_cock: { value: 0.8, min: 0.2, max: 1.4, step: 0.05 },      // rad past straight up a two-hand hammer cocks the ball (far behind the head)
  windmill_start: { value: 1.1, min: 0.3, max: 1.6, step: 0.05 },   // rad in front of straight down a windmill's circle starts (the ball held out in front)
  dunk_follow_angle: { value: 1.0, min: 0, max: 1.8, step: 0.05 },  // rad the arm carries on down through the rim after the slam
  dunk_follow_time: { value: 0.13, min: 0.03, max: 0.4, step: 0.01 }, // s of that follow-through (a hang grabs the rim at 60% of it)
  dunk_hang_pull: { value: 0.18, min: 0, max: 0.6, step: 0.02 },    // how strongly a dunker hanging on the rim is drawn in under his hand
  hammer_flex: { value: 1.7, min: 1, max: 3, step: 0.1 },           // how far a hammer jam bends the rim (1: as far as any other dunk)
  hammer_shake: { value: 1.6, min: 1, max: 3, step: 0.1 },          // times the screen shake of any other dunk a hammer jam gives
  block_window: { value: 0.9, min: 0.2, max: 2, step: 0.05 },   // s after a shot a defender's touch is a block
  block_pop: { value: 8, min: 2, max: 16, step: 0.5 },          // px/step a blocked ball flies back
  strip_speed: { value: 9, min: 3, max: 20, step: 0.5 },        // px/step hit that knocks a held ball loose
  steal_guard: { value: 0.35, min: 0, max: 1.5, step: 0.05 },   // s after a grab nobody can steal it
  bounce_charge_time: { value: 0.8, min: 0.2, max: 2, step: 0.05 }, // s of holding the bounce key for the longest pass
  bounce_vx_min: { value: 0.8, min: 0, max: 10, step: 0.5 },      // px/step forward speed of a quick dribble
  bounce_vx_max: { value: 11, min: 3, max: 20, step: 0.5 },     // px/step forward speed of a full pass
  bounce_vy_min: { value: 4, min: 0, max: 15, step: 0.5 },      // px/step downward throw of a quick dribble
  bounce_vy_max: { value: 6, min: 0, max: 15, step: 0.5 },      // px/step downward throw of a full pass
  bounce_ignore: { value: 0.35, min: 0, max: 1, step: 0.05 },    // s the bouncer's body ignores their own bounce
  dribble_reach: { value: 70, min: 0, max: 160, step: 5 },       // px from the hand a rising dribble is caught back
  bounce_regrab: { value: 0.3, min: 0, max: 1, step: 0.05 },    // s before the bouncer can catch it again
  pass_guard: { value: 0.6, min: 0, max: 2, step: 0.05 },        // s after a bounce that opponents cannot catch it
  pass_ghost: { value: 0.3, min: 0, max: 1, step: 0.05 },        // s a pass passes straight through opponents
  pass_catch_window: { value: 1.5, min: 0.3, max: 3, step: 0.1 },  // s a pass can be taken off a teammate's legs or chest
  oop_window: { value: 1.2, min: 0.2, max: 3, step: 0.1 },         // s after catching a pass that a dunk counts as an alley-oop
  dribble_threshold: { value: 0.25, min: 0, max: 1, step: 0.05 }, // bounce charge below which a release is a dribble
  dribble_vx: { value: 1.6, min: 0, max: 6, step: 0.1 },         // px/step forward speed of a dribble
  dribble_vy: { value: 6, min: 1, max: 14, step: 0.5 },          // px/step downward throw of a dribble
  dribble_time: { value: 0.7, min: 0.1, max: 2, step: 0.05 },    // s the dribbler hops along after a dribble
  dribble_slide: { value: 2.4, min: 0, max: 8, step: 0.1 },       // px/step forward slide while dribbling
  dribble_chain_time: { value: 1.2, min: 0.3, max: 3, step: 0.05 }, // s between dribbles that still counts as one chain
  dribble_error: { value: 0.9, min: 0, max: 3, step: 0.05 },      // px/step of random bounce error per unit of sloppiness
  dribble_safe_chain: { value: 6, min: 1, max: 20, step: 1 },     // dribbles in a row before the chain itself adds wobble
  dribble_rock: { value: 1, min: 0, max: 1.5, step: 0.1 },         // how big the planted swing is while dribbling (1 = as standing, 0 = steady, 1.5 = big wobble; much past that tips the body over)
  dribble_sway: { value: 1.6, min: 0, max: 5, step: 0.1 },        // how much sloppy taps sway the body in the air
  perfect_window: { value: 0.25, min: 0.02, max: 0.5, step: 0.01 }, // share of rim width from centre that counts as a perfect line
  perfect_graze: { value: 3, min: 0, max: 15, step: 1 },         // px a perfect shot may overlap the rim or board (a soft kiss) and still count
  soft_touch: { value: 3, min: 0, max: 10, step: 0.5 },          // px/step: a basket whose rim contact was this soft still counts as rainbow
  trail_width: { value: 1.6, min: 0.5, max: 3, step: 0.1 },        // trail block size, in ball radii
  trail_length: { value: 18, min: 0, max: 60, step: 1 },        // steps of ball trail behind a fired shot
  hustle_gap: { value: 2, min: 1, max: 10, step: 1 },           // points behind before a team hustles
  hustle_jump: { value: 1.15, min: 1, max: 1.6, step: 0.01 },   // jump height multiplier while hustling

  // ---- Ragdoll ----
  gravity: { value: 1.0, min: 0.3, max: 2, step: 0.05 },       // Matter gravity.y
  upright: { value: 26, min: 0, max: 80, step: 1 },            // rad/s^2 per rad pulling the torso upright
  upright_air: { value: 0.35, min: 0, max: 1, step: 0.05 },    // share of the upright pull in the air
  rock_angle: { value: 0.55, min: 0, max: 0.9, step: 0.01 },    // rad of the forward-and-back rock while planted
  rock_rate: { value: 0.75, min: 0.2, max: 3, step: 0.05 },      // rocks a second
  rock_follow: { value: 0.6, min: 0.05, max: 1, step: 0.05 },   // how tightly a planted body tracks its swing
  rock_engage: { value: 0.75, min: 0.3, max: 1.5, step: 0.05 },  // rad of tilt under which the planted swing takes over
  rock_max_turn: { value: 0.05, min: 0.01, max: 0.2, step: 0.005 }, // rad/step the swing may turn the body at most
  rock_max_speed: { value: 8, min: 2, max: 20, step: 0.5 },       // px/step the swing may move any body part at most
  player_max_speed: { value: 22, min: 10, max: 30, step: 1 },     // px/step cap on every body part (not during a dunk)
  getup_time: { value: 0.7, min: 0.1, max: 3, step: 0.05 },     // s lying down before springing back up
  getup_pop: { value: 7, min: 0, max: 15, step: 0.5 },          // px/step upward pop when getting up
  body_width: { value: 28, min: 12, max: 50, step: 1 },         // px torso width
  limb_width: { value: 15, min: 5, max: 20, step: 1 },          // px leg width (arms are 0.8 of it)
  arm_width: { value: 15, min: 6, max: 30, step: 1 },           // px arm thickness
  head_size: { value: 10.7, min: 8, max: 30, step: 0.1 },           // px head half-size
  head_shape: { value: 8, min: 2, max: 12, step: 0.5 },         // head outline exponent: 2 round, 4 squircle, 8+ nearly square
  head_extra_px: { value: 1, min: 0, max: 4, step: 1 },          // art pixels the head is wider than tall
  leg_closer_px: { value: 1, min: 0, max: 3, step: 1 },          // art pixels the legs are pulled together
  arm_length: { value: 62, min: 40, max: 140, step: 2 },        // px shoulder to fingertip: an 82" wingspan less the shoulders, halved
  torso_length: { value: 53, min: 30, max: 90, step: 1 },       // px hip to shoulder (a 6 ft 4 in player at about 2 px per inch)
  leg_length: { value: 86, min: 40, max: 120, step: 1 },        // px floor to hip
  upright_damp: { value: 3.5, min: 0, max: 15, step: 0.5 },    // 1/s damping on torso spin
  leg_stiffness: { value: 0.22, min: 0, max: 1, step: 0.01 },  // how hard legs swing back under the hips
  leg_follow: { value: 0.3, min: 0, max: 1, step: 0.05 },      // 0 floppy legs, 1 rigid legs
  fold_stiffness: { value: 1.35, min: 0.5, max: 3, step: 0.05 }, // how stiff the hips are: above 1 the body folds less and springs back less
  hand_floor_px: { value: 3, min: 0, max: 20, step: 1 },        // px: a hand this close to the floor pushes off it
  hand_push: { value: 0.1, min: 0, max: 0.3, step: 0.01 },     // rad/step: the push a hand on the floor gives, turning the wobble the other way
  seat_margin: { value: 4, min: 0, max: 20, step: 1 },
  rim_heat_time: { value: 2, min: 0.5, max: 6, step: 0.1 },     // s a player can stay on a rim before it is red hot
  rim_cool_time: { value: 1, min: 0.2, max: 5, step: 0.1 },     // s for a red-hot rim nobody is on to cool right down
  rim_gleam_time: { value: 0.45, min: 0.1, max: 1.5, step: 0.05 }, // s of the white gleam before the rim blows
  rim_blast: { value: 16, min: 0, max: 30, step: 0.5 },         // px/step the blast throws everything at its centre outward (less further out)
  rim_blast_radius: { value: 300, min: 50, max: 700, step: 10 }, // px from the rim the blast reaches: players and the ball inside it are knocked away
  arm_up_angle: { value: 2.5, min: 0.5, max: 3.1, step: 0.05 },// rad the arm lifts while the key is held
  arm_cock_angle: { value: 2.95, min: 1.5, max: 3.1, step: 0.05 }, // rad the arm swings back while cocking a shot
  follow_time: { value: 0.45, min: 0, max: 1.2, step: 0.05 },     // s the shooting arm holds its follow-through
  follow_angle: { value: 1.9, min: 0.8, max: 2.8, step: 0.05 },   // rad the shooting arm trails forward after release
  wrist_bend: { value: 1.3, min: 0, max: 1.8, step: 0.05 },       // rad the wrist bends palm-down in the follow-through
  back_arm_guide: { value: 0.3, min: 0, max: 2, step: 0.05 },     // rad the back arm lifts as a guide while shooting
  arm_hang: { value: 0.7, min: 0, max: 1, step: 0.05 },           // how much idle arms hang straight down instead of swinging with the body
  arm_gain: { value: 0.3, min: 0.05, max: 1, step: 0.01 },     // arm motor gain
  arm_max_speed: { value: 0.32, min: 0.05, max: 0.8, step: 0.01 }, // rad/step arm swing limit

  // ---- Ball ----
  ball_radius: { value: 21, min: 16, max: 60, step: 1 },       // px
  ball_shape: { value: 2.6, min: 2, max: 5, step: 0.1 },        // ball outline exponent: 2 round, 4 squircle
  ball_bounce: { value: 0.8, min: 0.3, max: 0.98, step: 0.01 },// restitution
  floor_bounce: { value: 0.92, min: 0, max: 0.98, step: 0.01 },  // floor restitution: above ball_bounce makes the ball livelier off the ground only
  ball_mass: { value: 1.3, min: 0.3, max: 5, step: 0.1 },      // Matter mass units
  ball_kick: { value: 2.6, min: 0, max: 8, step: 0.1 },        // px/step extra pop off any body hit
  ball_lift: { value: 0.9, min: 0, max: 3, step: 0.05 },      // share of each hit's pop sent upward
  ball_spin: { value: 0.18, min: 0, max: 0.6, step: 0.01 },    // rad/step random spin added on hits
  ball_air: { value: 0.004, min: 0, max: 0.03, step: 0.001 },  // air drag
  ball_max_speed: { value: 26, min: 10, max: 40, step: 1 },    // px/step cap, so it never tunnels
  drop_height: { value: 430, min: 200, max: 520, step: 10 },   // px above the floor the ball drops from

  // ---- Court ----
  court_width: { value: 860, min: 700, max: 1240, step: 10 }, // px
  rim_height: { value: 235, min: 200, max: 420, step: 5 },     // px from floor to rim
  rim_span_min: { value: 40, min: 30, max: 160, step: 2 },     // px rim opening (grows with the ball)
  rim_ball_ratio: { value: 1.4, min: 1.05, max: 2, step: 0.05 }, // rim opening as a multiple of the ball's width: 1.4 balls fit
  board_height: { value: 135, min: 60, max: 200, step: 5 },    // px backboard height
  board_inset: { value: 40, min: 20, max: 120, step: 2 },      // px from side wall to backboard


  // ---- Look and juice ----
  particles: { value: 1.5, min: 0, max: 3, step: 0.25 },          // how many particles every effect makes (0 turns them off)
  crowd_rows: { value: 3, min: 0, max: 5, step: 1 },              // rows of fans in the stands
  crowd_gaps: { value: 0.12, min: 0, max: 0.9, step: 0.01 },     // share of empty seats
  crowd_hype_time: { value: 2.2, min: 0.3, max: 6, step: 0.1 },  // s the crowd stays on its feet after sparks fly
  fire_time: { value: 1.1, min: 0, max: 3, step: 0.1 },          // s the rim burns after a dunk
  spark_time: { value: 1.2, min: 0, max: 3, step: 0.1 },         // s the cold-spark machines fire on a dunk or a made fadeaway
  pixel_size: { value: 3.5, min: 1, max: 6, step: 0.5 },           // screen px per art pixel on the court
  palette_snap: { value: 1, min: 0, max: 1, step: 1 },          // 1: snap every court pixel to the round's retro palette
  scanlines: { value: 0.12, min: 0, max: 0.5, step: 0.01 },     // darkness of the CRT scanlines
  vignette: { value: 0.35, min: 0, max: 0.8, step: 0.05 },        // darkness of the screen corners
  dunk_hitstop: { value: 4, min: 0, max: 12, step: 1 },           // frames frozen on a dunk's slam
  shake: { value: 16, min: 0, max: 40, step: 1 },              // px screen shake on a basket
};
