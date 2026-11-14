# Game Brief: Flop Hoops

## In your words
Build a Complete Basket Random Clone. Act as a senior full-stack game developer specializing in browser-based physics games. Build a fully playable clone of Basket Random, recreating its core gameplay, physics, visual style, controls, and multiplayer experience. The objective is to reproduce the original game's feel as closely as possible while using original implementation code and assets.

1. Core Gameplay: Create a 2D physics-based basketball game featuring: Two teams, each consisting of two characters. One basketball. A basketball court with two hoops, one on each side. Characters with intentionally chaotic, floppy, ragdoll-like physics. Unpredictable jumping, collisions, ball interactions, and movement. First team to reach 5 points wins. Automatic round resets after a basket. A visible scoreboard. The gameplay should capture Basket Random's defining characteristic: simple controls combined with chaotic physics that produce unpredictable and entertaining outcomes.
2. Controls: Implement local multiplayer: Player 1: W to jump. Player 2: Up Arrow to jump. Each player controls both characters on their respective team simultaneously. Characters should jump and interact with the ball through physics-based collisions. Holding a jump key should produce appropriate repeated or variable jumping behavior. Include keyboard input handling that works reliably throughout the match.
3. Physics Engine: Physics is the most important part of this project. Implement: Gravity. Character-body collisions. Ball-to-character collisions. Ball-to-ground collisions. Hoop and backboard collisions. Angular velocity and rotational movement. Ragdoll-like character movement. Impulse-based jumping. Friction and restitution. Realistic ball bouncing with deliberately exaggerated physics. Characters should have articulated or multi-body physics rather than behaving like rigid rectangles. The ball must respond naturally to character impacts, jumps, and environmental collisions. Avoid overly predictable trajectories. The game should feel chaotic but remain controllable.
4. Randomized Rounds: At the beginning of each round, randomly select environmental variations. Include: Different character proportions. Different basketball sizes. Different court dimensions. Different gravity and jump characteristics. Different ball elasticity. Different visual environments. Randomized character appearance. Randomization should create meaningful gameplay variation without making the game unfair or unplayable.
5. Visual Design: Recreate the recognizable minimalist aesthetic of Basket Random. Visual requirements: Simple, colorful 2D graphics. Exaggerated character proportions. Circular or simplified character heads. Distinct team colors. Clearly visible basketball. Basketball hoops with recognizable backboards and rims. Minimalist court background. Smooth animations. Scoreboard positioned prominently at the top. Use Canvas or another suitable rendering technology. Do not use copyrighted assets from the original game. Create original shapes, animations, and visual assets.
6. Game States: Main menu. Start game. Active gameplay. Scoring animation. Round reset. Victory screen. Restart functionality. Include a pause mechanism and a clear indication of whose turn or score is currently leading.
7. Technical Requirements: HTML5, CSS3, JavaScript or TypeScript, Canvas for rendering, Matter.js or an equivalent physics engine. Architecture should separate: physics simulation, rendering, input handling, collision detection, scoring, round randomization, game state management. Consistent physics timestep. Smooth rendering using requestAnimationFrame. Responsive browser layout. No unnecessary dependencies. Clean, modular, maintainable code. No placeholder mechanics. No nonfunctional buttons.
8. Gameplay Polish: character responsiveness, chaotic but believable collisions, basketball trajectory, scoring detection, character-to-character interaction, jump timing, round transitions, overall game pacing. Add small visual effects when scoring, including a brief screen shake and score animation. Add simple sound effects for jumping, ball impacts, and scoring if feasible.
9–10. Run the application, test it, identify problems, and iterate until the game works. Most important: The physics and gameplay should feel recognizably like Basket Random.

Answers: Not a copy: Original in the genre. Build this?: Build it.

After play: Allow for the character to grab the ball. Only allow collisions between enemies, not teammates. Make it look more pixelated. Make the characters look less make them look more just like simplistic. Allow the characters to grab the balls when you press the jump key. Make it so that the amount of time you hold on the jump key coincides with the amount of jump or the height of the jump. Then same thing, you keep holding to fire. Make the characters bobble side to side when they're not currently jumping, and eyes, as well as the cartoonish details, make them look a little bit more blocky. Implement dunking mechanics, as well as fadeaway mechanics, and blocks.

