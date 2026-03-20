/**
 * ElevenLabs TTS client — calls our /api/tts proxy route (server-side key).
 * Plays audio via HTMLAudioElement (new Audio()) which is exempt from
 * background tab throttling — audio plays even when DCS is focused.
 */

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
  let audio: HTMLAudioElement | null = null
  let blobUrl: string | null = null

  const abort = () => {
    aborted = true
    if (audio) {
      audio.pause()
      audio.src = ''
      audio = null
    }
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      blobUrl = null
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

    // Combine chunks into a single buffer, then create a Blob
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    const blob = new Blob([combined.buffer], { type: 'audio/mpeg' })
    blobUrl = URL.createObjectURL(blob)

    if (aborted) return

    // Play via HTMLAudioElement — works in background tabs
    audio = new Audio(blobUrl)

    return new Promise<void>((resolve, reject) => {
      audio!.onended = () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
          blobUrl = null
        }
        audio = null
        resolve()
      }
      audio!.onerror = () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
          blobUrl = null
        }
        audio = null
        reject(new Error('Audio playback failed'))
      }
      audio!.play().catch((err) => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
          blobUrl = null
        }
        audio = null
        reject(err)
      })
    })
  })()

  return { promise, abort }
}
