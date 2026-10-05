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

export const sfx = {
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