After play: create a hitbox that surrounds the hand of the character, if more than half of the basketball is inside the box, the ball is teleported to the player's hand. Same process if the ball touches the abdomen, but not the foot. make the game speed slower, The player should be rocking forwards and backwards when feet are touching the floor. The vertical coefficient shouldn't be affected as much by the amount of cockback as opposed to the horizontal coefficient. Make the characters much slimmer and the hoops much smaller. Make it really look retro. The characters are currently just accumulating in a little blob at a certain point. If the foot hitbox is touching the floor, keep it grounded instead of slipping and allowing character to fall over eternally and never get back to bobbling back and forth to allow for character movement. Make it so that whenever the player holds on the key and the ball is in hand, the ball is in its cockback firing phase. When the ball is picked up out of air, the movement key needs to be let go, then the ball can be fired. Make the characters not have faces at all, just make them have a squircle shaped heads. The ball should be squircle shaped as well. Arms should be much longer, and shirts shouldn't have detail. we'll add that later.

After play: shorten the height of the rims, and remove all modifiers. make the heads smaller. make it much more retro without as much detail, specifically the background, keep it simplistic like the jerseys. have the ball have a white trail on firing. The trail should be a rainbow if it is perfectly alligned with the goal. Make the firing a bit slower, and the arms beefier now. allow for backwards swinging, the characters should be pivoting off their foot, but swinging both left to right, not only middle to right and slowly slowing down, it should never be slowing down. add some more features you deem fit. the characters are not picking up the balls consistently currently.

After play: make the ball rounder, the hands smaller, the arms shorter, make the court smaller, basketball hoop is of good size. bring ball mechanics back to what they were like earlier. make the human proportions seem to be of someone of about 6'6 height, with +4 wingspan.
Answer: Which earlier ball mechanics: Iteration 2 shots.

After play: make the ball smaller, the hoops a bit larger, and everything should be a lot more blocky, make the characters be thicker. the gameplay loop should be a bit faster now, not as slow. the hoops should be able to fit 1.4 balls.

After play: Preserve existing assets and visual effects. The basketball, basketball rims, and rainbow trail are currently perfect; treat them as locked. Green trail when a shot heading into the basket touches rim or backboard; debug the rainbow trail (it once activated when it should not have); keep the rainbow intact otherwise. Characters 6'4" instead of 6'6", same proportions and style; ball size unchanged. Decouple the horizontal launch from the character's horizontal momentum; keep the vertical launch. New second key to bounce the ball: hold for strength and distance, release to bounce; natural bouncing; dribble and pass to a teammate; must not interfere with shooting. Dunk: available when a carrier is close to the rim (position relative to the rim, not just horizontal distance), with a dunking motion, the ball going in through a controlled motion; no dunks from too far or without the ball. Test shooting, bouncing, passing, dunking, rim and backboard collisions and trail transitions independently.

After play: make it so that when you bounce the ball, the enemies cannot grab it for a short period of time to encourage ball passing between teammates. When "dribbling" if the release period is short enough, the ball should just do a short bounce, and the player should move lean and do small jumps with the ball. make shooting a bit easier and simpler, the ball's trajectory should not be influenced by the momentum of the character: the ball should always follow the same parabolic trajectory to the hoop, even if character is leaning backwards etcetera.

After play: make the perfect effect easier to proc, as in if the ball hits the rim very slightly it counts as a perfect / or make the rim slightly larger and I mean really slightly larger. Make the dunking easier to do, the dunking should prompt when the player has the ball and is near the basket, even when standing on the ground, and it should be a tap of the jump key to proc a dunk, also when passing, the ball should pass through the enemy, (make sure this is a short time frame). add more particles to things, but make the particles feel polished - not just excessive. the ball should be held either at the base of the hand, or on the palm of the hand. currently it's being held on the chest without touching the arm.

