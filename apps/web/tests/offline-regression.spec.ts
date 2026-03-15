import { test, expect, type Page } from '@playwright/test'

// Helper: disable animations and wait for page to stabilise.
async function prepareForScreenshot(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // Wait for any loading states to settle.
  await page.waitForLoadState('networkidle')
}

// ── Desktop (1440×900) ────────────────────────────────────────────────────────

test('dashboard desktop - default state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await prepareForScreenshot(page)
  await expect(page).toHaveScreenshot('dashboard-desktop-default.png', { fullPage: true })
})

test('dashboard desktop - offline state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await prepareForScreenshot(page)

  // Simulate network going offline.
  await page.context().setOffline(true)

  // Wait for the CONNECTION LOST alert banner to appear.
  await page.waitForSelector('[role="alert"]', { timeout: 5000 })

  await expect(page).toHaveScreenshot('dashboard-desktop-offline.png', { fullPage: true })

  // Restore network.
  await page.context().setOffline(false)
})

// ── Mobile (390×844 - iPhone 14 Pro) ─────────────────────────────────────────

test('dashboard mobile - default state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await prepareForScreenshot(page)
  await expect(page).toHaveScreenshot('dashboard-mobile-default.png', { fullPage: true })
})

test('dashboard mobile - offline state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await prepareForScreenshot(page)

  await page.context().setOffline(true)
  await page.waitForSelector('[role="alert"]', { timeout: 5000 })

  await expect(page).toHaveScreenshot('dashboard-mobile-offline.png', { fullPage: true })

  await page.context().setOffline(false)
})

// ── Tablet (768×1024) ─────────────────────────────────────────────────────────

test('dashboard tablet - default state', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/')
  await prepareForScreenshot(page)
  await expect(page).toHaveScreenshot('dashboard-tablet-default.png', { fullPage: true })
})
