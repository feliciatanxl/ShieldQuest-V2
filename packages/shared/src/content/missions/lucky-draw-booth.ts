import type { Mission } from '../../mission';

// M07 The Lucky Draw Booth (GAME_DESIGN.md §9.2), 10-13 primary, also 14-16. The 17-24 variant, where the booth
// wants an IC number and an IC selfie, is lucky-draw-booth-ya.
// Players only inspect the form's fields (beat b3 lists them); nothing is ever typed, and no field takes input.
// The risk Aftershock id 'data-leaked' is the GDD's `dataLeaked` flag: M11 Parcel Re-delivery may use Mei's real
// name once a flag channel exists in the Aftershock contract (see the Retail batch report).
// Junior rules (§5.4, §9.6): short sentences, no Singlish, gentle consequences, no penalties and no age thresholds.

export const luckyDrawBooth: Mission = {
  id: 'lucky-draw-booth',
  version: 1,
  title: 'The Lucky Draw Booth',
  district: 'retail-district',
  scene: 'minimart',
  bands: ['junior', 'teen'],
  theme: 'Online safety and data requests',
  premise:
    'A booth offers free bubble tea and a chance to win a Lumen Tab. Mei just has to scan a QR code and fill in her name, birth date, address, her mum\'s phone number and a selfie.',
  skillFocus: ['S', 'E'],
  timeOfDay: 'afternoon',
  scaffold: 'guided',
  resident: 'mei',
  cast: [
    { id: 'mei', name: 'Mei', role: 'resident', anchor: 'atrium-booth', pose: 'phone', look: { body: '#fbbf24', accent: '#78350f', hair: 'bun' } },
    { id: 'promoter', name: 'Booth promoter', role: 'stranger', anchor: 'atrium-booth', pose: 'stand', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'priya', name: 'Priya', role: 'friend', anchor: 'door', pose: 'phone', look: { body: '#a78bfa', accent: '#4c1d95', hair: 'long' } },
    { id: 'mum', name: 'Mum', role: 'trusted', faceless: true, look: { body: '#a3e635', accent: '#365314', hair: 'short' } },
  ],
  intro:
    'Lumen Mall, Saturday, 4.40pm. Mei, 12, and her friend Priya are waiting for Mei\'s mum, who is at the bank. A bright booth in the middle of the mall catches Mei\'s eye.',
  live: {
    durationSec: 45,
    decisionPrompt: 'The selfie camera is open on Mei\'s phone. What should Mei do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'A big sign on the booth says: "WIN A LUMEN TAB! Free bubble tea for every entry!"', tactic: 'too-good' },
      { id: 'b2', at: 4, from: 'promoter', channel: 'speech', text: 'Hi girls! Want free bubble tea? Just scan the QR code to enter.', attachment: { kind: 'code', label: 'QR code on the booth', detail: 'Opens lumen-luckydraw.test' } },
      { id: 'b3', at: 9, from: 'narrator', channel: 'scene', text: 'The entry form opens on Mei\'s phone. It has five boxes.', attachment: { kind: 'link', label: 'lumen-luckydraw.test/enter', detail: "Full name · Birth date · Home address · Parent's phone number · Selfie" } },
      { id: 'b4', at: 14, from: 'priya', channel: 'speech', text: 'I already did mine! It only took one minute.', tactic: 'everyone-does-it' },
      { id: 'b5', at: 18, from: 'mei', channel: 'speech', text: 'Why do you need my address?' },
      { id: 'b6', at: 22, from: 'promoter', channel: 'speech', text: 'To send you the prize, of course! Your details are safe with us.', tactic: 'fake-proof' },
      { id: 'b7', at: 27, from: 'mum', channel: 'notification', text: 'Mum: Still in the bank queue. Meet you at the booth in 10 minutes 🙂' },
      { id: 'b8', at: 31, from: 'promoter', channel: 'speech', text: 'No need to ask your mum. It is free!', tactic: 'secrecy' },
      { id: 'b9', at: 36, from: 'promoter', channel: 'speech', text: 'Hurry! The draw closes at five o\'clock.', tactic: 'urgency' },
      { id: 'b10', at: 41, from: 'promoter', channel: 'speech', text: 'Last step. Just one quick selfie. Smile!', tactic: 'small-ask' },
    ],
  },
  clues: [
    { id: 'c-prize', label: 'A Lumen Tab and free bubble tea, just for filling in a form', target: { kind: 'beat', beatId: 'b1' }, redFlag: true, tactic: 'too-good', explain: 'Big prizes for a few taps are bait. The real price is your details.' },
    { id: 'c-link', label: "The QR code opens lumen-luckydraw.test, not the mall's own site", target: { kind: 'beat', beatId: 'b2' }, redFlag: true, explain: 'Anyone can print a QR code. This one goes to a site that has nothing to do with the mall. Check where a link goes before you fill anything in.' },
    { id: 'c-fields', label: "Name, birth date, home address, Mum's phone number and a selfie", target: { kind: 'beat', beatId: 'b3' }, redFlag: true, explain: 'A lucky draw only needs one way to contact the winner. All of this together tells a stranger who Mei is, where she lives and what she looks like.' },
    { id: 'c-friend', label: 'Priya: "I already did mine!"', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, tactic: 'everyone-does-it', explain: 'A friend doing it does not make it safe. It just means her details are out there too.' },
    { id: 'c-promise', label: '"Your details are safe with us"', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, tactic: 'fake-proof', explain: 'Only the booth says so, and the booth will not say who runs it. A promise you cannot check is not proof.' },
    { id: 'c-nomum', label: '"No need to ask your mum"', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'secrecy', explain: 'When someone says you do not need to ask a grown-up, that is the moment to ask one. Mum is only ten minutes away.' },
    { id: 'c-hurry', label: '"The draw closes at five o\'clock"', target: { kind: 'beat', beatId: 'b9' }, redFlag: true, tactic: 'urgency', explain: 'Hurrying stops Mei from asking Mum or checking. A real prize can wait ten minutes.' },
    { id: 'c-booth', label: 'Up close: no organiser name and no rules anywhere on the booth', target: { kind: 'anchor', anchor: 'atrium-booth' }, redFlag: true, explain: 'Real lucky draws say who runs them and print their rules. This booth has neither, so there is nobody to check with.' },
    { id: 'c-kiosk', label: 'The mall\'s own screen by the door: "How was your visit? Tap 1 to 5 stars"', target: { kind: 'anchor', anchor: 'door' }, redFlag: false, explain: 'This is normal. The mall\'s own screen asks for a star rating, not your name or address. Not every screen is a trap.' },
  ],
  influence: {
    from: 'promoter',
    hidden: {
      label: 'Whoever runs lumen-luckydraw.test',
      description: "The booth never says who runs it. Every entry goes to a website that is not the mall's. Details collected like this can be used to make scam messages that sound real.",
    },
    question: 'Pull the thread from the promoter. Who really gets something if Mei fills in the form?',
    options: [
      { id: 'i-mall', text: 'The mall. It wants to know its shoppers.', correct: false, explain: "The mall's own screen only asks for stars. This form sends Mei's details somewhere else." },
      { id: 'i-site', text: "Whoever runs lumen-luckydraw.test. They get all of Mei's details.", correct: true, explain: "Yes. The bubble tea costs them a little. Mei's name, address, birthday and face are worth much more to them." },
      { id: 'i-promoter', text: 'Only the promoter. They just want to give away bubble tea.', correct: false, explain: "The promoter may be paid for each form. But the details go to the website's owners, and they keep them." },
    ],
  },
  forecast: {
    question: 'If Mei fills in everything, what could happen in the next few weeks?',
    horizon: 'next-month',
    options: [
      { id: 'f-win', text: 'Mei wins the Lumen Tab.', likely: false },
      { id: 'f-messages', text: "Mei and her mum get scam messages that use Mei's real name.", likely: true },
      { id: 'f-nothing', text: 'Nothing. It was just a form.', likely: false },
    ],
    explain: 'Details from fake lucky draws can be used to make scam messages sound real. A message that knows your name can feel safe, but it may not be.',
  },
  choices: [
    {
      id: 'fill-all',
      label: 'Fill in everything and take the selfie',
      safety: 'risky',
      outcome: {
        title: 'Free bubble tea!',
        text: 'Mei fills in every box and smiles for the selfie. The promoter hands her a bubble tea. "You\'re in the draw! Good luck!" Priya cheers.',
        mood: 'shiny',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: 'to skip any form that asks for lots of personal details, and to ask a parent first',
        ifItHappened: "tell a parent straight away. Then watch for messages that use your name, and don't tap their links.",
      },
      aftershock: {
        id: 'data-leaked',
        polarity: 'risk',
        afterMissions: 2,
        timeLabel: '3 WEEKS LATER',
        title: 'A message that knows Mei',
        text: 'A ChatLah message arrives: "Hi Mei! You won the Lumen Tab 🎉 Pay S$5 for delivery at lumen-prize.test." It knows her name, her birthday and even her school: her selfie showed her school badge. Mum\'s phone has been getting strange messages about Mei too. There never was a Lumen Tab.',
        effects: { trust: -1, risk: 1 },
        fact: {
          text: 'ScamShield\'s advice: "Check for scam signs and with official sources."',
          source: 'ScamShield, I can ACT against scams (updated 23 Jul 2026)',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Mei feels worried. What should she do now?',
          options: [
            { id: 'r-tell', text: "Show Mum the messages. Don't reply, and don't tap the link.", good: true, response: "That's the best move. Mum can help Mei block and report the messages, and call the ScamShield Helpline 1799 to check. Beacon lights up.", help: ['trusted-adult', 'scamshield-1799'] },
            { id: 'r-pay', text: 'Pay the S$5. It is only a little money.', good: false, response: 'It is normal to want the prize. But there is no prize, and paying would give the same people even more. Showing Mum is still the best next step.' },
            { id: 'r-hide', text: 'Delete the messages and say nothing.', good: false, response: 'Wanting it to go away is normal. But Mum is getting messages too, and she can help. It is not too late to tell her.' },
          ],
        },
      },
    },
    {
      id: 'fill-some',
      label: 'Fill in just her name and birth date, and skip the rest',
      safety: 'unsure',
      outcome: {
        title: 'Half in',
        text: 'Mei types her name and birth date, then stops. "Sorry, the entry needs every box," says the promoter. No bubble tea. And her name and birthday have already been sent.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to give no details at all to a booth that will not say who runs it',
        ifItHappened: 'tell a parent what you typed in, so you can watch out for strange messages together.',
      },
    },
    {
      id: 'skip-ask',
      label: "Skip it, ask Mum, and use the mall's own screen instead",
      safety: 'safe',
      outcome: {
        title: 'No thanks',
        text: '"No thanks," Mei says, and puts her phone away. When Mum arrives, Mei tells her about the booth. They ask at the mall\'s customer service counter: there is no lucky draw today. Mei gives the mall five stars on its own screen, and Mum buys two bubble teas.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'urgency',
        saferMove: "to slow down, ask a parent, and check with the mall's own counter or app",
        ifItHappened: 'if you already gave your details, tell a parent. It is never too late.',
      },
      aftershock: {
        id: 'afterglow-spots-next',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: '2 WEEKS LATER',
        title: 'Afterglow: Mei spots the next one',
        text: 'A pop-up in Mei\'s game says: "Win Lumen Legends cards! Just enter your address." Mei knows this trick now. She shows Mum straight away, and they report the ad together. Priya asks Mei to check the next one with her.',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'skip-ask', text: 'A lucky draw only needs one way to reach the winner. This form wants to know everything about Mei.' },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'skip-ask', text: "No organiser name, no rules, and the link is not the mall's. There is nothing we can check." },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'fill-some', text: "Priya already did it, and Mei doesn't want to miss out. Giving just a few details feels like a fair middle way." },
  ],
  peerShield: {
    friend: 'priya',
    timeLabel: 'TWO WEEKS LATER',
    setup: 'After dinner, Priya messages Mei. She has found another lucky draw, this time on ChatLah.',
    messages: [
      { from: 'priya', text: 'omg there is a lucky draw for Lumen Legends cards!!' },
      { from: 'priya', text: "it just wants my address, my school and my mum's number" },
      { from: 'priya', text: "ends tonight. I'm doing it ok? don't tell my mum, she will say no 😅" },
    ],
    start: { guard: 60, doubt: 30 },
    slots: {
      opener: [
        { id: 'o-thanks', text: 'Thanks for telling me first!', quality: 'great', why: 'Thanking her for asking makes her feel safe to keep talking.', guard: -20, doubt: 5 },
        { id: 'o-look', text: 'Hmm, let me look.', quality: 'ok', why: 'Calm, but it does not help her feel safe yet.', guard: -5, doubt: 5 },
        { id: 'o-again', text: 'Again?? You never learn.', quality: 'harmful', why: 'Blame makes people hide things instead of asking for help.', guard: 40, doubt: -5 },
      ],
      reason: [
        { id: 'r-details', text: "Real draws don't need your school and address. Those details help scammers send messages that sound real.", quality: 'great', why: 'Gives a clear reason and points at the people asking, not at Priya.', guard: -5, doubt: 25 },
        { id: 'r-unsafe', text: 'It might not be safe.', quality: 'ok', why: 'True, but she needs a clear reason.', guard: 0, doubt: 10 },
        { id: 'r-fake', text: 'Just put a fake address, then it is fine.', quality: 'harmful', why: 'Her school and her mum\'s number would still go to strangers. It keeps the plan going.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-together', text: "Let's show your mum together. I'll come over after school tomorrow.", quality: 'great', why: 'Going together makes telling a grown-up much easier.', guard: -10, doubt: 15 },
        { id: 'f-skip', text: 'Maybe you could skip it?', quality: 'ok', why: 'Kind, but it leaves her to decide alone.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "Okay, I won't tell your mum.", quality: 'harmful', why: 'Keeping it secret is exactly what the people behind the draw need.', guard: -5, doubt: -15 },
      ],
      channel: [
        { id: 'c-check', text: 'If it is real, the shop\'s own app will say so. Your mum can call the ScamShield Helpline 1799 to check.', quality: 'great', why: 'Points to official ways to check, and to a trusted adult.', guard: -5, doubt: 15 },
        { id: 'c-ignore', text: 'Just ignore it.', quality: 'ok', why: 'Ignoring helps for now, but more draws like this will come.', guard: 0, doubt: 0 },
        { id: 'c-askpage', text: 'Message the lucky draw page and ask if it is real.', quality: 'harmful', why: 'The people running the page will always say yes.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Priya: "ok. I will show my mum. thanks Mei!" She skips the draw, and her mum reports the page.',
      partial: 'Priya: "maybe... I will think about it." She has not decided yet. Mei can check on her before bed.',
      fail: 'Priya: "fine, I will just do it myself." Seen.',
    },
  },
  ifThen: {
    if: 'a booth, poster or message asks for lots of my details to win a prize',
    then: "skip it, ask a parent, and check with the shop's own counter or app",
  },
  help: ['trusted-adult', 'scamshield-1799', 'tinkle-friend', 'mindline-1771'],
  sources: [
    { label: 'I can ACT against scams ("Check for scam signs and with official sources"), updated 23 Jul 2026', publisher: 'ScamShield', asOf: '2026-10-08', url: 'https://www.scamshield.gov.sg' },
    { label: 'ScamShield Helpline 1799', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
    { label: 'Get support from our partners (Tinkle Friend, mindline 1771)', publisher: 'Online Safety Commission', asOf: '2026-10-08' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
