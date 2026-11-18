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

After play: create a settings menu, and make it so that all of these coefficients can be changed. lower pixelation effect. add a live audience in the back that is heads that bob up and down and accentuate with the sparks
After play: improve dribbling mechanic

After play: make it so that shots past the halfway point of the court count for two points, dunks count as one. make it play to 12

After play: add an animation to the shooting where the back arm is extended and lagging back while the front arm trails forward with a bent wrist with palm down (classic shooting form). add different animations to dunks: [Tomahawk Dunk: Cocking the ball back behind your head with one or both hands before violently swinging it down through the rim, Windmill: Swinging the ball in a full circular motion below and behind your waist before snapping it up through the basket, Elbow Hang (The Honey Dip): Hanging on the rim by sliding your entire forearm/elbow inside the basket]. Add a 50% chance to hang on the rim after dunking. when dribbling, make character move slightly forward with each dribble, the ball doesn't interact with the opponents unless it touches the opponent hands (where it can be stolen). once completed, add slight bit more pixilation, and I mean just a small amount. Then add small details to make it more polished. Simple polish that's it. Do whatever you want.

After play: make the dunks slower so the animations are easier to see. make the windmill dunk rotate clockwise not counter clockwise, the arm should stay max length and rotate till the ball is inside the hoop. revert to previous version with the shooting animations, the bent wrist looks perfect, don't change, but keep the arms from swaying too much while not shooting. A realistic jump shot doesn't have much movement from the back arm when shooting. code AI to be able to dribble and do advanced things like alley oop etcetera, but make it scale based on a difficulty slider to choose how hard the ai is and what the functionalities that entail in the main menu.

After play: speed up the dunks a bit. add more particles to things. Simplify the settings menu to make it more player accessible. The dunks should be harder to hit, make it so that you need to be closer to the rim to be able to start a dunk, you cannot be behind the basket, as in you need to be on the side that faces the center of the court, when you're jumping near the rim, the prompt should allow you to dunk, but only if your jump trajectory can coincide with a quality dunk animation.

After play: improve the AI intelligence allowing for more flashy plays that players will enjoy to work around. improve AI targetting. Improve trajectory computation to remove some errors for shooting.

After play: improve the AI intelligence allowing for more flashy plays that players will enjoy to work around. improve AI targetting. Improve ball trajectory computation to remove some errors for rainbow proccing incorrectly. Dunks should be performed only when the player is either on the ground or is moving in a direction leaning towards the rim, if the player is falling backwards, the dunk shouldn't be available. change the font to Departure Mono. add gleam to the buttons when you hover over them, like a small white flash that flashes around the menu button. Change the sound effects to sound more premium. The dunk animation should actually just be a small jump that alligns perfectly with the height required to dunk. The arms should be doing the aiming, but if the arms miss, the ball hits the rim and flies out of the hand. impliment blocking of a dunk, where the defender's hand will stand straight and swat the ball out of the rim bounds, if the ball hits their hand or head.

After play: Shots should be more inaccurate the higher they are in the air while more accurate on ground (CPU only), allow dribbling anywhere on the court. AI's should spend a bit less time in the air but keep their guarding ability. Add a third archetype of AI called street ball which attempts flashier plays. Add more defensive maneuvers. Allow the AI archetype to be chosen in the secondary menu. Improve settings to be more legible and more user friendly.
Answers: Archetype: add STREET BALL as a 9th style and make all styles pickable. Shot accuracy: CPU only. Dribble zone: remove both limits, near-rim dribbles allowed too. Settings: grouped sections, clearer values and toggles, description and preview, mouse friendly.

After play: Add a new two point line where characters dribble towards the 2-point line instead of just dribbling forwards. There should be two of them: for oranges the 2-point line would be the teal side and vice versa. The character always dribbles in the direction of the two-point line. The closer the character is to the two-point line, the easier it is to shoot if they aren't swaying nor jumping. Make the cock-back timer make any length of press lead to goals save the extremities, only for the two point line. Make the line around the halfway point between the basket and the middle line.

After play: Aim assist should only apply when you're near the 2 point line shooting toward the nearest basket, not the 2 point line for the basket your opponent attempts to shoot on.
Answers: Rule: only on the half with the basket you shoot at. Range: tighten to about 180 px. Dribble: leave as it is.

