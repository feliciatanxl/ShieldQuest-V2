# ShieldQuest V2: *The Second Before*
## Final Game Design Document, v1.0, 8 October 2026

**Project SHIELD.** Team SecurePi (Felicia Tan and Charlisa Tan), Nanyang Polytechnic. NYC Young ChangeMakers grant, delivery Nov 2026 to Apr 2027 (Weeks 1-24).
**Who this is for:** the two developers and Claude Code. Engineering terms are used precisely: **MUST** means required, **SHOULD** means strongly recommended, **MAY** means optional.

> **Disclaimer.** This text ships word for word in the product: *"ShieldQuest is a student project by Team SecurePi (Nanyang Polytechnic). It is not an official SPF, NCPC or Government product. All scenarios are fictional."* Section 11, rule 27, lists every place it must appear.

---

## 0. Design basis and decisions

**Base concept.** We build on *The Second Before*. It had the highest combined judge score: 57 + 59 + 59 = **175/210**. The other three scored Stillframe 170, HOLDFAST 162 and HOLD UP 160. Two of the three judges named it the winner. Its strengths are the classroom fit, the Conductor tooling, privacy architecture that keeps assessment data and gameplay data apart, and a content plan two people can actually deliver.

**Ideas taken from the other three concepts.**

| From | Idea |
|---|---|
| **HOLD UP** | <ul><li>The player triggers HOLD themselves.</li><li>The Pressure Ring names each tactic as it arrives.</li><li>The `sceneAt(t, branchState)` timeline engine.</li><li>DIVE into the Digi-District sky layer and the "Behind the Stall" reveal.</li><li>GUARD and DOUBT meters on the friend in Peer Shield.</li><li>A face atlas for the low-poly characters.</li><li>Plain mode.</li></ul> |
| **Stillframe** | <ul><li>The freeze ends at a fixed time, so holding earlier buys more time to investigate.</li><li>Confidence shields, plus private correction notes when a player was confident and wrong.</li><li>Late Hold recovery after a bad outcome.</li><li>The fixed offender-focused feedback template and a content linter.</li><li>Genuine-versus-fake Twin pairs in the assessments.</li><li>Prompts that fade across missions: Guided, then Light, then Wildcard.</li><li>Flip the Board in the debrief, and the Return visit 2-4 weeks later.</li><li>Players decide for a fictional Lead character rather than for "you".</li><li>The projector shows only positive trends.</li></ul> |
| **HOLDFAST** | <ul><li>The Room Freeze in onboarding.</li><li>The LIVE vs HELD counter.</li><li>Pull the String.</li><li>Sealed forecasts that the Aftershock later checks.</li><li>Shieldfin swimming across teammates' screens.</li><li>The neutral line "The city will remember this."</li><li>Player progress stays on the device.</li></ul> |

**Where the concepts or the judges disagreed, this document decides:**

| Topic | Decision |
|---|---|
| How Hold happens | **The player triggers it.** Each phone has its own HOLD button during the live moment. Anyone who hasn't held by the decision second is frozen automatically in a "late" state with no penalty. Squad-wide auto-freeze as the only way to hold is cut. |
| When the freeze ends | At a **fixed server time**. Players who hold earlier get more time to investigate. Message beats that haven't arrived yet hang in the air and can be read early. |
| Squad decision | Private first seal, then a private re-seal; the squad decision is the re-seal majority, and the **Safety Lead breaks ties with a visible reason tile**. The five-thumb Squad Lock is **cut**. The celebration is a lantern beam on the projector. |
| Pressure events | **Squad-wide only.** They come from a fictional sender and are never secret. Each one is a mini-test: you dismiss it with a new HOLD. They are off for ages 10-13 and in Gentle mode. Secret Pings, pings aimed at one player, and surges that cut the freeze short are all **cut**. |
| Seeing the future | Ghost futures show what might happen to the scene, but they are **not labelled by choice** and anything later is fogged. Each player places one sealed forecast. HOLD UP's Peek, which previewed each option's result, is **cut**. |
| Echo | It is earned by **consulting or help-seeking actions**. Its ability is a Steelman card dealt to a random teammate. A minority reason is never shown unless at least 2 players share it. |
| Projector | It shows **positive trends only** (holds made, minds changed towards safer, lanterns lit). Raw room-wide vote splits stay off the projector. |
| Guardian and Codex progress | Stored **only on the device** (IndexedDB). The server never holds per-player progress. |
| Art | A low-poly "Blue Hour" city diorama. **Origami is used only for the Guardians.** NPCs are expressive beans. **Manipulators never get a body or a face.** Papercraft for the whole city is cut. |
| Districts at launch | The three committed districts (School Street, Retail District, Digi-District). Two expansion plates appear fogged on the map. Six districts at launch is cut. |
| Client stack | React 19.3 with @react-three/fiber 9.8, which the tech report verified. The concepts' Svelte and Preact suggestions are rejected. |
| Hosting | Amazon Lightsail in Singapore. AWS App Runner is closed to new customers and never supported WebSockets. |
| Twin Checks | Used in the tutorial, the pre/post assessment and the Return visit. **Not** in every mission. |
| Small-group suppression | **n ≥ 5** for anything stored or projected. This is stricter than the tech report's 3. |
| Aftershock tone | Sober and qualitative. No chains, no camera shake, no police letter slamming onto the screen. |
| Spotting during the live phase | Untimed and unscored. Live taps are never used as KPI evidence. |

---

## 1. Vision and tagline

**Tagline:** *Scams need you to hurry. You can Hold.*
**Programme line (from the proposal):** *Choose Right. Protect Together.*

ShieldQuest V2 is a 3D game for phones, played in squads in a facilitated 90-minute session. It is set in **ShieldQuest City**, a fictional island city where every risky decision is caught one second before it happens. Each mission plays live on every player's own phone. A recruiter's countdown runs, a friend says "just try once lah", messages pile in, and a labelled Pressure Ring around the big HOLD button names each tactic as it lands.

When a player presses and holds, *their* world freezes. Rain hangs in the air, the next scam message stops mid-flight where they can read it, and the camera unlocks. Each squad member then examines the frozen moment through a different lens:
- clues;
- strings of influence back to whoever gains;
- feelings;
- safe exits;
- possible futures.

The squad then seals votes privately on their own phones, sees an anonymous split, argues it out, re-seals, and lets time run again. The city remembers. Consequences come back as Aftershocks a mission later. Then the scam moves on to a friend, and the squad builds the words to pull them back.

On the projector, the whole room's city freezes when the room freezes and lights up as the room protects each other. It ends with the Stillpoint clock finally ticking from 11:59 to 12:00, and the closing card: ***"You can't freeze time out there. But you can Hold."***

---

## 2. Platform decision: PWA only for the grant period

**Decision:** ShieldQuest ships as an installable **Progressive Web App opened from a QR code, with nothing to download**. That is what the proposal promises.
- "Add to Home Screen" is offered but never required.
- No feature depends on installation or push notifications.
- Graphics are WebGL2 only. WebGPU is not used.

**Why not a native app now.** All of this comes from the tech report, checked on 8 Oct 2026.

| Factor | PWA via QR | Native store app |
|---|---|---|
| Time to start playing | Scan and play in about 10-20 s. First load is at most 600 KB, and a whole session is under 3 MB per phone. | Store sign-in, then 50-150 MB × 30 phones on one school Wi-Fi. School-managed phones and full storage often block installs. That uses up the 15-minute onboarding. |
| Cost | A domain plus about S$17/month hosting. | Apple Developer Program costs US$99/year, and the fee waiver doesn't cover individual students. Google Play costs US$25. |
| Store gates | None. | New personal Play accounts need 12 testers opted in for 14 days. Android developer verification has been enforced since Sep 2026. Apps go through Apple review. |
| Child-audience rules | Our own plain-language notice. | The 10-13 band triggers Google Play's Families policy and Apple's Kids and age-rating rules. |
| Tooling | Builds on Windows. | iOS builds need macOS and Xcode, and the team is on Windows. |
| Content updates | The Portal publishes new content instantly. | App-shell fixes go through store review. |

**What iOS gives us in 2026.** WebGL2 works everywhere we target. Service-worker offline play works. Sites added to the Home Screen open as web apps by default in iOS 26. Push notifications are installed-only and need the user's permission, so we don't use them. iOS has **no Vibration API**, so every haptic has a visual or audio equivalent.

**When to wrap the app later (after Week 24 only):**
1. **Android Trusted Web Activity** (Bubblewrap or PWABuilder, US$25): use this if a partner needs a Play Store listing. It publishes the same code with no fork.
2. **Capacitor 8.5:** use this only if a scale-up partner *requires* a store or MDM-distributable app, if a future Family Mode needs reliable notifications, or if background sync or device features become essential. Budget for:
   - the Apple fee;
   - Mac CI runners;
   - the risk of Apple rejecting the app under guideline 4.2 ("just a website").

---

## 3. Player fantasy and tone

**Fantasy.** You are a **Holder**, one of the few people in ShieldQuest City who can stop time for exactly one second. That second is the one before someone makes a choice they can't take back. Your phone is your **Hold Lens**. In a frozen moment you can:
- walk around the scene;
- read the message hanging in the air;
- pull a glowing string from the person pushing to whoever really gains;
- see faint ghosts of what might happen next.

Then your squad decides, and you let time go.

**Why it's fun** (for ages 14-20 especially):
- **Bullet-time detective.** The coolest move in any game, used to *think* rather than fight. Slow, tactile, investigative.
- **Everyone holds a piece.** Every lens shows something the others can't see. You talk because you need the other pieces, not because you were told to.
- **Consequences with a fuse.** The easy S$200 in Mission 1 comes back as a bank notice in Mission 2, in front of the room.
- **Protector, not target.** The hero move is "I paused, I checked, I helped Dev."
- **Earned companions.** Origami Guardians fold themselves out of the frozen air when your squad shows a skill.

**Third-person framing (required).** Every mission centres on a fictional **Lead character**, for example Ren, 19, a poly student whose shifts were cut. Holders share Ren's frozen second and decide what Ren does. All feedback and debrief prompts talk about Ren and the manipulator, never about "you". This lowers defensiveness, means nobody has to share their own experience, and keeps blame on the offender.

**Tone rules (required in all copy, art and audio):**
1. The villain is *the hurry*, and the people who manufacture it. Blame always goes to tactics and offenders. Feedback never says or implies that anyone "fell for", "should have known", was "careless" or "deserved" it.
2. Risky rewards are **shiny for 3 seconds, then sober**: coins land, the music thins out, the scene goes quiet. Every branch ends with the same neutral line: **"The city will remember this."**
3. The biggest spectacle is reserved for protective choices: Guardian unfolds, lanterns rising, the city lighting up.
4. Every risk outcome ends with a recovery route. Coming forward late is always rewarded and never shamed.
5. Humour targets situations and scammers, never victims.
   - Elders are never shown as naive.
   - Singlish stays light. **Plain mode** (no Singlish) is the default for ages 10-13 and a toggle elsewhere.
6. Consequences are realistic and proportionate. Legal wording always says "up to" and "may". Under-14s never see sentencing details.

---

## 4. World and art direction

### 4.1 ShieldQuest City
- **ShieldQuest City** is a fictional island city with a Singapore flavour: void decks, covered walkways, MRT-style fare gates, bubble-tea kiosks, HDB-style slab blocks, a food court under a zinc roof.
- At the centre stands the **Stillpoint**, a clock tower stuck at **11:59**. It is the source of the Hold power. The session's closing scene ticks it to 12:00.
- Districts are **hexagonal plates** around the Stillpoint. Glowing viaduct bridges link them, and an MRT-style train glides round the rim every 40 s.
- The **Digi-District floats above the city as a sky layer**: the same blocks redrawn as a glowing wireframe at night, where apps are places. Players reach it by **DIVE**: the camera flies into a character's phone screen and comes out in the online version of that chat.
- Sky-layer locations:
  - **Barang Market** (marketplace): each listing is a booth, and reviews hang as lanterns.
  - **ChatLah plaza** (messaging).
  - **QuikGig tower** (jobs noticeboard).
  - **the Arcade** (games).

**Districts at launch:**

| District | Accent | Sets (reusable 3D dioramas) | Themes |
|---|---|---|---|
| **School Street** | Chalk teal | S1 School Gate and Bus Stop (with a poly-campus variant); S2 Canteen and Locker Corridor | Game scams, cyberbullying, stranger approaches, digital identity |
| **Retail District** | Coral | S3 Mall Atrium and MiniMart 24 (with a phone-accessory shop variant); S4 Food Court and Pop-up Booth | Shop-theft dares, harassment and dares, data harvesting, SIM requests |
| **Digi-District** | Violet | S5 Neon Void Deck and Phone Kiosk (on the ground); S6 Digi Sky (Barang, ChatLah, QuikGig, Arcade) | Money mules, e-commerce, phishing, job scams |
| (Interiors) | n/a | S7 Bedroom Cutaway (night Peer Shield scenes) | Peer Shield rescues |
| *Void Deck Commons*, *Interchange* | n/a | Shown fogged on the map with "Coming soon" | Opened only when reviewed content exists (after the pilot) |

**Fictional brands** (a fixed list; the Portal blocks real brands):
- ChatLah (messaging), Barang Market (marketplace), QuikGig (jobs), TaskLah (task groups);
- Harbour Bank, MetroPay (e-wallet), CityPass (digital ID login), EduPass (school login);
- MiniMart 24, Boba Boleh, MetroPost (courier), Metro Legends (trading cards).
- All in-game web addresses use **`.test`** or **`.example`** domains.
- All phone numbers are shown as obvious placeholders (`8XXX XXXX`).

### 4.2 Art direction: Blue Hour low-poly diorama
- Everything is **flat-shaded low-poly geometry built in code** from boxes, prisms, cylinders, capsules and extruded SVG paths. We buy no model packs and download no glTF files.
- **Vertex colours** replace textures. One shared 256 px gradient ramp is the only texture.
  - Ambient occlusion is baked into vertex colours, and shadows are blob decals.
  - Window light patterns are computed in the shader.
- **The Freeze look** is one uniform on the one shared material (no post-processing pass):
  - The world drains to `still-blue`.
  - Rain becomes hanging beads of light (instanced).
  - Interactive objects keep their warm colour and gain a pulsing ring, an icon and a dotted outline, so the cue doesn't rely on colour.
- **Influence** shows as glowing strings with icon beads: a coin for gain, a clock for urgency, a crowd for social proof, a badge for fake authority, a link for a referral.
- **Ghost futures** are translucent figures a few steps ahead, tagged "+10 min (likely)", "+3 days (possible)" and so on. Behind them is a fog wall labelled **"Later is foggy."**

### 4.3 Palette tokens (in `packages/shared/tokens.ts`; CSS custom properties on `:root`)

| Token | Hex | Use |
|---|---|---|
| `night-navy` | #142033 | Base and sky |
| `dusk-indigo` | #2A2F6B | Shadows and fog |
| `paper` | #F4EFE6 | UI cards |
| `ink` | #1D2440 | Text on paper (≥ 7:1) |
| `still-blue` | #9FB3C8 | Freeze tint |
| `frost` | #CFE8FF | The Hold Glass frosting in from the edges |
| `school-teal` / `retail-coral` / `digi-violet` | #2BB3A3 / #F26B5B / #8A6CF0 | District accents |
| `trust-gold` | #F2C14E | Lanterns, Trust, Guardians |
| `safe` | #1FB5A8 | Always drawn as a **rounded shield** shape |
| `risk` | #FF4D8D | Always drawn as a **jagged burst with diagonal hatching** |
| `attention` | #FFC845 | Always drawn as a **diamond** |
| `unknown` | #9FB3C8 | Always drawn as a **dashed ring** |

**Shape-and-word rule:** every status uses shape + icon + word together. **Exit cards never carry a status shape.**
- Each Exit card has a letter and a neutral pattern: A dots, B stripes, C grid, D waves.
- **Letters are shuffled per session from a seed**, so the safer exit is not always C.
- Squad totems pair a shape with a name: Hornbill (triangle), Pangolin (circle), Kingfisher (square), Heron (diamond), Civet (star), Macaque (hexagon).

**Lighting grades:**
- **Blue Hour** is the default.
- **Bright Room** is the projector grade: ambient light +15%, shadows lifted, outlines thicker, so the scene doesn't turn to mud on washed-out classroom projectors.
- **Daylight** is the 10-13 grade. It is just a lighting preset and ships in Week 19.

### 4.4 Characters and Guardians
- **NPCs are "beans":** an 8-part rigid figure (capsule body, sphere head, stubby arms), with no skinning and at most 300 triangles.
  - The face is a `CanvasTexture` atlas of **8 expressions**: neutral, happy, smug, worried, shocked, relieved, sad, determined.
  - Diversity comes from 12 hair and headwear silhouettes (including headscarf and cap), glasses, school and work outfits, and a range of skin-tone colours. No caricature.
  - Poses are JSON presets that tween between each other: stand, sit, lean in, look at phone, arms crossed, open arms, curl up, turn towards.
- **Manipulators are never embodied.** Recruiters, fake sellers and impersonators appear only as a chat handle with an initial avatar. During Identify they may also appear as a faceless silhouette in a lit window. There is no face, accent or ethnic coding.
  - Impersonated "officials" are text or voice only, with fictional agency names. There are no crests, uniforms, warrant cards or officer names.
