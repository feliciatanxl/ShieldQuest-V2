import type { Mission } from '../../mission';

// M03 The Bus Stop Pickup (GAME_DESIGN.md §9.2). 10-13 only. Stranger approach at the school gate.
// Safeguarding: the "go along" branch NEVER shows harm. Its Aftershock lands straight away (afterMissions 0) as a
// gentle Late Hold halfway to the car park, and every path leads back to the guard and a call to Mum.
// The grown-up is a faceless silhouette; no fear imagery, no penalties, no age thresholds.

export const busStopPickup: Mission = {
  id: 'bus-stop-pickup',
  version: 1,
  title: 'The Bus Stop Pickup',
  district: 'school-street',
  scene: 'school-gate',
  bands: ['junior'],
  theme: 'Stranger approach',
  premise: 'After CCA, a grown-up Wei does not know says Mum sent them to fetch him. The car is at the next block, and it is about to rain.',
  skillFocus: ['H', 'E', 'L'],
  timeOfDay: 'evening',
  scaffold: 'guided',
  resident: 'wei',
  cast: [
    { id: 'wei', name: 'Wei', role: 'resident', anchor: 'bus-stop', pose: 'stand', look: { body: '#60a5fa', accent: '#1e3a8a', hair: 'short' } },
    { id: 'grown-up', name: 'Unknown grown-up', role: 'stranger', anchor: 'crossing', pose: 'stand', faceless: true, look: { body: '#475569', accent: '#1e293b', hair: 'none' } },
    { id: 'uncle-raj', name: 'Uncle Raj (school guard)', role: 'trusted', anchor: 'guard-post', pose: 'stand', look: { body: '#a3e635', accent: '#365314', hair: 'cap' } },
    { id: 'mum', name: 'Mum', role: 'trusted', faceless: true, look: { body: '#f472b6', accent: '#831843', hair: 'long' } },
    { id: 'hana', name: 'Hana', role: 'friend', faceless: true, look: { body: '#fbbf24', accent: '#78350f', hair: 'long' } },
  ],
  intro: '5.30pm. CCA is over. Wei waits at the bus stop outside the school gate. Dark clouds are rolling in.',
  live: {
    durationSec: 45,
    decisionPrompt: 'The grown-up is waving for Wei to follow. What should Wei do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'Wei puts his school bag on the bench and checks his phone.' },
      { id: 'b2', at: 4, from: 'mum', channel: 'chat', text: 'Take bus 23 home after CCA today. Text me when you are on it! ❤️' },
      { id: 'b3', at: 8, from: 'narrator', channel: 'scene', text: 'A grown-up Wei does not know walks over from the crossing, smiling and waving.' },
      { id: 'b4', at: 11, from: 'grown-up', channel: 'speech', text: 'Hi Wei! Your mum asked me to fetch you today. She is busy.', tactic: 'authority' },
      { id: 'b5', at: 16, from: 'grown-up', channel: 'speech', text: 'My car is at the next block. Come quickly, before it rains!', tactic: 'urgency' },
      { id: 'b6', at: 21, from: 'narrator', channel: 'scene', text: 'Wei looks at his phone again. There is no new message from Mum.' },
      { id: 'b7', at: 25, from: 'wei', channel: 'speech', text: 'Mum says anyone who fetches me knows our code word.' },
      { id: 'b8', at: 29, from: 'grown-up', channel: 'speech', text: 'Code word? No time for that. I know your name, right? Come on.', tactic: 'fake-proof' },
      { id: 'b9', at: 34, from: 'grown-up', channel: 'speech', text: 'No need to tell the uncle at the gate. Don\'t make a fuss, OK?', tactic: 'secrecy' },
      { id: 'b10', at: 38, from: 'grown-up', channel: 'speech', text: "I'll buy you a bubble tea on the way.", tactic: 'too-good' },
      { id: 'b11', at: 42, from: 'narrator', channel: 'scene', text: 'The grown-up starts walking towards the car park and waves for Wei to follow.' },
    ],
  },
  clues: [
    { id: 'c-tag', label: "Wei's name is on his bag tag", target: { kind: 'anchor', anchor: 'bench' }, redFlag: true, explain: 'Anyone walking past can read Wei\'s name off his bag. Knowing your name does not mean someone knows your family.' },
    { id: 'c-rush', label: '"Come quickly, before it rains!"', target: { kind: 'beat', beatId: 'b5' }, redFlag: true, tactic: 'urgency', explain: 'The rush is there so Wei goes before he can check. The car is also away from the gate, away from people who can help.' },
    { id: 'c-nomsg', label: 'No new message from Mum', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, explain: 'Mum\'s last message said to take bus 23. If plans had changed, Mum would tell Wei herself.' },
    { id: 'c-code', label: 'The grown-up does not know the code word', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'fake-proof', explain: 'Someone Mum really sent would know the family code word. Saying Wei\'s name is not proof.' },
    { id: 'c-secret', label: '"No need to tell the uncle at the gate"', target: { kind: 'beat', beatId: 'b9' }, redFlag: true, tactic: 'secrecy', explain: 'The grown-up wants to keep the guard out of it. When someone says "don\'t tell", that is the time to tell.' },
    { id: 'c-treat', label: 'A bubble tea to come along', target: { kind: 'beat', beatId: 'b10' }, redFlag: true, tactic: 'too-good', explain: 'A treat is used to make going along feel nice. A real helper does not need to offer Wei anything.' },
    { id: 'c-smile', label: 'The grown-up is smiling and friendly', target: { kind: 'beat', beatId: 'b3' }, redFlag: false, explain: 'Smiling is not a warning sign on its own. But friendly is not proof either. What matters is: no code word, and no message from Mum.' },
    { id: 'c-guard', label: 'Uncle Raj, the school guard, at the gate', target: { kind: 'anchor', anchor: 'guard-post' }, redFlag: false, explain: 'Not a warning sign. A safe exit! Uncle Raj is a trusted adult Wei can go to right now.' },
  ],
  influence: {
    from: 'grown-up',
    hidden: { label: 'Away from help', description: 'Each push (the rain, the treat, "don\'t tell the uncle") moves Wei away from the gate, where safe adults can see him.' },
    question: 'Pull the thread from the grown-up. What does the grown-up need Wei to do?',
    options: [
      { id: 'i-bus', text: 'Wait at the bus stop together.', correct: false, explain: 'The grown-up keeps asking Wei to leave the bus stop, not to stay.' },
      { id: 'i-away', text: 'Leave the gate and the guard, and go to a car Wei can\'t see.', correct: true, explain: 'Right. The plan only works if Wei leaves the safe place with people around. That is why the guard must not be told.' },
      { id: 'i-mum', text: 'Go home, because Mum really asked.', correct: false, explain: 'Mum did not send a message. The only one saying so is the grown-up.' },
    ],
  },
  forecast: {
    question: 'If Wei follows the grown-up, what is most likely to happen?',
    horizon: 'tonight',
    options: [
      { id: 'f-home', text: 'Wei gets home faster and stays dry.', likely: false },
      { id: 'f-far', text: 'Wei is far from the guard with someone he does not know, and Mum does not know where he is.', likely: true },
      { id: 'f-tea', text: 'Wei just gets a free bubble tea.', likely: false },
    ],
    explain: 'Going with someone you do not know takes you away from people who can help. Mum did not send anyone, so she would not know where Wei is.',
  },
  choices: [
    {
      id: 'go-along',
      label: 'Go with the grown-up to the car',
      safety: 'risky',
      outcome: {
        title: 'Wei starts walking',
        text: 'Wei follows the grown-up past the gate. The guard post gets smaller behind him. Something feels wrong.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'authority',
        designedTo: 'make a stranger seem like someone your family trusts, so you go along without checking',
        saferMove: 'to stay where the safe adults are and call home to check, even if the grown-up seems nice',
        ifItHappened: 'it is never too late to stop, go back to the guard or a shop, and call home. You will not be in trouble.',
      },
      aftershock: {
        id: 'late-hold-halfway',
        polarity: 'risk',
        afterMissions: 0,
        timeLabel: 'HALFWAY TO THE CAR PARK',
        title: 'Wei hesitates',
        text: 'Halfway to the car park, Wei slows down. Mum never sent a message. The grown-up did not know the code word. Wei can still stop.',
        effects: { trust: -1 },
        fact: {
          text: 'If you are ever in danger right now, go to a safe adult and call 999.',
          source: 'SPF, Contact Us (999, 24/7)',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Wei hesitates. What now?',
          options: [
            { id: 'r-back', text: 'Stop, say "No, I\'m going back," and walk quickly back to Uncle Raj. Call Mum from there.', good: true, response: 'Yes! It is never too late to turn back. Uncle Raj stays with Wei while he calls Mum. Mum did not send anyone. She is on her way, and she is proud of Wei. Beacon lights up.', help: ['trusted-adult', 'police-999'] },
            { id: 'r-shop', text: 'Go into the kiosk nearby and ask the shop helper to call Mum.', good: true, response: 'Good thinking. A busy shop with a helper is a safe place too. The helper calls Mum, and Uncle Raj comes over. Beacon lights up.', help: ['trusted-adult'] },
            { id: 'r-polite', text: 'Keep walking so the grown-up does not get upset.', good: false, response: 'Lots of people worry about being rude. But Wei does not have to be polite to someone pushing him to leave. He can still stop now, go back to Uncle Raj and call Mum.' },
          ],
        },
      },
    },
    {
      id: 'call-mum',
      label: 'Say "I\'ll call my mum first" and call her from beside the guard',
      safety: 'safe',
      outcome: {
        title: 'Wei checks first',
        text: 'Wei says, "I\'ll call my mum first," and walks over to Uncle Raj. The grown-up turns and leaves. Mum picks up: "I didn\'t send anyone. Stay with the guard. I\'m coming!"',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'urgency',
        saferMove: 'to slow down and check with your family yourself before you go anywhere',
        ifItHappened: 'go back to a safe adult as soon as you can and call home. You will not be in trouble for coming back.',
      },
      aftershock: {
        id: 'afterglow-code-word',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: 'THAT NIGHT',
        title: 'Afterglow: a family code word',
        text: 'At dinner, Mum and Wei pick a new family code word together. Mum says she is proud Wei checked first. His little sister learns it too.',
        effects: { trust: 1 },
      },
    },
    {
      id: 'stay-guard',
      label: 'Stay inside the gate, tell the guard, and call Mum',
      safety: 'safe',
      outcome: {
        title: 'Wei stays safe',
        text: 'Wei walks back inside the gate and tells Uncle Raj: "A grown-up I don\'t know says Mum sent him." Uncle Raj stays with Wei while he calls Mum, and writes down what happened.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'secrecy',
        saferMove: 'to go to a safe adult nearby, like a guard or a teacher, and tell them what happened',
        ifItHappened: 'go back to a safe adult as soon as you can and tell them. Telling is always the right thing.',
      },
      aftershock: {
        id: 'afterglow-school-notice',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: 'THE NEXT DAY',
        title: "Afterglow: Wei's report helped",
        text: 'The school sends a notice to all families about a grown-up who spoke to students near the bus stop. The guards are keeping watch. Wei\'s report helped everyone stay safe.',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'go-along', text: 'The grown-up knows Wei\'s name and is being nice. Saying no to a grown-up feels rude, and it is about to rain.' },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'call-mum', text: 'Mum\'s message said to take the bus. The only one saying "Mum sent me" is the grown-up. Let\'s check with Mum.' },
    { id: 'p-lead', role: 'Safety Lead', leaning: 'stay-guard', text: 'Uncle Raj is right there. Inside the gate, next to a safe adult, nobody can rush Wei.' },
  ],
  peerShield: {
    friend: 'hana',
    timeLabel: 'THE NEXT WEEK',
    setup: 'Hana is at the playground near her block. A grown-up she does not know is talking to her. She messages Wei.',
    messages: [
      { from: 'hana', text: 'wei!! a lady says my dad sent her to bring me home' },
      { from: 'hana', text: 'she knows my name. she says dad is busy and we have to go now' },
      { from: 'hana', text: "she says don't call him, he's in a meeting" },
    ],
    start: { guard: 55, doubt: 25 },
    slots: {
      opener: [
        { id: 'o-glad', text: "Hana, wait! I'm really glad you messaged me.", quality: 'great', why: 'It tells Hana that asking was the right thing to do.', guard: -20, doubt: 5 },
        { id: 'o-hmm', text: 'Hmm, wait a sec.', quality: 'ok', why: 'Calm, but it does not help her feel safe yet.', guard: -5, doubt: 5 },
        { id: 'o-why', text: 'Why are you even talking to her??', quality: 'harmful', why: 'Blame makes Hana feel bad instead of helping her act.', guard: 30, doubt: -5 },
      ],
      reason: [
        { id: 'r-name', text: 'Knowing your name is not proof. Your dad would tell you himself.', quality: 'great', why: 'It gives a clear reason to check, without scaring her.', guard: -5, doubt: 20 },
        { id: 'r-weird', text: 'That sounds a bit weird.', quality: 'ok', why: 'True, but Hana needs a clear reason.', guard: 0, doubt: 10 },
        { id: 'r-nice', text: 'She knows your name, so it is probably fine.', quality: 'harmful', why: 'A name is easy to find out. This pushes Hana to go.', guard: -5, doubt: -15 },
      ],
      offer: [
        { id: 'f-stay', text: "I'll stay on the chat with you until your dad answers.", quality: 'great', why: 'Hana is not alone while she checks.', guard: -10, doubt: 10 },
        { id: 'f-tell', text: 'Tell me what happens, OK?', quality: 'ok', why: 'Kind, but she is still on her own right now.', guard: -5, doubt: 5 },
        { id: 'f-go', text: 'Just go, and text me when you get home.', quality: 'harmful', why: 'This sends Hana away from help with someone she does not know.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-shop', text: 'Go into MiniMart 24 next to the playground and ask the cashier to help you call your dad.', quality: 'great', why: 'A safe adult in a busy place, and a call straight to her dad.', guard: -5, doubt: 15 },
        { id: 'c-friend', text: 'Maybe ask another friend what to do.', quality: 'ok', why: 'Friends care, but a grown-up nearby can help faster.', guard: 0, doubt: 5 },
        { id: 'c-proof', text: 'Ask the lady to show you a text from your dad.', quality: 'harmful', why: 'Proof from the person asking is not proof. Hana should call her dad herself.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Hana: "ok I\'m going into MiniMart 24 now." Ten minutes later: "dad says he didn\'t send anyone!! he\'s coming. thank you Wei."',
      partial: 'Hana: "ok I\'ll wait here I guess." She has not called her dad yet. Wei can ask Mum to help right now.',
      fail: 'Hana: "you\'re making it a big deal." Wei can still tell Mum right away, so a grown-up can help Hana.',
    },
  },
  ifThen: {
    if: 'a grown-up I do not know says my family sent them to fetch me',
    then: 'stay near a safe adult, like a guard or teacher, and call my family to check',
  },
  help: ['police-999', 'trusted-adult', 'tinkle-friend', 'mindline-1771'],
  sources: [
    { label: 'Contact Us: emergency 999', publisher: 'Singapore Police Force', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
    { label: 'Get support from our partners (Tinkle Friend, mindline 1771)', publisher: 'Online Safety Commission', asOf: '2026-10-08', url: 'https://www.osc.gov.sg' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
