import type { Mission } from '../../mission';

// M02 The Screenshot (GAME_DESIGN.md §9.2), 10-13 and 14-16 wording. Cyberbullying in a class group chat.
// Upstander focus: don't add to it, check on the person privately, report, tell a teacher.
// 10-13 rule: no legal detail and no age thresholds, so the OSC age line lives only in the 17-24 variant.

export const theScreenshot: Mission = {
  id: 'the-screenshot',
  version: 1,
  title: 'The Screenshot',
  district: 'school-street',
  scene: 'canteen',
  bands: ['junior', 'teen'],
  theme: 'Cyberbullying',
  premise: 'Someone posts an edited photo of Jun Hao in the class chat. The laughing reacts pour in, and Aisha is asked to add a sticker.',
  skillFocus: ['I', 'L', 'D'],
  timeOfDay: 'afternoon',
  scaffold: 'light',
  resident: 'aisha',
  cast: [
    { id: 'aisha', name: 'Aisha', role: 'resident', anchor: 'lockers', pose: 'phone', look: { body: '#2dd4bf', accent: '#134e4a', hair: 'hijab' } },
    { id: 'marcus', name: 'Marcus', role: 'pressurer', anchor: 'bench', pose: 'sit', look: { body: '#fb923c', accent: '#7c2d12', hair: 'short' } },
    { id: 'meme', name: 'Memelord_3B', role: 'stranger', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'jun-hao', name: 'Jun Hao', role: 'bystander', anchor: 'corridor', pose: 'lean', look: { body: '#818cf8', accent: '#312e81', hair: 'short' } },
    { id: 'ms-ong', name: 'Ms Ong', role: 'trusted', anchor: 'noticeboard', pose: 'stand', look: { body: '#facc15', accent: '#713f12', hair: 'long' } },
  ],
  intro: 'Lunch time by the lockers. Aisha opens her class chat, "3B Chill". Something new has just been posted.',
  live: {
    durationSec: 50,
    decisionPrompt: 'Everyone is waiting to see what Aisha posts. What should Aisha do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'Aisha\'s phone buzzes again and again. The class chat is going fast.' },
      { id: 'b2', at: 3, from: 'meme', channel: 'chat', text: 'LOOK AT JUN HAO 🤣🤣🤣', attachment: { kind: 'image', label: 'Edited photo of Jun Hao', detail: 'His face stuck on a crying baby, with a mean caption' } },
      { id: 'b3', at: 7, from: 'narrator', channel: 'notification', text: '14 people reacted 😂 in 30 seconds.', tactic: 'everyone-does-it' },
      { id: 'b4', at: 12, from: 'marcus', channel: 'speech', text: 'Add a sticker lah. Everyone is.', tactic: 'everyone-does-it' },
      { id: 'b5', at: 17, from: 'meme', channel: 'chat', text: 'Funniest sticker gets a shoutout! 🏆', tactic: 'too-good' },
      { id: 'b6', at: 22, from: 'narrator', channel: 'notification', text: 'The photo has been forwarded 9 times.' },
      { id: 'b7', at: 27, from: 'ms-ong', channel: 'chat', text: 'Reminder: science worksheets are due on Friday. Thank you!' },
      { id: 'b8', at: 31, from: 'meme', channel: 'chat', text: "Relax, it's just one sticker. He won't even know.", tactic: 'small-ask' },
      { id: 'b9', at: 36, from: 'meme', channel: 'chat', text: "Don't show the teachers ok. What happens in 3B Chill stays in 3B Chill. 🤐", tactic: 'secrecy' },
      { id: 'b10', at: 41, from: 'marcus', channel: 'speech', text: "If you don't, they'll think you're on his side.", tactic: 'loyalty' },
      { id: 'b11', at: 46, from: 'narrator', channel: 'notification', text: 'Marcus added a sticker. 15 reacts now.' },
    ],
  },
  clues: [
    { id: 'c-edit', label: 'The photo was edited to make fun of Jun Hao', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, explain: 'Jun Hao is not in on this joke. A photo changed to laugh at someone is bullying, even when it is called a joke.' },
    { id: 'c-reacts', label: '14 laughing reacts in 30 seconds', target: { kind: 'beat', beatId: 'b3' }, redFlag: true, tactic: 'everyone-does-it', explain: 'Lots of reacts make joining in feel normal. But every react also adds to the hurt.' },
    { id: 'c-prize', label: 'A "shoutout" for the funniest sticker', target: { kind: 'beat', beatId: 'b5' }, redFlag: true, tactic: 'too-good', explain: 'The poster rewards people for joining in. More stickers means more attention for the poster.' },
    { id: 'c-forward', label: 'Forwarded 9 times, and counting', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, explain: 'Once a photo is forwarded, it can spread far beyond the class. It is very hard to pull back.' },
    { id: 'c-secret', label: '"Don\'t show the teachers"', target: { kind: 'beat', beatId: 'b9' }, redFlag: true, tactic: 'secrecy', explain: 'The poster knows a teacher would stop this. When someone says "don\'t tell", that is the time to tell.' },
    { id: 'c-junhao', label: 'Jun Hao, alone at the end of the corridor', target: { kind: 'anchor', anchor: 'corridor' }, redFlag: true, explain: 'Jun Hao has seen it. His status has just gone offline, and he is staring at the floor. The "joke" is landing on a real person.' },
    { id: 'c-notice', label: "Ms Ong's worksheet reminder", target: { kind: 'beat', beatId: 'b7' }, redFlag: false, explain: 'Just a normal class message. Not everything in the chat is a problem. The edited photo is.' },
  ],
  influence: {
    from: 'marcus',
    hidden: { label: "Memelord_3B's attention", description: 'The poster gets more reacts, more followers and more attention with every sticker and every forward.' },
    question: 'Pull the thread from Marcus. Who really gains when Aisha adds a sticker?',
    options: [
      { id: 'i-marcus', text: 'Marcus. He wins a prize for every sticker.', correct: false, explain: 'Marcus gets nothing. He is just going along with the crowd, like Aisha is being asked to.' },
      { id: 'i-poster', text: 'The poster. Every sticker and forward brings Memelord_3B more attention.', correct: true, explain: 'Right. The poster asked for stickers and offered a shoutout. The more people join, the bigger the poster looks.' },
      { id: 'i-nobody', text: "Nobody. It's just a joke.", correct: false, explain: 'Someone does gain: the poster. And someone pays the cost: Jun Hao.' },
    ],
  },
  forecast: {
    question: 'If Aisha adds a sticker, what is most likely to happen by next week?',
    horizon: 'next-week',
    options: [
      { id: 'f-forget', text: 'Everyone forgets about it by tomorrow.', likely: false },
      { id: 'f-spread', text: 'The photo spreads to other classes, with her sticker on it.', likely: true },
      { id: 'f-laugh', text: 'Jun Hao laughs about it too.', likely: false },
    ],
    explain: 'Forwarded photos keep travelling. Each sticker stays on the picture, and the person in it sees every share.',
  },
  choices: [
    {
      id: 'add-sticker',
      label: 'Add a sticker or forward it',
      safety: 'risky',
      outcome: {
        title: 'Three people laugh',
        text: 'Aisha adds a laughing sticker. Three people react to hers. For a moment, it feels good to be part of it.',
        mood: 'shiny',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'everyone-does-it',
        saferMove: 'to skip the react and the forward, send the person a kind private message, and report the post',
        ifItHappened: 'delete your sticker, say sorry to the person privately, and tell a teacher so the post can be taken down.',
      },
      aftershock: {
        id: 'photo-spreads',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: 'ONE WEEK LATER',
        title: 'The photo has spread',
        text: 'The edited photo has reached other classes, with Aisha\'s sticker still on it. Jun Hao has stopped going to CCA.',
        effects: { trust: -2, risk: 1 },
        recovery: {
          prompt: 'It already happened. What can Aisha do now?',
          options: [
            { id: 'r-repair', text: 'Delete her sticker, say sorry to Jun Hao privately, report the reposts and tell Ms Ong.', good: true, response: 'That is brave and kind. Removing her part and saying sorry helps Jun Hao, and a teacher can help get the reposts taken down. Beacon lights up.', help: ['trusted-adult'] },
            { id: 'r-leave', text: 'Leave it. The photo is everywhere now anyway.', good: false, response: 'It can feel too late. It isn\'t. Deleting her sticker and telling a teacher still helps Jun Hao feel less alone.' },
            { id: 'r-group', text: 'Ask the group to stop, but don\'t tell any teachers.', good: false, response: 'Asking the group to stop is a good start. But the photo is still spreading. A teacher or parent can help get it taken down.' },
          ],
        },
      },
    },
    {
      id: 'stay-silent',
      label: 'Stay silent and scroll past',
      safety: 'unsure',
      outcome: {
        title: 'Aisha says nothing',
        text: 'Aisha doesn\'t add a sticker. But the reacts keep coming, and Jun Hao has no idea that anyone is on his side.',
        mood: 'sober',
        effects: {},
      },
      feedback: {
        tactic: 'everyone-does-it',
        saferMove: 'to stay out of it, and also check on the person privately and report the post',
        ifItHappened: 'it is not too late to message the person, report the post and tell a teacher.',
      },
    },
    {
      id: 'support-report',
      label: 'Don\'t forward. Message Jun Hao "you ok?", report the post and tell a teacher',
      safety: 'safe',
      outcome: {
        title: 'Aisha reaches out',
        text: 'Aisha sends Jun Hao a private message: "Hey, you ok? That post isn\'t funny." She reports the post and shows Ms Ong. A minute later, Jun Hao replies: "thanks".',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'everyone-does-it',
        saferMove: 'to support the person privately, report the post and tell a trusted adult',
        ifItHappened: 'keep reporting the reposts and let a teacher help get them taken down.',
      },
      aftershock: {
        id: 'afterglow-taken-down',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: 'THE NEXT WEEK',
        title: 'Afterglow: others follow Aisha',
        text: 'Two classmates also report the post, and it is taken down. Jun Hao is back at CCA. He tells Aisha her message helped.',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'stay-silent', text: 'If Aisha says anything, the group might turn on her next. Staying out of it feels safer.' },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'support-report', text: 'The forward count keeps going up. The longer the post stays, the further it spreads.' },
    { id: 'p-lead', role: 'Safety Lead', leaning: 'support-report', text: 'Imagine being Jun Hao right now. One kind message and one report can change his whole day.' },
  ],
  peerShield: {
    friend: 'marcus',
    timeLabel: 'TWO DAYS LATER',
    setup: 'Memelord_3B has posted another edited photo, this time of a different classmate. Marcus messages Aisha privately.',
    messages: [
      { from: 'marcus', text: 'eh did you see the new one 😂' },
      { from: 'marcus', text: "should I add a sticker? everyone is. I don't want them to think I'm boring" },
      { from: 'marcus', text: "don't tell Ms Ong ok" },
    ],
    start: { guard: 55, doubt: 25 },
    slots: {
      opener: [
        { id: 'o-thanks', text: 'Thanks for asking me first.', quality: 'great', why: 'It shows him that asking was the right thing to do, so his guard drops.', guard: -20, doubt: 5 },
        { id: 'o-hmm', text: 'Hmm, wait.', quality: 'ok', why: 'Calm, but it does not tell him you are on his side.', guard: -5, doubt: 5 },
        { id: 'o-mean', text: "Wow. You're so mean.", quality: 'harmful', why: 'Calling him names makes him defend himself instead of thinking.', guard: 30, doubt: -5 },
      ],
      reason: [
        { id: 'r-real', text: 'That photo is hurting a real person. The poster just wants attention.', quality: 'great', why: 'Names who gets hurt and who gains, without blaming Marcus.', guard: -5, doubt: 20 },
        { id: 'r-funny', text: "It's not that funny.", quality: 'ok', why: 'True, but it is about taste, not about the person being hurt.', guard: 0, doubt: 10 },
        { id: 'r-small', text: 'Just add a small one. No one will notice.', quality: 'harmful', why: 'Every sticker adds to the pile, and the poster gains.', guard: -5, doubt: -15 },
      ],
      offer: [
        { id: 'f-both', text: "Let's both message him to check he's ok.", quality: 'great', why: 'Doing it together makes being kind feel normal, not risky.', guard: -10, doubt: 10 },
        { id: 'f-you', text: "You decide. I'm not adding one.", quality: 'ok', why: 'A good example, but it leaves him on his own.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "OK, I won't tell Ms Ong you asked.", quality: 'harmful', why: 'Keeping it secret helps the post stay up.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-report', text: "Let's report the post and show Ms Ong together.", quality: 'great', why: 'Reporting and a teacher can get the post taken down.', guard: -5, doubt: 15 },
        { id: 'c-mute', text: 'Maybe just mute the chat.', quality: 'ok', why: 'It protects you, but the post stays up.', guard: 0, doubt: 5 },
        { id: 'c-back', text: "Let's make a meme about the poster back.", quality: 'harmful', why: 'Hitting back spreads more hurt and can make it worse for everyone.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Marcus: "ok you\'re right. I\'ll message him too. Can we tell Ms Ong after recess?"',
      partial: 'Marcus: "hmm ok maybe I won\'t add one." He has not reported it yet. Checking in again could help.',
      fail: 'Marcus: "whatever, you\'re no fun." He adds a sticker. Aisha can still report the post and tell Ms Ong.',
    },
  },
  ifThen: {
    if: 'someone posts a photo to make fun of a classmate',
    then: 'skip the react and the forward, check on them privately, and tell a teacher',
  },
  help: ['trusted-adult', 'tinkle-friend', 'mindline-1771', 'osc'],
  sources: [
    { label: 'The Online Safety Commission begins operations on 29 June 2026', publisher: 'Ministry of Law', asOf: '2026-10-08', url: 'https://www.osc.gov.sg' },
    { label: 'Get support from our partners (Tinkle Friend, mindline 1771)', publisher: 'Online Safety Commission', asOf: '2026-10-08' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