- **Guardians are origami animals.** Each is generated as a flat sheet that morphs into the animal through code-computed vertex positions (the "Unfold"), at most 1.5k triangles each:
  - **VeriFox:** a fox with a magnifier-fold tail.
  - **Echo:** an otter.
  - **Beacon:** a lantern firefly.
  - **Shieldfin:** a manta ray whose wings spread into a shield.
  - **Cluepaw:** a cat with ink paw prints.
  - **ByteBuddy:** a folded cube robot with a fold-out screen face.

### 4.5 Camera

| Context | Rig |
|---|---|
| City Hub (phone and projector) | Orthographic, isometric-style. Zoom is computed from the aspect ratio. Drag spins the turntable with inertia. Tapping a district plays a 900 ms ease-out zoom. |
| Live (phone) | Locked "director" perspective camera (FOV 30) driven by the mission's beats: a dolly towards the phone when a message lands, a cut to the friend when they speak. 2-3 px sway that grows with pressure. |
| Freeze moment (phone) | A 400 ms "punch" (FOV 30 to 26 with a small dolly in). Under reduced motion it becomes a fade. |
| Hold (phone, 14-24) | Constrained orbit: ±75° from the authored front, 25-70° elevation, zoom 0.6-2.0×. Double-tap an object to fly to its authored close-up in 600 ms. A Recentre button. Tapping a chip on the Evidence Board flies the camera to that clue. |
| Hold (phone, 10-13) | **Rail mode:** 4 authored stops you swipe between. No free orbit. |
| Pull the String (phone) | The string is tube geometry along a curve. A 1 s tween goes to its end anchor inside the current set (a lit window in the skyline). **Long cross-district camera moves happen only on the projector.** |
| DIVE | A 1.2 s flight into the in-scene phone and out into the S6 sky layer. Under reduced motion it is a cut. |
| Projector | Authored cinematic camera only: a drone glide in, a dolly-zoom at the freeze, a slow 90 s orbit that **shows no clue highlights** (so the phones matter), a crane up to the map for reveals, and a reverse time-lapse for the debrief Rewind. |

### 4.6 Animation and audio
- **Animation:**
  - Every scene animation is a pure function of mission time `t` (section 12.3). Rewind and sync therefore come almost free.
  - UI motion uses CSS transforms and opacity via `motion` (`LazyMotion` + `m`), so the UI runs at 60 fps even when the 3D view is capped at 30.
- **Audio** is **synthesized** with the Web Audio API, so there are no audio files and no licences:
  - a tape-stop pitch drop on Freeze and a reverse swell on Release;
  - an accelerating tick during Live;
  - pentatonic plucks when a clue is found;
  - a generative ambient pad per district;
  - the **six-note S.H.I.E.L.D. motif**: each letter is one note, and it plays as the letters light up on the Bond screen.
- **Narration** is pre-rendered Amazon Polly audio (Opus, 24 kbps), played on the Big Screen, and in solo only if the player opts in.
- **In a classroom, only the projector carries music, ambience and narration.** Phones use captions, haptics (Android) and quiet UI ticks, so 30 phones never clash.

### 4.7 Responsive layouts

| Viewport | Layout |
|---|---|
| **Phone portrait** (360-430 px wide; reference device 360×800) | <ul><li>Top bar, 48 px.</li><li>3D stage takes the **top 58%**; bottom sheet the **bottom 42%**.</li><li>A **76 px HOLD button** floats on the seam, bottom-centre, in the thumb zone.</li><li>Caption band sits directly above the sheet.</li></ul> |
| **Phone landscape / small tablet** | Stage on the left (62%), panel on the right (38%). HOLD at the bottom-right. |
| **Tablet** (768-1024) | Landscape layout with larger type. In portrait, the phone layout at 1.25× scale. |
| **Laptop** (≥ 1280) | Side-panel layout plus keyboard: <ul><li>Space or H: Hold.</li><li>1-4: choose an Exit.</li><li>Tab: cycle through clues.</li><li>Enter: Inspect.</li><li>P: Pin.</li><li>Arrow keys: orbit.</li><li>Esc: Pause.</li></ul> |
| **Projector "Big Screen"** (1280×720 and 1920×1080) | <ul><li>No interactive controls.</li><li>Captions ≥ 40 px, all other text ≥ 28 px.</li><li>A permanent two-line caption band.</li><li>5% safe margins.</li><li>Bright Room grade.</li><li>Disclaimer footer always visible.</li></ul> |
| **Conductor** (facilitator laptop or tablet) | A dense 2D dashboard. 3D is never needed. |

Also: use CSS container queries for panels, `100dvh`/`svh` instead of `vh`, `viewport-fit=cover` with safe-area insets, and `touch-action: manipulation`. Never set `user-scalable=no`.

### 4.8 Flat View (the Lite 2D mode)
Flat View is a full, first-class version of the game, not a degraded one.
- **What it is:** an **SVG snapshot of the scene**, rendered directly from the set's prop list (every prop has a 2D glyph), plus a **Scene List**. The Scene List is an ordered list of buttons for every person and object you can inspect, filtered by your lens.
  - Strings become a "Who gains?" list.
  - Ghost futures become cards.
  - The Live phase is the same DOM chat with a static SVG scene.
- **When it is used:**
  - automatically if WebGL2 is unavailable;
  - if the device's benchmark lands it in "Flat";
  - after two WebGL context losses;
  - by user choice ("2D mode / Battery saver" in Comfort Settings).
- **No decision in the game may require the 3D view.** Flat View is also the screen-reader path and the source for printed kit cards.
- It is built from scene data at runtime. There is **no headless WebGL rendering** at publish time.

---

## 5. Core loop and mission anatomy

### 5.1 The proposal's six-stage loop, as played

| Proposal stage | ShieldQuest V2 beat | S.H.I.E.L.D. | What the player does |
|---|---|---|---|
| **1. Explore** | City Hub, Role Flip, then the **Live** moment | S | <ul><li>Fly into the district.</li><li>Receive a role and lens.</li><li>Watch the moment play live on your own phone under labelled pressure.</li><li>Optionally tap things that catch your eye (untimed, unscored).</li></ul> |
| **2. Investigate** | **HOLD**, then **Investigate** | H, S, I | <ul><li>Press and hold to freeze *your* world.</li><li>Orbit, inspect, pin evidence.</li><li>Pull the String to reveal who gains.</li><li>Use your lens tools.</li></ul> |
| **3. Discuss** | **Think, Seal, Reveal, Explain** | E, L | <ul><li>Sealed forecast.</li><li>Private vote with confidence shields.</li><li>Anonymous squad split.</li><li>Spoken discussion with Echo cards and reason chips.</li></ul> |
| **4. Decide** | **Re-seal and squad decision** | L | <ul><li>Private re-seal.</li><li>The majority becomes Ren's action; the Safety Lead breaks ties with a visible reason.</li></ul> |
| **5. Experience** | **Release**, then later the **Aftershock** | E | <ul><li>The immediate outcome plays now.</li><li>The delayed consequence lands a mission later.</li><li>Ripple Trace, forecast check, Late Hold recovery.</li></ul> |
| **6. Protect** | **Peer Shield**, plus Shieldfin during play | D | <ul><li>Build a four-part message across the squad's phones to pull a friend back.</li><li>Block pressure aimed at teammates.</li></ul> |

### 5.2 Always on screen (phone)
- **Top bar (48 px):**
  - District chip.
  - **S.H.I.E.L.D. rail**: six letter badges. The current letter is enlarged, **bold, underlined and boxed**; finished letters show a check shape.
  - **Aa** (text size, 100-200%).
  - **?** (sends the Conductor a "needs help" flag for the squad).
  - **Pause** (a door icon). It opens a calm "Take a break" screen; the facilitator sees only an anonymous count.
  - **i**: disclaimer, content note, and the **Need to talk?** panel.
- **Squad strip** (inside the sheet): the squad totem and seat role icons with readiness ticks only. It never shows anyone's choices.
- **Caption band:** every line and meaningful sound, for example `[phone buzzes twice]` or `[ticking speeds up]`.

### 5.3 Squad mission anatomy
This is the reference timing for the 14-16 and 17-24 bands, Mission 1 (Guided). The mission clock starts at Role Flip. "Server" means the per-squad state machine in `@shieldquest/engine`, run by the server.

| # | Phase (letter) | Clock | Phone | Big Screen | Server |
|---|---|---|---|---|---|
| 0 | **Aftershock slot** (E). Missions 2-3 only. | up to 90 s, before Role Flip | Plays due Seeds: Timeline Ribbon fast-forward, Ripple Trace, consequence scene, forecast check, Late Hold. See 6.3. | A dark frost ripple or a gold Afterglow ripple spreads from the source district. | `dce.due()` at the `MissionOpen` boundary. |
| 1 | **Role Flip** | 0:00-0:15 | A role card flips over: role, lens, letter, one-line job. In Guided mode, a prompt sits under the current letter. | The drone camera glides from the map into the district; role icons rotate on each squad tower. | Roles = (seatIndex + missionIndex) mod roles, with merge rules (6.6). |
| 2 | **Live** (S then H) | 0:15-1:15 (45-60 s of beats) | <ul><li>Top: the 3D scene on the director camera.</li><li>Sheet: the in-game **ChatLah** chat (DOM), messages arriving with typing dots.</li><li>The **Pressure Ring** around HOLD gains a labelled segment as each tactic lands: URGENCY, EVERYONE DOES IT, BIG REWARD, SECRET, OFFICIAL-LOOKING, LAST CHANCE.</li><li>Clues shimmer gently for the whole phase; tapping one drops a "first look" pin (untimed).</li><li>Reply chips appear at about 30 s and can be tapped without holding. Tapping one shows: *"That's what the hurry is for. Nothing was sent."* No penalty.</li></ul> | Plays the same moment from the same `t0`. Each squad lane shows "Hornbill 3/5 holding" (counts only). | Sends `{missionId, variant, branch, t0}`. Every phone animates locally. |
| 2a | **HOLD** (H) | any time during Live | <ul><li>Press and hold HOLD for 0.6 s (adjustable 0.3-2.0 s, or tap to toggle).</li><li>A ring fills; then over 400 ms time eases from 1 to 0; colour drains; tape-stop sound; a 60 ms buzz on Android.</li><li>Header: *"Time is held. Nothing is rushing you now."*</li><li>**Beats that haven't arrived yet hang in mid-air as 3D cards that can be read early.**</li></ul> | That squad's lantern frosts by one more segment. | Records the hold only into a session-level **latency bucket** (0-5 / 5-15 / 15-30 / 30+ s / late). The seat is not stored. |
| 2b | **Late auto-freeze** | at the decision second (end of Live) | Players who haven't held freeze automatically. The scene shows Ren's thumb over Send, with the line *"You can always pause. Scams count on you forgetting that."* No penalty. | n/a | Counts it in the "late" bucket. |
| 3 | **Investigate** (S, I) | from your own hold until **Freeze End = Live start + 3:30** (fixed server time). Facilitator can add +30 s. | <ul><li>Sheet tabs: **LENS / BOARD / SQUAD**.</li><li>Drag to orbit, pinch to zoom, double-tap to focus.</li><li>Tapping a ringed object opens an **Inspect card** (DOM, scalable text) with **PIN**, **Seems fine** and your lens action (*Independent?*, *Who gains?*, *How do they feel?*, *Safe exit?*, *Scan*).</li><li>Pins file under S / I / E on the shared **Evidence Board**, each tagged with the role icon, never a name.</li><li>**Pull the String**: drag from the person or message applying pressure to Ren. On release the string tightens and a **Gain Tag** pops up (e.g. "Paid S$50 per recruit"). The Influence Tracer also sees *hidden* strings.</li><li>Every scene has 1-3 red herrings ("Seems fine" is the right call).</li><li>One **quiet clue** per scene has no ring and can only be found by moving the camera.</li></ul> | Frozen city in still-blue, slow orbit, **no clue highlights**. | Ends early only if **every connected seat taps Done**. |
| 3a | **Pressure Surge** (H, D). Not for 10-13; off in Gentle mode. | Freeze start + 60 s | <ul><li>A squad-wide pop-up from the in-story pusher (e.g. Dev: "Bro why so long?? just do it") covers the sheet, with a fake "Reply now" lure.</li><li>**Dismiss it by pressing HOLD again** (practising H).</li><li>Or the Shieldfin holder **flicks Shieldfin**: the manta swims across every teammate's screen in seat order and dissolves the pop-up.</li><li>**No timer changes, ever.**</li></ul> | The lantern flickers, then steadies. | `surge` event; `shieldfin:swim {order, delayMs: 250}`. |
| 3b | **LIVE vs HELD** | at Freeze End | Personal counter, kept on the device: "Seen live: 2 · Found while holding: 7". The Board also shows squad totals. | n/a | Squad totals are aggregated. **Not a KPI.** |
| 4 | **Think** (E, L) | 30 s; SEAL is locked for the first 10 s while a breathing ring runs | <ol><li>**Sealed Forecast:** "If Ren says yes, what's most likely by +3 weeks?" Drag 1 of 4 outcome tokens onto the fog layer.</li><li>Choose an **Exit** card (2-4).</li><li>**Seal with a shield count**: tap *Unsure (1)*, *Fairly sure (2)* or *Certain (3)*. That tap *is* the seal (double-tap confirm is available). The card folds into an envelope.</li></ol> | **Seal Wall:** a paper lantern rises from the squad tower for each seal ("4 of 5 sealed"). | Holds `{voteId, seat, exit, confidence, forecast}` in memory only. |
| 5 | **Reveal** | 15 s | <ul><li>Anonymous **dots on each Exit, in shuffled order**.</li><li>10-13 uses **Mood** instead: United / Mostly agree / Split.</li><li>On a split: *"Split decisions are normal. Talk it out."*</li></ul> | The lantern pulses. No per-squad split is shown. | Broadcasts counts only. |
| 6 | **Explain** (L) | 2:00; the squad can ask for +30 s once; Echo Invite adds +60 s once | <ul><li>"Eyes up" mode dims the screen.</li><li>Shows your role's **sentence-starter** card (e.g. "The person pushing gains…").</li><li>**Reason chips**, pick up to 2: *Too urgent, Can't verify it, Too good to be true, Who gains?, Friend says it's fine, Easy money, Need the money.*</li><li>A chip's count shows on the Board **only when ≥ 2 seats picked it**; the rest are pooled as "other reasons".</li><li>On a split, one **random** seat gets a **Steelman card** ("Make the best case for B"), regardless of how anyone voted. **Pass** is always available.</li></ul> | "Talk it out" timer only. | Picks the Steelman seat with seeded RNG. Votes are not consulted. |
| 7 | **Re-seal** (L) | 20 s | <ul><li>Privately keep or change your Exit (no confidence this time).</li><li>The squad decision is the majority.</li><li>On a tie, the **Safety Lead's** phone shows the tied Exits; they must add a **"Because…" reason tile**, which the whole squad sees.</li><li>Phones then show a count only, e.g. "2 minds changed".</li></ul> | A **lantern beam** rises from the tower: "Hornbill decided". The choice is never shown. | Writes the `VoteAggregate` (6.5). |
| 8 | **Release** (E) | 30-45 s | <ul><li>Time resumes: a 300 ms reverse whir and the colour floods back.</li><li>The outcome plays as a captioned 3D sequence. Wallet and Trust dials move.</li><li>Neutral line: **"The city will remember this."**</li><li>A **Feedback Card** (fixed template, 6.3) explains any red herrings that were pinned.</li><li>If *this device* sealed a risky Exit with 3 shields, it privately shows a **correction note**: "You were sure. Here's the one detail that flips it…"</li><li>If a consequence is pending, a **Seed** drops onto the Timeline Ribbon, labelled *"Something is still in motion."*</li></ul> | The district's Ripple Map. Discreet mode shows only class-level effects. | Plants the Seeds (6.3). |
| 8a | **Branch sub-decision** (optional) | up to 75 s | For example, Ask for Proof brings convincing screenshots, then a **Mini-Hold** (45 s) with VeriFox's *Independent?* test, then a second seal. | n/a | Auto-skipped by Conductor pacing if the room is behind. |
| 9 | **Peer Shield** (D) | 3:00 | See 6.4. "Two days later…" A friend is frozen at their own second; tiles are spread across the phones; GUARD and DOUBT meters react. | Shows the assembled message only if the squad's Safety Lead taps Share. | Tag-rule evaluator. |
| 10 | **Bond** | 20 s | <ul><li>Letters light up with the six-note motif. Which letters light for *you* is computed on your device and kept private.</li><li>Guardians **Unfold** on every squad phone for the squad's bonds.</li><li>Counter-Playbook stamps.</li><li>"Phones down."</li></ul> | The origami Guardian leaps to the squad tower. | Guardian rules are evaluated over the squad's mission events. |

**Duration:** Mission 1 takes about 12:30-13:00. Mission 2, with its Aftershock slot, takes about 14:00. Mission 3 (Wildcard Sprint) is about 9:00:
- Live 0:45, and Freeze End at Live start + 2:30.
- Explain 1:00.
- Peer Shield 3:00.

### 5.4 Band dials (the same anatomy for every band)

