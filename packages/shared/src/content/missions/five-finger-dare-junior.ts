import type { Mission } from '../../mission';

// M05 junior variant, "Keep Watch" (GAME_DESIGN.md §9.2, 10-13). Same deep structure as five-finger-dare, but the
// resident is asked to be the look-out, and the person pushing is being pushed too.
// Junior rules (§5.4, §9.6): short sentences, no Singlish, 2-3 choices, gentle consequences, no penalties, no legal
// detail and no age thresholds. No theft method is ever shown or hinted.

export const fiveFingerDareJunior: Mission = {
  id: 'five-finger-dare-junior',
  version: 1,
  title: 'Keep Watch',
  district: 'retail-district',
  scene: 'minimart',
  bands: ['junior'],
  theme: 'Shop-theft dare and look-out',
  premise: "Kavin's best friend Jayden wants a pack of cards he can't pay for. He asks Kavin to stand by the door and keep watch.",
  skillFocus: ['H', 'I', 'E', 'D'],
  timeOfDay: 'afternoon',
  scaffold: 'guided',
  resident: 'kavin',
  cast: [
    { id: 'kavin', name: 'Kavin', role: 'resident', anchor: 'aisle-beauty', pose: 'stand', look: { body: '#60a5fa', accent: '#1e3a8a', hair: 'short' } },
    { id: 'jayden', name: 'Jayden', role: 'friend', anchor: 'aisle-snacks', pose: 'phone', look: { body: '#fbbf24', accent: '#78350f', hair: 'short' } },
    { id: 'cashier', name: 'Auntie Lin', role: 'bystander', anchor: 'counter', pose: 'stand', look: { body: '#2dd4bf', accent: '#134e4a', hair: 'bun' } },
    { id: 'bigkids', name: 'LvlUp Squad', role: 'pressurer', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
  ],
  intro: 'MiniMart 24, Wednesday, 3.30pm. Kavin and his best friend Jayden stop in after school. Jayden is staring at a pack of Metro Legends cards.',
  live: {
    durationSec: 45,
    decisionPrompt: 'Jayden is pointing at the door. What should Kavin do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: "Jayden's phone buzzes. It is a group chat with some older kids from school." },
      { id: 'b2', at: 4, from: 'bigkids', channel: 'chat', text: "Bring the new Metro Legends pack today. Or you're not in the squad." },
      { id: 'b3', at: 9, from: 'jayden', channel: 'speech', text: "I can't pay for it. Just stand by the door and tell me if someone comes." },
      { id: 'b4', at: 14, from: 'jayden', channel: 'speech', text: "You don't even have to take anything. You just stand there.", tactic: 'small-ask' },
      { id: 'b5', at: 19, from: 'jayden', channel: 'speech', text: 'The big kids do it all the time. It is normal.', tactic: 'everyone-does-it' },
      { id: 'b6', at: 24, from: 'cashier', channel: 'speech', text: 'Hi Kavin! Say hi to your mum for me.' },
      { id: 'b7', at: 29, from: 'jayden', channel: 'speech', text: "You're my best friend, right? Best friends help each other.", tactic: 'loyalty' },
      { id: 'b8', at: 34, from: 'jayden', channel: 'speech', text: "And don't tell your mum, okay? She will make it a big thing.", tactic: 'secrecy' },
      { id: 'b9', at: 39, from: 'jayden', channel: 'speech', text: 'Quick, my mum is picking me up soon. Go to the door now!', tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-bigkids', label: 'The older kids want the cards, but they are not here', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, explain: 'The older kids get the cards and take no risk. Jayden is being pushed too.' },
    { id: 'c-small', label: '"You don\'t even have to take anything"', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, tactic: 'small-ask', explain: 'Keeping watch is still taking part. It can get Kavin into trouble too.' },
    { id: 'c-normal', label: '"The big kids do it all the time"', target: { kind: 'beat', beatId: 'b5' }, redFlag: true, tactic: 'everyone-does-it', explain: 'Lots of people doing something does not make it okay. Taking things without paying is stealing.' },
    { id: 'c-best', label: '"Best friends help each other"', target: { kind: 'beat', beatId: 'b7' }, redFlag: true, tactic: 'loyalty', explain: 'A real friend can hear no. Kavin can care about Jayden and still say no.' },
    { id: 'c-secret', label: '"Don\'t tell your mum"', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'secrecy', explain: 'When someone says "don\'t tell", that is the time to tell a grown-up you trust.' },
    { id: 'c-quick', label: '"Quick, go to the door now!"', target: { kind: 'beat', beatId: 'b9' }, redFlag: true, tactic: 'urgency', explain: 'Hurrying stops Kavin from thinking. It is okay to slow down.' },
    { id: 'c-camera', label: 'A sign on the wall: "Smile, CCTV in use"', target: { kind: 'anchor', anchor: 'cctv' }, redFlag: true, explain: 'Shops have cameras. They can show who was there, even days later. That includes the friend at the door.' },
    { id: 'c-hello', label: 'The cashier says hi to Kavin', target: { kind: 'beat', beatId: 'b6' }, redFlag: false, explain: 'This is just a friendly hello. Not every detail is a warning sign.' },
  ],
  influence: {
    from: 'jayden',
    hidden: { label: 'The older kids in the LvlUp chat', description: 'The older kids told Jayden to bring the cards to join their squad. They get free cards, and Jayden and Kavin take all the risk.' },
    question: 'Pull the thread from Jayden. Who really gets something if Kavin keeps watch?',
    options: [
      { id: 'i-kavin', text: 'Kavin. Jayden will share the cards with him.', correct: false, explain: 'Jayden never said that. And sharing the cards would not make it okay.' },
      { id: 'i-bigkids', text: 'The older kids. They get free cards without any risk.', correct: true, explain: 'Yes. The older kids push Jayden, and Jayden pushes Kavin. The people who gain are not even in the shop.' },
      { id: 'i-jayden', text: 'Only Jayden. He gets the cards.', correct: false, explain: 'Jayden wants to fit in. But the cards are for the older kids. He is being used too.' },
    ],
  },
  forecast: {
    question: 'If Kavin keeps watch, what could happen by next week?',
    horizon: 'next-week',
    options: [
      { id: 'f-fine', text: 'Nothing. Nobody will know.', likely: false },
      { id: 'f-found', text: "The shop finds out from its cameras, and both boys' parents are called.", likely: true },
      { id: 'f-stop', text: 'The older kids let Jayden in and stop asking.', likely: false },
    ],
    explain: 'Shop cameras can show who was there, even days later. And people who push you once often ask again.',
  },
  choices: [
    {
      id: 'keep-watch',
      label: 'Stand at the door and keep watch',
      safety: 'risky',
      outcome: {
        title: '"You\'re the best!"',
        text: 'Kavin stands at the door. Jayden walks out with the cards in his bag and gives Kavin a high five. The older kids send a thumbs-up. Kavin\'s heart is still racing.',
        mood: 'shiny',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to say no, leave the shop, and tell a grown-up you trust',
        ifItHappened: 'tell your mum, dad or a teacher what happened. It is brave to tell, and they can help you put it right.',
      },
      aftershock: {
        id: 'shop-calls-home',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: 'NEXT WEEK',
        title: 'The shop calls home',
        text: "The shop checked its cameras. They show Jayden taking the cards and Kavin at the door. The manager calls both families. The shop has also told the police, who will talk with the boys and their parents.",
        effects: { trust: -2, risk: 1 },
        fact: {
          text: "Shop cameras can help identify people who come back, even if they weren't caught at the time.",
          source: 'SPF, Mid-Year Crime Brief 2026',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Kavin feels scared. What should he do now?',
          options: [
            { id: 'r-tell', text: 'Tell Mum everything, even the part about the older kids.', good: true, response: 'That is the bravest move. Mum can help Kavin say sorry and put it right. Telling about the older kids may stop them pushing other children. Beacon lights up.', help: ['trusted-adult', 'tinkle-friend', 'mindline-1771'] },
            { id: 'r-hide', text: 'Say he was not there.', good: false, response: 'It is normal to feel scared. But hiding makes it harder. Telling Mum or a teacher is still the best next step.' },
            { id: 'r-ask', text: 'Ask Jayden what to say.', good: false, response: 'Jayden is scared too, and the older kids still have a hold on him. A grown-up you trust can help you both.' },
          ],
        },
      },
    },
    {
      id: 'walk-away',
      label: 'Walk away, but keep it a secret',
      safety: 'unsure',
      outcome: {
        title: 'Out, but carrying it',
        text: 'Kavin says "I can\'t" and leaves. He is out of it. But Jayden takes the cards anyway, and Kavin carries the secret home. It feels heavy all evening.',
        mood: 'mixed',
        effects: {},
      },
      feedback: {
        tactic: 'secrecy',
        saferMove: 'to leave and also tell a grown-up you trust, so the secret is not yours to carry',
        ifItHappened: 'it is not too late to tell your mum, dad or a teacher. Telling is a way of looking after your friend.',
      },
    },
    {
      id: 'say-no-tell',
      label: 'Say no, leave the shop, and tell Mum',
      safety: 'safe',
      outcome: {
        title: 'Kavin says no',
        text: 'Kavin shakes his head. "No. Let\'s go." He walks out and waits by the bus stop. Jayden follows a minute later, without the cards. That evening, Kavin tells Mum about the older kids.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'loyalty',
        saferMove: 'to say no, walk out, and tell a grown-up you trust',
        ifItHappened: 'tell a grown-up you trust what you saw. You will not be blamed for asking for help.',
      },
      aftershock: {
        id: 'afterglow-older-kids-stop',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: 'TWO DAYS LATER',
        title: 'Afterglow: the older kids stop',
        text: 'Kavin\'s mum tells the school. A teacher talks to the older kids, and the LvlUp chat goes quiet. Jayden says, "Thanks for not keeping watch."',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'say-no-tell', text: 'Keeping watch is still taking part. Kavin should leave and tell Mum.' },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'say-no-tell', text: 'The older kids are not even here. They get the cards, and Jayden takes the risk.' },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'keep-watch', text: 'Jayden is his best friend, and he looks scared. Kavin just wants to help him.' },
  ],
  peerShield: {
    friend: 'jayden',
    timeLabel: 'TWO DAYS LATER',
    setup: 'At night, Jayden messages Kavin. The older kids want him to try again tomorrow.',
    messages: [
      { from: 'jayden', text: 'the big kids say I have to try again tomorrow' },
      { from: 'jayden', text: "if I don't, I'm out of the squad forever" },
      { from: 'jayden', text: "pls don't tell anyone ok" },
    ],
    start: { guard: 60, doubt: 30 },
    slots: {
      opener: [
        { id: 'o-glad', text: "I'm really glad you told me.", quality: 'great', why: 'Thanking him for telling makes him feel safe.', guard: -20, doubt: 5 },
        { id: 'o-oh', text: 'Oh. Okay.', quality: 'ok', why: 'Calm, but it does not help him feel safe yet.', guard: -5, doubt: 5 },
        { id: 'o-shame', text: "That's so bad. I can't believe you.", quality: 'harmful', why: 'Shaming makes him hide things instead of asking for help.', guard: 40, doubt: -5 },
      ],
      reason: [
        { id: 'r-fair', text: "The big kids get the cards, and you get all the risk. That's not fair to you.", quality: 'great', why: 'Shows who gains, and blames the older kids, not Jayden.', guard: -5, doubt: 25 },
        { id: 'r-bad', text: 'It sounds like a bad idea.', quality: 'ok', why: 'True, but he needs a clear reason.', guard: 0, doubt: 10 },
        { id: 'r-once', text: 'Just do it one more time, then stop.', quality: 'harmful', why: '"One more time" is how it keeps going.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-come', text: "I'll come with you to tell your mum or our teacher.", quality: 'great', why: 'Going together makes the hard part easier.', guard: -10, doubt: 15 },
        { id: 'f-friends', text: 'Maybe find other friends?', quality: 'ok', why: 'Kind, but it leaves him to sort it out alone.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "Okay, I won't tell anyone.", quality: 'harmful', why: 'Keeping the secret is exactly what the older kids need.', guard: -5, doubt: -15 },
      ],
      channel: [
        { id: 'c-teacher', text: "A teacher can make the big kids stop. Let's tell one tomorrow.", quality: 'great', why: 'Points to a trusted adult who can really help.', guard: -5, doubt: 15 },
        { id: 'c-ignore', text: 'Just ignore their messages.', quality: 'ok', why: 'Ignoring helps for a while, but they may keep pushing.', guard: 0, doubt: 0 },
        { id: 'c-easier', text: 'Ask the big kids for an easier test.', quality: 'harmful', why: 'The older kids gain from the tests. Asking them keeps Jayden stuck.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Jayden: "ok. can you come with me to tell Ms Lim tomorrow?" He leaves the LvlUp chat.',
      partial: 'Jayden: "maybe..." He has not decided yet. Kavin can check on him at recess.',
      fail: 'Jayden: "forget it." He goes offline.',
    },
  },
  ifThen: {
    if: 'a friend asks me to keep watch or take something',
    then: 'say no, walk away, and tell a grown-up I trust',
  },
  help: ['trusted-adult', 'tinkle-friend', 'mindline-1771'],
  sources: [
    { label: 'Mid-Year Crime Brief 2026 (store CCTV)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Get support from our partners (Tinkle Friend, mindline 1771)', publisher: 'Online Safety Commission', asOf: '2026-10-08' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
