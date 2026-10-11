# Contributing to ShieldQuest

Thank you for helping young people practise safer choices. This guide covers how to set up the project, how the code is organised, and the rules every change must follow. Please also read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Play-test** on real devices, especially older Android phones and iPhones, and report what feels slow, confusing or broken.
- **Accessibility testing:** screen readers, keyboard-only play, large text, reduced motion and colour-blind checks.
- **Content review:** check missions for accuracy, tone, age-appropriateness and victim-blaming. We especially welcome youth workers, educators and counsellors.
- **Code:** bug fixes, performance work and features from the [project status](README.md#project-status) list.
- **Youth co-design:** mission ideas can be pitched through the in-app "Pitch a mission" form (Scenario Portal). Pitches never need personal stories.

## Development setup

**Requirements:** Node.js 22 or newer (developed on Node 24) and npm 10 or newer.

```bash
git clone https://github.com/feliciatanxl/ShieldQuest-V2.git
cd ShieldQuest-V2
npm install
npm run dev
```

- Web app: http://localhost:5173 (Vite, hot reload)
- API and live sessions: http://localhost:8787 (Fastify + Socket.IO; Vite proxies `/api` and `/socket.io` to it)

**Before you open a pull request**, make sure all four checks pass:

```bash
npm run typecheck
npm test
npm run build
```

and that you have played your change in the browser at phone size (360 × 800) and at desktop size.

## How the code is organised

| Path | What lives there |
|---|---|
| `packages/shared` | Shared TypeScript used by both web and server: the S.H.I.E.L.D. framework, the `Mission` schema, the rules engine, the content lint, help channels and all missions. **Code contracts here are the source of truth.** |
| `apps/web/src/site` | Public website |
| `apps/web/src/game` | City hub, mission player and Bond Book |
| `apps/web/src/world` | 3D world (kit, city, scenes) and its 2D twins |
| `apps/web/src/squad` | Squad session clients: phone, facilitator console and Big Screen |
| `apps/web/src/portal`, `assess` | Scenario Management Portal, analytics and assessment |
| `apps/server/src` | API routes, Socket.IO squad server and file-based store |
| `docs/GAME_DESIGN.md` | The game design document. Where it differs from the code contracts, the code wins. |

## Code style

- **TypeScript strict mode**, no `any`. React function components and hooks.
- Formatting: 2-space indent, single quotes, semicolons, lines up to about 120 characters. Match the surrounding code.
- Comments explain **why**, not what. Keep them short.
- CSS: plain `.css` files next to the components that use them. Class names use the module prefix (`site-`, `hub-`, `msn-`, `sq-`, `portal-`, `assess-`, `w-`, `ui-`). Use the design tokens in `apps/web/src/styles/global.css` and `rem` units.
- Keep the first load small. The 3D code (`three` and React Three Fiber) must only be loaded lazily through `apps/web/src/world/index.ts`.
- Do not add dependencies without discussing it in an issue first. Never add runtime CDNs, analytics, trackers or externally hosted fonts.

## Non-negotiable rules

Every change must keep these promises. Reviewers will check them.

### Privacy

- Never ask for or store names, ages or birthdates, schools, phone numbers, NRIC numbers, emails, photos or IP addresses.
- Solo progress stays on the device. Squad votes stay in server memory, and only group counts are stored.
- Never show any analytics for groups of fewer than 5.
- Free-text inputs must pass the personal-data guard (`findPersonalData` / `lintFreeText` in `packages/shared/src/lint.ts`).

### Accessibility

- Tap targets of at least 48 px, full keyboard operation and visible focus.
- All readable text in the DOM (never only inside the 3D canvas), so text size and screen readers work.
- Status is always shown with **shape + icon + word**, never colour alone (use `StatusBadge`).
- Respect reduced motion: use cuts and fades instead of camera flights, and no shaking.
- **No decision may require the 3D view.** Every 3D interaction needs a 2D or DOM equivalent.

### Content safety

- **Fictional brands only:** ChatLah, Barang Market, QuikGig, TaskLah, Harbour Bank, LumenPay, CityPass, EduPass, MiniMart 24, Boba Boleh, LumenPost, Lumen Legends.
- **No real links or phone numbers** in fictional content. Use `.test` / `.example` domains and `8XXX XXXX`.
- **Offender-focused feedback.** Blame the tactic, never the target. Every risky choice needs a recovery path.
- **Manipulators are never shown with a face or body.** They appear only as a chat handle or a faceless silhouette.
- **No sextortion, intimate images, self-harm methods or shop-theft techniques.** Never show caning.
- Laws and penalties use "may" and "up to". Statistics and helplines cite a source with an as-of date.

## Adding or editing a mission

1. Copy the structure of `packages/shared/src/content/missions/easy-money.ts` (the reference mission) and follow the `Mission` type in `packages/shared/src/mission.ts`.
2. Use a scene from `SCENES` and only that scene's anchor names.
3. Register the mission in the district batch file (`content/school.ts`, `retail.ts` or `digi.ts`).
4. Run `npm test`. The content test runs `lintMission` on every mission and must report **zero errors**. Fix any reading-level warnings for your age band too.
5. Set `review.status` to `'draft'`. A mission only becomes `'reviewed'` after **two human sign-offs**: one for content and one for safeguarding.
6. Re-check every legal or helpline fact against the official source before each pilot phase. Singapore's scam laws and helplines changed several times between 2024 and 2026.

## Branches, commits and pull requests

- Branch from `main` with a short descriptive name, for example `fix/hold-button-keyboard` or `content/parcel-redelivery-review`.
- Write commit messages in the imperative mood ("Add Peer Shield retry", not "Added …").
- Keep pull requests focused on one change. In the description, explain **what** changed, **why**, and **how you tested it** (devices, screen sizes, 2D mode, keyboard).
- Include screenshots or a short recording for any UI change.
- Never commit `.env` files, real data or the `apps/server/data/` folder.

## Reporting bugs and ideas

Open a GitHub issue with:

- what you expected and what happened;
- steps to reproduce, including the device, browser and screen size;
- the route (for example `/play/m/first-hold`) and the mission phase, if relevant.

**Security or privacy problems must not be reported in public issues.** Follow [SECURITY.md](SECURITY.md) instead.

## Licence

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE) that covers this project.
