/**
 * ElevenLabs TTS client — calls our /api/tts proxy route (server-side key).
 * Plays audio via Web Audio API. Reuses a single AudioContext to avoid
 * browser gesture restrictions.
 */

let _sharedAudioCtx: AudioContext | null = null

async function getAudioContext(): Promise<AudioContext> {
  if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
    _sharedAudioCtx = new AudioContext()
  }
  // Resume if suspended (browser auto-suspends when tab loses focus)
  if (_sharedAudioCtx.state === 'suspended') {
    await _sharedAudioCtx.resume()
  }
  return _sharedAudioCtx
}

// Pre-warm AudioContext on first user gesture
if (typeof document !== 'undefined') {
  const warmUp = () => {
    getAudioContext()
    document.removeEventListener('click', warmUp)
    document.removeEventListener('keydown', warmUp)
  }
  document.addEventListener('click', warmUp, { once: true })
  document.addEventListener('keydown', warmUp, { once: true })

  // Re-resume AudioContext whenever the tab regains focus.
  // Browsers suspend AudioContext when the tab is backgrounded (e.g. DCS
  // is fullscreen). Without this, TTS audio queued while backgrounded
  // never actually plays through the speakers.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _sharedAudioCtx && _sharedAudioCtx.state === 'suspended') {
      _sharedAudioCtx.resume()
    }
  })
}

export interface TTSOptions {
  text: string
  voiceId?: string
  model?: string
  stability?: number
  similarityBoost?: number
}

/**
 * Stream TTS audio via the server-side /api/tts proxy and play it.
 * Returns a promise that resolves when playback finishes,
 * and an abort function to stop playback immediately.
 */
export function speakWithElevenLabs(
  options: TTSOptions
): { promise: Promise<void>; abort: () => void } {
  const {
    text,
    voiceId,
    model = 'eleven_turbo_v2_5',
    stability = 0.5,
    similarityBoost = 0.75,
  } = options

  let aborted = false
  let sourceNode: AudioBufferSourceNode | null = null

  const abort = () => {
    aborted = true
    if (sourceNode) {
      try { sourceNode.stop() } catch { /* already stopped */ }
    }
  }

  const promise = (async () => {
    if (!text.trim()) return

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId, model, stability, similarityBoost }),
    })

    if (!response.ok || !response.body) {
      const errText = await response.text()
      console.error('TTS proxy error:', response.status, errText)
      throw new Error(`TTS unavailable (ElevenLabs): ${response.status}`)
    }

    // Collect the streaming response into a single buffer
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (aborted) { reader.cancel(); return }
      chunks.push(value)
    }

    if (aborted) return

    // Combine chunks
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    // Decode and play using shared AudioContext — await resume to ensure
    // the context is actually running before we start playback
    const audioCtx = await getAudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(combined.buffer.slice(0))

    if (aborted) return

    sourceNode = audioCtx.createBufferSource()
    sourceNode.buffer = audioBuffer
    sourceNode.connect(audioCtx.destination)

    return new Promise<void>((resolve) => {
      sourceNode!.onended = () => {
        resolve()
      }
      sourceNode!.start()
    })
  })()

  return { promise, abort }
}