| Dial | 10-13 | 14-16 | 17-24 |
|---|---|---|---|
| Live length / countdown visuals | 30-40 s, **no countdown**; pressure comes through characters | 45-60 s, yes | 45-60 s, yes |
| Camera | Rail, 4 stops | Constrained orbit | Constrained orbit |
| Lenses | 3 merged (Clue, Heart, Path) | 5 | 5 |
| Exits | 2-3 | 3 | 3-4, including a partly safe or "stall" option |
| Red herrings | 0-1 | 1-2 | 2-3, plus conflicting evidence |
| Pressure Surge | Off | On | On |
| Reveal | Mood | Dots | Dots |
| Projector default | Discreet | Discreet | Open (shows Trust on squad towers, never choices) |
| Reading target (enforced by moment-lint) | About Flesch-Kincaid grade 4-5, Plain mode on | About grade 7 | About grade 9 |
| Peer Shield slots | 3 (Opener, Offer, Channel) | 4 | 4 |
| Consequence wording | Gentle; no legal detail, no age thresholds | Simplified: investigation, parents informed, Guidance Programme | Legal, financial and social, always with "up to" and "may" |
| Cluepaw nudge | After 45 s | After 90 s | Only when the Guardian is called |

### 5.5 Prompts fade across a session
- **Mission 1, Guided:** the rail shows each letter with a one-line prompt, roles get prompts in Explain, and Cluepaw nudges are on.
- **Mission 2, Light:** letters only; prompts appear only when tapped.
- **Mission 3, Wildcard Sprint:**
  - The rail is hidden and lenses give no prompts.
  - The scenario is one the room hasn't seen: an unfamiliar surface with the same deep structure.
  - At Bond, each player first taps which S.H.I.E.L.D. steps they used, then sees the answer. This stays on the device.
- If Mission 3 is dropped for time, the Wildcard moves to the Return visit (7.6).

---

## 6. Grant mechanics in detail

### 6.1 S.H.I.E.L.D. skills

| Letter | Where it's practised | What lights the letter (on the device, private) | Aggregate signal stored |
|---|---|---|---|
| **S, Spot the Risk** | Live shimmer; Inspect and Pin; "Seems fine" on red herrings; quiet clues; ByteBuddy Scan | Pinned ≥ 2 genuine flags, or correctly cleared a red herring | Flags found live vs held (squad sums); per-clue discovery and miss rate |
| **H, Hold Before Acting** | The personal HOLD; re-holding to dismiss a Surge; the 10 s seal lock | Held before the auto-freeze | Hold rate; hold-latency histogram (session level) |
| **I, Identify the Influence** | Pull the String; hidden strings; Gain Tags; Pressure Ring labels | Pulled a string to the real beneficiary | Share of squads that revealed the hidden beneficiary |
| **E, Evaluate the Consequences** | Ghost futures; Sealed Forecast; Ripple Trace; Aftershocks | Forecast matched, or Ripple Trace correct | Forecast accuracy; Ripple Trace accuracy |
| **L, Lead the Right Choice** | Seal, Explain, Re-seal; Safety Lead tie-break | Re-sealed on a safer Exit with a reason chip | First-seal to re-seal shift towards safer (counts) |
| **D, Defend Your Community** | Peer Shield; Shieldfin; picking the right channel | Shield succeeded without a trap tile, or used Shieldfin | Peer Shield success rate, trap-tile rate, most-built lines |

**Link to national campaigns (for the facilitator toolkit, in our own words, no logos):**
- Spot, Hold, Identify and Evaluate line up with **Check**.
- Lead and Defend line up with **Tell**.
- ByteBuddy's hygiene tips line up with **Add**. This is the "I can ACT against scams" Add / Check / Tell framing [S17].
- Hold reflects CSA's "Stop and Check" advice to take a cognitive break before responding [S18].

