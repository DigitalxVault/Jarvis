'use client'

import { useInstallPrompt } from '@/hooks/use-install-prompt'

export function InstallPrompt() {
  const { installState, promptInstall, dismiss } = useInstallPrompt()

  if (installState.type === 'hidden' || installState.type === 'dismissed') {
    return null
  }

  // Chromium install banner
  if (installState.type === 'chromium') {
    return (
      <div
        role="banner"
        className="fixed bottom-4 left-4 right-4 z-[10000] flex items-center justify-between px-4 py-3 sm:left-auto sm:right-4 sm:max-w-sm"
        style={{
          background: 'linear-gradient(180deg, #001a2e 0%, #000d1a 100%)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '3px',
        }}
      >
        <div className="flex flex-col gap-1">
          <span
            className="text-jarvis-accent text-xs font-bold"
            style={{ letterSpacing: '1.5px' }}
          >
            INSTALL JARVIS
          </span>
          <span className="text-jarvis-muted text-[12px]" style={{ letterSpacing: '0.5px' }}>
            Add to your home screen for quick access
          </span>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button
            onClick={dismiss}
            className="text-jarvis-muted hover:text-jarvis-primary text-[12px] transition-colors"
            style={{ letterSpacing: '1px' }}
          >
            SKIP
          </button>
          <button
            onClick={promptInstall}
            className="text-jarvis-accent hover:text-white text-xs font-bold px-3 py-1.5 border border-jarvis-accent/40 hover:border-jarvis-accent transition-all"
            style={{ letterSpacing: '1.5px' }}
          >
            INSTALL
          </button>
        </div>
      </div>
    )
  }

  // iOS install guidance
  if (installState.type === 'ios') {
    return (
      <div
        role="banner"
        className="fixed bottom-4 left-4 right-4 z-[10000] px-4 py-3 sm:left-auto sm:right-4 sm:max-w-sm"
        style={{
          background: 'linear-gradient(180deg, #001a2e 0%, #000d1a 100%)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '3px',
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span
              className="text-jarvis-accent text-xs font-bold"
              style={{ letterSpacing: '1.5px' }}
            >
              INSTALL JARVIS
            </span>
            <span
              className="text-jarvis-primary text-[12px] leading-relaxed"
              style={{ letterSpacing: '0.5px' }}
            >
              Tap{' '}
              <span className="inline-block" aria-label="Share icon">
                &#x2191;&#xFE0E;
              </span>{' '}
              then &quot;Add to Home Screen&quot;
            </span>
          </div>
          <button
            onClick={dismiss}
            className="text-jarvis-muted hover:text-jarvis-primary text-[12px] ml-3 transition-colors"
            style={{ letterSpacing: '1px' }}
            aria-label="Dismiss install instructions"
          >
            &#x2715;
          </button>
        </div>
      </div>
    )
  }

  return null
}
