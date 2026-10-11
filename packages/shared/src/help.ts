// Help and reporting channels shown in debriefs and the always-available Help panel.
// Facts were verified against official sources on 2026-10-08. Re-verify before every pilot phase:
// helplines and laws in Singapore changed several times between 2024 and 2026.
// Shown as plain text (no hyperlinks to ScamShield/SPF pages without written consent).

export type HelpChannelId =
  | 'scamshield-1799'
  | 'scamshield-report'
  | 'police-999'
  | 'police-sms-70999'
  | 'police-hotline'
  | 'bank'
  | 'trusted-adult'
  | 'mindline-1771'
  | 'sos-1767'
  | 'tinkle-friend'
  | 'osc';

export interface HelpChannel {
  id: HelpChannelId;
  name: string;
  contact: string;
  when: string;
  hours?: string;
  /** Show to the junior (10-13) band? */
  junior: boolean;
  source: string;
  asOf: string;
}

export const HELP_CHANNELS: readonly HelpChannel[] = [
  {
    id: 'trusted-adult',
    name: 'A trusted adult',
    contact: 'A parent, teacher, school counsellor or youth worker you trust',
    when: 'Whenever something feels off, or a friend might be in trouble. You will not be blamed for asking.',
    junior: true,
    source: 'ShieldQuest guidance',
    asOf: '2026-10-08',
  },
  {
    id: 'scamshield-1799',
    name: 'ScamShield Helpline',
    contact: '1799',
    when: 'To check whether a message, call or offer is a scam.',
    hours: '24/7',
    junior: true,
    source: 'Singapore Police Force, Contact Us (police.gov.sg)',
    asOf: '2026-10-08',
  },
  {
    id: 'scamshield-report',
    name: 'ScamShield app and website',
    contact: 'ScamShield app, or scamshield.gov.sg',
    when: 'To check messages and report a scam.',
    junior: false,
    source: 'scamshield.gov.sg',
    asOf: '2026-10-08',
  },
  {
    id: 'bank',
    name: 'Your bank',
    contact: "The phone number on the back of your card or in your bank's official app",
    when: 'Immediately, if money or bank details may have been taken or misused.',
    junior: false,
    source: 'Singapore Police Force advisory, 12 Mar 2026',
    asOf: '2026-10-08',
  },
  {
    id: 'police-999',
    name: 'Police emergency',
    contact: '999',
    when: 'When someone is in danger or a crime is happening now.',
    hours: '24/7',
    junior: true,
    source: 'Singapore Police Force, Contact Us (police.gov.sg)',
    asOf: '2026-10-08',
  },
  {
    id: 'police-sms-70999',
    name: 'Police emergency SMS',
    contact: 'SMS 70999',
    when: 'In an emergency when it is not safe to talk.',
    hours: '24/7',
    junior: false,
    source: 'Singapore Police Force, change of emergency SMS number (1 Oct 2024)',
    asOf: '2026-10-08',
  },
  {
    id: 'police-hotline',
    name: 'Police Hotline',
    contact: '1800 255 0000, or i-Witness online',
    when: 'To give information about a crime (not for emergencies). Online police reports are for non-urgent cases.',
    junior: false,
    source: 'Singapore Police Force, Contact Us and Lodge Police Report e-service',
    asOf: '2026-10-08',
  },
  {
    id: 'osc',
    name: 'Online Safety Commission',
    contact: 'Report to the platform first, then to the Online Safety Commission',
    when: 'For online harassment, doxxing, online stalking or intimate image abuse.',
    junior: false,
    source: 'Ministry of Law, OSC began operations 29 June 2026',
    asOf: '2026-10-08',
  },
  {
    id: 'mindline-1771',
    name: 'National mindline',
    contact: '1771 (call), or WhatsApp +65 6669 1771',
    when: 'If you feel stressed, scared or upset. You can reach out any time.',
    hours: '24/7',
    junior: true,
    source: 'Online Safety Commission partner list (osc.gov.sg)',
    asOf: '2026-10-08',
  },
  {
    id: 'sos-1767',
    name: 'Samaritans of Singapore',
    contact: '1767',
    when: 'If you or someone you know is in crisis or thinking about self-harm.',
    hours: '24/7',
    junior: true,
    source: 'Online Safety Commission partner list (osc.gov.sg)',
    asOf: '2026-10-08',
  },
  {
    id: 'tinkle-friend',
    name: 'Tinkle Friend',
    contact: '1800 2744 788',
    when: 'For primary-school-age children who want someone to talk to.',
    hours: 'Mon–Fri 2.30pm–5pm (after hours, call 1771)',
    junior: true,
    source: "Singapore Children's Society via osc.gov.sg",
    asOf: '2026-10-08',
  },
] as const;

export const helpById = (id: HelpChannelId): HelpChannel => HELP_CHANNELS.find((h) => h.id === id)!;

/** Shown in every debrief and in the persistent Help panel. */
export const ALWAYS_SHOW_HELP: readonly HelpChannelId[] = ['trusted-adult', 'mindline-1771', 'sos-1767'];

/** Outdated numbers that must never appear in content (checked by the content lint). */
export const RETIRED_CONTACTS = [
  { pattern: /71999/, replacement: 'SMS 70999 (changed 1 Oct 2024)' },
  { pattern: /1800[\s-]?722[\s-]?6688/, replacement: 'ScamShield Helpline 1799 (changed 27 Sep 2024)' },
  { pattern: /\bScamAlert\b/i, replacement: 'ScamShield Alert' },
] as const;

/** National campaigns referenced in the team's own words (no logos or campaign artwork). */
export const CAMPAIGN_LINKS = [
  {
    name: 'I can ACT against scams',
    by: 'national anti-scam campaign',
    idea: 'Add security features, Check for scam signs with official sources, Tell the authorities, family and friends.',
  },
  {
    name: 'Stop and Check',
    by: 'national cybersecurity campaign',
    idea: 'Take a pause when you get an unexpected message, and check with official sources before you respond.',
  },
] as const;
