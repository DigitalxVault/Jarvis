/**
 * ElevenLabs TTS client — calls our /api/tts proxy route (server-side key).
 * Plays audio via Web Audio API.
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
      console.error('TTS proxy error:', response.status, await response.text())
      return
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

    // Decode and play
    const audioCtx = new AudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(combined.buffer)

    if (aborted) { await audioCtx.close(); return }

    sourceNode = audioCtx.createBufferSource()
    sourceNode.buffer = audioBuffer
    sourceNode.connect(audioCtx.destination)

    return new Promise<void>((resolve) => {
      sourceNode!.onended = () => {
        audioCtx.close()
        resolve()
      }
      sourceNode!.start()
    })
  })()

  return { promise, abort }
}