After play: Bug fix and prepare for first release.

After play: Move the backboard a bit backwards so the ball doesn't get stuck up there in the gap. Don't allow dribbling when the hand is touching the floor. Play-test a full match before shipping.

After play: Declutter the main menu. When one button is pressed any other button with the same sprite also plays the click animation: fix that.

**Pitch:** Two wobbly ragdoll ballers a side, one jump key each, swinging on their feet and hurling a squircle ball.

**Genre:** arcade sports (floppy physics sport)

**Controls:** Player 1 W (jump/shoot) and S (bounce/pass), Player 2 Up and Down; each key drives both of that team's players. Planted players swing evenly forward and back about their feet: hop on the swing to move that way. Tap to hop, hold to jump higher. The ball snaps to a hand when over half of it is in the hand box, or when it hits the abdomen (never the feet). With the ball, hold jump to cock back and let go to fire (near the rim: dunk); hold bounce and let go to bounce it forward, short for a dribble, long for a pass; after a catch made with a key down, let go of it once first. Esc or P pauses.

**Question:** Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?

**Hooks:** Players swing back and forth on their feet: the hop's timing is the steering; a perfectly lined-up shot leaves a rainbow trail.

**Intent:** needs 2 players *(you said)*

## Look and references
- Look: really retro: the court drawn at low resolution, snapped to each round's small palette and scaled up under scanlines, with a monospace square-cornered HUD; flat plain backgrounds (sky, one horizon band, floor, centre line); slim faceless characters built like a 6 ft 4 in player with a +4 in wingspan (long legs, small squircle heads, small hands, plain shirts); a rounded ball with a white trail when fired (rainbow on a perfect line); a smaller ball; hoops whose rim fits 1.4 balls, with a taller backboard and deeper net, 10 ft high on a narrower court (792 px); everything chunky (3.5 px art pixels, square-cornered outlines, near-square heads, thicker bodies); thick dark outlines; tangerine vs teal teams; a bright orange seamed ball; each round a new venue (school gym, dusk rooftop, beach, night street court) in its own two-tone palette, background darker and calmer than play; signature: the rainbow trail of a perfectly lined-up shot. Every figure drawn, no emoji, no plain circles. *(inferred (strong))*
- References: the floppy one-button basketball genre (Basket Random and others) for its feel only: one-key jumps, ragdoll chaos, random rounds.
- View: 2D side view · Camera: static, whole court visible, scaled to the window.

## First minute
The menu reads "W vs ↑"; Start. A round card flips: "Normal ball". Each player taps; both their ballers hop and tip forward, arms swinging. The ball drops at centre; someone headbutts it, it clangs off a rim, a scramble, and a flailing arm knocks it in: the screen shakes, the score pops, and a new card flips in, "Giant ball!".

## Challenge
Every touch is contested from second one: the skill is timing your hop against theirs. A conceded basket costs a point and resets the court. Every round plays to the same rules; a team two points behind hustles with higher jumps.

## Core loop
- Time hops to tip and shove the ball toward the opponent's hoop
- Score → score animation → round reset with new random settings
- First to 12 points (long shots 2, everything else 1) → victory screen → rematch

## Goal & fail state
- Win: first team to 12 points. Lose: the other team reaches 12 first. A jump shot released beyond the shooter's own two-point line (halfway between the basket and the centre line) scores 2; dunks, close shots and scrambles score 1.

