/**
 * Tiny synthesized sound effects (no audio files needed). The AudioContext is created lazily
 * on the first call, which always happens inside a tap — so mobile browsers allow it.
 */
let ctx: AudioContext | null = null
const ac = () => (ctx ??= new AudioContext())

function tone(freqFrom: number, freqTo: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const c = ac()
  const t = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freqFrom, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), t + dur)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(dur: number, gain: number, delay = 0) {
  const c = ac()
  const t = c.currentTime + delay
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3
  const src = c.createBufferSource()
  const f = c.createBiquadFilter()
  const g = c.createGain()
  f.type = 'lowpass'
  f.frequency.value = 900
  g.gain.value = gain
  src.buffer = buf
  src.connect(f).connect(g).connect(ac().destination)
  src.start(t)
}

let musicTimer: number | null = null
let muted = false

export const sfx = {
  /** Global mute for the cute sounds (the punch game ignores it — it's loud on purpose). */
  setMuted(m: boolean) {
    muted = m
  },
  kiss() {
    if (muted) return
    try {
      tone(900, 1700, 0.09, 'sine', 0.18)
      noise(0.05, 0.25, 0.06)
    } catch {
      /* audio unavailable */
    }
  },
  giggle() {
    if (muted) return
    try {
      ;[0, 0.11, 0.22, 0.33].forEach((d, i) => tone(700 + i * 60, 900 + i * 60, 0.08, 'triangle', 0.1, d))
    } catch {
      /* audio unavailable */
    }
  },
  heartbeat() {
    if (muted) return
    try {
      tone(90, 60, 0.12, 'sine', 0.6)
      tone(80, 55, 0.12, 'sine', 0.45, 0.18)
    } catch {
      /* audio unavailable */
    }
  },
  chime() {
    if (muted) return
    try {
      ;[1047, 1319, 1568].forEach((f, i) => tone(f, f, 0.5, 'sine', 0.08, i * 0.09))
    } catch {
      /* audio unavailable */
    }
  },
  shutter() {
    if (muted) return
    try {
      noise(0.04, 0.6)
      noise(0.05, 0.4, 0.07)
    } catch {
      /* audio unavailable */
    }
  },
  pop() {
    if (muted) return
    try {
      tone(400, 900, 0.07, 'sine', 0.2)
    } catch {
      /* audio unavailable */
    }
  },
  /** Soft music-box loop (C – Am – F – G arpeggios). */
  music(on: boolean) {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer)
      musicTimer = null
    }
    if (!on) return
    const chords = [
      [523, 659, 784, 1047],
      [440, 523, 659, 880],
      [349, 440, 523, 698],
      [392, 494, 587, 784],
    ]
    let step = 0
    const play = () => {
      if (muted) return
      const c = chords[Math.floor(step / 8) % chords.length]
      const n = c[[0, 1, 2, 3, 2, 1, 2, 3][step % 8]]
      try {
        tone(n, n, 0.9, 'sine', 0.045)
        tone(n * 2, n * 2, 0.4, 'triangle', 0.012)
      } catch {
        /* audio unavailable */
      }
      step++
    }
    play()
    musicTimer = window.setInterval(play, 330)
  },

  /** A cartoon "bonk": thump + short body; strength 0..1. */
  punch(strength = 0.5, crit = false) {
    try {
      noise(0.12, 0.5 + strength * 0.4)
      tone(220 + strength * 80, 60, 0.18, 'sine', 0.6)
      if (crit) tone(900, 1500, 0.12, 'square', 0.08, 0.02)
    } catch {
      /* audio unavailable */
    }
  },
  /** Slide-whistle fall + thud. */
  ko() {
    try {
      tone(900, 120, 0.7, 'triangle', 0.18)
      noise(0.35, 0.9, 0.7)
      tone(90, 40, 0.4, 'sine', 0.7, 0.7)
    } catch {
      /* audio unavailable */
    }
  },
  /** Little "ta-da" when he gets back up. */
  getUp() {
    try {
      tone(523, 523, 0.12, 'triangle', 0.12)
      tone(659, 659, 0.12, 'triangle', 0.12, 0.12)
      tone(784, 784, 0.25, 'triangle', 0.12, 0.24)
    } catch {
      /* audio unavailable */
    }
  },
}