### 6.2 Guardians
Guardians are earned by **demonstrated skill, using deterministic rules** (`packages/engine/guardians.ts`; each rule is a pure predicate over the squad's events for the mission).
- No loot boxes, no randomness, no shop, no currency.
- The **Bond Book** shows every rule in plain words.
- Credit is **shared by the squad**: the bond is copied to every member's device. The server records only "squad X bonded Guardian Y in session S" as an aggregate count.
- **Each Guardian's ability can be used once per mission, by any seat.** The first press wins, and the server ignores duplicates.

| Guardian | Skill | Earned when (rule id) | Ability in play |
|---|---|---|---|
| **VeriFox** | Verification before action | `verifox.independent`: the squad runs *Independent?* on proof supplied by the sender (result: not independent) **and** the decision verifies through a channel the sender doesn't control (the registry, the number in the official app or on the card). | **Cross-check:** drag any claim onto VeriFox. The Verify Desk checks it against the city's fictional Trusted Directory: *Verified / Contradicted / Can't verify from here*. |
| **Echo** | Help-seeking and consultation | `echo.consult`: the chosen Exit or sub-choice consults a trusted person, **or** a trusted-adult Channel tile is played in Peer Shield. (Not "everyone tapped Said it".) | **Invite:** deals a Steelman card to a random teammate (Pass always available) and adds +60 s to Explain. In solo it brings in the Echo Council's counter-view. |
| **Beacon** | Personal safety and escalation | `beacon.channel`: on the Channel Map, the genuine safe channel is picked over a decoy (e.g. a scammer's "compliance hotline"), **or** the Late Hold recovery is chosen. | **Light the path:** lights up safe exits and channels in the Path lens on every squad phone, and dims the decoy. |
| **Shieldfin** | Refusal and peer support | `shieldfin.shield`: Peer Shield reaches *Open* with no blame, shame or dismiss tile in the final message. | **Shield:** flick it to block a Pressure Surge. It swims across every teammate's screen, protecting other players from a pressure event. |
| **Cluepaw** | Situational awareness | `cluepaw.quiet`: the scene's designated quiet clue is pinned **without a hint**. | **Sniff:** paw prints lead every squad phone to one key clue nobody has pinned yet. |
| **ByteBuddy** | Cyber hygiene | `bytebuddy.scan`: Scan correctly flags an unsafe link, permission or data request, without flagging the genuine one. | **Scan:** outlines lookalike domains, over-reaching permissions and requests for codes or OTPs on the in-scene phone. |

**Bond marks** (on the device only):
- **I:** the first demonstration.
- **II:** the same skill in a **different district**.
- **III:** the skill in a **Wildcard** mission or at the **Return visit**. This rewards transfer and retention, not grinding.

Each mark adds a cosmetic fold: a second colour, a trail, a note in the Guardian chord.

### 6.3 Delayed Consequence Engine (DCE)
The DCE is a pure TypeScript module in `@shieldquest/engine`. The same module runs **on the server for squads** and **on the device for solo**.

```ts
type SeedTrigger =
  | { kind: 'nextMission' }                       // squad: next MissionOpen slot
  | { kind: 'minutes'; min: number; max: number } // squad: earliest wall clock, then next safe slot
  | { kind: 'afterMissions'; n: number }          // solo: after n more Moments
  | { kind: 'finale' }                            // squad: Long Fast-Forward (55:00); solo: Nightfall
  | { kind: 'nextLaunch' }                        // solo: "While you were away…"
  | { kind: 'return' };                           // Return visit (neutral or positive only, lint-enforced)

interface Seed {
  id: string;                                   // 'easy-money.A.restricted'
  polarity: 'risk' | 'protective' | 'neutral';
  trigger: SeedTrigger;
  slots: Array<'missionOpen' | 'lookUpTeaser' | 'finale'>; // where it may surface
  conditions?: { all?: string[]; any?: string[]; none?: string[] }; // squad flags
  effects: {
    wallet?: number;          // in-fiction S$ (squad / solo)
    trust?: number;           // district Trust Meter delta for this squad's city (-3..+3)
    risk?: number;            // hidden risk level delta (0..3), revealed on delivery
    setFlags?: string[];      // e.g. 'accountRestricted', 'dataLeaked'
    clearFlags?: string[];
    roomLanterns?: number;    // MUST be >= 0 (room lanterns never decrease)
  };
  reveal: {
    timelineLabel: string;    // '+3 weeks'
    sceneId: string;          // authored 20-30 s outcome sequence
    captionKeys: string[];
    forecastKey?: OutcomeToken;                 // checked against sealed forecasts
    trace: { questionKey: string; optionKeys: string[]; correctIndex: number }; // Ripple Trace
  };
  recovery?: { lateHoldId: string };  // REQUIRED when polarity === 'risk' (moment-lint)
  chainsTo?: string[];                // Seeds planted when this one fires
}

interface ScheduledSeed {
  seedId: string; squadKey: string; plantedAt: number; earliestAt: number;
  status: 'pending' | 'delivered' | 'expired';
}
```

**Scheduling rules:**
1. **Planting:** at Release, the engine reads the decided Exit's `seeds[]`, filters them by `conditions` against the squad's flags, and pushes `ScheduledSeed`s into the squad's queue (held in memory and snapshotted).
2. **Delivery happens only at safe boundaries.** The phase machine calls `dce.due(queue, now, boundary)` only at:
   - `MissionOpen` (the Aftershock slot);
   - `LookUp` (an anonymous class-level teaser on the Big Screen only, e.g. "Somewhere in Digi-District, a bank notice is on its way…");
   - `Finale`.

   Seeds are **never** delivered during Live, Investigate, Think, Reveal, Explain, Re-seal or Peer Shield.
3. **At most 2 Seeds per squad per slot.** Any overflow rolls to the next slot. **Finale delivers everything still pending** except `return` threads, so nobody goes into the post-assessment with an unresolved misconception.
4. **Delivery sequence** (≤ 90 s): Timeline Ribbon fast-forward, then **Ripple Trace** (each phone privately taps which earlier choice planted it; aggregate accuracy only), then the consequence scene, then the **forecast check**, then **Late Hold** for risk Seeds.
   - **Forecast check:** the device compares against its own sealed token; the squad sees "3 of 5 forecasts matched".
   - **Late Hold** (30 s, "Ren is panicking. What now?"): coming forward relights a lantern and counts towards Beacon.
5. **Shadow check.** If the squad chose a safe Exit, the Aftershock slot plays its Afterglow and then a 10 s card: *"Meanwhile, in another timeline…"*. The card shows the risky branch's outcome so every squad's forecast can still be checked (KPI 3 signal).
6. **State:**
   - **Wallet** is in-fiction money per squad.
   - Each squad's city has a per-district **Trust Meter** (the proposal's Trust Meter). It can fall, and recovery raises it again.
   - **Risk** stays hidden until a Seed reveals it.
   - **Flags** change later scenes. For example, `accountRestricted` makes Ren's card decline in a later Retail mission, and a recruiter may message again.
   - The room's **City Pulse** (lanterns on the projector) **only ever increases**.
7. **Deterministic:** `dce.step(state, event, now) → state` is pure, and Vitest tests it with fixed clocks.

**Feedback Card template.** It is mandatory and moment-lint enforces it:
> **[Tactic]** is designed to **[effect]**. A safer move is **[action]**. If it already happened, **[recovery]**.

It must include a recovery line and must not use any word from the victim-blaming lexicon (e.g. *fell for, should have known, careless, stupid, greedy, deserved*). Those words may appear only inside labelled trap tiles.

### 6.4 Peer Shield Mode
- **Setup:** the story jumps ahead ("Two days later…"). A friend NPC is frozen at *their* second. There are two variants:
  - **Rewind:** before the harm (they're about to say yes).
  - **Rescue:** after the harm ("my account kena frozen… don't tell anyone pls").
- **Four slots: Opener, then Reason, then Offer, then Channel.** Tiles are **dealt by seat from authored data, never by chance**:
  - Opener tiles go to two seats.
  - Reason tiles to the Influence Tracer or Future Reader.
  - Offer tiles to the Peer Supporter.
  - Channel tiles to the Safety Lead.
  - Each seat holds 3 tiles, including traps.
  - With 4 seats, roles merge. 10-13 uses 3 slots.
- **Tile tags:**
  - Helpful: `empathetic`, `offender_focused`, `factual`, `concrete_offer`, `safe_channel`, `bridge`, `honesty` (Branch A only, e.g. "I did it and I'm reporting it. Don't follow me.").
  - Traps: `blame`, `shame`, `dismiss`, `cover_up`, `secrecy_pact`, `lecture`, `fear_only`, `decoy_channel`.
- **Meters:** **GUARD** (how defensive the friend is) and **DOUBT** (how much they doubt the scam). Each runs 0-5 and is shown with an icon, a word, a number and segments. The friend's pose and face react to every tile.
- **Rule evaluator** (ordered tag rules; tunable per mission):
  - `empathetic` opener: GUARD −2.
  - `blame` or `shame`: GUARD +3, arms cross, "You don't get it". Echo suggests a softer opener, and **one retry** is allowed (practice, not penalty).
  - `offender_focused` or `factual` reason: DOUBT +2.
  - `concrete_offer`: DOUBT +1, GUARD −1.
  - `safe_channel`: **success if GUARD ≤ 2 and DOUBT ≥ 3**.
  - `decoy_channel`: Beacon prompt.
- **Sending:** the **Peer Supporter** taps SEND. If they're disconnected, any seat can after 20 s.
- **Follow-up turn** (14-24): e.g. the friend says "Promise you won't tell anyone". The squad picks between the `secrecy_pact` trap and a `bridge` tile.
- **Pressure on the friend:** the recruiter fires a final "last chance" message at the friend, which Shieldfin can block.
- **No free text anywhere.** The debrief's **Shield Lines Wall** shows the room's most-built combinations and how the friend reacted.

### 6.5 Think-Vote-Explain

**Squad version** (5.3, steps 4-7):
- Private forecast, then a private seal with confidence, then an anonymous reveal (dots, or Mood for 10-13).
- Then Explain, using role sentence starters, reason chips that show only when ≥ 2 share them, a random Steelman card and spoken talk.
- Then a private re-seal; the majority decides, and the Safety Lead breaks ties with a visible reason.

**What is stored:**
- **In memory only (plus a crash snapshot deleted when the session closes, 24 h at most):** `{voteId, seatId, exitId, confidence, forecast}`.
- **Persisted** per squad and mission:
  - first-seal counts per Exit;
  - a confidence histogram;
  - forecast counts;
  - re-seal counts;
  - switches (towards safer / towards riskier / unchanged);
  - the decided Exit and whether the tie-break was used.
- **No row anywhere links a seat to a vote once the session closes.**

**Solo version, "Echo Council":**
- After you seal, three ghost squadmates reveal their seals, each with a one-line reason, including the tempting wrong one ("It's only once, and Dev did it"). They are **clearly labelled as characters**.
- A **Ghost Squad** bar shows real anonymous aggregates for that mission and band, **only once ≥ 20 responses exist**. Before that it reads "Not enough votes yet".
- **Change a mind:** drag one of your pinned clues onto the character whose reasoning it answers. A good match makes them visibly reconsider; a weak match gets "Hmm, that doesn't answer my point."
- Then you may re-seal.

### 6.6 Rotating roles and lenses

| Role | Lens | Sees | Job | Letter |
|---|---|---|---|---|
| **Safety Lead** | Path | Safe exits as glowing doorways, trusted channels, decoys | Breaks re-seal ties with a reason; taps Share for Spotlight; holds Channel tiles | L |
| **Evidence Checker** | Clue | Clue halos, metadata (account age, URL anatomy, image inconsistencies), the *Independent?* test | Tests proof | S |
| **Peer Supporter** | Heart | NPC thought bubbles, pressure auras, hidden notifications | Leads Peer Shield and taps SEND | D |
| **Influence Tracer** | Thread | Hidden strings and secondary beneficiaries (e.g. the friend's referral bonus) | Plays "who gains" in Explain | I |
| **Future Reader** | Ripple | Ghost futures, tagged likely / possible / unknown, never answers | Plays the "what next" card | E |

- **Rotation:** role = `(seatIndex + missionIndex) mod 5`.
- **Merges:**
  - 4 players: Ripple merges into Path.
  - 3 players: Thread also merges into Clue.
  - 6 players: one extra **Shadow Clue** lens.
  - 10-13: 3 lenses only (Clue, Heart, Path).
- **Late joiners** take an open lens or a Shadow Clue lens at the next phase boundary.
- **Everyone** can Hold, Inspect, Pin, Pull visible Strings and vote. Lenses add *unique* evidence; they don't gate participation.

---

## 7. Modes

### 7.1 Solo (QR, no login)
- **Entry:** `/solo`, from posters, the take-home card, or the community activation.
  - **Gate:** disclaimer and data notice.
  - **Comfort Settings:** text size, captions, reduced motion, sound and haptics, 2D mode.
  - **"Which fits you best?"** Primary / Lower Secondary, Upper Secondary, or Post-secondary / working. This sets the band. **The game never asks for a date of birth.**
- **No account.** Progress (Bond Book, Counter-Playbook, Moment Atlas, Home Block, If-Then card) lives in IndexedDB.
  - Moving to another device is done by **exporting progress as a QR code or file**. Nothing is stored on a server.
- **Each Moment takes 5-7 min** and follows the same anatomy as squad play, with these changes:
  - a **Lens Dial** (thumb dial switching between all 5 lenses; some clues appear in only one lens);
  - the Echo Council;
  - Peer Shield with a 6-tile hand and unlimited retries.
- **A City Day** is 3 Moments, about 18 min. Then **Nightfall**: due Seeds land, the Trust Meter updates, and the game says "The city is resting". It is a natural stopping point, not an endless feed.
- **On the next launch:** a captioned **Metro FM "Morning After"** bulletin delivers any `nextLaunch` Seeds ("While you were away…"). There are **no push notifications**.
- **Rewind** unlocks after the first, authentic playthrough, so players can explore other branches (7.6, 8).
- **Fully offline** after the first load. Anonymous counters (mission, band, Exit, campaign tag; no identifier) queue up and send when the device is back online.

### 7.2 Squad session: the 90-minute run sheet
**Joining:**
- The projector shows a big QR code, the room code (6 characters from `[A-HJ-NP-Z2-9]`, e.g. `H7KQ2M`) and a short URL, `/j/H7KQ2M`. Totem tent cards carry `/j/H7KQ2M/hornbill`.
- Phone flow:
  1. Gate (disclaimer and plain-language data notice).
  2. Comfort Settings.
  3. **Session code** shown large.
  4. Tap your table's totem.
  5. An automatic pseudonym (colour plus object, e.g. "Teal Kite"). **No name is ever typed.**
- Squads are 4-5 players; 3-6 is supported.
- **Shared Seat:** pass-and-play on one device, with a cover screen for private votes.
- **Reclaim Seat:** tap your totem again and choose an open seat. No identity is needed.

| Clock | Segment | What happens |
|---|---|---|
| 00:00-03:00 | **Onboarding** (15 min total) | Welcome cinematic over ShieldQuest City at 11:59. Ground rules (respect; you never have to share anything personal; Pause and Pass are always OK). Facilitator reads the disclaimer aloud. |
| 03:00-06:00 | | QR join, Comfort Settings, session code (also written on a paper slip), totems. |
| 06:00-11:00 | | **Calibration (pre-assessment)**, Form A or B. In the background, the 3D chunk and today's mission packs prefetch and a 1 s tier benchmark runs. |
| 11:00-13:00 | | **Six Beats:** each S.H.I.E.L.D. letter lights a district and a Guardian silhouette while the facilitator explains it. |
| 13:00-15:00 | | **The Room Freeze** (45 s), then the **Practice Freeze**, "The Free Bubble Tea Poster" (75 s): orbit, inspect, pin, seal. Roles are dealt. |
| 15:00-28:00 | **Gameplay** (45 min total) | **Mission 1 (Guided).** |
| 28:00-29:30 | | **Look Up #1:** Freeze All Phones, "Eyes up, stretch with us". The Big Screen shows the City Pulse and an Aftershock teaser. |
| 29:30-44:00 | | **Mission 2 (Light)**, opening with its Aftershock slot. |
| 44:00-45:30 | | **Look Up #2.** |
| 45:30-55:00 | | **Mission 3, the Wildcard Sprint, or a Peer Shield mission.** **Dropped automatically if the room is more than 4 min behind**; squads then get Bonus Holds (Cluepaw's hidden clue). |
| 55:00-58:00 | | **The Long Fast-Forward:** the projector sun arcs through "+2 weeks", every remaining Seed lands, and Late Hold recoveries run. |
| 58:00-60:00 | | Buffer. |
| 60:00-62:00 | **Debrief** (20 min total) | **The Rewind:** the session plays backwards on the projector (lanterns sink, coins fly back) and stops on Mission 1's frozen second. Phones are dark. |
| 62:00-65:00 | | **Flip the Board:** the city turntable rotates 180° to reveal the manipulator's backstage corkboard. Every tactic used in the session is strung to the exact moment it was used. *"It was never Ren's fault. It was a script."* |
| 65:00-74:00 | | **Three Stop Frames** with scripted prompts: <ol><li>Minds changed towards safer (room level, positive only).</li><li>Clue heatmap on the 3D scene, the most-missed clue (Cluepaw pounces), and the room's LIVE vs HELD totals.</li><li>The Aftershock reel told from the manipulator's playbook side, plus forecasts vs outcomes.</li></ol>Phones become the **Debrief Companion**: preset anonymous polls and an "I see it differently" signal. |
| 74:00-78:00 | | **Shield Lines Wall** and the peer-intervention discussion ("What would you actually say to Dev?"). Optional 2-minute pair role-play. |
| 78:00-80:00 | | **Carry It Out:** <ul><li>A private **If-Then card**, built from chips and kept on the device: "If someone rushes me with money or a secret, I will ___ and talk to ___ (a role like 'my sister', not a name)". It can be saved as a lock-screen image watermarked with the disclaimer.</li><li>The **Help Card** (9.5).</li><li>S.H.I.E.L.D. mapped to Add / Check / Tell.</li></ul> |
| 80:00-86:00 | **Evaluation** (10 min total) | **Calibration (post-assessment)**, the other form. The session code is pre-filled. |
| 86:00-89:00 | | Feedback: 5 usability items plus engagement and clarity questions. |
| 89:00-90:00 | | **Closing:** the Stillpoint ticks to 12:00 and the city lights up. *"You can't freeze time out there. But you can Hold."* A take-home **Return Pass** card (QR to `/return`, space to write the session code) and the solo QR. |

Screen time stays within the risk assessment's 15-20 minute bursts: missions are 9-14 min, with Look Up breaks between them and dimmed "Eyes up" screens during Explain.

### 7.3 Conductor console and Big Screen
- **Routes:**
  - `/conduct/:room` on the facilitator laptop.
  - `/screen/:room` on the projector, as an extended display.
  - If the projector can only mirror the laptop, the facilitator pairs their phone as a remote by scanning a QR code on the Conductor.
- **Pre-flight (10 min before the session):**
  - Create or open the session: band, playlist (2 core missions plus 1 optional), reveal mode, Discreet or Open, Pressure Surges on or off, Relaxed timing, narration.
  - **Network check:** a test QR code joins over the room's Wi-Fi and reports *Live / Fell back to polling / Blocked*. If blocked, show a slide: "Use mobile data: under 3 MB for the whole session."
  - A projector readability test slide.
  - Print totem tent cards (print CSS).
- **Squad grid** (one card per totem): devices connected, current phase letter, sealed count (n/N), pin count, Guardians, **agreement state (United / Mostly agree / Split; never the counts)**, "needs help" flags, and the anonymous number of players currently on Pause.
- **Controls:**
  - Start / Next (one big button that always does the right thing).
  - +30 s, Skip phase, Skip scenario (for sensitive content).
  - **Freeze All Phones** (the Look Up break).
  - **Calm Mode** (slows timers, mutes pressure audio, plays a calm bed on the Big Screen).
  - Gentle mode per squad (no surges, no countdown visuals).
  - Reassign or merge squads.
  - **Spotlight squad**: puts that squad's Evidence Board on the Big Screen, **only after its Safety Lead taps Share**.
  - **Show room shift**: positive trajectories only.
  - Trigger Aftershock now.
  - Auto-pacing suggestions with an ahead/behind indicator.
  - A script panel with prompts for the current phase.
  - The debrief timeline scrubber.
  - **Rehearsal mode** with bot squads.
- **Room-level raw vote counts** appear on the Conductor only, and only when the room has n ≥ 5. **The facilitator never sees an individual's vote or session code.**
- **Big Screen views:** Lobby (QR and towers lighting up), Six Beats, Calibration progress ring, Room Freeze, Live Scene, Seal Wall, Ripple Map, Look Up / City Pulse, Long Fast-Forward, Rewind, Flip the Board, Spotlight, Shield Lines Wall, Closing.
  - **The Big Screen never shows:** anything about an individual, squad rankings or scores, or any raw split showing how many chose the risky option.

### 7.4 Scenario Management Portal and Youth-Created Missions
**Portal (`/portal`).** Adults only (team, educators, facilitators). Sign-in is by email magic link. Roles: *Author*, *Reviewer/Approver*, *Facilitator*. Every action is recorded in an audit log (`moderation_log`).
- **Moment Library:** filter by district, band, tactic, letter and status. A **coverage matrix** of tactic × band shows gaps in the content.
- **Scene Composer:**
  - pick a set; place props from the procedural kit (about 60 props) on a grid; place NPCs with pose and expression presets;
  - attach clues to anchors (lens, letter, genuine or red herring, quiet, tactic, front and back text);
  - define strings with Gain Tags; set camera bookmarks;
  - **live 3D preview on the same engine** with a band switcher, and a "Preview on phone" QR code.

  At MVP the Composer MAY be form-plus-JSON with the live preview.
- **Script editor:** beat timeline, Exits, the Feedback Card template, the **Ripple Editor** (Seeds, triggers, effects, Ripple Trace question, Late Hold link), Peer Shield tiles and rules, band variants, glossary and captions.
- **moment-lint** runs live and in CI. It checks:
  - the schema;
  - reading level per band;
  - the victim-blaming lexicon;
  - PII regexes (NRIC/FIN `[STFGM]\d{7}[A-Z]`, SG phone `(\+65[\s-]?)?[3689]\d{3}[\s-]?\d{4}`, emails, URLs other than `.test`/`.example`, @handles, runs of 8+ digits);
  - real brands and institutions;
  - **outdated channels** (`71999`, `1800-722-6688`, "ScamAlert");
  - that every risk Seed has a recovery;
  - that every Exit has a feedback card;
  - that `return` Seeds are not of polarity `risk`;
  - that no legal-penalty text appears in the 10-13 band.
- **Publishing needs two sign-offs:** (1) content accuracy, with a cited source key and a review-by date; (2) safeguarding and tone. Every version is kept. Publish and unpublish work per band.
- **Help Card editor:** the single central list of real-world channels, each with its source and as-of date (9.5). It is re-verified before each pilot.
- **Publish pipeline:**
  1. validate;
  2. lint;
  3. render narration to Opus via Polly;
  4. bump the content version, which invalidates phone caches;
  5. regenerate the Flat View glyph data and the printable kit (print CSS).

**Youth-Created Missions ("Moment Cards").**
- Available in the PWA after the debrief and in solo. Submitting needs a **maker code** printed on the take-home card for each cohort, which limits spam.
- A chip-first template:
  - district and setting;
  - who is pushing (a role only: stranger / friend / online seller / "company");
  - the offer or pressure (chips plus ≤ 140 characters);
  - 1-3 warning signs, picked from the Counter-Playbook;
  - the safer move;
  - the recovery move.
- **The PII scrubber runs on the device and on the server** (the same regex set as moment-lint, plus a school-name list and profanity). Submission is blocked until flagged items are removed, with the reminder *"Fictional only, no real people or places."*
- **Contributors are never asked about their own experiences.**
- **Moderation queue:** an educator approves, edits, or returns the card with reason codes. An approved card becomes a draft Moment on the nearest set. The team builds it out and it goes through the full two-signature publish.
- Published missions carry a **"Made by youths in a ShieldQuest session"** badge, credited to the squad totem and pilot (e.g. "Squad Hornbill, NYP Pilot 1"). Never a name.
- They are released **in batches between pilots, not weekly**.

### 7.5 Analytics dashboard (aggregated only)
- **Stored:** the `event_counts` table, keyed by `(sessionId, squadTotem | null, missionId, metric, bucket)`, plus `vote_aggregates` and `solo_counters`. There is **no per-seat row and no per-seat endpoint.**
- **Views:**
  - **Session:** join and completion; scenario completion; hold rate and latency histogram; LIVE vs HELD totals; per-clue discovery heatmap; first-seal vs re-seal shift; forecast and Ripple Trace accuracy; Peer Shield success and trap-tile rate; Guardians bonded per session; time per phase.
  - **Scenario, across sessions:** difficulty, most-missed clue, band comparisons, branch distribution.
  - **Impact:** pre/post KPI deltas with 95% confidence intervals (from the separate assessment schema).
- **Suppression:** **any cell with n < 5 shows "< 5"**, enforced in SQL views (`v_*`) that the dashboard reads exclusively. CSV exports are aggregate only.

| KPI | Primary measure (Calibration, 7.6) | In-game signal (aggregate, never per person) |
|---|---|---|
| 1. Risk recognition | Twin pairs (genuine vs fake) with confidence: accuracy, **d′**, criterion **c** | Flags found while held; most-missed clues |
| 2. Decision accuracy (transfer) | 3 held-out vignettes never used in gameplay | Wildcard first-seal safer rate |
| 3. Consequence awareness | Consequence Timeline items (Now / Days / Weeks; who is affected) | Forecast accuracy, Ripple Trace accuracy |
| 4. Peer-intervention confidence | 3 self-efficacy Likert items plus 1 situational-judgement item | Peer Shield success and trap-tile rate |
| 5. Retention | Form C at the Return visit vs post | Return completion count |
| 6. Engagement | Session and scenario completion, average duration | Voluntary replay: solo Moments started with the workshop campaign tag, Rewinds |

### 7.6 Pre/post assessment ("Calibration") and the Return visit
- **Session code:** generated by the server with a cryptographic RNG at join. Format: **FOODWORD-XXX**, e.g. `KAYA-7K2`, from a curated 256-word list plus 3 characters from a 31-character alphabet with no 0/O/1/I/L.
  - Shown large on screen, written on a paper slip, stored in `localStorage`, and pre-filled for the post-assessment.
  - **Stored only in the `assess` schema.** Never in gameplay tables, URLs, query strings or logs. No email or phone is ever collected.
- **Forms:** A, B and C are parallel. **A and B are counterbalanced by the parity of the code's hash**, so half the room sees A first.
  - Items are **2D DOM, quick, and never 3D**, so the quality of a player's phone can't bias their score.
  - **Pre** takes about 5 min (12 items):
    - 6 Twin pairs (KPI 1);
    - 3 transfer vignettes (KPI 2);
    - 3 consequence items (KPI 3).
  - Confidence items (KPI 4) appear in both pre and post.
  - **Post** takes about 6 min and adds the feedback form.
  - Items are piloted for difficulty in co-design Weeks 1-3.
- **Return to ShieldQuest City** (`/return`, 2-4 weeks later):
  - The partner sends the link through its own channel. We send nothing.
  - Entering the code opens **Form C**.
  - It also opens **one Wildcard Moment** and the **"jammed Freeze" frame**. In that frame, HOLD fails for one second, and the player must make a real-world Hold: put the phone face down for 10 s, stop replying, and choose *who* to tell. This corrects the "there's always time" misconception.
  - Plus the neutral continuation of an earlier friend's story.
  - Bond mark III can be earned here.
- **Paper backups** carry the same code (the 140 printed forms in the budget).

---

## 8. Progression and replay
Replay comes from **curiosity, mastery, contribution and story**. It never comes from chance, purchases or ranking.

1. **Moment Atlas:** each mission has a branch tree of 4-8 endings, including delayed ones.
   - Branches you haven't seen show as folded paper with a one-word hint.
   - **Rewind** unlocks only after the first, authentic playthrough.
   - Risky branches are framed as *case files about the manipulator*. Seeing every branch folds a small medal onto that mission's pin.
2. **Counter-Playbook:** pages for 10 tactics: Urgency, Too-good reward, Secrecy, Social proof, Fake authority, Friend referral, Foot-in-the-door, Fear/threat, Lookalike link, Pay-to-unlock.
   - A page unlocks when you **spot** the tactic (pin it or name it), never when you fall for it.
   - It fills with up to 3 sightings from different surfaces, side by side, plus a one-line counter-move. It doubles as a take-home field guide.
3. **Guardian Bond Book:** 6 Guardians × 3 Bond marks. All rules are visible; marks are cosmetic.
4. **Your Home Block** (solo): finishing Moments restores your home block (lights, plants, a kopi stall reopening, Guardians perched around it). Deterministic and cosmetic.
5. **Return to ShieldQuest City:** the 2-4 week event (7.6).
6. **New Moments:** reviewed batches and approved Moment Cards arrive with a soft ripple on the map.
7. **City Pulse:** room-level lanterns during a session. *(A pilot-wide "Community Light" city is deferred.)*
8. **Private mirrors, computed on the device and never uploaded:**
   - "Calm Hold" (you held before the first LAST CHANCE beat);
   - "Clean Hold" (you pinned every genuine flag);
   - your Calibration before-and-after Growth Card.
9. **Safe share card:** a Guardian or S.H.I.E.L.D. badge card with the disclaimer and a QR code to `/solo`. It **never shows a scam message or frame** and carries no comparison numbers.

**Deliberately absent:** loot boxes, random drops, currency, shops, leaderboards, squad or school rankings, streaks, push notifications by default, timers on rewards, and any score tied to personal disclosure.

**Deferred past Week 24** (none of these is a grant commitment):
- Quick Holds;
- Kiosk mode;
- solo avatar maker (solo gets Shuffle only);
- Pressure Dial;
- Photo Mode / Postcards;
- festive cosmetics;
- Night Watch remixes;
- pilot-wide Community Light;
- Squad Block persistence;
- Locker stickers;
- extra districts.

---

## 9. Content plan

### 9.1 Source key
Every helpline, legal or statistical line carries one of these keys in the Portal, with its as-of date. Re-verify before each pilot.

| Key | Source (publisher, document, date) |
|---|---|
| S1 | SPF, *Contact Us* (ScamShield Helpline 1799, 24/7; 999; SMS 70999; Police Hotline 1800 255 0000; i-Witness; "Government officials will never ask you to transfer money or disclose bank log-in details over a phone call"). As of 2026-10. police.gov.sg/contact-us |
| S2 | SPF, *Change of police emergency SMS sender ID from 71999 to 70999* (effective 1 Oct 2024) |
| S3 | SPF, *Annual Scam and Cybercrime Brief 2025* (released 25 Feb 2026) |
| S4 | SPF, *Mid-Year Scam and Cybercrime Brief 2026* (26 Aug 2026) |
| S5 | SPF, *CDSA and CMA Bill amendments* (in force 8 Feb 2024) |
| S6 | MHA, *Commencement of amendments to the CMA and CDSA* (8 Feb 2024) |
| S7 | SPF, *Misuse of SIM Card Offences* (commencement date not verified; do not state it) |
| S8 | SPF, *Caning for scams and scam-related offences* (offences from 30 Dec 2025) |
| S9 | MHA, written reply on unwitting money mules (15 Oct 2025) |
| S10 | SPF, *Advisory on the compromise of WhatsApp accounts* (12 Mar 2026) |
| S11 | MinLaw, *The Online Safety Commission begins operations on 29 June 2026* |
| S12 | OSC, *Get support from our partners*; tinklefriend.sg; sos.org.sg; mindline.sg (as of 2026-10) |
| S13 | MSF, *Triage and pre-court diversionary programmes* (Guidance Programme) |
| S14 | SPF, *Annual Crime Brief 2025* (24 Feb 2026) |
| S15 | SPF, *Mid-Year Crime Brief 2026* (24 Aug 2026): CCTV / facial recognition, STAR programme |
| S16 | MHA, *Reasons for rise in youths investigated for shop theft* (9 Sep 2026) |
| S17 | ScamShield, scamshield.gov.sg homepage and *I can ACT against scams* page (updated 23 Jul 2026) |
| S18 | CSA, *Stop and Check* campaign (Sep 2025-2026) |
| S19 | SPF, e-Services *Lodge Police Report* |
| S20 | SPF, shop theft press releases (Penal Code s380; look-outs liable, s34). **Medium confidence: verify on sso.agc.gov.sg before quoting** |
| S21 | SPF, advisory on fake platforms selling gaming accounts (25 Nov 2022). Tactic only; **no current SG statistics** |
| S22 | gov.sg, *gov.sg SMS Sender ID* (Jul 2024). Medium confidence |
| S23 | SPF, islandwide operation, 231 suspected scammers and money mules aged 14-84 investigated (13 Feb 2026) |

### 9.2 Launch missions (12 missions, 26 band variants)

| # | Title | District / Set | Bands (**primary**) | Theme | Focus · Guardians |
|---|---|---|---|---|---|
| M01 | Free Skins | School Street / S2 (DIVE to Arcade) | **10-13**, 14-16 | Game scam | S, I · ByteBuddy, Echo |
| M02 | The Screenshot | School Street / S2 | **10-13**, 14-16, 17-24 | Cyberbullying | I, L, D · Echo, Shieldfin |
| M03 | The Bus Stop Pickup | School Street / S1 | **10-13** | Stranger approach | H, E, L · Beacon |
| M04 | Lend Me Your Login | School Street / S1 poly-gate variant | **17-24**, 14-16 | Digital identity | I, E · VeriFox, ByteBuddy |
| M05 | Five-Finger Dare | Retail / S3 | **14-16**, 10-13 | Shop theft, dare, look-out | H, I, E, D · Echo, Shieldfin |
| M06 | Prank for the Feed | Retail / S4 | **14-16**, 17-24 | Harassment, risky dare | I, L, D · Echo, Shieldfin |
| M07 | The Lucky Draw Booth | Retail / S3 | **10-13**, 14-16, 17-24 | Online safety, data requests | S, E · ByteBuddy, VeriFox |
| M08 | SIM for Fifty | Retail / S3 phone-shop variant | **17-24** | Suspicious request, SIM misuse | I, E · VeriFox, Beacon |
| M09 | Easy Money (flagship) | Digi / S5, DIVE to QuikGig | **17-24**, 14-16 | Money-mule recruitment | S, H, I, E, L, D · all |
| M10 | Behind the Stall | Digi / S6 (DIVE from S4) | **14-16**, 10-13, 17-24 | E-commerce pre-order scam | S, E · VeriFox, ByteBuddy |
| M11 | Parcel Re-delivery | Digi / S5 | **14-16**, 10-13, 17-24 | Phishing | S, H · ByteBuddy, VeriFox |
| M12 | Like-for-Cash | Digi / S6 + S5 | **17-24**, 14-16 | Job / task scam | E, H, L · VeriFox, Echo |

**Totals:** 26 variants, plus 2 Peer Shield missions × 2 bands = 30, plus the tutorial × 3 bands = **33 reviewed scenarios**, within the grant's 30-40. The NYP pilot (17-24) has **9 mission variants plus PS1** to choose from.

---

**M01 Free Skins** (School Street, canteen. **10-13**, 14-16)
- **Premise:** Kai, 12, gets a ChatLah DM from "ProGamer_Zed": a rare skin bundle "free, just send me the 6-digit code you'll get by SMS so I can gift it, 5 mins only". Classmate Mira says "I did it, got mine".
- **Clues:**
  - the code request;
  - the "5 mins only" deadline;
  - a profile created this week;
  - the quiet clue: Mira's account is suddenly posting the same offer, because her account was taken over;
  - the red herring: a genuine event banner inside the game's own app.
- **Exits:**
  - A: send the code.
  - B: ask Zed for proof (he sends a fake screenshot).
  - C: don't send it, screenshot the chat, tell a trusted adult, report in the game.
  - (14-16) D: ask Mira in person how she got hers.
- **Delayed:**
  - *Risk, next mission:* Kai's game account is taken over, his items are gone, and his account sends the same "free skins" DM to his friends. Recovery: tell a parent or teacher, use the game's own recovery page, warn friends.
  - *Protective:* Kai's warning in the class chat stops two friends; Mira gets her account back with an adult's help.
- **Lines:**
  - "Never share one-time codes, even with friends." [S10]
  - **No statistics**, since there is no current SG gaming-scam data. [S21]
  - Help: trusted adult; Tinkle Friend 1800-2744-788 (Mon-Fri); mindline 1771 (24h) [S12].

**M02 The Screenshot** (School Street, locker corridor. **10-13**, 14-16, 17-24)
- **Premise:** in class group chat "3B Chill", someone posts an edited photo of classmate Jun Hao with a mocking caption. Fourteen laughing reacts arrive in 30 s. A friend says "add a sticker lah, everyone is".
  - 17-24 variant: an edited photo of a coursemate in a CCA chat.
- **Clues:**
  - the poster gains attention (Thread);
  - Jun Hao's status flips to offline and the Heart lens shows a hurt bubble;
  - the forward count is climbing;
  - red herring: a normal class announcement in the same chat.
- **Exits:**
  - A: add a sticker or forward it.
  - B: stay silent.
  - C: don't forward, message Jun Hao privately ("you ok?"), report the post on the platform, tell a teacher.
  - (17-24) D: call it out in the group. Partly safe, with a social cost.
- **Delayed:**
  - *Risk:* the screenshot spreads beyond the class with Aisha's sticker still on it, and Jun Hao skips CCA. Recovery: delete your own reaction, apologise privately, report the reposts, tell a teacher.
  - *Protective:* two classmates follow Aisha's lead, the post is removed, and Jun Hao says thanks.
- **Lines:**
  - "Report it on the platform first. For harassment, if there's no proper response within 24 hours, you can go to the Online Safety Commission (osc.gov.sg). Parents or guardians can file for under-18s." [S11]
  - "Singapore has laws against harassment and online harms."
  - 10-13: trusted adult, Tinkle Friend and 1771 [S12].

**M03 The Bus Stop Pickup** (School Street, school gate. **10-13** only)
- **Premise:** after CCA, an adult Wei (11) doesn't know says "Your mum asked me to fetch you, she's busy. Car's at the next block, come quickly before it rains."
- **Clues:**
  - the quiet clue: the adult read Wei's name off his bag tag;
  - no family code word;
  - no message from Mum;
  - the school guard at the gate (a safe exit);
  - red herring: the adult is smiling and friendly. Friendly isn't proof, but it isn't a warning sign either.
- **Exits:**
  - A: go along.
  - B: "I'll call my mum first", calling from beside the guard.
  - C: stay inside the gate with the guard and call Mum.
- **Delayed:**
  - Branch A **never shows harm**. A Late Hold triggers halfway to the car park ("Wei hesitates. What now?") and leads back to the guard and a call to Mum.
  - *Afterglow:* the next day the school sends a notice about a stranger approaching students, and Wei's report helped.
- **Lines:** "If you're in danger right now: call 999. If you can't talk, SMS 70999." [S1, S2]. Beacon's channel map: school guard, teacher, parent.

**M04 Lend Me Your Login** (School Street, poly gate. **17-24**, 14-16 as "Borrow your EduPass for a quick job")
- **Premise:** Priya, 20. A QuikGig "recruiter" offers S$80 to "approve a CityPass login on your phone so my boss can register a company account, 2 mins". Her friend says "my cousin did, easy".
- **Clues:**
  - approving someone else's login;
  - she can't see who they are or where they are;
  - "keep it quiet, competition";
  - the profile is 4 days old;
  - red herring: a real job post on the same board that asks for a CV and an interview.
- **Exits:**
  - A: approve the login.
  - B: ask for the company's registration (a convincing fake arrives).
  - C: refuse, block, keep the chat, tell a trusted adult.
  - D: "Let me think about it" (the recruiter escalates).
- **Delayed:**
  - *Risk, +3 weeks:* a letter says Priya's CityPass was used to open an account linked to scams, her use of high-risk services is restricted, and police want to talk. Recovery: come forward early.
  - *Protective:* her report flags the recruiter.
- **Lines (17-24):**
  - "Giving away your digital ID login to help someone commit an offence is a crime: up to S$10,000 fine and/or up to 3 years." [S5, S6]
  - "The law isn't meant to punish people who were genuinely tricked, so report it." [S6]
  - Restrictions can include using your digital ID for high-risk services [S4].
  - ByteBuddy "Add" tip: passkey logins resist phishing [S4].
  - **Never simulate real Singpass.** CityPass is fictional.

**M05 Five-Finger Dare** (Retail, MiniMart 24. **14-16**, 10-13 as "Keep Watch")
- **Premise:** Darren, 15. Friends dare him to pocket a S$4 lip balm for the group-chat video ("everyone's done it, don't be scared"). One friend will keep watch.
- **Clues:** all social, and **no theft methods are ever shown**:
  - the dare is for the friends' content (Thread);
  - the friend's posted "it's easy" claim;
  - Mum's message about Darren's pocket money (Heart);
  - the store notice that cameras are in use;
  - red herring: staff restocking shelves is just work.
- **Exits:**
  - A: take it.
  - B: be the look-out instead.
  - C: say no, buy it or suggest bubble tea, and walk out together.
- **Delayed:**
  - *Risk, next mission:* Darren goes back to the store days later. The store's camera system recognises him, staff call the police, and his parents are informed. A police investigation follows, and possibly a six-month Guidance Programme instead of court.
  - *Protective:* the friends back off, and one admits they didn't want to do it either.
- **Lines:**
  - "Store cameras can help identify people who come back, even if they weren't caught at the time." [S15]
  - "Young people may be placed on a 6-month Guidance Programme instead of going to court." [S13]
  - The look-out-liability line appears only after verification [S20].
  - Facilitator notes: 4,109 shop theft cases in 2025, and shop theft is among the top offences for arrested youths [S14]; youths *investigated* for shop theft rose 28.8% in H1 2026 [S16].
  - The store chain is fictional.

**M06 Prank for the Feed** (Retail, food court. **14-16**, 17-24)
- **Premise:** Nadia, 16. Her group dares her to film an older cleaner and post it with a mocking caption for a "views challenge" ("it's just a joke, he won't know").
- **Clues:**
  - the challenge account rewards views (Thread);
  - the cleaner's face would be identifiable;
  - previews of comments turning cruel;
  - red herring: someone filming their food.
- **Exits:**
  - A: film and post.
  - B: film but "only for us".
  - C: refuse, swap to a harmless dare, report the challenge account.
- **Delayed:**
  - *Risk:* the clip spreads and the cleaner's family sees it. Nadia's account gets reported, the school counsellor gets involved, and the clip can't be fully pulled back. Recovery: delete it, report reposts, tell a trusted adult, apologise.
  - *Protective:* the group switches challenges.
- **Lines:** platform reporting, then the OSC [S11]; "Singapore has laws against harassment and online harms."

**M07 The Lucky Draw Booth** (Retail, mall atrium. **10-13**, 14-16, 17-24)
- **Premise:** Mei, 12. A promoter offers free bubble tea and a lucky-draw entry for a "Metro Tab" if she scans a QR code and fills in her full name, birth date, address, a parent's phone number and a selfie ("draw closes at 5!").
- **Players inspect the form's fields and never type anything.**
- **Clues:**
  - far more data requested than a draw needs;
  - the QR leads to `metro-luckydraw.test`, not the mall's site;
  - no organiser name and no terms;
  - red herring: the mall's genuine kiosk, which asks only for a star rating.
- **Exits:**
  - A: fill in everything.
  - B: fill in only some of it.
  - C: skip it, ask a parent, use the mall's own kiosk.
- **Delayed:**
  - *Risk, chain:* weeks later, scam messages use Mei's real name and school, which makes them more convincing. This sets the `dataLeaked` flag, which personalises M11.
  - *Protective:* Mei spots the next one faster and tells Mum.
- **Lines:** "Check for scam signs and with official sources." [S17]

**M08 SIM for Fifty** (Retail, phone-accessory shop. **17-24**)
- **Premise:** Hafiz, 18. A friend-of-a-friend offers S$50 per prepaid SIM if Hafiz registers three in his own name and hands them over "for workers who can't register".
- **Clues:**
  - lines in *your* name, used by someone else;
  - "you don't need to know";
  - paid only after handover;
  - hidden string: the middleman is paid per SIM;
  - red herring: the shop's genuine plan promotion.
- **Exits:**
  - A: register and hand them over.
  - B: register just one.
  - C: refuse, keep the chat, tell a trusted adult, give information to police.
- **Delayed:**
  - *Risk:* a line in Hafiz's name was used to contact scam victims. Police get in touch, and his own new mobile lines may be restricted.
  - *Protective:* he warns the group chat.
- **Lines:**
  - "Handing over SIM cards registered in your name for unlawful use can be an offence: up to S$10,000 fine and/or up to 3 years for a first offence." [S7]
  - Restrictions on new mobile lines [S4].
  - "Saw something? Police Hotline 1800 255 0000, or i-Witness." [S1]
  - The single SPF quote: *"Payment accounts, Singpass credentials, and SIM cards are strictly for personal use only."* [S3]

**M09 Easy Money** (Digi-District, neon void deck. **17-24**, 14-16 as "Lend Me Your Account"; **not shown to 10-13**, which gets M01 instead)
- **Premise:** this is the proposal's sample mission.
  - Ren, 19, a poly student; his shifts were cut and his rent share is due Friday.
  - "Mel | QuikGig Partners" offers S$200 to receive money into Ren's Harbour Bank account and transfer it elsewhere: "100% legal, urgent, risk-free, answer in 10 min, don't mention it to your bank".
  - His friend Dev says *"Just try once, everyone does side hustles now."*
- **Clues:**
  - the receive-and-forward request;
  - "100% legal";
  - the deadline;
  - "don't tell your bank" (secrecy);
  - the quiet clue, for Cluepaw: the profile says "Joined 3 days ago";
  - a "compliance hotline" next to a lookalike logo (the decoy channel);
  - hidden string: Dev is paid S$50 for each person he recruits;
  - Heart lens: Dev's lock screen reads "account temporarily restricted";
  - red herrings: the professional logo (logos are easy to copy) and the hawker stall's QR payment sign.
- **Exits:**
  - A: accept and transfer.
  - B: ask for proof. Convincing screenshots arrive, then a Mini-Hold with VeriFox's *Independent?* test, then a second seal: A or C. *Feedback: information supplied by a suspicious sender is not independent verification; verify through trusted sources.*
  - C: refuse, stop contact, keep the messages, seek trusted help.
  - (17-24) D: "I'll think about it". Mel escalates with a voice note and "last chance", and the squad re-seals with less time. *Holding means pause, then act; it doesn't mean stall.*
- **Delayed:**
  - *A, risk, next mission:*
    - A Harbour Bank notice: "account services restricted while we review incoming funds reported as linked to a scam".
    - The S$200 is reversed, Trust −2, and Risk is revealed as High.
    - At the finale: *"Police would like to speak with you about transfers through your account."*
    - Chain: Ren's card is declined in a later Retail mission.
    - Late Hold: stop, don't move any more money, tell a trusted adult, call the bank through its official app or the number on the card, make a police report.
  - *C, protective:* "Harbour Bank flagged Mel's account. Your report helped other students get a warning." This branch earns VeriFox and Beacon.
- **Lines (17-24, reviewed wording):**
  - "Letting others move money through your account is how scams hide stolen money. It can lead to restrictions and an investigation, even if you didn't know where the money came from, if you ignored warning signs." [S5, S4]
  - Facilitator notes:
    - CDSA maximums: rash money laundering up to S$250,000 and/or 5 years; negligent up to S$150,000 and/or 3 years; assisting another to retain benefits up to S$50,000 and/or 3 years [S5].
    - "Scam mules may be liable for caning" (discretionary). Text only, never a visual [S8].
    - Sentences actually imposed in H1 2026: 1-3 strokes, average 26 months. Facilitator notes only [S4].
    - Police don't intend to charge people who were genuinely tricked; restricted people keep basic banking and can appeal [S9].
    - People as young as 14 were investigated in the Feb 2026 operation [S23].
  - Help:
    - "Not sure? ScamShield Helpline 1799 (24/7)." [S1]
    - "Call your bank immediately and make a police report." [S10, S19]
  - The single SPF quote [S3].
- **14-16 variant:** S$30 to receive an e-wallet top-up and forward it. Three Exits. Consequences in simple words: "the account was restricted, and a trusted adult helped sort it out".

**M10 Behind the Stall** (Digi Sky, Barang Market, reached by DIVE from the food court. **14-16**; 10-13 as a card-pack pre-order with 2-3 Exits; 17-24 as a concert-lightstick deposit)
- **Premise:** Jun, 15, wants a sealed *Metro Legends* trading-card box at 55% below the usual price. It's a pre-order that "arrives in 3 months". The seller wants a 50% deposit by bank transfer now, asks to move off the platform's chat ("no fees"), and has five-star reviews.
- **Signature moment:** orbit behind the glossy booth and find a **cardboard facade propped up on sticks. Every review lantern was hung on the same day.**
- **Clues:**
  - a price far below market;
  - deposit due now;
  - payment off the platform;
  - delivery months away;
  - reviews all posted on the same day, and the account's age;
  - red herring: nice photos (photos can be copied);
  - a genuine seller nearby who uses the platform's own checkout with buyer protection.
- **Exits:**
  - A: transfer the deposit.
  - B: ask for a video (it arrives instantly and still proves nothing).
  - C: buy only through the protected checkout, or walk away and report the listing.
  - (17-24) D: offer to meet and inspect it in person (partly safe).
- **Delayed:**
  - *Risk, "+3 months":* the date passes, the seller account is deleted, and the deposit is gone. Late Hold: report to the platform, the bank and police; tell a parent.
  - *Protective:* the listing is removed and other buyers are warned.
- **Lines:**
  - E-commerce scams had the most cases in 2025 (6,703) and in H1 2026 (3,865, up 19.3%). Trading-card scams, driven by pre-orders, made up 605 cases in H1 2026 [S4].
  - Among scam victims aged 19 and below: 36.6% fell prey to e-commerce scams in 2025 [S3], and 45.6% in H1 2026 [S4].
  - All marketplaces are fictional.

**M11 Parcel Re-delivery** (Digi-District, phone kiosk, with a DIVE to the fake site. **14-16**, 10-13, 17-24)
- **Premise:** Sara, 16, is expecting a parcel. A message arrives: "MetroPost: parcel undeliverable. Pay S$1.80 re-delivery fee within 24h". It links to `metropost-redeliver.test`, which asks for her card details, then an OTP "to verify".
  - If `dataLeaked` is set (from M07), the message uses her real name.
- **Clues:**
  - the lookalike domain;
  - the OTP request;
  - the urgency;
  - the sender name (a sender ID alone proves nothing [S22]);
  - red herring: MetroPost's real app shows the parcel "out for delivery".
- **Exits:**
  - A: pay through the link and enter the OTP.
  - B: call the number given in the message.
  - C: don't click; check the official app or a site you type in yourself; delete and report; if unsure, call 1799.
- **Delayed:**
  - *Risk, next mission:* unknown charges; Sara's card has been added to a mobile wallet on someone else's phone. Late Hold: call the bank immediately and make a police report.
  - *Protective:* her report helps flag the sender.
- **Lines:**
  - Phishing: 6,264 cases in 2025, mostly victims giving away card details and OTPs [S3].
  - H1 2026 courier-themed phishing, with cards then added to mobile wallets [S4].
  - Help: 1799 [S1]; bank and police [S10].

**M12 Like-for-Cash** (Digi Sky, QuikGig tower, plus the neon void deck. **17-24**, 14-16)
- **Premise:** Wei Ling, 21, joins a "TaskLah" group that pays S$5 per hotel-review "like".
  - The first S$15 really is paid. **This is the immediate reward the DCE later turns.**
  - Then: "Premium task: top up S$100 to unlock S$300 commission". Group members post screenshots of their payouts.
- **Clues:**
  - paying in order to earn;
  - every member joined the same week (fake social proof);
  - you can't withdraw until you top up;
  - red herring: a real café job ad that says to apply on the café's own site and interview.
- **Exits:**
  - A: top up S$100.
  - B: ask the admin to let you withdraw first.
  - C: stop, keep the chats, leave the group, tell a trusted adult; if unsure, call 1799.
- **Delayed:**
  - *Risk:* "top up to withdraw" escalates (S$300, then S$800), the account is "frozen for tax", and the money is lost. Late Hold recovery.
  - *Protective:* she warns her CCA chat and one friend avoids it.
- **Lines:** job scams: 5,575 cases and about S$123.5m lost in 2025; small commissions come first, then bigger and bigger demands [S3]. 17.8% of victims aged 20-29 fell for job scams [S3]. Help: 1799 [S1].

### 9.3 Peer Shield missions (8-9 min each; usable as Mission 3 "Shield Sprints")

**PS1 The 2am Message** (Rescue. S7 bedroom. **17-24**, 14-16)
- **Premise:** Dev texts at 2am: *"Bro my bank account kena frozen. Bank says police might contact me. I only did it twice. Don't tell anyone pls."* Dev is shown curled up, labelled *Closed*.
- **Tiles:**

  | Slot | Helpful | Trap |
  |---|---|---|
  | Opener | "Thanks for telling me. I'm here." | "Told you it was dodgy." (blame) |
  | Reason | "The people who recruited you used you. That's on them." (offender-focused); "Banks freeze accounts used to move scam money; telling the truth early helps." (factual) | "Everyone gets caught eventually." (fear-only) |
  | Offer | "Want me to come with you when you call the bank?" | "Just delete the chats." (cover-up) |
  | Channel | The bank via its official app or the number on the card; a trusted adult; a police report | "Mel's compliance hotline" (decoy) |

- **Follow-up:** "Promise you won't tell anyone" (secrecy-pact trap) vs the Bridge tile: *"I won't spread it around. But this needs someone who can help, and I'll be there."*
- **Delayed (`return`, neutral):** Dev's call with the bank went OK.
- **Lines:** genuinely tricked people are not meant to be charged; they keep basic banking and can appeal [S9]; "call your bank immediately and make a police report" [S10].

**PS2 The Code Your Friend Needs** (Rewind. S1 bus stop. **10-13**, 14-16)
- **Premise:** Lina, 12, gets a ChatLah message from her best friend's account: "Eh I accidentally sent my code to your number, can you send me the 6 digits?" Her thumb is over Send.
- **Tiles:**
  - Opener: "Wait, can I see that first?"
  - Reason: "That code lets someone take over your account. Her account might be hacked."
  - Offer: "Let's *call* her to check, not chat."
  - Channel: a parent or teacher. Decoy: "reply in the chat to ask if it's really her", which fails because the scammer controls that chat.
  - Echo's prompt: check another way.
- **Delayed:**
  - *If the shield fails (finale):* Lina's account messages her contacts asking for codes. Recovery, with an adult: remove unknown linked devices and turn on two-step verification.
  - *Protective:* the friend confirms her account was hacked, recovers it with a parent, and the group is warned.
- **Lines:**
  - Social-media impersonation scams rose 47.9% to 587 cases in H1 2026, and 66.6% involved compromised WhatsApp accounts of the victim's contacts [S4].
  - "Never share OTPs; remove unknown linked devices; turn on two-step verification." [S10]

### 9.4 Tutorial, Twin pairs and the printable kit
- **Tutorial, "The Free Bubble Tea Poster"** (all bands, 2 min): a QR poster promises a free drink if you share it to 10 friends in 60 s. It teaches Hold, orbit, inspect, pin and seal, with harmless stakes, and ends on a joke.
- **Twin pair bank:** 30 genuine/fake pairs across the 10 tactics, used only in Calibration Forms A, B and C, the tutorial and the Return visit. **Never reused inside missions.**
- **Paper Bridge kit** (20 kits, exported from the same content):
  - scene cards with lift-the-flap lens clues (one flap shape per lens);
  - Exit cards and face-down shield vote tokens;
  - sealed Aftershock envelopes labelled "open at the start of Mission 2";
  - Peer Shield tile cards;
  - a HOLD card;
  - paper Calibration forms with a space for the code.
  - The disclaimer is printed on every component. No official logos.

### 9.5 Help Card: one central config (`help_channels`)
This is edited only in the Portal. Every row has a source key and an as-of date. It is shown in the debrief and Late Hold, and in the persistent **Need to talk?** panel (available from the "i" menu on every screen).

| Situation | Text (plain, never a hyperlink unless written consent is obtained) | Source |
|---|---|---|
| Is this a scam? | "Not sure if it's a scam? ScamShield Helpline **1799** (24/7). Check or report: scamshield.gov.sg" | S1, S17 |
| Money moved or details shared | "Call your bank using the number in its official app or on your card. Make a police report." | S10, S19 |
| Danger now | "**999**. If it's not safe to talk, SMS **70999**." | S1, S2 |
| You saw something (not urgent) | "Police Hotline **1800 255 0000**, or i-Witness on the SPF website." | S1 |
| Online harms | "Screenshot, block and report on the platform, then tell a trusted adult. If needed: Online Safety Commission (osc.gov.sg)." | S11 |
| Need to talk (10-13) | "Tinkle Friend **1800-2744-788** (Mon-Fri 2.30-5pm; chat Mon-Thu 2.30-7pm, Fri 2.30-5pm). Any time: mindline **1771**." | S12 |
| Need to talk (14-24) | "mindline **1771** (24h, WhatsApp +65 6669 1771) · SOS **1767** (24h, CareText WhatsApp 9151 1767) · TOUCH **1800 377 2252** (Mon-Fri 9am-6pm) · SHECARES **800 101 4616** (Mon-Fri 9am-9pm)" | S12 |

- **Excluded until verified:** the ScamShield WhatsApp bot and the CHAT contact details.
- **Blocked everywhere:** `71999`, `1800-722-6688`, "ScamAlert".

### 9.6 Content rules (moment-lint plus human review)
1. All brands, people and places are fictional. Use `.test` or `.example` domains and placeholder numbers. **No official logos, crests, uniforms, mascots or campaign artwork** (SPF, NCPC, ScamShield, CSA's Jaga).
2. Shop-theft content never teaches methods. Mule content never explains the laundering process beyond recognising the request.
3. Legal lines say "up to" and "may". Caning appears as text only, only for 17-24, and only in mule missions. **10-13 sees no penalties and no age thresholds.**
4. Statistics always carry their source and period. 41,974 is the number of **scam *and* cybercrime** cases in 2025; scam cases alone were 37,308 [S3]. "Arrested" and "investigated" are never merged.
5. **No sextortion, intimate-image or sexual content in any playable scenario or Moment Card.** For 17-24 it may come up only in facilitator-led, non-graphic discussion, signposting OSC, SHECARES, SOS 1767 and police.
6. Simulated scam messages exist only inside the clearly labelled game UI. **No real SMS, email or chat message is ever sent.**
7. The Scams (Countermeasures) and Other Matters Act 2026 is **not described as in force** until it commences.

---

## 10. Accessibility and performance budgets

### 10.1 Accessibility (all numbers are acceptance criteria)

| Area | Requirement |
|---|---|
| Text | <ul><li>All readable text is DOM, never baked into WebGL. Sized in `rem`.</li><li>A−/A+ in 5 steps: 100 / 125 / 150 / 175 / 200%.</li><li>At 200% on a 360 px phone, nothing scrolls horizontally.</li><li>Body text ≥ 16 px. Phone captions ≥ 18 px. Projector captions ≥ 40 px and all other projector text ≥ 28 px.</li></ul> |
| Font | Atkinson Hyperlegible Next (variable, OFL), self-hosted as a Latin subset in **one WOFF2 file ≤ 40 KB**. An optional wider-spacing mode. |
| Contrast | Body ≥ 7:1, UI ≥ 4.5:1, large text ≥ 3:1. The projector theme ≥ 7:1. |
| Colour independence | <ul><li>Every status is shown by shape + icon + word.</li><li>Exits use letter + pattern.</li><li>Squads use totem shape + name.</li><li>Meters show segments + numbers.</li><li>CI renders screenshots through deuteranopia, protanopia and tritanopia filters.</li></ul> |
| Captions | On by default for every voiced line and meaningful sound. Narration is optional and generated from the same text. |
| Motor | <ul><li>Touch targets ≥ 48×48 px; HOLD is 76 px.</li><li>Hold duration adjustable 0.3-2.0 s, or tap to toggle.</li><li>The seal has a double-tap alternative.</li><li>**Every drag has a tap-then-tap alternative.</li><li>Orbit has arrow buttons.</li><li>Full keyboard play.</li></ul> |
| Timing | <ul><li>Relaxed timing: 1.5× per squad.</li><li>Facilitator +30 s.</li><li>Gentle mode: no surges, no countdown visuals.</li><li>No reflex-speed challenges anywhere.</li></ul> |
| Motion | <ul><li>`prefers-reduced-motion` or the in-app toggle (`MotionConfig reducedMotion="user"`): cuts instead of camera flights, no sway, shake or dolly-zoom.</li><li>Nothing flashes more than 3 times per second.</li></ul> |
| Non-visual play | <ul><li>Flat View with Scene List.</li><li>ARIA live regions announce Hold, Release, Reveal and Aftershock.</li><li>axe-core finds 0 serious issues on every route.</li></ul> |
| Language | <ul><li>Reading targets per band (5.4), enforced by lint.</li><li>Sentences ≤ 20 words.</li><li>A tap-to-define glossary ("money mule", "OTP", "phishing").</li><li>Strings live in i18n JSON; English first, Chinese, Malay and Tamil ready for later.</li></ul> |
| Wellbeing | <ul><li>Pause on every screen.</li><li>A content-note chip on every mission card.</li><li>Skip scenario (Conductor).</li><li>**No disclosure prompts anywhere.**</li></ul> |
| Test viewports | 360×640, 390×844, 412×915, 768×1024, 1366×768, projector 1280×720 and 1920×1080. Safe-area notches handled. |

### 10.2 Performance

**Download budgets** (enforced in CI; measured sizes from the tech report):

| Item | Budget |
|---|---|
| App shell JS: Gate, join, lobby, vote, Calibration, Flat View | **≤ 130 KB gzip** (measured 115 KB with `LazyMotion` and `zod/mini`). Interactive in < 3 s on a mid-range Android over school Wi-Fi. |
| 3D chunk: three + R3F + drei | **≤ 260 KB gzip** (measured 239 KB). Lazy-loaded and **prefetched during Calibration**. |
| Post-processing | +23 KB, **projector High tier only**. |
| Mission pack (scene recipe, text, seeds, tiles, captions) | ≤ 25 KB gzip each. Set recipes ≤ 15 KB. |
| First load total | **≤ 600 KB transferred.** |
| A whole classroom session per phone | **≤ 3 MB.** Phones download no audio in squad mode. |
| Narration (Big Screen and solo opt-in) | Opus at 24 kbps, about 15 KB per line. |
| Realtime messages | ≤ 1 KB typical, 16 KB hard cap, about 1 per second per client at peak. |

**Render budgets per tier:**

| | Low (default for phones) | Mid | Projector / High |
|---|---|---|---|
| Target fps | Stable 30 | 60 | 60 |
| Device pixel ratio cap | 1.0 | 1.5 | 2.0 |
| Draw calls per scene | **≤ 40** | ≤ 60 | ≤ 120 |
| Triangles per scene | **≤ 40k** | ≤ 60k | ≤ 150k |
| Antialiasing | Off | On | On |
| Shadows | Blob decals | Blob decals | Blob + one static shadow map |
| Post-processing | **None** | **None** | Bloom + vignette (lazy) |
| Particles (instanced) | ≤ 200 | ≤ 600 | ≤ 2,000 |
| GPU memory | < 64 MB | < 96 MB | < 256 MB |

**Content budgets:**
- District plate: ≤ 8k triangles, ≤ 6 draw calls after merging.
- City hub: ≤ 40 draw calls.
- Bean: ≤ 300 triangles, ≤ 12 visible, instanced.
- Guardian: ≤ 1.5k triangles.
- Materials: one shared `MeshLambertMaterial` with vertex colours, patched with `onBeforeCompile` for `uFreeze`, `uLensMask` and window light.

**Techniques (required):**
- `frameloop="demand"`, calling `invalidate()` only while the camera moves or something animates. On Low tier, a 33 ms timer drives animation.
- Pause rendering when the tab is hidden.
- `mergeGeometries` for static scenery; `InstancedMesh` for rain, windows, trees and beans.
- **Choosing the tier:**
  - start from boot heuristics (`hardwareConcurrency`, `deviceMemory`, the WebGL renderer string, screen size);
  - refine with the 1 s benchmark during Calibration;
  - adjust at runtime with drei `<PerformanceMonitor flipflops={3}>` and `<AdaptiveDpr>`;
  - allow a manual override.
- **WebGL context loss:** all state lives in zustand outside `<Canvas>`. On loss, show "Tap to restore", then remount `<Canvas key>`. After two losses, switch to Flat View.
- **No hidden network fetches:** no drei `<Environment>` presets, no troika `<Text>` CDN fonts, no `detect-gpu` CDN, no runtime Google Fonts.

**Device targets:**
- *Low:* about S$150-250 Androids from 2021-24 (Mali-G52/G57 MC2, Adreno 610/619, 3-4 GB RAM).
- iPhone XR/11 and later.
- A Chromebook.
- A real 720p classroom projector.

**Acceptance criteria:**
- p95 frame time ≤ 40 ms on Low.
- **≤ 10% battery** over the 45-minute gameplay block, with no thermal throttling.
- After a reconnect, state is restored in ≤ 1 s.
- Playable on a throttled "school Wi-Fi" profile (400 ms RTT, 3% packet loss).

---

## 11. Privacy and safeguarding rules for engineers

**Data collection**
1. Player routes **MUST NOT** contain input fields for name, NRIC/FIN, phone, email, address, bank or card numbers, Singpass/CityPass credentials or OTPs. A Playwright test asserts that no such field exists on any player route.
2. In-scene forms (the lucky draw, a fake bank login, CityPass) are **non-editable illustrations**. Players inspect them; they never type into them.
3. The game requests **no permissions**: no camera, microphone, location, contacts or notifications. Wake Lock and vibration need no prompt.

**Identity and codes**

4. **Seat token:** random, 128-bit, stored in `localStorage`. The server keeps only its hash, and deletes seats **≤ 24 h after the session closes**.
5. **Session code:** generated by the server with a cryptographic RNG. Stored only in the `assess` schema and on the device. **Never** written to gameplay tables, URLs, query strings or logs.
6. **Pseudonyms and totems are generated.** Free-text names are impossible.

**Votes and gameplay**

7. The link between a seat and its vote exists **only in server memory and in `live_snapshots`**. Snapshots are deleted when the session closes and by a sweeper with a hard 24 h TTL.
8. Only **aggregates** are persisted: `vote_aggregates` and `event_counts`. Hold latency is bucketed *before* it is written.
9. **Guardian bonds, the Counter-Playbook, the Moment Atlas, private mirrors, If-Then cards, correction notes and Growth Cards are computed and stored on the device only.** No API accepts them.
10. In squads, reason chips are shown only when ≥ 2 seats share them. Steelman cards are dealt by seeded RNG, independent of votes. The 10-13 band uses Mood reveal.

**Analytics and display**

11. Every dashboard query goes through `v_*` SQL views that **suppress cells with n < 5**. There are no per-seat endpoints. Exports are aggregate only.
12. **The Big Screen never shows** individual data, squad rankings or raw risky splits. **The Conductor never shows** an individual's vote or session code, and shows squad agreement only as United / Mostly / Split.
13. Ghost Squad aggregates in solo appear only at n ≥ 20.

**Storage, retention, logging**

14. Assessment data lives in a **separate Postgres schema (`assess`) behind a separate database role**, with **no foreign keys to gameplay tables** and no columns that would allow a join.
15. **Retention:**
    - `live_snapshots`: ≤ 24 h.
    - Rejected Moment Cards: 30 days.
    - Assessment responses: deleted 90 days after the final report.
    - Aggregates: kept for the impact report.

    The participant notice states all of this.
16. pino serialisers **drop IP address and user-agent**. Caddy's access log is off. **No third-party analytics, SDKs, fonts or CDNs at runtime.** CSP is `default-src 'self'; connect-src 'self' wss:`.
17. If the Cloudflare proxy is used, the data notice says so, because Cloudflare sees client IP addresses.

**Content safety**

18. Real-world channels come **only from `help_channels`** and are never hard-coded. The lint blocks outdated numbers and names.
19. The victim-blaming lexicon, the PII and real-brand regexes, and the "every risk branch has a recovery" check are **CI gates** for all content, including content from the database.
20. Manipulators never have faces or bodies. Impersonators are text or voice only. No real agency marks.
21. **Pressure Surges are squad-wide only.** They come from fictional characters, are never secret, are off for 10-13 and in Gentle mode, and **never change timers**.
22. Sexual or sextortion content is rejected in both scenarios and Moment Cards.
23. Moment Cards: chip-first, ≤ 140 characters per free field, PII-scrubbed on the client and the server, needing a maker code, and **always moderated by an educator before publication**. There is **no free text in live play**.

**Session safety**

24. **Pause** works on every screen, with no penalty; the Conductor sees only an anonymous count. Content notes appear on every mission card. **No screen asks about personal experience.** Debrief prompts refer to characters.
25. **No competitive scoring, leaderboards or squad rankings.** Bonds are shared within the squad.
26. Simulated scams never leave the app: no SMS, email, chat messages or calls.

**Brand and disclaimer**

27. The disclaimer (section 0) appears verbatim on:
    - the Gate/splash and join screens;
    - the "i" menu and the About page;
    - the Big Screen footer (permanent);
    - the Conductor and Portal headers;
    - the Flip the Board screen;
    - every exported image (If-Then card, share card) as a watermark;
    - every printed kit component;
    - the **PWA manifest `description`**.
28. Staff accounts: magic-link sign-in, role-based access, everything audited in `moderation_log`. **No youth accounts exist.**

**Security**

29. Validate every REST and socket payload with zod. Enforce a 16 KB message cap. Use `@fastify/rate-limit`, `@fastify/helmet`, idempotent client event IDs, and server-authoritative phases and timers.

---

## 12. Technical architecture

### 12.1 Monorepo layout
This extends the existing npm-workspaces scaffold (`@shieldquest/*`).

```
shieldquest-v2/
├─ apps/
│  ├─ web/                @shieldquest/web    Vite 8 + React 19.3 PWA (all client routes)
│  │  └─ src/
│  │     ├─ app/          router (wouter), Gate, Comfort Settings, layouts, i18n
│  │     ├─ ui/           DOM: sheets, cards, rail, captions, HOLD button, Pressure Ring
│  │     ├─ stage/        LAZY CHUNK: R3F <Canvas>, SceneRenderer, camera rigs, tiers
│  │     ├─ flat/         Flat View SVG renderer + Scene List
│  │     ├─ net/          socket client, clock sync, IndexedDB outbox, rejoin
│  │     ├─ audio/        Web Audio synth (SFX, pads, S.H.I.E.L.D. motif)
│  │     ├─ store/        zustand stores (all game state lives outside <Canvas>)
│  │     ├─ local/        on-device progress (Bond Book, Codex, Atlas, mirrors)
│  │     ├─ conduct/      LAZY: Conductor console
│  │     ├─ screen/       LAZY: Big Screen views (+ optional postprocessing chunk)
│  │     └─ portal/       LAZY: Scenario Portal (staff only)
│  └─ server/             @shieldquest/server Fastify 5 + Socket.IO 4.8 (serves PWA, API, sockets)
│     └─ src/
│        ├─ http/         REST: sessions, assessment, moment cards, portal API, health
│        ├─ rt/           socket namespaces /play /screen /conduct, room registry
│        ├─ machine/      per-squad + per-session phase machines (wrap @shieldquest/engine)
│        ├─ db/           drizzle schema (public + assess), migrations, v_* views
│        ├─ auth/         staff magic links
│        └─ jobs/         snapshot sweeper, retention purge, publish pipeline (Polly)
├─ packages/
│  ├─ shared/             @shieldquest/shared  zod schemas, event contracts, tokens, FRAMEWORK
│  ├─ engine/             @shieldquest/engine  PURE TS: sceneAt timeline, phase reducer, DCE,
│  │                                          guardian rules, peer-shield evaluator, roles
│  ├─ scenekit/           @shieldquest/scenekit plain three.js builders: props, 7 sets, beans,
│  │                                          guardians (unfold morph), rain, freeze material
│  └─ content/            @shieldquest/content  seed missions JSON, twin pairs, help channels,
│                                               word lists, glossary
├─ tools/
│  ├─ moment-lint/        CLI + library (also used live in Portal)
│  └─ bot-squad/          headless Socket.IO bots for load tests + Conductor rehearsal
└─ scripts/dev.mjs        (existing)
```

`scenekit` is plain three.js so it can be tested without React. The R3F components in `apps/web/stage` wrap its outputs with `<primitive>`.

### 12.2 Pinned versions
These follow the tech report, verified 2026-10-08. Use **exact pins (no `^`)** for react, three, R3F, drei and postprocessing. Commit the lockfile.

| Client | Server / tooling |
|---|---|
| react / react-dom **19.3.0** (R3F caps React below 19.4) | node **24.15 LTS**; `"engines": {"node": ">=24.15 <25"}` |
| three **0.186.1**, @types/three **0.186.0** | fastify **5.12.5** + @fastify/static 10.1.5, rate-limit 11.2.0, helmet 13.1.1, compress 9.2.0 |
| @react-three/fiber **9.8.1**, @react-three/drei **10.7.9** | socket.io **4.8.4**, attached to `app.server` (**not** `fastify-socket.io`) |
| @react-three/postprocessing 3.1.3 + postprocessing 6.39.5 (projector only, lazy) | pg **8.23.1**, drizzle-orm **0.45.3**, drizzle-kit **0.31.11** |
| zustand **5.0.15**, motion **13.5.1** (import from `motion/react`) | @electric-sql/pglite **0.5.8** (dev and tests; Postgres 18.3 in WASM) |
| wouter **3.13.0**, socket.io-client **4.8.4**, zod **4.6.5** (`zod/mini` on the client), qrcode **1.5.4** (Conductor chunk only) | Postgres **18** in production |
| vite **8.3.3**, @vitejs/plugin-react **6.1.2**, vite-plugin-pwa **1.3.0**, workbox-window **7.4.1** | typescript **6.0.3** (+ typescript-eslint), vitest **5.0.3**, @playwright/test **1.63.0**, @types/node **24.19.1**, tsx 4.23.15 |

**Corrections to the current scaffold:**
- Root `typescript ^7.0.2` → **6.0.3**. TS 7 breaks typescript-eslint.
- `motion ^14.0.0` → **13.5.1**.
- `vite-plugin-pwa ^2.0.0` → **1.3.0**. 2.0's breaking changes are undocumented.
- `@types/node ^26.6.4` → **24.19.1**.
- `engines >=22` → **>=24.15 <25**.
- Replace caret ranges with exact pins.
- Add the drizzle, pglite, helmet, rate-limit and compress packages.
- Keep `@fastify/cors` for development only; production is same-origin.
- The manifest `description` **must** include the disclaimer.
- Code splitting uses dynamic `import()` (`stage`, `conduct`, `screen`, `portal`). Vite 8 / Rolldown chunk options live under `build.rolldownOptions`.

### 12.3 Engine core: everything is a function of time
```ts
// packages/engine/timeline.ts
sceneAt(moment: BandVariant, t: number, branch: BranchState, opts: { lens?: Lens; ghost?: GhostSpec })
  → SceneFrame { props: Transform[]; npcs: {id, pose, expression, t}[];
                 messages: {id, state: 'pending'|'inFlight'|'landed', pos}[];
                 rainPhase: number; strings: StringState[]; ghosts: GhostFrame[] }
```
- **Hold** sets the local `timeScale` to 0 at `tHold`. Messages that haven't landed stay `inFlight`, so they can be read early.
- **Release** resumes `t` along the decided branch.
- **Ghost futures** are `sceneAt(t + Δ, ghostBranch)` rendered with a translucent material.
- **Rewind** (solo and the debrief) runs `t` backwards. The debrief Rewind replays a **session-level aggregate timeline** (lantern and Aftershock events), not seat data.
- **Sync:** the server sends `{missionId, variant, branch, t0}`, and each client computes `t = now + clockOffset − t0`. The clock offset is the median of 5 NTP-style `clock:ping` samples.
- **Determinism:** a seeded RNG (`sessionSeed ⊕ missionId`) drives Exit letter shuffling, Steelman selection and idle animations. That makes every behaviour Vitest-testable.

### 12.4 Data schemas
These are zod schemas in `@shieldquest/shared`; the types below are what they infer.

```ts
type Band = 'b10_13' | 'b14_16' | 'b17_24';
type Letter = 'S'|'H'|'I'|'E'|'L'|'D';
type Lens = 'clue'|'thread'|'heart'|'path'|'ripple';
type Tactic = 'urgency'|'too_good'|'secrecy'|'social_proof'|'fake_authority'|'friend_referral'
            |'foot_in_door'|'fear_threat'|'lookalike_link'|'pay_to_unlock'|'data_harvest';
type OutcomeToken = string; // band-specific, e.g. 'nothing'|'paid'|'account_restricted'|'police_contact'|'friend_targeted'|'lose_money'

interface Scenario {                       // a.k.a. Moment
  id: string; version: number;
  status: 'draft'|'in_review'|'approved'|'published'|'retired';
  kind: 'mission'|'peer_shield'|'tutorial';
  district: 'school_street'|'retail'|'digi'; setId: string;
  themes: string[]; letters: Letter[]; kpiTags: ('K1'|'K2'|'K3'|'K4')[];
  variants: Partial<Record<Band, BandVariant>>;
  sources: { key: string; note: string }[];   // e.g. { key: 'S3', note: 'job scam stats' }
  reviewBy: string;                            // ISO date
  signoffs: { kind: 'accuracy'|'safeguarding'; staffId: string; at: string }[];
  origin: 'team'|'youth_card'; originCredit?: string; // 'Squad Hornbill, NYP Pilot 1'
}

interface BandVariant {
  lead: CharacterRef; cast: CharacterRef[]; contentNoteKey: string;
  live: { durationS: number; beats: Beat[] };
  freezeEndS: number;                          // fixed, relative to live start
  clues: Clue[]; threads: StringDef[]; ghosts: GhostSpec[];
  forecast: { questionKey: string; options: OutcomeToken[] };  // 4 options
  exits: Choice[]; peerShield: PeerShieldSet;
  surge?: { atS: number; fromCharacter: string; textKey: string };
  guidedPrompts: Partial<Record<Letter, string>>;
  captions: Record<string, string>; glossary: string[];
}

interface Beat { t: number; kind: 'message'|'npc_line'|'pose'|'expression'|'sfx'|'camera'|'pressure';
  actor?: string; textKey?: string; tactic?: Tactic; ringLabel?: string; payload?: unknown }

interface Clue { id: string; anchor: { kind: 'prop'|'npc'|'message'; id: string };
  lens: Lens|'all'; letter: Letter; genuine: boolean; quiet: boolean; tactic?: Tactic;
  frontKey: string; backKey: string; guardianRule?: 'cluepaw_quiet'|'bytebuddy_scan'|'verifox_independent' }

interface StringDef { id: string; from: string; to: string; hidden: boolean; gainKey: string; tactic?: Tactic; endAnchor: string }

interface Choice {                            // Exit
  id: string; labelKey: string; safety: 'safer'|'partial'|'risky';
  immediate: { sceneId: string; captionKeys: string[]; wallet?: number; trust?: number };
  feedback: { tactics: Tactic[]; effectKey: string; saferKey: string; recoveryKey: string;
              herringNoteKeys: string[]; hypercorrectionKey?: string };
  seeds: Seed[];                               // Consequences (see §6.3)
  setFlags?: string[];
  sub?: { kind: 'mini_hold'; durationS: number; evidence: string[]; then: string[] };
  guardianRules?: string[];                    // e.g. ['verifox.independent','beacon.channel']
}

interface PeerShieldSet { variant: 'rewind'|'rescue'; friend: CharacterRef;
  slots: ('opener'|'reason'|'offer'|'channel')[];
  tiles: { id: string; textKey: string; slot: string; tags: string[]; dealTo: Lens }[];
  rules: { when: { tag: string; slot?: string }; guard?: number; doubt?: number; pose?: string; expression?: string; lineKey?: string; retry?: boolean }[];
  successWhen: { guardMax: number; doubtMin: number; requireTag: 'safe_channel' };
  followUp?: { promptKey: string; tiles: string[] } }

interface Session {
  id: string; roomCode: string; band: Band; createdBy: string;   // staffId
  playlist: { scenarioId: string; version: number; mode: 'guided'|'light'|'wildcard' }[];
  options: { projectorMode: 'discreet'|'open'; reveal: 'dots'|'mood'; surges: boolean;
             relaxedTiming: boolean; narration: boolean };
  squads: { totem: string; expectedSeats: number }[];
  seed: string; cohortTag: string;            // 'nyp-p1'
  status: 'setup'|'live'|'debrief'|'closed'; startedAt?: string; endedAt?: string;
}

// IN MEMORY ONLY (+ live_snapshots, ≤24 h)
interface Seat { seatId: string; tokenHash: string; totem: string; pseudonym: string; connected: boolean }
interface Vote { voteId: string; seatId: string; missionIdx: number; round: 'first'|'reseal'|'mini';
  exitId: string; confidence?: 1|2|3; forecast?: OutcomeToken; at: number }

// PERSISTED (aggregate)
interface VoteAggregate { sessionId: string; totem: string; scenarioId: string; round: 'first'|'reseal'|'mini';
  exitCounts: Record<string, number>; confidenceHist?: [number, number, number];
  forecastCounts?: Record<OutcomeToken, number>;
  switches?: { toSafer: number; toRiskier: number; same: number };
  decidedExitId?: string; tieBroken?: boolean }
interface EventCount { sessionId: string; totem: string|null; scenarioId: string|null;
  metric: string; bucket: string; count: number }   // e.g. metric 'hold_latency', bucket '5-15s'

// SEPARATE SCHEMA `assess` (separate DB role, no FKs to gameplay)
interface AssessmentResponse { id: string; sessionCode: string; cohortTag: string; band: Band;
  form: 'A'|'B'|'C'; phase: 'pre'|'post'|'return'; itemId: string;
  response: unknown; confidence?: 1|2|3; answeredOn: string /* date only */ }

interface MomentCard { id: string; cohortTag: string; district: string; setting: string;
  pusherRole: 'stranger'|'friend'|'online_seller'|'company'; offerChips: string[]; offerText?: string; // ≤140
  warningTactics: Tactic[]; saferMove: string; recoveryMove: string;
  piiFlags: string[]; status: 'submitted'|'returned'|'approved'|'built'|'rejected';
  moderatorNotes?: string; reasonCodes?: string[]; createdAt: string }

interface HelpChannel { id: string; bands: Band[]; situation: string; textKey: string;
  sourceKey: string; asOf: string; verifiedBy: string; active: boolean }
```

**Postgres tables:**
- `public`: `scenarios`, `scenario_versions`, `help_channels`, `staff`, `staff_tokens`, `sessions`, `live_snapshots` (jsonb, TTL), `vote_aggregates`, `event_counts`, `solo_counters`, `moment_cards`, `moderation_log`.
- `assess`: `codes`, `responses`.
- Dashboard: `v_*` views only.

### 12.5 Real-time events (Socket.IO)
- **Namespaces:** `/play`, `/screen`, `/conduct`.
- **Rooms:** `s:{session}`, `q:{session}:{totem}`, `screen:{session}`, `conduct:{session}`.
- Every client→server event carries a client UUID and is acknowledged with `emitWithAck`, a timeout and retries. The server de-duplicates.

| Direction | Event | Payload (all ≤ 1 KB) |
|---|---|---|
| C→S | `join` / `rejoin` | `{roomCode, totem?, seatToken?}`, acked with `{seatId, pseudonym, role, snapshot, version}` |
| C→S | `clock:ping` | `{c}`, answered with `clock:pong {c, s}` |
| C→S | `hold` | `{missionIdx, tMs}`. The server buckets it and discards the seat link. |
| C→S | `pin` / `unpin` / `seemsFine` | `{clueId}` |
| C→S | `string:pull` | `{stringId}` |
| C→S | `investigate:done` | `{}` |
| C→S | `guardian:use` | `{guardian}` |
| C→S | `surge:dismiss` | `{}` |
| C→S | `vote:seal` | `{voteId, round, exitId, confidence?, forecast?}`, acked with `{ok, dup}` |
| C→S | `reasons` | `{chipIds[≤2]}` |
| C→S | `tiebreak` | `{exitId, reasonTileId}` (Safety Lead only) |
| C→S | `tile:play` / `shield:send` | `{slot, tileId}` / `{}` |
| C→S | `trace:answer` / `latehold:choose` | `{seedId, optionIdx}` |
| C→S | `pause` / `help:ping` / `board:share` | `{on}` / `{}` / `{}` |
| S→C | `phase` | `{missionIdx, phase, startsAt, endsAt, payload}`. Deadlines are server timestamps. |
| S→C | `live:start` | `{scenarioId, variant, branch, t0}` |
| S→C | `board` | `{pins:[{clueId, lens}], strings:[...]}` (role icons only) |
| S→C | `seal:progress` / `reveal` | `{sealed, total}` / `{dots:[{exitId,n}] shuffled}` or `{mood}` |
| S→C | `chips` / `steelman` | `[{chipId, n≥2}]` / `{exitId}`, sent to one seat |
| S→C | `decision` | `{exitId, outcomeId, mindsChanged}` |
| S→C | `surge` / `shieldfin:swim` | `{fromKey, textKey}` / `{order:[seatIdx], delayMs:250}` |
| S→C | `shield:state` | `{slots, guard, doubt, pose, expression}` |
| S→C | `aftershock` / `forecast:result` | `{seedId, reveal}` / `{matched, total}` |
| S→C | `bond` | `{guardians[], squadLetters[]}` |
| S→C | `room:freeze` / `calm` | `{on}` |
| S→Screen | `screen:state`, `lanterns`, `pulse`, `spotlight` | Aggregate only |
| Conduct→S | `cmd:next`, `cmd:extend`, `cmd:skip`, `cmd:freezeAll`, `cmd:calm`, `cmd:gentle`, `cmd:spotlight`, `cmd:roomShift`, `cmd:aftershockNow`, `cmd:reassign` | n/a |

**Phase machines:**
- **Session level:** `SETUP → ONBOARD → CALIBRATE_PRE → TUTORIAL → MISSION[i] ⇄ LOOKUP → FINALE → DEBRIEF → CALIBRATE_POST → CLOSED`.
- **Squad level:** `GATE → AFTERSHOCK? → ROLE_FLIP → LIVE → INVESTIGATE → THINK → REVEAL → EXPLAIN → RESEAL → RELEASE → (MINI_HOLD → RESEAL2)? → PEER_SHIELD → BOND → GATE`.
  - **Sync gates:** the facilitator opens each mission for the whole room. Within a mission, squads run at their own pace inside a time window.
  - **Quorum:** a phase advances when all *connected* seats have acted or the deadline passes.
  - Each squad's state is snapshotted to `live_snapshots` at every boundary.

**Resilience:**
- `connectionStateRecovery: { maxDisconnectionDuration: 180_000, skipMiddlewares: true }`, `pingInterval`/`pingTimeout` 20 s, `maxHttpBufferSize: 16_384`. The tech report verified this restores the same seat, the same rooms, missed events and duplicate-vote rejection.
- If recovery fails, the client sends `rejoin` with its seat token and gets a full snapshot with a version number.
- The long-polling fallback stays on (polling first, then upgrade).
- **Never deploy during a session.**

### 12.6 Offline and PWA strategy
- **vite-plugin-pwa 1.3.0** (`generateSW`):
  - precache the app shell, fonts and icons;
  - the stage chunk is runtime-cached and **prefetched during Calibration**;
  - the session's mission packs are cached at join under `packs-v{contentVersion}`.
- **IndexedDB:**
  - solo progress and on-device progress;
  - an **outbox** of pending events with idempotent IDs, retried until acknowledged;
  - the cached snapshot for an instant redraw on reload.
- **While offline:** squad phones keep Investigate, Think UI, Peer Shield tile viewing and Flat View running from cache. Only seals and squad-shared actions need the network; they queue and sync.
  - If the server is unreachable for more than 60 s, the Conductor offers **Paper Bridge**: the Big Screen keeps telling the story from cache while squads switch to the printed kit.
- **Screen Wake Lock** during active phases. On `visibilitychange`, request a fresh snapshot.
- **Updates never reload mid-session.** A prompt appears only on the Gate or Hub. A content version bump invalidates the packs.
- **Solo** is fully offline after the first load.

### 12.7 Hosting (≈ S$17/month, within the S$50/month line)
- **Amazon Lightsail, Singapore, 2 GB / 2 vCPU, US$12/month.**
  - Caddy (automatic HTTPS) in front of Node 24 (Fastify serves the PWA, the API and Socket.IO) in front of **Postgres 18 in Docker**.
  - Nightly `pg_dump` to a Lightsail bucket (about US$1).
- **Option:** a managed Lightsail Postgres (+US$15, ≈ S$35 total) if the budget's "managed database" wording must be matched literally.
- **Optional Cloudflare free proxy** (WebSockets supported). If used, disclose it in the data notice.
- **Extras:** Amazon SES for magic-link email (cents), and Polly within the S$100 TTS allowance.
- **Domain:**
  - register it ≥ 4 weeks before the NYP pilot;
  - submit it for an "Education" category with web filters;
  - test it on the venue's Wi-Fi and on a school-managed device at the dry run;
  - bring a 4G/5G hotspot as backup.
- **Budget paperwork:** AWS App Runner, named in the budget, is closed to new customers. Re-word the line as "Production hosting (e.g., Amazon Lightsail, Singapore)", the equivalent within the same category, and keep the receipts.
- **Asset line (S$600) recommendation:** no stock environment art or music licences are needed, because geometry and audio are generated in code. Spend it on:
  - one illustrator pass for **SVG Guardian and character silhouettes plus prop glyph sheets** (about S$350-400), which feed scenekit, Flat View and the printed kit;
  - print-quality kit art (about S$200).

  Confirm any reallocation within the line with NYC if required.

### 12.8 Testing
- **Vitest:**
  - **100% branch coverage** for the DCE, the phase reducer, Guardian rules, the Peer Shield evaluator, role rotation and moment-lint;
  - `sceneAt` snapshot tests;
  - PGlite for database tests.
- **Playwright multi-context:** 5 phones + the Conductor + the Big Screen in one test, with device emulation.
  - Join, Hold (early and late), seal, re-seal and tie-break.
  - Reconnect mid-Reveal.
  - Aftershock delivery.
  - Pass-and-play.
  - The no-PII-inputs assertion.
  - The disclaimer-presence assertion on every route.
- **bot-squad:** 6 squads × 5 seats for Conductor rehearsal; 150 seats for load. Run before every pilot.
- **CI gates:** Lighthouse CI on a Slow 4G profile, enforcing the bundle budgets in 10.2; axe-core; colour-blind screenshot sims; screenshot diffs at the 7 viewports.
- **Device lab:** two Low-tier Androids, one older iPhone, one Chromebook, a real projector. A throttled "school Wi-Fi" profile (400 ms RTT, 3% loss).

---

## 13. Build milestones (grant Weeks 1-24)

| When | Milestone | Done means |
|---|---|---|
| **Now to Week 0** (Oct 2026, in-kind) | **Vertical slice, Flat View first** | Easy Money playable end to end as a **2D flow on 4 phones + Conductor + Big Screen**: join, Live with HOLD, Investigate (Scene List), Think/Seal/Reveal/Explain/Re-seal, Release, Peer Shield. Then one 3D set (S5) with the freeze material. Scaffold versions corrected (12.2). Lightsail and domain set up. |
| **Weeks 1-3** (Nov) **Co-design** | Youth validation | <ul><li>Youth workshops with the slice and a paper prototype: tune Hold timing, the lens set, tile wording, Singlish vs Plain.</li><li>Pilot the Twin pairs and assessment items for difficulty.</li><li>Learning-outcome baseline.</li><li>Review the 12 mission briefs and the Help Card with sources.</li><li>Engineering: `engine` (sceneAt, reducer, DCE) with tests.</li></ul> |
| **Weeks 4-5** | Core play | <ul><li>scenekit: props, beans with face atlas, Guardians and Unfold, rain, freeze material, sets S1/S3/S5.</li><li>Phone Live with Pressure Ring; personal HOLD and late auto-freeze; Investigate with 5 lenses.</li><li>Pull the String; LIVE vs HELD.</li><li>Flat View parity.</li><li>Conductor v1 and Big Screen v1 (Lobby, Live, Seal Wall).</li><li>Calibration v1 (2D, Forms A and B, session codes, `assess` schema).</li></ul> |
| **Weeks 6-7** | Grant mechanics | <ul><li>DCE in sessions: Aftershock slots, Ripple Trace, sealed forecasts and Shadow check, Late Hold.</li><li>Peer Shield with GUARD/DOUBT.</li><li>All six Guardian rules and abilities; Bond Book (local).</li><li>Pressure Surge and Shieldfin swim.</li><li>Room Freeze, Look Up, Freeze All.</li><li>Debrief: Stop Frames, Flip the Board, Shield Lines Wall.</li><li>Solo v1 with Echo Council.</li></ul> |
| **Weeks 8-9** | Portal and content | <ul><li>Portal: library and coverage matrix, Composer (form plus live preview), script and Ripple editors, moment-lint, two-signature publish, Help Card editor, Polly publish.</li><li>Moment Cards with scrubber and moderation queue.</li><li>Analytics views and dashboard (n ≥ 5).</li><li>Sets S2/S4/S6/S7 and DIVE.</li><li>**Content sprint:** all 17-24 and 14-16 variants, PS1, tutorial.</li><li>**Printable kit export** (proposal: offline companion kit by Week 9).</li></ul> |
| **Weeks 10-12** (Jan 2027) | Test and refine | <ul><li>Accessibility pass (10.1); device lab; tier tuning.</li><li>bot-squad load tests.</li><li>Two usability rounds.</li><li>Facilitator toolkit v1 (run sheet, scripts, ground rules, ACT mapping, Help Card).</li><li>Lighthouse budgets green; security review.</li><li>**Full 90-minute dress rehearsal** with bots and about 10 volunteers.</li><li>**Feature freeze at the end of Week 12.**</li></ul> |
| **Weeks 13-18** (Feb-Mar) | Controlled pilots | <ul><li>**NYP pilot** (17-24) in Weeks 13-14.</li><li>Fixes and wording in Weeks 15-16.</li><li>**Return to ShieldQuest City** live by Week 15 (Form C, Wildcard, jammed Freeze) for the NYP follow-up 2-4 weeks later.</li><li>Intended **ITE pilot** in Weeks 17-18.</li><li>During pilot weeks: bug fixes and content only; hotfixes outside session hours.</li></ul> |
| **Weeks 19-22** (Mar-Apr) | Refined community pilot | <ul><li>Enable the 10-13 band (rail camera, Mood reveal, Daylight grade, PS2, the 10-13 variants).</li><li>Secondary-school and community sessions.</li><li>**Community activation** (solo QR posters plus a Big Screen session).</li><li>Content batch 2, including approved Moment Cards.</li><li>Solo Nightfall and Morning After.</li></ul> |
| **Weeks 23-24** (Apr) | Evaluation and handover | <ul><li>Aggregate exports and the impact report (KPI deltas with confidence intervals; d′ and c).</li><li>Final facilitator toolkit.</li><li>Scale-up plan (including the TWA/Capacitor decision from section 2).</li><li>Retention purge scheduled.</li><li>Handover docs.</li></ul> |

**MVP required for the NYP pilot (ships by the end of Week 12):**
- [ ] A squad session for 20-30 players in 5-7 squads: QR or room-code join, Gate with disclaimer and data notice, Comfort Settings, session code, totems, Shared Seat, Reclaim Seat.
- [ ] Calibration pre and post (Forms A and B, counterbalanced), feedback form, paper backups.
- [ ] Tutorial and Room Freeze.
- [ ] **At least 6 variants for 17-24** (M09 Easy Money, M12, M10, M04, M11, M02) plus **PS1** as the Shield Sprint.
- [ ] Player-triggered Hold with fixed Freeze End and late auto-freeze; 5 lenses; Pull the String; sealed forecast; Think-Vote-Explain with confidence; re-seal and tie-break; Feedback Card and private correction note; Peer Shield; DCE (next-mission and finale slots, Ripple Trace, Late Hold); all six Guardians earnable and usable; Bond Book on the device.
- [ ] Conductor: pacing, auto-drop of Mission 3, Freeze All, Calm, Gentle, Skip, +30 s, Spotlight with consent. Big Screen: Lobby, Live, Seal Wall, Ripple Map, Look Up, Long Fast-Forward, Rewind/Stop Frames, Flip the Board, Shield Lines Wall, Closing.
- [ ] Flat View; text size; captions; reduced motion; colour-independent cues; keyboard play.
- [ ] Aggregate analytics with n ≥ 5 suppression and CSV export.
- [ ] Portal: publish with lint and two sign-offs, the Help Card config, Moment Card submission and moderation queue.
- [ ] Offline precache, reconnect and rejoin, outbox, Wake Lock.
- [ ] The disclaimer in every required place.

**Pre-agreed cut-lines** (no grant commitment breaks if these are dropped, in this order):
1. The Ripple lens (merge it into Path).
2. DIVE (play Behind the Stall at ground level).
3. The animated debrief Rewind (use static Stop Frames).
4. Mission 3 (it becomes Return-visit content).
5. The Daylight grade.
6. Solo extras.

---

## 14. Signature moments

1. **The Room Freeze.** The facilitator says "Everyone, press and hold." On the projector, the rain over the city freezes drop by drop in proportion to the number of thumbs down. When the last person holds, the thunder cuts to silence and the hanging rain glows. The room has just practised Hold Before Acting together.
2. **Your own Hold.** The countdown reads 0:07 and Dev is halfway through "just try once lah" when you press HOLD. The tape-stop drops, colour drains, and the header reads *Nothing is rushing you now.*
3. **The message in mid-air.** You held early, so Mel's next message is still a folded card hanging in the air: *"Don't mention it to your bank."* You read it before it lands.
4. **LIVE 2 · HELD 7.** The counter jumps, and pausing visibly lets you see more.
5. **Pull the String.** You drag a thread from Dev. It tightens towards a dark window, and the Gain Tag reads *Paid S$50 per recruit.* Dev is being used too, and judgement turns into empathy.
6. **Behind the Stall.** You orbit a glossy five-star seller booth in the Digi-District sky and find it is cardboard propped on sticks, with every review hung on the same day.
7. **Lanterns rise.** Seals float up as paper lanterns from each squad tower. After the re-seal, a beam of light rises, and the projector shows only how many minds changed towards safer.
8. **The Aftershock.** At the start of Mission 2, a squad's tower that glittered gold from the "easy" S$200 frosts over. Phones fast-forward "+3 weeks", a Harbour Bank notice slides in, and the sealed forecasts open: *"3 of 5 of you saw it coming."* Then comes Late Hold: *coming forward is the right move, even late.*
9. **Shieldfin crosses the table.** A pressure pop-up hits every phone in the squad. One flick, and the origami manta swims off one screen and across each teammate's in turn, dissolving it.
10. **The Shield Line.** Opener, Reason, Offer and Channel tiles from four phones snap into one message. Dev's curled-up figure slowly lowers his phone and turns towards the squad: *"ok. tomorrow morning. come with me."*
11. **Flip the Board.** The whole city turntable rotates to reveal the recruiter's corkboard, with every tactic from the session strung to the moment it was used. It was never Ren's fault; it was a script.
12. **12:00.** The Stillpoint clock finally ticks over, the city lights up block by block with the room's protective choices, and the last card reads: ***"You can't freeze time out there. But you can Hold."***