## Features
- [x] Multi-body ragdoll players (head, torso, arms, legs) on one key per team
- [x] Ball physics with ground, player, rim and backboard collisions
- [x] Basket detection, scoreboard, score animation, screen shake, round reset; shots from beyond the team's two-point line score 2 (+2 TWO-POINTER! with sparks), dunks and everything else 1; first to 12
- [x] Rounds: same rules every round (no modifiers); venue colours and player looks change
- [x] Settings menu (title and pause): every coefficient in config.js by section, with sliders, keys and mouse; saved in this browser; RESET ALL
- [x] A live crowd in the stands: heads bobbing on their own beats, on their feet with arms up when the sparks fly and on every basket
- [x] Menu, pause, victory screen, restart: in the game's own 5x7 pixel font with drop shadows, over a retro sunset-and-grid backdrop on the title; buttons bob, lift with a blinking pointer on hover or focus, and squash when pressed; arrows or W/S and Enter pick
- [ ] Synth sounds: jump, bounce, rim, swish; mute
- [x] Fixed physics timestep, requestAnimationFrame render, responsive canvas
- [x] CPU shots are less accurate the higher the shooter is: a planted shot gets the aim help `ai_ground_assist` (0.95), a shot at the top of a jump `ai_air_assist` (0.4) plus up to `ai_air_miss` px of aim error (50); people are not affected
- [x] The CPU dribbles anywhere on the court, the rims included (`ai_dribble_zone` 0), except under its own rim, where it still passes; people already could
- [x] The CPU spends less of the match in the air: movement hops are shorter (`ai_hop_air`) and rest on the floor after landing (`ai_hop_rest`); closeouts, recoveries and every guarding jump are unchanged (measured: about 46% of steps airborne down to about 36-40% at Pro, guard jumps not reduced)
- [x] STREET BALL, a ninth CPU style: dribbles much more (anywhere, 2 extra dribbles a possession), pump fakes, alley-oop lobs and self-passes more, gambles for steals; flashier and looser than the rest
- [x] More defensive moves: STRIP THE CATCH (a hand goes for a ball only just picked up), RECOVER (a carrier who got past it is chased in long hops), DEFLECT THE PASS (a hand up to meet a pass in the air), and street ball's steal gambles
- [x] The CPU's style is picked on the title screen under the level (arrows or click: RANDOM, then the nine styles, each with a plain line) and in settings (CPU STYLE)
- [x] Settings opens on three tabs (MATCH, FEEL, LOOK AND SOUND) of big rows: arrows each side of a bar, notches for named stops, a tick where the default is, an orange dot on changed rows, ON/OFF switches for anything 0/1, the value in words, a plain note and the default under the list; Tab or Q/E switch tabs, the mouse hovers, clicks arrows and tabs, drags bars
- [x] Two two-point lines, one per team, painted on the floor in the team's colour (with a "2" and a faint beam) halfway (`line_frac` 0.5) between the basket the team attacks and the centre line: the oranges' is on the teal half and the teal team's on the orange half. A shot released beyond a team's own line scores 2 (this replaces the centre-line rule)
- [x] A dribble always carries the dribbler toward his team's line, from either side of it (and bounces in place within 14 px of it); the lean in his swing only sets how far it carries
- [x] The closer a shooter is to his line, the easier the shot, while he is still: feet down and the swing's lean under `line_sway_max` (0.3 rad); swaying more or jumping gives no help. Within `line_zone` (60 px) of the line any cock-back from `line_charge_min` (0.12) to `line_charge_max` (0.92) goes in; only the two extremes (a bare tap, a hold to the very end) miss. Nothing of this applies away from the line
- [x] The line's help is for the shooter's own line only and only on the half of the court holding the basket he shoots at (so none near the other team's line, none at centre court); it reaches `line_range` 180 px (tightened from 260) either side of the line, and the line's hot spot flashes by the same rule
- [x] The CPU reads the line too: its 2-point test, scouting and long-shot defence use its own line; dribbling to the line is worth taking and not once it is there; a still shot on the line is taken at once
- [x] Release 1.0.0 candidate (`production/releases/v1.0.0.md`): version on the title, `LICENSES.txt` (Matter.js MIT, Departure Mono OFL), a favicon and page description, a keyboard-needed notice on touch-only devices, `tools/release.sh` (dist/ plus the zip); fixes: `rock_angle` 0 broke physics, bad saved settings crashed the title, no Web Audio stopped the game from starting, a tie read "LEVEL"
- [x] The backboards stand flush against the side walls (`board_inset` 6, the court 792 px wide so the hoops are where they were): a ball can no longer lodge in the gap between the wall and the board (35 of 300 test drops stuck before, none after)
- [x] A hand within `dribble_hand_floor` (16 px) of the floor cannot start a dribble: the tap is lost and the ball stays in the hand, a pass still goes; the CPU knows the rule
- [x] A decluttered title: the CPU panel shows just the level (name and bar) and the style (name), the controls panel the two key rows and two hint lines, one short footer line; what each level and style does is under the highlighted row in settings (MATCH tab). Pressing a button squashes only that button: the pressed state is matched by label and position, so the two `<` and two `>` arrows no longer move together
- [x] Catch: hand hitbox (over half the ball inside) or abdomen contact snaps the ball to the hand; feet never catch
- [x] Hold with the ball to cock back, let go to fire; a catch made with the key down needs one let-go first; cock-back grows forward speed far more than height
- [x] Jump height follows how long the key is held
- [x] Blocks and steals by defenders; a shot taken drifting or leaning away is called a fadeaway (same arc)
- [x] Only opponents collide; teammates pass through each other
- [x] Planted players pivot on their feet, swinging evenly forward and back (±0.55 rad) at a beat that never fades, so a well-timed hop carries them far; fallen players get back up
- [x] While a team has the ball, its key moves only the carrier: the teammate stays planted
- [x] Shooting form: the shooting arm trails forward with the wrist bent palm-down; the back arm lifts only slightly (0.3 rad) as a guide and barely moves; idle arms hang toward straight down instead of swinging with the body
- [x] Dunks of about 0.6 to 1 s (a touch quicker than before, still readable); a dunk straight off a teammate's pass is an ALLEY-OOP
- [x] Exact shot maths: the aim help solves the engine's own flight (drag, gravity, the real release height) for the forward speed, instead of a closed-form guess that fell 147 px short on average; a shot can be previewed (where it will cross the rim) at any cock-back; walls and ceiling count as contact
- [x] Harder dunks: a dunk can only start from the court side of the rim, at least 24 px from it; standing it needs to be within 70 px; in the air the flight must top out within 110 px of the rim with the hand above it and not be dropping fast (an alley-oop catch gets 30% more reach). TAP TO DUNK only shows then, with a marker on the floor showing the zone
- [x] Settings open on a short plain list of 12 (sound, points to win, CPU level, game speed, jump power, dunk reach, dribble wobble, particles, screen shake, crowd size, pixel size, scanlines) with a line about each; ADVANCED shows every coefficient
- [x] More particles, scaled by a PARTICLES setting: take-off and landing dust, catch sparkles, shot and perfect-shot bursts, a sparkle trail behind shots, block and steal bursts, hustle embers, a bigger dunk burst with embers while hanging, richer confetti and net flecks
- [x] Three dunk styles at random: tomahawk (cocked behind the head, swung down), windmill (the arm at full length turning clockwise, mirrored for the team facing left, until the ball is in the hoop), honey dip (hanging by the forearm inside the rim); tomahawks and windmills hang on the rim half the time
- [x] Every dribble carries the dribbler a little forward; a dribbled ball passes through opponents' bodies and only an opponent's hand can steal it
- [x] Departure Mono (SIL OFL, embedded in `js/font.js` as a data URI, so it still plays offline) is the font everywhere; the 5x7 bitmap font remains as the stand-in until it loads. Buttons gleam on hover: a white glint runs around the border and a soft sheen sweeps across
- [x] Premium sound: a new synth engine with a compressor and a short reverb; layered, filtered tones and noise (soft thumps for dribbles, a bright tick with a ring for the rim, a rising chime for a swish, a deep boom for a dunk, a sharp crack for a swat)
- [x] Dunks are a small planned jump: the take-off speed is solved so the body tops out exactly where the arm can put the ball over the rim; the arm does the aiming (tomahawk cocks back then swings down; windmill circles; honey dip sweeps up through the front); the ball is slammed when it is over the rim's opening. If the arm misses, the ball hits the rim and pops out of the hand (a DUNK MISS, no points)
- [x] A dunk is only offered from the ground or when moving or leaning toward the rim: drifting or leaning away, or already falling fast, never shows the prompt
- [x] Dunks can be blocked: a defender near the rim raises the arm straight up, and a hand or the head touching the ball swats it away from the hoop (DENIED!); the CPU (level 2+) jumps to contest a dunk, and a level 4+ carrier waits out a defender in the air
- [x] Rainbow follows what happened: the shot's real crossing of the rim plane and its contacts decide it (a player's touch or a hard rim or board hit turns it white at once); the prediction now allows for the squircle ball's corners and no rim overlap (perfect_graze 8 -> 0), which removed false rainbows
- [x] Polish: points float up off the rim, a few frozen frames on a dunk's slam, darker screen corners, camera flashes in the crowd when it is hyped
- [x] Match replay: the best moments (alley-oops, dunks, perfect shots, fadeaways, long shots, blocks) are recorded as they happen and the best five play after the final basket in slow motion around the big moment (ENTER next, ESC skip); HIGHLIGHTS on the results screen plays them again; replay_clips in settings (0 = off)
- [x] VS CPU mode: the computer plays the Tealbacks with the same two keys a person has; a six-step difficulty slider on the main menu says what each level does: 1 Rookie (chases the ball, misses, reacts slowly, dribbles a little), 2 Amateur (basic shooting and blocking, dribbles upcourt), 3 Pro (dribbles, passes, dunks, spots open chances, has a personality), 4 All-Star (predicts flights, times steals, adapts to how you play), 5 Legend (shoots only perfect lines, fast breaks, reads your plays, still makes mistakes), 6 Mythic (the Legend plus: it reads a dunk a few steps early and swats more of them, trusts what it has seen after two sightings, follows how its own pump fakes have fared, leads a pass to where the receiver is running, takes the best shot left after three seconds instead of stalling, and tries the self-pass: from about halfway to the rim, with a clear lane, it throws the ball ahead, hops after it, catches it in the air itself and dunks). Its brain is three parts: offense scores every option (dunk, shot, long shot, fadeaway, dribble, pass, alley-oop, wait) as expected points minus risk plus its personality's taste plus level-dependent noise, with a cooldown so it does not flip-flop; defense predicts the carrier up to 40 steps ahead (when the cocked shot will leave, when the dunk zone is reached, a pass) and jumps to the predicted release, every answer rolled once per incident at a strength that doubles per level; chase stands between the carrier and its rim, reads where a loose ball will land (with the error a lower level makes), crashes the board after a predicted miss and times a steal against a dribble in the air. It remembers the match (shots, long shots, dunks, passes, how far out you shoot, which way you drive, how you score pressed versus open) and leans on it gradually: defends deeper against long shooters, sags to the rim against dunkers, presses harder when pressure works. Eight personalities (Aggressive, Sniper, Playmaker, Showboat, Defensive, Reckless, Tactician, Opportunist) tilt the scores and never dictate a play. A line under the scoreboard says what it is trying to do, and a bubble over the head of the player doing it shows it as a picture (ball, shot, shield, screen, pass, dunk, steal, rebound); WATCH CPU on the title lets the computer play itself, after a picker where each computer gets its own level; at level 4+ it throws alley-oop lobs onto the backboard above the rim while the second player goes up for the dunk (the physics plans his jump to meet the ball, like a dunk's), and it keeps off the far side of the baskets; I shows what it thinks (option scores, what it reads from you, what it has learned, the ball path and the spot it is heading to). It aims by asking the physics where the ball would cross the rim if released now; each CPU level has its own reaction time (0.26 s Rookie, 0.24, 0.21, 0.17, 0.10, 0.02 Mythic: each step shorter than the last by more) and aim error (1.0 Rookie down to 0.005 Mythic); neither is a setting; 2 PLAYERS mode on one keyboard
- [x] No erratic launches: the planted swing takes over only near upright and turns no faster than itself; a tumbling body's hop is steered no harder than a full swing; body parts capped at 22 px/step outside dunks; hops carry by the lean (hop_reach)
- [x] Shots: one arc per cock-back and spot (forward 3.5-14, up 11-13, 1 s cock-back); lean, drift and momentum change nothing; strong aim help toward the rim's centre
- [x] Bounce key: hold to wind up, let go to bounce the ball forward as a pass; a pass slips through opponents for 0.3 s and they cannot catch it for 0.6 s
- [x] Dribble: tap the bounce key to bounce it at the feet; it carries you the way you lean in your swing. Tapping again as the ball rises is clean; tapping while it falls or mashing is sloppy and builds wobble until you lose it (about 3 s of mashing, about 20 s of clean rhythm)
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
