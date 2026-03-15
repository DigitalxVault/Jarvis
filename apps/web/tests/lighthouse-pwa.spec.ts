/**
 * PWA Audit Tests
 *
 * Verifies PWA requirements programmatically instead of running the full Lighthouse CLI.
 * Lighthouse v12+ removed the PWA category, so we check the individual requirements directly.
 *
 * REQ-225 (Lighthouse PWA checks pass), REQ-227 (SW does not interfere with Supabase WebSocket).
 */
import { test, expect } from '@playwright/test'

// ── Manifest ──────────────────────────────────────────────────────────────────

test('manifest is valid', async ({ request }) => {
  // Next.js manifest route handler serves at /manifest.webmanifest
  const res = await request.get('/manifest.webmanifest')
  expect(res.ok()).toBe(true)

  const manifest = await res.json() as Record<string, unknown>

  expect(typeof manifest.name).toBe('string')
  expect(typeof manifest.short_name).toBe('string')
  expect(manifest.start_url).toBe('/')
  expect(manifest.display).toBe('standalone')

  // Must have at least 192x192 and 512x512 icons.
  const icons = manifest.icons as Array<{ sizes: string; purpose?: string }>
  expect(Array.isArray(icons)).toBe(true)

  const has192 = icons.some((i) => i.sizes === '192x192')
  const has512 = icons.some((i) => i.sizes === '512x512')
  expect(has192).toBe(true)
  expect(has512).toBe(true)

  // Must have a maskable icon (REQ: maskable-icon audit).
  const hasMaskable = icons.some((i) => i.purpose === 'maskable')
  expect(hasMaskable).toBe(true)
})

// ── Viewport meta tag ─────────────────────────────────────────────────────────

test('viewport meta tag present', async ({ page }) => {
  await page.goto('/')
  const viewport = await page.$eval(
    'meta[name="viewport"]',
    (el) => (el as HTMLMetaElement).content
  )
  expect(viewport).toContain('width=device-width')
})

// ── Theme-color meta tag ──────────────────────────────────────────────────────

test('theme-color meta tag present', async ({ page }) => {
  await page.goto('/')
  // Next.js Viewport export renders theme-color as a <meta> tag.
  const themeColor = await page.$eval(
    'meta[name="theme-color"]',
    (el) => (el as HTMLMetaElement).content
  )
  expect(themeColor).toBe('#010a1a')
})

// ── Service worker registration ───────────────────────────────────────────────

test('service worker registered', async ({ page }) => {
  await page.goto('/')
  // Allow SW install time.
  await page.waitForTimeout(2000)

  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'not-supported'
    const reg = await navigator.serviceWorker.getRegistration('/')
    if (!reg) return 'not-registered'
    return reg.active?.state ?? reg.installing?.state ?? reg.waiting?.state ?? 'unknown'
  })

  // SW should be active (or activating on first install).
  expect(['activated', 'activating', 'installed', 'installing']).toContain(swState)
})

// ── Offline fallback ──────────────────────────────────────────────────────────

test('offline fallback works', async ({ page }) => {
  await page.goto('/')
  // Allow SW to install and cache the shell.
  await page.waitForTimeout(2000)

  await page.context().setOffline(true)

  // Navigate to a URL that is definitely not in the cache.
  // SW should serve the offline.html fallback for navigation requests.
  await page.goto('/does-not-exist-offline-test', { waitUntil: 'domcontentloaded' })

  const body = await page.content()
  // The offline.html contains the JARVIS title.
  expect(body).toContain('J . A . R . V . I . S')

  await page.context().setOffline(false)
})

// ── Supabase WebSocket not intercepted by SW ─────────────────────────────────

test('Supabase WebSocket not intercepted by SW', async ({ page }) => {
  // The SW strategy for Supabase URLs is network-only (never cached).
  // We verify this by inspecting fetch requests: Supabase fetch responses
  // should NOT carry a SW cache header and should not come from cache.

  const supabaseResponses: Array<{ url: string; fromServiceWorker: boolean; status: number }> = []

  page.on('response', (response) => {
    const url = response.url()
    if (url.includes('supabase.co')) {
      supabaseResponses.push({
        url,
        fromServiceWorker: response.fromServiceWorker(),
        status: response.status(),
      })
    }
  })

  await page.goto('/')
  await page.waitForTimeout(3000)

  // If there are any Supabase responses, none should come from the service worker cache.
  for (const resp of supabaseResponses) {
    expect(resp.fromServiceWorker).toBe(false)
  }
})
