'use client'

import { useEffect, useRef, useCallback, useState, startTransition } from 'react'
import type { CommStage } from '@/hooks/use-trainer-comm'
import { ObserverGuard } from './observer-guard'
import { useTrainerRole } from './trainer-role-context'

interface TrainerVoiceTabProps {
  stage: CommStage
  elapsedMs: number
  errorMessage: string
  analyserRef: React.RefObject<AnalyserNode | null>
  onToggleRecording: () => void
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function StageProgress({ stage, errorMessage }: { stage: CommStage; errorMessage: string }) {
  if (stage === 'error') {
    return (
      <div
        className="text-jarvis-danger text-center"
        style={{ fontSize: '11px', letterSpacing: '2px' }}
      >
        {errorMessage || 'ERROR'}
      </div>
    )
  }

  if (stage === 'transcribing' || stage === 'rephrasing' || stage === 'speaking') {
    const label =
      stage === 'transcribing' ? 'TRANSCRIBING' :
      stage === 'rephrasing' ? 'REPHRASING' :
      'SPEAKING'

    return (
      <div
        className="text-jarvis-accent flex items-center justify-center gap-2"
        style={{ fontSize: '11px', letterSpacing: '2px' }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-jarvis-accent animate-pulse"
        />
        {label}...
      </div>
    )
  }

  return (
    <div
      className="text-jarvis-primary/30 text-center"
      style={{ fontSize: '9px', letterSpacing: '2px' }}
    >
      READY
    </div>
  )
}

export function TrainerVoiceTab({
  stage,
  elapsedMs,
  errorMessage,
  analyserRef,
  onToggleRecording,
}: TrainerVoiceTabProps) {
  const { isObserver } = useTrainerRole()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const isRecordingRef = useRef(false)

  // Persistent mic denied state — set when mic permission is denied, stays until unmount
  const [micDenied, setMicDenied] = useState(false)

  useEffect(() => {
    if (
      errorMessage &&
      (errorMessage.toLowerCase().includes('denied') ||
        errorMessage.toLowerCase().includes('notallowederror') ||
        errorMessage.toLowerCase().includes('permission'))
    ) {
      startTransition(() => setMicDenied(true))
    }
  }, [errorMessage])

  // Draw function stored in ref to avoid circular dependency
  const drawWaveformRef = useRef<() => void>(() => {})

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Background
    ctx.fillStyle = '#000d1a'
    ctx.fillRect(0, 0, width, height)

    if (isRecordingRef.current && analyserRef.current) {
      // Live waveform
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyserRef.current.getByteTimeDomainData(dataArray)

      ctx.strokeStyle = '#00d4ff'
      ctx.lineWidth = 1.5
      ctx.beginPath()

      const sliceWidth = width / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.stroke()
    } else {
      // Flat line at center when not recording
      ctx.strokeStyle = '#00d4ff'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    if (isRecordingRef.current) {
      rafRef.current = requestAnimationFrame(drawWaveformRef.current)
    }
  }, [analyserRef])

  // Keep draw ref in sync
  useEffect(() => {
    drawWaveformRef.current = drawWaveform
  }, [drawWaveform])

  // Start/stop RAF loop based on recording state
  useEffect(() => {
    isRecordingRef.current = stage === 'recording'

    if (stage === 'recording') {
      rafRef.current = requestAnimationFrame(drawWaveformRef.current)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      // Redraw flat line
      drawWaveform()
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [stage, drawWaveform])

  // Keyboard shortcut — Space to toggle recording when voice tab is visible
  // Blocked for observers (isObserver check prevents PTT via keyboard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        if (!isObserver && (stage === 'idle' || stage === 'recording')) {
          onToggleRecording()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stage, onToggleRecording, isObserver])

  const isRecording = stage === 'recording'
  const isPipelineActive = stage === 'transcribing' || stage === 'rephrasing' || stage === 'speaking'
  const isButtonDisabled = isPipelineActive || micDenied

  return (
    <ObserverGuard>
    <div className="flex flex-col gap-2 p-2 h-full">
      {/* Waveform canvas */}
      <div className="relative" style={{ height: '60px' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={60}
          className="w-full h-full"
          style={{ display: 'block', background: '#000d1a', borderRadius: '2px' }}
        />
        {/* Elapsed timer overlay when recording */}
        {isRecording && (
          <div
            className="absolute top-1 right-2 text-jarvis-danger font-mono"
            style={{ fontSize: '11px', letterSpacing: '1px' }}
          >
            {formatElapsed(elapsedMs)} / 30s MAX
          </div>
        )}
      </div>

      {/* Persistent mic denied tooltip */}
      {micDenied && (
        <div
          className="text-jarvis-warning text-center border border-jarvis-warning/30 px-2 py-1"
          style={{ fontSize: '10px', letterSpacing: '1px', borderRadius: '2px' }}
        >
          MICROPHONE ACCESS DENIED — Check browser permissions
        </div>
      )}

      {/* PTT toggle button */}
      <button
        onClick={onToggleRecording}
        disabled={isButtonDisabled}
        className={`
          w-full font-mono uppercase tracking-widest transition-all
          ${isRecording
            ? 'bg-jarvis-danger text-white border border-jarvis-danger animate-pulse'
            : isButtonDisabled
              ? 'bg-jarvis-bg border border-jarvis-primary/20 text-jarvis-primary/30 cursor-not-allowed'
              : 'bg-jarvis-bg border border-jarvis-primary text-jarvis-primary hover:bg-jarvis-primary/10 cursor-pointer'
          }
        `}
        style={{
          height: '42px',
          fontSize: '11px',
          letterSpacing: '3px',
          borderRadius: '2px',
          opacity: micDenied ? 0.4 : 1,
        }}
      >
        {isRecording ? 'RECORDING — PRESS TO STOP' : 'PRESS TO TALK'}
      </button>

      {/* Stage progress (non-mic errors only) */}
      {!micDenied && <StageProgress stage={stage} errorMessage={errorMessage} />}
    </div>
    </ObserverGuard>
  )
}
