# Security Policy

ShieldQuest is designed to be used by young people, so we treat **privacy issues as security issues**. Thank you for helping keep players safe.

## Supported versions

| Version | Supported |
|---|---|
| `main` branch (latest) | Yes |
| Anything older | No: please test against `main` |

## Reporting a vulnerability

**Please do not open a public issue for security or privacy problems.**

1. Use GitHub's private reporting: go to the repository's **Security** tab and choose **Report a vulnerability**. This opens a private advisory that only the maintainers can see.
2. If that option is not available, contact the repository owner [@feliciatanxl](https://github.com/feliciatanxl) privately on GitHub and ask for a private channel. Do not include exploit details in a public message.

Please include:

- what you found and where (file, route or socket event);
- steps to reproduce, or a proof of concept that uses **test data only**;
- the impact you think it has (for example, "a player's vote can be linked to a seat");
- any suggested fix.

**What to expect:**

| Step | Target time |
|---|---|
| Acknowledge your report | within 3 working days |
| Confirm whether it is a valid issue | within 7 working days |
| Release a fix for a confirmed high-severity issue | as soon as possible, before any pilot session continues |

We will keep you updated and credit you in the fix, unless you prefer to stay anonymous.

## What we especially want to hear about

- **Any way to collect or reveal personal data.** For example: names, NRIC numbers, phone numbers, emails, IP addresses or precise timestamps getting into storage or logs, or the personal-data guard being bypassed in free-text fields.
- **Breaking vote privacy.** For example: linking an individual's private vote, confidence or reasons to their seat or pseudonym, or exposing raw splits on the projector or to other players.
- **Small-group exposure.** Analytics or assessment results shown for groups of fewer than 5 people.
- **Session hijacking.** Joining or controlling someone else's session, seat or facilitator console (for example, guessing session codes or misusing host keys).
- **Educator portal auth bypass.** Publishing missions without the required two sign-offs.
- **Unsafe content getting through.** Ways to get real links, real phone numbers or harmful content past the content lint and moderation queue.
- **Injection.** Cross-site scripting or injection through mission content, youth submissions or socket events.
- **Third-party requests.** Anything that makes players' browsers contact third-party servers.

## Out of scope

- Denial-of-service against development servers.
- Findings that need physical access to an unlocked device.
- Social engineering of the maintainers or of pilot participants. **Never test on real participants or real sessions.**
- Missing security headers on local development servers (`localhost`).

## Safe harbour

We will not take action against good-faith research that:

- only uses accounts, sessions and data you created yourself;
- does not access, change or keep other people's data;
- does not disrupt pilot sessions or degrade the service for others;
- gives us reasonable time to fix the issue before you disclose it publicly.

## Our privacy commitments

These are the commitments that security reports help us keep:

- no accounts, no names, and no personal data from players;
- solo progress stays on the device;
- squad votes stay in memory, and only group counts are saved;
- assessments use random codes, and results are reported only for groups of 5 or more;
- logs exclude IP addresses, user agents and request bodies;
- no third-party scripts, fonts or analytics at runtime.

For details, see the "Privacy and safety by design" section of the [README](README.md).