After play: make the dunk animation smoother and add a crowd cheer. thicken the ball trail. Make the ball trail green if it is going to score a point, but not cleanly. make the rainbow effect easier to attain by allowing for small imperfections in the ball scoring to still allow for rainbow. make the dribbling more intuitive, do with that as you will. make the ball bouncing mechanism work for dribbling, so basically when you semi-spam press the down direction key, the ball bounces down and the player slides forward adding more and more swaying as they go so that the ball eventually is too hard to control (dribbling shouldn't be preferred, but it should be available), and make it so that if the ball is passed to the other character on the same team, and it hits their legs or chest, it automatically gets picked up. make fadeaway jumpers that are going in a blue trail, make a fire effect around the rim when there's a dunk. Make cold spark machines on the sides that flare up when something happens that is cool (like a fadeaway jumper or a dunk for now)

After play: make the sparks be reddish and orangish. the ball should bounce more on the ground, but bounce the same amount on the brim.

After play: make the court less wide, and the character heads one pixel wider, make the legs one pixel closer to one another, largen the wobbling, to allow for horizontal movement for the player. when the jump key is being held to make the character shoot, the teammate shouldn't be jumping, they should be staying in place.

After play: make the menu more retro with a retro font. add a background for the menu, dropshadow for the text. add animations to the buttons in the menu.

After play: create an AI to play against. Debug the movement to remove erratic launching into the air and into the basket.

**Pitch:** Two wobbly ragdoll ballers a side, one jump key each, swinging on their feet and hurling a squircle ball.

**Genre:** arcade sports (floppy physics sport)

**Controls:** Player 1 W (jump/shoot) and S (bounce/pass), Player 2 Up and Down; each key drives both of that team's players. Planted players swing evenly forward and back about their feet: hop on the swing to move that way. Tap to hop, hold to jump higher. The ball snaps to a hand when over half of it is in the hand box, or when it hits the abdomen (never the feet). With the ball, hold jump to cock back and let go to fire (near the rim: dunk); hold bounce and let go to bounce it forward, short for a dribble, long for a pass; after a catch made with a key down, let go of it once first. Esc or P pauses.

**Question:** Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?

**Hooks:** Players swing back and forth on their feet: the hop's timing is the steering; a perfectly lined-up shot leaves a rainbow trail.

**Intent:** needs 2 players *(you said)*

## Look and references
- Look: really retro: the court drawn at low resolution, snapped to each round's small palette and scaled up under scanlines, with a monospace square-cornered HUD; flat plain backgrounds (sky, one horizon band, floor, centre line); slim faceless characters built like a 6 ft 4 in player with a +4 in wingspan (long legs, small squircle heads, small hands, plain shirts); a rounded ball with a white trail when fired (rainbow on a perfect line); a smaller ball; hoops whose rim fits 1.4 balls, with a taller backboard and deeper net, 10 ft high on a narrower court (860 px); everything chunkier (5 px art pixels, square-cornered outlines, near-square heads, thicker bodies); thick dark outlines; tangerine vs teal teams; a bright orange seamed ball; each round a new venue (school gym, dusk rooftop, beach, night street court) in its own two-tone palette, background darker and calmer than play; signature: the rainbow trail of a perfectly lined-up shot. Every figure drawn, no emoji, no plain circles. *(inferred (strong))*
- References: the floppy one-button basketball genre (Basket Random and others) for its feel only: one-key jumps, ragdoll chaos, random rounds.
- View: 2D side view · Camera: static, whole court visible, scaled to the window.

## First minute
The menu reads "W vs ↑"; Start. A round card flips: "Normal ball". Each player taps; both their ballers hop and tip forward, arms swinging. The ball drops at centre; someone headbutts it, it clangs off a rim, a scramble, and a flailing arm knocks it in: the screen shakes, the score pops, and a new card flips in, "Giant ball!".

## Challenge
Every touch is contested from second one: the skill is timing your hop against theirs. A conceded basket costs a point and resets the court. Every round plays to the same rules; a team two points behind hustles with higher jumps.

## Core loop
- Time hops to tip and shove the ball toward the opponent's hoop
- Score → score animation → round reset with new random settings
- First to 5 → victory screen → rematch

## Goal & fail state
- Win: first team to 5 baskets. Lose: the other team reaches 5 first.

## Features
- [x] Multi-body ragdoll players (head, torso, arms, legs) on one key per team
- [x] Ball physics with ground, player, rim and backboard collisions
- [x] Basket detection, scoreboard, score animation, screen shake, round reset
- [x] Rounds: same rules every round (no modifiers); venue colours and player looks change
- [x] Menu, pause, victory screen, restart: in the game's own 5x7 pixel font with drop shadows, over a retro sunset-and-grid backdrop on the title; buttons bob, lift with a blinking pointer on hover or focus, and squash when pressed; arrows or W/S and Enter pick
- [ ] Synth sounds: jump, bounce, rim, swish; mute
- [x] Fixed physics timestep, requestAnimationFrame render, responsive canvas
- [x] Catch: hand hitbox (over half the ball inside) or abdomen contact snaps the ball to the hand; feet never catch
- [x] Hold with the ball to cock back, let go to fire; a catch made with the key down needs one let-go first; cock-back grows forward speed far more than height
- [x] Jump height follows how long the key is held
- [x] Blocks and steals by defenders; a shot taken drifting or leaning away is called a fadeaway (same arc)
- [x] Only opponents collide; teammates pass through each other
- [x] Planted players pivot on their feet, swinging evenly forward and back (±0.55 rad) at a beat that never fades, so a well-timed hop carries them far; fallen players get back up
- [x] While a team has the ball, its key moves only the carrier: the teammate stays planted
- [x] VS CPU mode: the computer plays the Tealbacks with the same two keys a person has (hops on the swing to the ball, shoots by distance with some error, taps to dunk, jumps to block, sometimes passes); 2 PLAYERS mode on one keyboard
- [x] No erratic launches: the planted swing takes over only near upright and turns no faster than itself; a tumbling body's hop is steered no harder than a full swing; body parts capped at 22 px/step outside dunks; hops carry by the lean (hop_reach)
- [x] Shots: one arc per cock-back and spot (forward 3.5-14, up 11-13, 1 s cock-back); lean, drift and momentum change nothing; strong aim help toward the rim's centre
- [x] Bounce key: hold to wind up, let go to bounce the ball forward as a pass; a pass slips through opponents for 0.3 s and they cannot catch it for 0.6 s
- [x] Dribble: tapping the bounce key bounces the ball at the feet while the player slides forward; each tap in a row adds sway and bounce error until the ball gets away (about 14 taps)
- [x] Dunk: with the ball near your hoop, standing or flying, TAP TO DUNK shows; a tap of the jump key dunks: the ball arcs in over the rim and the dunker is carried up to it
- [x] Quicker pace than iteration 4 (game speed 0.9, shorter round card and celebration); players eased apart so they never pile into one blob
- [x] Fired ball trail (thicker): white; rainbow on a perfect line or when it scores with at most a soft touch; green when it scores after a real touch; blue for a fadeaway heading in
- [x] The ball is held in the palm, just past the hand, whatever the arm's angle at the catch
- [x] Particles, few and short: landing and bounce dust, rim sparks, net flecks, a dunk burst, tidier score confetti
- [x] Dunk: eased, smoother motion with a short hang on the rim; the rim burns for a moment after
- [x] Spark machines at both court edges fountain warm red and orange sparks on a dunk or a made fadeaway; a crowd cheers every basket, louder for dunks and perfect shots
- [x] A pass that hits the teammate's legs or chest is picked straight up
- [x] The ball bounces livelier off the floor (floor_bounce 0.92) while rim and backboard bounces stay as they were
- [x] SWISH and PERFECT SWISH baskets; HUSTLE higher jumps for a team 2+ points behind; pickup flash
- [x] Catches checked every step: larger hand box, abdomen overlap

## Your systems
- ragdoll physics · in the slice
- round venues and looks · in the slice
- local 2-player · in the slice
- CPU opponent · in the slice
- menus and game states · in the slice
- ball handling (grab, shoot, dunk, fadeaway, block) · in the slice

## Keep
- the basketball *(you said)* · pins: ball_radius 21, ball_shape 2.6
- the basketball rims *(you said)* · pins: rim_ball_ratio 1.4, rim_span_min 40, rim_height 235, board_height 135
- the rainbow trail *(you said)* · pins: trail_length 18, perfect_window 0.25

## Avoid
- Basket Random's name, art, characters and UI
- Round modifiers (removed after play)

## Out of scope
- Online play: needs a server, not built yet (two players on one keyboard instead)
- Leagues and seasons: grow it

## Build order
1. One full match: ragdolls, ball, hoops, scoring to 5, random rounds, menu, pause, victory.

---
**Kill condition:** if after two tuning rounds the jumps feel random instead of chaotic-but-steerable.

**Who it's for / what they feel:** two friends on one keyboard laughing at an unlikely dunk.

**Games you love / don't:** "a clone of Basket Random" (you said).
