/**
 * "Open when…" letters. Each one can have a voice note at `audio`
 * (drop the file in public/audio/letters/ — the player shows "coming soon" until it exists).
 * TODO: rewrite these in your own words.
 */
export interface Letter {
  id: string
  /** Finishes the sentence "Open when…" */
  when: string
  emoji: string
  /** Envelope paper colour */
  color: string
  body: string[]
  signoff: string
  audio: string
}

export const letters: Letter[] = [
  {
    id: 'miss-me',
    when: 'you miss me',
    emoji: '🫂',
    color: '#f7b6cc',
    body: [
      'I know. I miss you too — probably right this second.',
      'Close your eyes and imagine my arms around you. That’s not imagination, by the way; that’s a reservation. I’m holding that spot for you.',
      'Every day apart is one day closer to the day we stop counting.',
    ],
    signoff: 'Always yours',
    audio: '/audio/letters/miss-me.mp3',
  },
  {
    id: 'cant-sleep',
    when: 'you can’t sleep',
    emoji: '🌙',
    color: '#b9b1f2',
    body: [
      'Hey, sleepyhead who isn’t sleeping.',
      'Put the phone a little further from your face, take a slow breath in… and out. Again.',
      'Look up if you can — somewhere up there, Spica and Aldebaran are keeping watch for both of us.',
    ],
    signoff: 'Goodnight, my love',
    audio: '/audio/letters/cant-sleep.mp3',
  },
  {
    id: 'need-a-laugh',
    when: 'you need a laugh',
    emoji: '😂',
    color: '#ffd48a',
    body: [
      'Okay. Picture me trying to cook something fancy to impress you.',
      'Now picture the smoke alarm.',
      'Now picture me pretending that was the plan all along. You’re smiling. I can tell.',
    ],
    signoff: 'Your personal clown',
    audio: '/audio/letters/need-a-laugh.mp3',
  },
  {
    id: 'bad-day',
    when: 'you’ve had a bad day',
    emoji: '🌧️',
    color: '#9fd3e6',
    body: [
      'Whatever happened today, it doesn’t get to decide who you are.',
      'You are kind and brave and so much stronger than you feel right now.',
      'Go get some water, wrap yourself in a blanket, and call me. I mean it.',
    ],
    signoff: 'On your side, always',
    audio: '/audio/letters/bad-day.mp3',
  },
  {
    id: 'proud',
    when: 'you did something amazing',
    emoji: '🏆',
    color: '#a8e0b8',
    body: [
      'I KNEW you could do it. I’m so proud of you I could burst.',
      'Take a second to actually feel this — you earned it.',
      'Now tell me everything, every single detail.',
    ],
    signoff: 'Your biggest fan',
    audio: '/audio/letters/proud.mp3',
  },
  {
    id: 'doubt',
    when: 'you doubt us',
    emoji: '💌',
    color: '#ffb8a6',
    body: [
      'Distance makes things feel fragile sometimes. We aren’t.',
      'I choose you — on the easy days and the hard ones, from far away and, soon, up close.',
      'Read this as many times as you need.',
    ],
    signoff: 'Forever, me',
    audio: '/audio/letters/doubt.mp3',
  },
]
