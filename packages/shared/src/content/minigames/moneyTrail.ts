// Money Trail: follow "easy money" step by step and see where it really goes and what happens next.
// Juniors: game accounts, gift cards, "hold this money for me". Teens and young adults: mule jobs, lending
// bank cards, SIM cards and Singpass. Every step has exactly one correct option; the last step is always
// "what should you do". Tone: serious about consequences, never blaming people who were tricked.
// Status: draft. The legal lines (marked LEGAL) need checking against current Singapore law before a pilot.
import type { MoneyTrailScenario } from './types';

export const MONEY_TRAIL_SCENARIOS: readonly MoneyTrailScenario[] = [
  // ------------------------------------------------------------------ Junior
  {
    id: 'mt-game-account',
    bands: ['junior'],
    status: 'draft',
    title: 'Sell your game account?',
    hook: {
      from: 'GemBuyer',
      channel: 'dm',
      message: "I'll pay S$50 for your game account! Send me your login and password. I'll pay after I check it.",
    },
    steps: [
      {
        id: 's1',
        node: { kind: 'you', label: 'You send your login' },
        scene: 'You send your login and password to GemBuyer.',
        prompt: 'What happens next?',
        options: [
          { id: 'a', text: 'GemBuyer pays you S$50.', correct: false, explain: 'Often they never pay. Once they have your login, they do not need to.' },
          { id: 'b', text: 'They change the password and lock you out.', correct: true, explain: 'Right. Your account, your items and your friends list now belong to a stranger.' },
        ],
      },
      {
        id: 's2',
        node: { kind: 'scammer', label: 'The stranger' },
        scene: 'The stranger now controls your account, with your name and picture.',
        prompt: 'What might they do with it?',
        options: [
          { id: 'a', text: 'Message your friends as "you" and ask for their codes.', correct: true, explain: 'Yes. Your friends trust your name, so they are easy to trick.' },
          { id: 'b', text: 'Keep it safe and never use it.', correct: false, explain: 'Stolen accounts get used, often to trick more people.' },
        ],
      },
      {
        id: 's3',
        node: { kind: 'friends', label: 'Your friends' },
        scene: 'Your friend Sam gets a message from "you": "Can you send me the code on your phone?"',
        prompt: 'Who gets hurt?',
        options: [
          { id: 'a', text: "Nobody. It's just a game.", correct: false, explain: 'Real people lose accounts and items. Friends may even think it was you.' },
          { id: 'b', text: 'Your friends can lose their accounts too.', correct: true, explain: 'Yes. One shared login can spread to a whole group of friends.' },
        ],
      },
      {
        id: 's4',
        node: { kind: 'choice', label: 'Your choice' },
        scene: "Back to the start. GemBuyer's message is waiting.",
        prompt: 'What is the best thing to do?',
        options: [
          { id: 'a', text: 'Ask them to pay first, then send the login.', correct: false, explain: 'Even if they paid, a stranger would have your account and could trick your friends.' },
          { id: 'b', text: 'Say no, keep your login private, and tell a trusted adult.', correct: true, explain: 'That keeps you and your friends safe. You will not get in trouble for asking for help.' },
        ],
      },
    ],
    lesson: 'Your login is only for you. Selling or sharing it can hurt you and your friends. Tell a trusted adult about offers like this.',
  },
  {
    id: 'mt-hold-money',
    bands: ['junior', 'teen'],
    status: 'draft',
    title: 'Hold this money for me',
    hook: {
      from: 'Kai (game friend)',
      channel: 'chat',
      message: "Can I send S$100 to your MetroPay? Then you send it to my cousin's account. You keep S$10 for helping!",
    },
    steps: [
      {
        id: 's1',
        node: { kind: 'victim', label: 'Where it starts' },
        scene: 'S$100 arrives in your MetroPay. But where did it come from?',
        prompt: 'Where does this money really come from?',
        options: [
          { id: 'a', text: "Kai's pocket money.", correct: false, explain: 'Then why pay you S$10 to pass it on? Kai could send it straight to his cousin.' },
          { id: 'b', text: 'Maybe from someone who was tricked by a scam.', correct: true, explain: "Yes. Scammers move stolen money through other people's accounts to hide it." },
        ],
      },
      {
        id: 's2',
        node: { kind: 'account', label: 'Your MetroPay' },
        scene: 'The money sits in your MetroPay, in your name.',
        prompt: 'Whose name is now on this money trail?',
        options: [
          { id: 'a', text: 'Yours. The account is in your name.', correct: true, explain: 'Right. Banks and police follow the money, and your account is on the trail.' },
          { id: 'b', text: "Only Kai's.", correct: false, explain: 'The money went through your account, so your name is on the trail too.' },
        ],
      },
      {
        id: 's3',
        node: { kind: 'transfer', label: 'Sent on' },
        scene: 'You send S$90 on to "the cousin". It disappears into another account.',
        prompt: 'What happens to the person who lost the S$100?',
        options: [
          { id: 'a', text: 'The bank gives it back to them straight away.', correct: false, explain: 'Once money has moved on, it is often gone for good.' },
          { id: 'b', text: 'It is now much harder for them to get it back.', correct: true, explain: 'Yes. Every hop makes stolen money harder to find and return.' },
        ],
      },
      {
        id: 's4',
        node: { kind: 'bank', label: 'The bank checks' },
        scene: 'The person who was tricked reports it. The bank looks at the trail.',
        prompt: 'What could happen to your account?',
        options: [
          { id: 'a', text: 'It can be frozen, and the police may want to talk to you and your family.', correct: true, explain: 'Yes. It is serious, even for someone who was only "helping". Telling an adult early really helps.' },
          { id: 'b', text: 'Nothing. You only kept S$10.', correct: false, explain: 'Helping to move scam money is a crime, even for a small reward.' },
        ],
      },
      {
        id: 's5',
        node: { kind: 'choice', label: 'Your choice' },
        scene: 'Kai asks again: "Please, just this once."',
        prompt: 'What do you do?',
        options: [
          { id: 'a', text: 'Do it just once for the S$10.', correct: false, explain: 'Once is enough to put your account on the money trail.' },
          { id: 'b', text: "Say no, don't let anyone use your account, and tell a trusted adult.", correct: true, explain: 'Exactly. Your account is only for your own money.' },
        ],
      },
    ],
    lesson: 'Never let anyone send money through your account, even a friend. If it already happened, tell a trusted adult now. They will help you.',
  },
  {
    id: 'mt-gift-card-errand',
    bands: ['junior'],
    status: 'draft',
    title: 'The gift card favour',
    hook: {
      from: 'Leo (met in a game)',
      channel: 'chat',
      message: "Can you buy a S$50 game gift card with your mum's card and send me the code? I'll give you rare items worth S$200!",
    },
    steps: [
      {
        id: 's1',
        node: { kind: 'you', label: "Mum's card" },
        scene: "You use Mum's card to buy a S$50 gift card.",
        prompt: 'Whose money is this?',
        options: [
          { id: 'a', text: "Mum's. It is family money, used without asking.", correct: true, explain: 'Yes. Leo is getting your family to pay, and Mum does not even know.' },
          { id: 'b', text: "Leo's, because he will pay you back with items.", correct: false, explain: 'Leo has not paid anything. The S$50 came from Mum.' },
        ],
      },
      {
        id: 's2',
        node: { kind: 'transfer', label: 'The code' },
        scene: 'You send the gift card code to Leo.',
        prompt: 'What can Leo do with the code?',
        options: [
          { id: 'a', text: 'Nothing, until he gives you the items.', correct: false, explain: 'He can use it the moment he sees it. Nothing makes him send the items.' },
          { id: 'b', text: 'Spend it straight away. A code is like cash.', correct: true, explain: 'Yes. Once sent, anyone can use it, anywhere, and it cannot be taken back.' },
        ],
      },
      {
        id: 's3',
        node: { kind: 'scammer', label: 'Leo' },
        scene: 'Leo goes quiet. No rare items arrive.',
        prompt: 'What does Leo do next?',
        options: [
          { id: 'a', text: 'Asks for another code, or blocks you.', correct: true, explain: 'Scammers often say the first code "did not work" to get one more.' },
          { id: 'b', text: 'Sends the items a week later.', correct: false, explain: 'There were never any items. The promise was the bait.' },
        ],
      },
      {
        id: 's4',
        node: { kind: 'choice', label: 'Your choice' },
        scene: 'Leo messages: "First code failed. Send one more and I send everything."',
        prompt: 'What should you do now?',
        options: [
          { id: 'a', text: 'Stop, keep the chat, and tell Mum or another trusted adult.', correct: true, explain: 'Telling an adult quickly is the best move. It is not your fault you were tricked.' },
          { id: 'b', text: 'Buy one more code so Leo sends the items.', correct: false, explain: 'Sending more only loses more. Stop and get help.' },
        ],
      },
    ],
    lesson: 'Gift card codes are like cash. Never buy or send them for someone online. If it happened, tell an adult. It is not your fault.',
  },

  // ------------------------------------------------------------------ Teen and young adult
  {
    id: 'mt-easy-job',
    bands: ['teen', 'young-adult'],
    status: 'draft',
    title: 'Easy S$200 job',
    hook: {
      from: 'Mel (QuikGig recruiter)',
      channel: 'chat',
      message: 'Easy S$200! Receive a transfer into your bank account, then send it on to our partner. 10 minutes of work. Interested?',
    },
    steps: [
      {
        id: 's1',
        node: { kind: 'victim', label: 'Mdm Rose, 68' },
        scene: 'Mdm Rose got a call from a fake "bank officer". She was told to move S$2,000 to "keep it safe".',
        prompt: 'Where does the money in this "job" really come from?',
        options: [
          { id: 'a', text: 'Company sales that need processing.', correct: false, explain: 'Real companies use their own accounts. They do not pay strangers to pass money along.' },
          { id: 'b', text: 'Someone like Mdm Rose, who was tricked by a scam.', correct: true, explain: 'Yes. Mule "jobs" move money taken from scam victims.' },
          { id: 'c', text: "The recruiter's own savings.", correct: false, explain: 'Then the recruiter could send it straight to the partner.' },
        ],
      },
      {
        id: 's2',
        node: { kind: 'account', label: 'Your bank account' },
        scene: 'S$2,000 lands in your account. Mel says: send S$1,800 on and keep S$200.',
        prompt: 'What is your account being used for?',
        options: [
          { id: 'a', text: 'Normal payroll work.', correct: false, explain: 'Payroll is done by companies, not by students moving money through personal accounts.' },
          { id: 'b', text: 'Testing a banking app.', correct: false, explain: 'No real test needs real money from strangers.' },
          { id: 'c', text: 'Hiding where stolen money goes. That makes you a money mule.', correct: true, explain: 'Right. Mules are the link that makes stolen money hard to trace.' },
        ],
      },
      {
        id: 's3',
        node: { kind: 'transfer', label: 'Sent overseas' },
        scene: 'You transfer S$1,800 to "the partner". Minutes later it moves again, overseas.',
        prompt: 'What does this mean for Mdm Rose?',
        options: [
          { id: 'a', text: 'Her money is now very hard to trace or get back.', correct: true, explain: 'Yes. Each hop, especially overseas, makes recovery much harder.' },
          { id: 'b', text: 'The bank reverses it automatically.', correct: false, explain: 'Banks can sometimes stop money early, but once it is overseas it is often gone.' },
          { id: 'c', text: 'She gets it back from you later.', correct: false, explain: 'You only kept S$200. The rest has already gone.' },
        ],
      },
      {
        id: 's4',
        node: { kind: 'police', label: 'The report' },
        scene: 'Mdm Rose reports the scam. Police follow the money, and your account is on the trail.',
        prompt: 'What can happen to you?',
        options: [
          { id: 'a', text: 'Nothing. Only Mel gets in trouble.', correct: false, explain: 'Mel is hard to find. The account is in your name, so you are the easiest to trace.' },
          // LEGAL: money mule offences in Singapore (incl. rash/negligent dealing). Check wording.
          {
            id: 'b',
            text: 'Your account can be frozen, police can investigate, and you can be charged even if you say you did not know.',
            correct: true,
            explain: 'Yes. Letting your account move scam money is a crime in Singapore. "I thought it was a job" may not protect you, especially when there were warning signs.',
          },
          { id: 'c', text: 'You return the S$200 and it is over.', correct: false, explain: 'Returning the money does not undo what happened. The investigation can still go ahead.' },
        ],
      },
      {
        id: 's5',
        node: { kind: 'choice', label: 'Your choice' },
        scene: "Back to Mel's first message.",
        prompt: 'What is the best move?',
        options: [
          { id: 'a', text: 'Do it once to see if it is real.', correct: false, explain: 'Once is enough to put your account on the money trail.' },
          { id: 'b', text: 'Ask for a bigger cut first.', correct: false, explain: 'More money means more risk, not less.' },
          { id: 'c', text: 'Say no, never share your account details, keep the chat, and tell a trusted adult or report it.', correct: true, explain: 'That protects you, and your report can warn others.' },
        ],
      },
    ],
    lesson: 'Never let anyone move money through your account. Money mule "jobs" are a crime, even when they say it is legal. If you already did it, stop and tell a trusted adult now.',
  },
  {
    id: 'mt-lend-card',
    bands: ['teen', 'young-adult'],
    status: 'draft',
    title: 'Borrow your ATM card?',
    hook: {
      from: "Daniel (friend's cousin)",
      channel: 'chat',
      message: "Can borrow your ATM card and PIN for one month? I give you S$500. My account kena closed, just need to collect some payments.",
      plainMessage: 'Can I borrow your ATM card and PIN for one month? I will give you S$500. My account was closed, I just need to collect some payments.',
    },
    steps: [
      {
        id: 's1',
        node: { kind: 'you', label: 'Your card' },
        scene: 'You hand over your card and PIN. You get S$500 cash.',
        prompt: 'Why would someone pay S$500 to use your card?',
        options: [
          { id: 'a', text: 'Their own bank is slow.', correct: false, explain: 'Slow banks do not make people pay S$500 for a stranger\'s card.' },
          { id: 'b', text: 'Their accounts were closed, maybe for scams, so they need a clean one.', correct: true, explain: 'Yes. Accounts used for scams get shut down, so criminals look for new ones.' },
          { id: 'c', text: 'They are just being generous.', correct: false, explain: 'S$500 is the price of using your name to hide something.' },
        ],
      },
      {
        id: 's2',
        node: { kind: 'account', label: 'Your account' },
        scene: 'Over the month, S$18,000 flows in and out of your account in dozens of transfers.',
        prompt: 'Whose money is it?',
        options: [
          { id: 'a', text: 'Money from scam victims, moved through your name.', correct: true, explain: 'Right. Your account became a stop on the money trail.' },
          { id: 'b', text: "Daniel's business payments.", correct: false, explain: 'A real business has its own account. It does not need yours.' },
          { id: 'c', text: "Nobody's. It is just numbers on a screen.", correct: false, explain: 'Every dollar belonged to someone who lost it.' },
        ],
      },
      {
        id: 's3',
        node: { kind: 'bank', label: 'The bank' },
        scene: 'The bank spots the pattern.',
        prompt: 'What does the bank do?',
        options: [
          { id: 'a', text: 'Sends Daniel a warning.', correct: false, explain: "The account is in your name. The bank deals with you, not Daniel." },
          { id: 'b', text: 'Nothing, because you did not make the transfers.', correct: false, explain: 'It is your account, so the bank holds you responsible for how it is used.' },
          { id: 'c', text: 'Freezes your account and reports it to the police.', correct: true, explain: 'Yes. You may also find it hard to open bank accounts later.' },
        ],
      },
      {
        id: 's4',
        node: { kind: 'police', label: 'Police' },
        scene: 'Police contact you about the transfers.',
        prompt: 'Does "I only lent my card" protect you?',
        options: [
          // LEGAL: handing over bank accounts / Singpass credentials as an offence. Check wording.
          { id: 'a', text: 'No. Giving others your bank account, card or login can be a crime on its own.', correct: true, explain: 'In Singapore, handing over your bank account, card or Singpass for others to use can be an offence, even if you never touched the money.' },
          { id: 'b', text: 'Yes, because Daniel made the transfers.', correct: false, explain: 'You gave him the tools. That can be an offence by itself.' },
          { id: 'c', text: 'Yes, if you give back the S$500.', correct: false, explain: 'Giving the money back does not undo what your account was used for.' },
        ],
      },
      {
        id: 's5',
        node: { kind: 'choice', label: 'Your choice' },
        scene: "Back to Daniel's message.",
        prompt: 'What is the best move?',
        options: [
          { id: 'a', text: 'Lend it for one week only.', correct: false, explain: 'One week is plenty of time to move a lot of scam money.' },
          { id: 'b', text: 'Say no. Your card, PIN, bank login, Singpass and SIM are only for you. Tell a trusted adult.', correct: true, explain: 'Exactly. These are your identity, not something to rent out.' },
          { id: 'c', text: 'Lend it, then change the PIN later.', correct: false, explain: 'By then the money has already moved through your name.' },
        ],
      },
    ],
    lesson: 'Your bank account, ATM card, Singpass and SIM card are for you alone. Lending them can be a crime, even for a friend.',
  },
  {
    id: 'mt-sim-cards',
    bands: ['teen', 'young-adult'],
    status: 'draft',
    title: 'S$100 per SIM card',
    hook: {
      from: 'Ray',
      channel: 'chat',
      message: 'Easy S$100 per SIM! Register prepaid SIM cards in your name and pass them to me. My company needs extra lines.',
    },
    steps: [
      {
        id: 's1',
        node: { kind: 'you', label: 'Your SIM cards' },
        scene: 'You register 3 SIM cards with your ID and hand them to Ray. He pays S$300 cash.',
        prompt: 'Whose name is on these phone numbers?',
        options: [
          { id: 'a', text: "Ray's company.", correct: false, explain: 'You registered them with your ID. The numbers lead back to you.' },
          { id: 'b', text: 'Yours. Every call and message from them points to you.', correct: true, explain: 'Right. The SIMs are linked to your identity.' },
        ],
      },
      {
        id: 's2',
        node: { kind: 'scammer', label: "Ray's group" },
        scene: 'The SIM cards end up with a scam group.',
        prompt: 'What do they use your numbers for?',
        options: [
          { id: 'a', text: 'Normal company phone calls.', correct: false, explain: 'A real company registers its own lines.' },
          { id: 'b', text: 'Nothing. They just collect them.', correct: false, explain: 'Nobody pays S$100 for a SIM card they will not use.' },
          { id: 'c', text: 'Scam calls and texts, and fake accounts that need a phone number.', correct: true, explain: 'Yes. Your numbers help scams reach more people.' },
        ],
      },
      {
        id: 's3',
        node: { kind: 'victim', label: 'A victim' },
        scene: 'A student gets a call from one of "your" numbers. A fake officer says her bank account is linked to a crime.',
        prompt: 'She reports the call. Where does the trail lead?',
        options: [
          { id: 'a', text: 'To the person who registered the number: you.', correct: true, explain: 'Yes. Police trace a number to whoever registered it.' },
          { id: 'b', text: 'Straight to Ray.', correct: false, explain: 'Ray kept his own name off everything. Yours is on the SIM.' },
        ],
      },
      {
        id: 's4',
        node: { kind: 'police', label: 'Police' },
        scene: 'Police contact you about the numbers.',
        prompt: 'What can happen to you?',
        options: [
          { id: 'a', text: 'Nothing. You did not make the calls.', correct: false, explain: 'Handing over SIM cards for others to misuse can be a crime by itself.' },
          // LEGAL: offences for registering / handing over SIM cards for others' misuse. Check wording.
          { id: 'b', text: 'You can be investigated and charged. Giving others SIM cards registered in your name can be an offence.', correct: true, explain: 'Yes. In Singapore this is treated seriously because SIM cards are a key tool for scams.' },
          { id: 'c', text: 'You just pay a small phone bill.', correct: false, explain: 'The bill is the smallest problem. The calls were used to hurt people.' },
        ],
      },
      {
        id: 's5',
        node: { kind: 'choice', label: 'Your choice' },
        scene: "Back to Ray's message.",
        prompt: 'What is the best move?',
        options: [
          { id: 'a', text: "Register them in a friend's name instead.", correct: false, explain: 'That puts your friend in the same danger.' },
          { id: 'b', text: 'Register just one SIM.', correct: false, explain: 'One SIM is enough for many scam calls.' },
          { id: 'c', text: 'Refuse, keep the chat, and tell a trusted adult or the police.', correct: true, explain: 'That protects you, and the chat helps police find Ray.' },
        ],
      },
    ],
    lesson: 'A SIM card in your name is linked to you. Never register or give away SIM cards for others. It can be a crime, and it helps scams reach more victims.',
  },
  {
    id: 'mt-singpass-company',
    bands: ['young-adult'],
    status: 'draft',
    title: 'S$800 to "register a company"',
    hook: {
      from: 'Kelvin (business contact)',
      channel: 'chat',
      message: 'Earn S$800! Let me log in with your Singpass to register a company in your name. I handle everything. You just approve the login on your phone.',
    },
    steps: [
      {
        id: 's1',
        node: { kind: 'you', label: 'Your Singpass' },
        scene: 'You approve the login on your phone. Kelvin is in.',
        prompt: 'What can someone do once they are in your Singpass?',
        options: [
          { id: 'a', text: 'Only see your address.', correct: false, explain: 'It is far more than that. It is your official digital identity.' },
          { id: 'b', text: 'Act as you: open accounts, register companies and sign up for services in your name.', correct: true, explain: 'Yes. To many services, a Singpass login is you.' },
          { id: 'c', text: 'Nothing important.', correct: false, explain: 'It unlocks government and banking services in your name.' },
        ],
      },
      {
        id: 's2',
        node: { kind: 'account', label: 'A company in your name' },
        scene: 'A company is registered with you as director. Two business bank accounts are opened for it.',
        prompt: 'What are these accounts really for?',
        options: [
          { id: 'a', text: 'Moving large amounts of scam money behind a company name.', correct: true, explain: 'Right. Shell companies make stolen money look like business income.' },
          { id: 'b', text: "Kelvin's real business.", correct: false, explain: 'A real business owner registers in their own name.' },
          { id: 'c', text: 'Nothing. It just sits there.', correct: false, explain: 'Nobody pays S$800 for a company they will not use.' },
        ],
      },
      {
        id: 's3',
        node: { kind: 'transfer', label: 'Money flows out' },
        scene: 'S$90,000 passes through the company accounts in two weeks, then goes overseas.',
        prompt: 'Who is the named director when police look?',
        options: [
          { id: 'a', text: 'Kelvin.', correct: false, explain: "Kelvin's name is on nothing. That was the point." },
          { id: 'b', text: 'You.', correct: true, explain: 'Yes. Everything points to the person whose identity was used.' },
        ],
      },
      {
        id: 's4',
        node: { kind: 'police', label: 'Police' },
        scene: 'Victims report the scam. Police reach the company accounts.',
        prompt: 'What can happen to you?',
        options: [
          { id: 'a', text: 'You only lose the S$800.', correct: false, explain: 'The S$800 is the least of it.' },
          // LEGAL: disclosing Singpass credentials as an offence. Check wording.
          { id: 'b', text: 'You can be investigated and charged, and you may struggle to open bank accounts for years.', correct: true, explain: 'Yes. Sharing your Singpass for others to misuse can be an offence in Singapore.' },
          { id: 'c', text: 'Nothing. Kelvin made the transfers.', correct: false, explain: 'You approved the login. The company and accounts are in your name.' },
        ],
      },
      {
        id: 's5',
        node: { kind: 'choice', label: 'Your choice' },
        scene: "Back to Kelvin's message.",
        prompt: 'What is the best move?',
        options: [
          { id: 'a', text: 'Do it if Kelvin signs a contract.', correct: false, explain: 'A contract does not make misusing your identity legal.' },
          { id: 'b', text: 'Share it once, then change your password.', correct: false, explain: 'Once is enough to set up a company and accounts in your name.' },
          { id: 'c', text: 'Never share your Singpass or approve logins for anyone. Refuse and report it.', correct: true, explain: 'Exactly. Only approve logins you started yourself.' },
        ],
      },
    ],
    lesson: 'Your Singpass is your identity online. Never share it or approve a login for someone else. It can be a crime, and the trail leads to you.',
  },
  {
    id: 'mt-online-partner',
    bands: ['young-adult'],
    status: 'draft',
    title: '"I only trust you"',
    hook: {
      from: 'Alex (met online)',
      channel: 'chat',
      message: 'My overseas account is blocked. Can my clients pay into your account? Then just send it to me. I only trust you.',
    },
    steps: [
      {
        id: 's1',
        node: { kind: 'victim', label: 'The "clients"' },
        scene: 'S$5,000 arrives from three people you have never heard of.',
        prompt: 'Who are these "clients" likely to be?',
        options: [
          { id: 'a', text: "Alex's family.", correct: false, explain: 'Family could pay Alex directly. Strangers paying you is a warning sign.' },
          { id: 'b', text: "Real customers of Alex's business.", correct: false, explain: 'Real businesses get paid into their own accounts.' },
          { id: 'c', text: 'People who were tricked into sending money.', correct: true, explain: 'Yes. The "clients" are most likely scam victims.' },
        ],
      },
      {
        id: 's2',
        node: { kind: 'account', label: 'Your account' },
        scene: 'Alex says it is fine because you are special to him.',
        prompt: 'What is really happening?',
        options: [
          { id: 'a', text: 'You are being used as a money mule, even if the feelings feel real.', correct: true, explain: 'Right. Scammers build trust first so the ask feels like a favour.' },
          { id: 'b', text: 'You are doing your partner a normal favour.', correct: false, explain: 'A partner who cares about you would not put your account at risk.' },
        ],
      },
      {
        id: 's3',
        node: { kind: 'transfer', label: 'Sent overseas' },
        scene: 'You send the money to an overseas account Alex gives you.',
        prompt: 'Can the money be traced back easily now?',
        options: [
          { id: 'a', text: 'Yes. Banks reverse overseas transfers easily.', correct: false, explain: 'Overseas transfers are among the hardest to get back.' },
          { id: 'b', text: 'No. Once it goes overseas, it is very hard to recover.', correct: true, explain: 'Yes. That is why scammers send it abroad fast.' },
        ],
      },
      {
        id: 's4',
        node: { kind: 'bank', label: 'The report' },
        scene: 'The people who sent the money report it as a scam.',
        prompt: 'What happens next?',
        options: [
          { id: 'a', text: 'Your account is frozen and police may investigate, even though you were tricked too.', correct: true, explain: 'Yes. Coming forward early and showing the messages helps police see what happened.' },
          { id: 'b', text: 'Nothing, because you did it for love.', correct: false, explain: 'The money still moved through your account, so it is still on the trail.' },
          { id: 'c', text: 'Only Alex is blamed.', correct: false, explain: 'Alex is overseas and hard to find. Your account is right here.' },
        ],
      },
      {
        id: 's5',
        node: { kind: 'choice', label: 'Your choice' },
        scene: 'Alex messages again: more "clients" are paying today.',
        prompt: 'What is the best move?',
        options: [
          { id: 'a', text: 'Keep going so Alex is not upset.', correct: false, explain: 'Each transfer adds to the harm, to others and to you.' },
          { id: 'b', text: 'Stop, send nothing more, keep the messages, and talk to someone you trust and the police.', correct: true, explain: 'It is not your fault you were targeted. Getting help early protects you and others.' },
          { id: 'c', text: 'Ask Alex for a video call first, then decide.', correct: false, explain: 'Video calls can be faked, and the ask is the warning sign anyway.' },
        ],
      },
    ],
    lesson: 'Anyone who asks to move money through your account is using you, even if they say they care. Stop, keep the messages, and get help. It is not your fault you were targeted.',
  },
];
