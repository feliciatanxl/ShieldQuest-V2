import type { Mission } from '../../mission';

// M06 Prank for the Feed (GAME_DESIGN.md §9.2), teen primary, also young adults.
// A "views challenge" dares Nadia to film an older cleaner and post it with a mocking caption. The cleaner is a person
// with dignity, never a punchline: no clip is ever shown, only what the group says and what happens next.
// Legal wording stays general [S11]: "Singapore has laws against harassment and online harms."

export const prankForTheFeed: Mission = {
  id: 'prank-for-the-feed',
  version: 1,
  title: 'Prank for the Feed',
  district: 'retail-district',
  scene: 'food-court',
  bands: ['teen', 'young-adult'],
  theme: 'Online harassment and risky dares',
  premise: 'A "views challenge" pays for the most-watched prank. Nadia\'s friends dare her to film the food court cleaner and post it with a mocking caption.',
  skillFocus: ['I', 'L', 'D'],
  timeOfDay: 'evening',
  scaffold: 'light',
  resident: 'nadia',
  cast: [
    { id: 'nadia', name: 'Nadia', role: 'resident', anchor: 'table', pose: 'sit', look: { body: '#a78bfa', accent: '#4c1d95', hair: 'hijab' } },
    { id: 'bryan', name: 'Bryan', role: 'pressurer', anchor: 'pillar', pose: 'lean', look: { body: '#f97316', accent: '#7c2d12', hair: 'short' } },
    { id: 'farah', name: 'Farah', role: 'friend', anchor: 'stall', pose: 'stand', look: { body: '#f472b6', accent: '#831843', hair: 'long' } },
    { id: 'rahim', name: 'Uncle Rahim', role: 'bystander', anchor: 'tray-return', pose: 'walk', look: { body: '#94a3b8', accent: '#1e293b', hair: 'short' } },
    { id: 'daredash', name: 'DareDash', role: 'stranger', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
  ],
  intro: 'Metro Food Court, Friday, 6.20pm. Nadia, 16, is at a table with Bryan and Farah. Uncle Rahim, the cleaner, is clearing trays nearby.',
  live: {
    durationSec: 55,
    decisionPrompt: "Uncle Rahim is walking past with a stack of trays. Bryan nudges Nadia's phone. What should Nadia do?",
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: "Bryan's phone lights up. DareDash has posted this week's Views Challenge." },
      { id: 'b2', at: 4, from: 'daredash', channel: 'chat', text: 'VIEWS CHALLENGE 🔥 Prank a random uncle or auntie. Most views by 8pm wins S$100 MetroPay credit!', tactic: 'too-good', attachment: { kind: 'link', label: 'daredash.test/challenge', detail: 'Top 10 clips get reposted to 80k followers' } },
      { id: 'b3', at: 9, from: 'bryan', channel: 'speech', text: 'Nadia, film Uncle Rahim. Caption it something savage. Easy views.' },
      { id: 'b4', at: 15, from: 'bryan', channel: 'speech', text: 'Get his face in properly. His reaction is the funny part.' },
      { id: 'b5', at: 21, from: 'narrator', channel: 'scene', text: 'At the next table, a student films her bowl of laksa for her food page.' },
      { id: 'b6', at: 26, from: 'farah', channel: 'speech', text: "Everyone in our class posted one already. Kayla's got 20k views.", tactic: 'everyone-does-it' },
      { id: 'b7', at: 32, from: 'bryan', channel: 'speech', text: "Relax lah, it's just a joke. He won't even know.", tactic: 'small-ask' },
      { id: 'b8', at: 38, from: 'daredash', channel: 'chat', text: "Last week's winner 👑 Can you beat this?", attachment: { kind: 'screenshot', label: "Comments on last week's top clip", detail: 'Laughing emojis first, then crueller and crueller comments about the man in the video' } },
      { id: 'b9', at: 44, from: 'bryan', channel: 'speech', text: "Don't be boring, Nadia. You said you're in.", tactic: 'loyalty' },
      { id: 'b10', at: 50, from: 'daredash', channel: 'chat', text: '⏰ 2 hours left! Post now to make the Top 10.', tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-prize', label: 'DareDash pays for the "most views"', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: "The prize rewards whatever gets the most views, and cruel clips often do. DareDash grows its page on other people's clips." },
    { id: 'c-face', label: '"Get his face in properly"', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, explain: 'With his face in it, anyone who knows Uncle Rahim can recognise him: his family, his friends, his boss.' },
    { id: 'c-everyone', label: '"Everyone in our class posted one already"', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, tactic: 'everyone-does-it', explain: 'Other people posting does not make it okay. It only means more people have been pulled into the challenge.' },
    { id: 'c-joke', label: '"It\'s just a joke. He won\'t even know."', target: { kind: 'beat', beatId: 'b7' }, redFlag: true, tactic: 'small-ask', explain: 'A joke that only works if the person never finds out is a joke at his expense. And clips travel, so he may well find out.' },
    { id: 'c-comments', label: "The comments on last week's top clip", target: { kind: 'beat', beatId: 'b8' }, redFlag: true, explain: 'Comments on clips like this start with laughs and turn cruel. The person in the video cannot reply, and the clip stays up.' },
    { id: 'c-lanyard', label: "Uncle Rahim's lanyard: a photo of his grandkids", target: { kind: 'anchor', anchor: 'tray-return' }, redFlag: true, explain: "He is somebody's grandfather. If the clip spreads, his family could see him being laughed at." },
    { id: 'c-laksa', label: 'A student filming her laksa', target: { kind: 'beat', beatId: 'b5' }, redFlag: false, explain: 'Filming your own food is ordinary. Filming is not the problem. Filming a person to mock them, without asking, is.' },
    { id: 'c-booth', label: 'Pop-up booth sign: "Filming a promo. Tell us if you\'d rather not be in it."', target: { kind: 'anchor', anchor: 'popup-booth' }, redFlag: false, explain: 'This is normal, respectful filming: they tell people and let them say no. That is the difference.' },
  ],
  influence: {
    from: 'bryan',
    hidden: { label: 'The DareDash page', description: "DareDash grows its page on clips other people send in. It gets the views; the people in the clips, and the people who post them, carry the cost." },
    question: 'Pull the thread from Bryan. Who gains most if Nadia posts the clip?',
    options: [
      { id: 'i-bryan', text: 'Bryan. He gets a laugh.', correct: false, explain: 'Bryan gets a laugh, but the thread runs past him to DareDash.' },
      { id: 'i-daredash', text: 'DareDash. Its page grows on every clip, and it takes none of the blame.', correct: true, explain: 'Right. DareDash gets the views. Nadia gets the risk, and Uncle Rahim gets hurt.' },
      { id: 'i-rahim', text: 'Uncle Rahim. He might go viral.', correct: false, explain: "Going viral for being laughed at isn't a gain. He never agreed to be in it." },
    ],
  },
  forecast: {
    question: 'If Nadia posts the clip, what is most likely by next week?',
    horizon: 'next-week',
    options: [
      { id: 'f-forgotten', text: 'It gets a few laughs and is forgotten by Monday.', likely: false },
      { id: 'f-spreads', text: 'It spreads beyond her friends, and people work out who Uncle Rahim is.', likely: true },
      { id: 'f-delete', text: 'She can delete it any time, and that ends it.', likely: false },
    ],
    explain: 'Clips travel further than we plan. Once a clip has been reposted, deleting your own post does not pull the copies back.',
  },
  choices: [
    {
      id: 'post-it',
      label: 'Film Uncle Rahim and post it to the challenge',
      safety: 'risky',
      outcome: {
        title: '3,000 views and climbing',
        text: "The views tick up fast: 200, 900, 3,000. Bryan cheers. DareDash reposts it with a crown emoji. Nadia's phone won't stop buzzing.",
        mood: 'shiny',
        effects: { risk: 2 },
      },
      feedback: {
        tactic: 'everyone-does-it',
        saferMove: "to refuse to film anyone to mock them, swap to a dare that doesn't target a person, and report the challenge account",
        ifItHappened: 'delete the clip, report any reposts on the platform, tell a trusted adult, and apologise to the person if you can. Acting fast limits how far it spreads.',
      },
      aftershock: {
        id: 'clip-spread',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: '1 WEEK LATER',
        title: 'The clip got away',
        text: "The clip has been reposted on three other pages. Uncle Rahim's granddaughter saw it, and he has stopped greeting students at the food court. Nadia's account was reported, and the school counsellor has asked to see her. She deleted her post, but the reposts are still up.",
        effects: { trust: -2, risk: 1 },
        fact: {
          text: 'Report harmful posts on the platform first. If that does not work, the Online Safety Commission can help with online harassment. Singapore has laws against harassment and online harms.',
          source: 'MinLaw, The Online Safety Commission begins operations on 29 June 2026',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: "It's already out there. What should Nadia do now?",
          options: [
            { id: 'r-own', text: 'Tell the counsellor the truth, report every repost, and apologise to Uncle Rahim in person.', good: true, response: "That's the strongest move. She can't pull every copy back, but owning it and reporting the reposts limits the harm, and an apology matters to him. Beacon lights up.", help: ['trusted-adult', 'osc'] },
            { id: 'r-kidding', text: 'Post a "just kidding" story and move on.', good: false, response: 'A "just kidding" story won\'t reach everyone who saw the clip, and it doesn\'t undo the hurt. It\'s not too late to talk to the counsellor or another trusted adult.' },
            { id: 'r-daredash', text: 'Message DareDash and ask them to quietly take it down.', good: false, response: "DareDash gains from the clip staying up. Report the reposts through the platform's own tools, and tell a trusted adult who can help." },
          ],
        },
      },
    },
    {
      id: 'only-for-us',
      label: 'Film him, but keep it "only for us" in the group chat',
      safety: 'risky',
      outcome: {
        title: 'Just for the group',
        text: 'Nadia films Uncle Rahim and drops it in the group chat only. Laughing emojis pour in. "Don\'t worry, it stays here," Bryan types.',
        mood: 'shiny',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to not film people to mock them, even "just for us". Once a clip exists, nobody controls where it goes',
        ifItHappened: 'delete the clip, ask everyone in the chat to delete it too, and tell a trusted adult if it has spread.',
      },
      aftershock: {
        id: 'only-for-us-leaked',
        polarity: 'risk',
        afterMissions: 2,
        timeLabel: '2 WEEKS LATER',
        title: '"Only for us" didn\'t stay that way',
        text: "Someone in the group chat forwarded the clip. It ended up on DareDash anyway, with Nadia's name in the caption. Uncle Rahim's family has asked the food court manager to find out who filmed it.",
        effects: { trust: -2, risk: 1 },
        recovery: {
          prompt: 'The clip is out, with her name on it. What should Nadia do now?',
          options: [
            { id: 'r-own', text: 'Tell a trusted adult, report the repost, and apologise to Uncle Rahim.', good: true, response: "That's the strongest move. Owning it early and reporting the repost limits the harm, and an apology matters to him. Beacon lights up.", help: ['trusted-adult', 'osc'] },
            { id: 'r-callout', text: 'Find out who forwarded it and call them out in the group.', good: false, response: 'It makes sense to feel betrayed. But a group fight spreads the clip further. Reporting the repost and talking to a trusted adult will help more.' },
          ],
        },
      },
    },
    {
      id: 'refuse-swap',
      label: 'Refuse, suggest a harmless dare, and report the challenge',
      safety: 'safe',
      outcome: {
        title: 'The chilli challenge',
        text: 'Nadia puts her phone face down. "Nah, Uncle Rahim\'s just doing his job. New dare: who can finish the sambal without water?" Farah laughs first. Bryan rolls his eyes, then films himself in tears over the sambal. Nadia reports the DareDash post.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'everyone-does-it',
        saferMove: 'to say no to clips that mock someone, offer a fun dare that targets nobody, and report the challenge account',
        ifItHappened: "report the clip on the platform, don't share it further, and tell a trusted adult. If you know the person in it, help them report it too.",
      },
      aftershock: {
        id: 'afterglow-chilli',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: '1 WEEK LATER',
        title: 'Afterglow: the chilli challenge wins',
        text: "Bryan's sambal clip gets more laughs than any prank. Two other groups switch to food dares too, and the DareDash challenge post is taken down after reports. Uncle Rahim still waves at Nadia's table.",
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'refuse-swap', text: "If he hasn't agreed to be filmed, he isn't in on the joke. He is the joke." },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'refuse-swap', text: "Look at last week's top clip. The comments start with laughs and end with insults. That's where this clip goes too." },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'only-for-us', text: "Nadia doesn't want to be the boring one. If it stays in our chat, nobody outside will see it, right?" },
  ],
  peerShield: {
    friend: 'farah',
    timeLabel: 'TWO DAYS LATER',
    setup: 'It is the last night of the Views Challenge. Farah has filmed the drinks-stall auntie singing along to the radio, and Bryan wants her to post it.',
    messages: [
      { from: 'farah', text: "ok don't judge but I filmed the drinks auntie singing 😂" },
      { from: 'farah', text: 'bryan says post it, last night of the challenge' },
      { from: 'farah', text: "it's funny right?? she won't see it anyway" },
    ],
    start: { guard: 60, doubt: 30 },
    slots: {
      opener: [
        { id: 'o-asked', text: "Thanks for checking with me first. That's a good sign.", quality: 'great', why: 'Noticing that she asked lowers her guard.', guard: -20, doubt: 5 },
        { id: 'o-see', text: 'Hmm, let me see it.', quality: 'ok', why: 'Neutral. It keeps the talk going but does not help her feel safe.', guard: -5, doubt: 5 },
        { id: 'o-mean', text: "Wow. That's actually so mean of you.", quality: 'harmful', why: 'Shame makes people defend the clip instead of rethinking it.', guard: 40, doubt: -5 },
      ],
      reason: [
        { id: 'r-gains', text: 'DareDash gets the views, she gets laughed at, and she never said yes. Clips like this spread way past us.', quality: 'great', why: 'Names who gains and the real harm, without attacking Farah.', guard: -5, doubt: 25 },
        { id: 'r-trouble', text: 'Could get you in trouble.', quality: 'ok', why: 'True, but it leaves out the auntie. A clearer reason works better.', guard: 0, doubt: 10 },
        { id: 'r-blur', text: "Just blur her face, then it's fine.", quality: 'harmful', why: 'People can still be recognised, and it still mocks her. It keeps the plan alive.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-sambal', text: "Want to do the sambal dare with me tonight instead? I'll film you.", quality: 'great', why: 'A fun swap gives her a way out without losing face.', guard: -10, doubt: 15 },
        { id: 'f-else', text: "You'll think of something else.", quality: 'ok', why: 'Kind, but it leaves her to find the way out alone.', guard: -5, doubt: 5 },
        { id: 'f-close', text: 'Just post it on your close friends story.', quality: 'harmful', why: '"Only for us" clips get forwarded. It is the same risk with extra steps.', guard: -5, doubt: -15 },
      ],
      channel: [
        { id: 'c-report', text: "Let's report the DareDash post together. If anything gets posted, we tell a teacher we trust.", quality: 'great', why: "Uses the platform's own report tools and a trusted adult.", guard: -5, doubt: 15 },
        { id: 'c-leave', text: 'Just leave the challenge chat.', quality: 'ok', why: 'Leaving helps her, but the challenge keeps going for everyone else.', guard: 0, doubt: 0 },
        { id: 'c-ask', text: "Ask DareDash if it's against the rules.", quality: 'harmful', why: 'DareDash gains from every clip. It will always say it is fine.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Farah: "ok fine, sambal dare it is. deleting it now 🫣" She deletes the clip and reports the challenge post.',
      partial: 'Farah: "hmm ok I\'ll think about it." The clip is still on her phone. Checking in later could help.',
      fail: 'Farah: "wow ok, forget I asked." Seen.',
    },
  },
  ifThen: {
    if: 'friends dare me to film someone so we can laugh at them',
    then: 'say no, suggest a dare that targets nobody, and report the challenge',
  },
  help: ['trusted-adult', 'osc', 'mindline-1771'],
  sources: [
    { label: 'The Online Safety Commission begins operations on 29 June 2026', publisher: 'Ministry of Law', asOf: '2026-10-08' },
    { label: 'Get support from our partners (mindline 1771)', publisher: 'Online Safety Commission', asOf: '2026-10-08' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
