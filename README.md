# ShieldQuest

**Scams need you to hurry. You can Hold.**
*Choose Right. Protect Together.*

ShieldQuest is a 3D crime- and scam-prevention game that runs in the browser. It is the youth-facing part of **Project SHIELD**, a youth-led initiative by **Team SecurePi** (Nanyang Polytechnic, Singapore). Young people practise the split-second decisions that scammers and peer pressure exploit, so they have practised them before facing them for real.

> ShieldQuest is a student project by Team SecurePi (Nanyang Polytechnic). It is not an official SPF, NCPC or Government product. All scenarios are fictional.

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)

---

## Contents

- [Why ShieldQuest exists](#why-shieldquest-exists)
- [How a mission plays](#how-a-mission-plays)
- [Features](#features)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [App routes](#app-routes)
- [Configuration](#configuration)
- [Privacy and safety by design](#privacy-and-safety-by-design)
- [Content and sources](#content-and-sources)
- [Deployment](#deployment)
- [Project status](#project-status)
- [Contributing](#contributing)
- [Team](#team)
- [License](#license)

## Why ShieldQuest exists

Most crime-prevention education is passive: a talk, a poster, a video. Scams don't win because people have never heard of them. They win because they **rush** people: a countdown, a friend saying "just try once", money on the table. The Singapore Police Force reported that 81.8% of scams in 2025 involved victims being manipulated into making the transfers themselves (SPF Annual Scam and Cybercrime Brief 2025).

ShieldQuest trains the opposite of rushing. In the city of **Lumen**, the player is a *Holder*: someone who can freeze time one second before a risky choice, look around, and decide calmly. Every mission walks through the **S.H.I.E.L.D. Behavioural Framework**:

| Letter | Skill | Guardian |
|---|---|---|
| **S** | Spot the Risk | Cluepaw |
| **H** | Hold Before Acting | Echo |
| **I** | Identify the Influence | VeriFox |
| **E** | Evaluate the Consequences | ByteBuddy |
| **L** | Lead the Right Choice | Beacon |
| **D** | Defend Your Community | Shieldfin |

Guardians are origami companions **earned by demonstrating skills**. There are no loot boxes, no shop and no public rankings.

## How a mission plays

1. **Live:** the moment plays in real time on your phone. Chat messages arrive, a clock ticks, and a *Pressure Ring* names each tactic as it lands (URGENCY, BIG REWARD, EVERYONE DOES IT …).
2. **HOLD:** press and hold to freeze time. Rain hangs in the air and nothing rushes you.
3. **Investigate:** inspect messages, people and places. Pin the warning signs, and mark ordinary details as "Seems fine".
4. **Pull the String:** follow the thread from the person pushing to whoever really gains.
5. **Sealed forecast:** predict what happens later. Lumen checks it later.
6. **Think, Vote, Explain:** seal a private vote with how sure you are, hear other views, then re-seal.
7. **Release:** live with the result now. The *Delayed Consequence Engine* brings an **Aftershock** (or a positive **Afterglow**) one or two missions later, always with a recovery path.
8. **Peer Shield:** a friend faces the same pressure. Build a message that helps without blaming them.
9. **Bond:** the S.H.I.E.L.D. letters light up and Guardians unfold.

The full design is in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

## Features

- **No download.** It is a Progressive Web App opened from a QR code and runs on phones, tablets, laptops and classroom projectors.
- **Solo play** with progress stored only on the device, and **squad sessions** for 90-minute facilitated workshops (squads of 4–5 on their own phones, a facilitator console and a projector "Big Screen").
- **Three content bands:** 10–13, 14–16 and 17–24.
- **Code-built 3D city and scenes.** Low-poly geometry generated in code, with no model downloads and adaptive quality for low-end Android phones.
- **A full 2D mode** that is a first-class version of the game, used for older devices, battery saving and screen readers.
- **Accessibility.** Text size up to 150%, reduced motion, captions for sounds, tap-to-hold, and status shown with shape, icon and word together (never colour alone).
- **Synthesised audio** (Web Audio API), so there are no audio files or licences.
- **Content safety lint** that every mission must pass: no real brands, links or phone numbers, no victim-blaming language, a recovery path for every risky choice, and sources with as-of dates.
- **Scenario Management Portal** (in progress) for educators, with moderated youth-created missions.
- **Before-and-after assessment** (in progress) using random pseudonymous codes, with results reported only for groups of 5 or more.

## Getting started

**Requirements:** Node.js 22 or newer (developed on Node 24) and npm 10 or newer.

```bash
git clone https://github.com/feliciatanxl/ShieldQuest-V2.git
cd ShieldQuest-V2
npm install
npm run dev
```

Then open **http://localhost:5173**.

| Service | Port | Notes |
|---|---|---|
| Web app (Vite) | `5173` | Proxies `/api` and `/socket.io` to the API server |
| API + live sessions (Fastify + Socket.IO) | `8787` | Override with `API_PORT` when using `npm run dev` |

To try it on a phone on the same Wi-Fi, open `http://<your-computer's-IP>:5173`.

## Scripts

Run these from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the web app and the API server together |
| `npm run dev:web` | Starts the web app only |
| `npm run dev:server` | Starts the API server only |
| `npm run build` | Builds the production web app into `apps/web/dist` |
| `npm start` | Runs the API server, which also serves `apps/web/dist` when it exists |
| `npm run typecheck` | Type-checks every workspace |
| `npm test` | Runs all tests once (Vitest), including the content safety lint for every mission |
| `npm run test:watch` | Runs the tests in watch mode |

## Project structure

```
ShieldQuest-V2/
├─ apps/
│  ├─ web/                 React 19 + Vite PWA (public website + game)
│  │  └─ src/
│  │     ├─ site/          Public website pages
│  │     ├─ game/          City hub, mission player, Guardians / Bond Book
│  │     ├─ world/         3D world: kit, city, mission scenes and their 2D twins
│  │     ├─ squad/         Squad sessions: join, facilitator console, Big Screen
│  │     ├─ assess/        Before/after assessment
│  │     ├─ portal/        Scenario Management Portal and analytics
│  │     ├─ audio/         Synthesised sound and haptics
│  │     ├─ ui/            Shared UI components
│  │     └─ state/         On-device settings and progress
│  └─ server/              Fastify 5 + Socket.IO API (sessions, portal, assessments)
├─ packages/
│  └─ shared/              Shared TypeScript: S.H.I.E.L.D. framework, mission schema,
│                          game rules engine, content lint, help channels, missions
├─ docs/GAME_DESIGN.md     Final game design document
└─ scripts/dev.mjs         Runs web + API together in development
```

**Tech stack:** TypeScript, React 19, Vite 8, three.js with React Three Fiber and drei, Zustand, Motion, Wouter, Fastify 5, Socket.IO 4, Zod and Vitest.

## App routes

| Route | Purpose |
|---|---|
| `/` | Public website (also `/how-it-works`, `/educators`, `/safety`, `/about`, `/help`) |
| `/play` | Game hub: the city of Lumen |
| `/play/m/:id` | Play a mission (start with `/play/m/first-hold`) |
| `/play/guardians` | Bond Book: Guardians, tactics codex and If-Then cards |
| `/play/nightfall` | Land any pending Aftershocks at the end of a solo session |
| `/join`, `/j/:code`, `/j/:code/:totem` | Join a squad session (students; the totem form comes from tent-card QR codes) |
| `/host`, `/host/:code` | Facilitator console |
| `/screen/:code` | Projector Big Screen |
| `/assess` | Before / after / return check |
| `/portal` | Scenario Management Portal and youth mission submissions |
| `/portal/analytics` | Educator analytics (aggregates only, n ≥ 5) |

## Configuration

Environment variables (all optional in development):

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `8787` | Port the API server listens on |
| `HOST` | server | `0.0.0.0` | Interface to bind |
| `API_PORT` | `npm run dev` | `8787` | API port used by the dev runner |
| `CORS_ORIGIN` | server | allow all | Comma-separated list of allowed origins |
| `LOG_LEVEL` | server | `info` | Log level (logs never include IP addresses or request bodies) |
| `SHIELDQUEST_DATA_DIR` | server | `apps/server/data` | Folder for the file-based data store |
| `SHIELDQUEST_SERVER` | web (dev) | `http://127.0.0.1:8787` | Where Vite proxies API calls |
| `PORTAL_PASSCODE` | server | dev passcode outside production | Educator portal passcode (at least 8 characters). **Required in production** |
| `NODE_ENV` | server | unset (`production` on Railway) | `production` disables the dev portal passcode and the public assessment summary route |
| `ASSESSMENT_PURGE_DATE` | server | unset | `YYYY-MM-DD`, 90 days after the final report: from that date the server deletes every stored assessment response (GDD §11.15) |

Never commit `.env` files. They are git-ignored.

## Privacy and safety by design

- **No accounts and no names.** Players are never asked for names, ages, schools, phone numbers, NRIC, emails or photos.
- **Solo progress stays on the device** (browser storage) and is never uploaded.
- **Squad votes are kept in memory only.** Reveals show counts only, and only group-level aggregates are saved.
- **Assessments use a random code** (for example `ORCA-7K2`), and results are only reported for groups of **5 or more**.
- **No third-party requests at runtime.** No CDNs, analytics, external fonts or trackers; everything is self-hosted.
- **Offender-focused content.** Feedback always blames the manipulator's tactic, never the target, and every risky path has a recovery. Help channels (mindline 1771, SOS 1767, a trusted adult) are always one tap away.

See [SECURITY.md](SECURITY.md) to report a privacy or security issue.

## Content and sources

Missions live in [`packages/shared/src/content/missions`](packages/shared/src/content/missions). Each one is plain data following the `Mission` type in [`mission.ts`](packages/shared/src/mission.ts) and must pass `lintMission` (run by `npm test`).

- All brands, people, links and phone numbers are **fictional**: ChatLah, Barang Market, QuikGig, Harbour Bank, `.test` domains, `8XXX XXXX`.
- Facts about helplines, laws and statistics cite official Singapore sources with an **as-of date**. Singapore's scam laws changed several times between 2024 and 2026, so **re-verify before every pilot**.
- **Every mission is currently a draft.** Each needs two human sign-offs (content and safeguarding) before it is used with youths.

## Deployment

The server is a single Node.js process that serves the API, live sessions and the built web app:

```bash
npm run build
NODE_ENV=production PORT=8080 PORTAL_PASSCODE=<choose-a-strong-passcode> npm start
```

**Recommended hosting:** one small Amazon Lightsail instance in Singapore (about US$12/month, which supports WebSockets) behind HTTPS. AWS App Runner is not suitable: it closed to new customers in 2026 and does not support WebSockets.

## Project status

This is an active student project heading towards a pilot.

| Area | Status |
|---|---|
| Shared framework, mission schema, rules engine, content lint | Done |
| Solo mission player (full loop, playable end to end) | Done |
| 19 missions across School Street, Retail District and Digi-District | Done (drafts awaiting two human sign-offs) |
| Public website (home, how it works, educators, safety, about, help) | Done |
| 3D city of Lumen, 7 mission sets, origami Guardians, 2D mode | Done |
| Squad sessions (facilitator console, phones, Big Screen) | Done |
| Before/after assessment, Scenario Portal, analytics | Done |
| Synthesised sound and haptics | Done |
| Tested on real mid-range Android phones and in a real classroom | Not yet: planned before the pilot |

**Before the pilot:** two human sign-offs on every mission, a re-check of every statistic, helpline and legal line against official sources, and setting `PORTAL_PASSCODE` and `ASSESSMENT_PURGE_DATE` in production.

## Contributing

Contributions are welcome, especially accessibility testing, content review and youth co-design feedback. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Team

**Team SecurePi**, Nanyang Polytechnic

- **Felicia Tan:** product and technology, UI/UX, game systems
- **Charlisa Tan:** research and content, scenario design, pilot coordination

## License

The code is released under the [MIT License](LICENSE). Bundled third-party packages keep their own licences (for example, the Fredoka font is under the SIL Open Font License).

**Acknowledgements:** this work is informed by game-based learning research, including Ruiz, Sanchez & Figueredo (2024), *Frontiers in Education*, and Henriksen-Bulmer et al. (2024), *Interactive Learning Environments*. It also echoes, in our own words, the national "I can ACT against scams" and "Stop and Check" campaigns. No official logos are used, and no endorsement is implied.
