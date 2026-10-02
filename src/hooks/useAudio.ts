import { useCallback, useEffect, useRef, useState } from 'react'

/** Only one voice note plays at a time across the whole app. */
let current: HTMLAudioElement | null = null

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'missing'

export function useAudio(src: string) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [status, setStatus] = useState<AudioStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const a = new Audio()
    a.preload = 'metadata'
    a.src = src
    ref.current = a
    setStatus('idle')
    setProgress(0)
    // Listeners are removed before teardown: clearing `src` fires an "error" event that would
    // otherwise mark the *next* element (e.g. StrictMode's remount) as missing.
    const listeners = new AbortController()
    const on = (ev: string, fn: () => void) => a.addEventListener(ev, fn, { signal: listeners.signal })
    on('loadedmetadata', () => setDuration(a.duration))
    on('timeupdate', () => setProgress(a.duration ? a.currentTime / a.duration : 0))
    on('playing', () => setStatus('playing'))
    on('waiting', () => setStatus('loading'))
    on('pause', () => setStatus((s) => (s === 'ended' ? s : 'paused')))
    on('ended', () => setStatus('ended'))
    on('error', () => setStatus('missing'))
    return () => {
      listeners.abort()
      a.pause()
      if (current === a) current = null
      a.removeAttribute('src')
      a.load()
    }
  }, [src])

  const play = useCallback(async () => {
    const a = ref.current
    if (!a) return
    if (current && current !== a) current.pause()
    current = a
    setStatus('loading')
    try {
      await a.play()
    } catch {
      setStatus(a.error ? 'missing' : 'paused')
    }
  }, [])

  const pause = useCallback(() => ref.current?.pause(), [])
  const toggle = useCallback(() => (ref.current && !ref.current.paused ? pause() : play()), [play, pause])
  const seek = useCallback((fraction: number) => {
    const a = ref.current
    if (a && a.duration) a.currentTime = fraction * a.duration
  }, [])

  return { status, progress, duration, play, pause, toggle, seek }
}
