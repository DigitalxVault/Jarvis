'use client'

import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState =
  | { type: 'hidden' }      // Already installed or unsupported
  | { type: 'chromium' }    // beforeinstallprompt captured
  | { type: 'ios' }         // iOS Safari, not standalone
  | { type: 'dismissed' }   // User dismissed the prompt this session

export function useInstallPrompt() {
  const [installState, setInstallState] = useState<InstallState>({ type: 'hidden' })
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstallState({ type: 'hidden' })
      return
    }

    // Check for iOS Safari (no beforeinstallprompt support)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
    const isStandalone = ('standalone' in navigator) && (navigator as unknown as { standalone: boolean }).standalone

    if (isIOS && !isStandalone) {
      setInstallState({ type: 'ios' })
      return
    }

    // Chromium: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault() // Prevent default mini-infobar
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setInstallState({ type: 'chromium' })
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Listen for successful install
    const installedHandler = () => {
      setInstallState({ type: 'hidden' })
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setInstallState({ type: 'hidden' })
    } else {
      setInstallState({ type: 'dismissed' })
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    setInstallState({ type: 'dismissed' })
  }, [])

  return { installState, promptInstall, dismiss }
}
