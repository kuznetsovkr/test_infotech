// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { createViteConfig } from '../vite.config'
import { sendSmsPilotEmulator } from '../vite/demoSmsPilotPlugin'

const emulatorKey = 'public-emulator-key-for-test'

describe('SMSPILOT server-side demo adapter', () => {
  it('uses POST form encoding and always sends emulator parameters', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        send: [{ server_id: '1000', phone: '79991234567', status: '0' }],
      }),
    })

    const result = await sendSmsPilotEmulator({
      phone: '79991234567',
      message: 'Тестовое уведомление',
      apiKey: emulatorKey,
      fetchImpl,
    })
    const [url, options] = fetchImpl.mock.calls[0]

    expect(url).toBe('https://smspilot.ru/api.php')
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    expect(options.body).toBeInstanceOf(URLSearchParams)
    expect(Object.fromEntries(options.body)).toEqual({
      send: 'Тестовое уведомление',
      to: '79991234567',
      apikey: emulatorKey,
      format: 'json',
      test: '1',
    })
    expect(result).toEqual({
      success: true,
      provider: 'smspilot',
      emulated: true,
      server_id: '1000',
    })
  })

  it('returns a stable response for provider and network failures', async () => {
    const providerFailure = await sendSmsPilotEmulator({
      phone: '79991234567',
      message: 'Test',
      apiKey: emulatorKey,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          error: { code: '111', description_ru: 'Неправильный номер телефона' },
        }),
      }),
    })
    const networkFailure = await sendSmsPilotEmulator({
      phone: '79991234567',
      message: 'Test',
      apiKey: emulatorKey,
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
    })

    expect(providerFailure).toEqual({
      success: false,
      provider: 'smspilot',
      emulated: true,
      message: 'Неправильный номер телефона',
    })
    expect(networkFailure).toEqual({
      success: false,
      provider: 'smspilot',
      emulated: true,
      message: 'Не удалось связаться с SMSPILOT emulator.',
    })
    expect(JSON.stringify([providerFailure, networkFailure])).not.toContain(emulatorKey)
  })
})

describe('Vite bridge activation', () => {
  it('enables the bridge only for the demo development server', () => {
    const demoServe = createViteConfig({ command: 'serve', mode: 'demo' })
    const productionServe = createViteConfig({ command: 'serve', mode: 'production' })
    const demoBuild = createViteConfig({ command: 'build', mode: 'demo' })
    const pluginNames = (config) => config.plugins.map((plugin) => plugin.name)

    expect(pluginNames(demoServe)).toContain('demo-smspilot-bridge')
    expect(pluginNames(productionServe)).not.toContain('demo-smspilot-bridge')
    expect(pluginNames(demoBuild)).not.toContain('demo-smspilot-bridge')
  })
})
