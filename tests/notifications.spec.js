import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyDemoBookSubscribers } from '../src/mocks/notifications'
import {
  getDemoSmsLog,
  resetDemoSubscriptionState,
  subscribeToDemoAuthor,
} from '../src/mocks/subscriptions'

const book = { id: 101, title: 'Совместная книга' }
const authors = [
  { id: 1, full_name: 'Первый Автор' },
  { id: 2, full_name: 'Второй Автор' },
]

beforeEach(() => {
  globalThis.localStorage.clear()
  resetDemoSubscriptionState()
})

describe('demo book notifications', () => {
  it('finds subscriptions for all authors and sends once per phone/book', async () => {
    subscribeToDemoAuthor({ authorId: 1, phone: '79991234567' })
    subscribeToDemoAuthor({ authorId: 2, phone: '+7 999 123-45-67' })
    subscribeToDemoAuthor({ authorId: 2, phone: '79995550102' })
    const sendSms = vi.fn().mockResolvedValue({
      success: true,
      provider: 'smspilot',
      emulated: true,
      server_id: '1000',
    })

    const events = await notifyDemoBookSubscribers({ book, authors }, { sendSms })

    expect(sendSms).toHaveBeenCalledTimes(2)
    expect(sendSms).toHaveBeenCalledWith({
      phone: '79991234567',
      message: expect.stringContaining('Первый Автор, Второй Автор'),
    })
    expect(sendSms.mock.calls[0][0].message).toContain('Совместная книга')
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      phone_masked: '79•••••••67',
      author_ids: [1, 2],
      success: true,
      provider: 'smspilot',
      emulated: true,
      server_id: '1000',
    })
  })

  it('does not call the bridge when there are no subscriptions', async () => {
    const sendSms = vi.fn()

    const events = await notifyDemoBookSubscribers({ book, authors }, { sendSms })

    expect(sendSms).not.toHaveBeenCalled()
    expect(events).toEqual([])
    expect(getDemoSmsLog()).toEqual([])
  })

  it('records a failed event without leaking an API key', async () => {
    subscribeToDemoAuthor({ authorId: 1, phone: '79991234567' })
    const sendSms = vi.fn().mockRejectedValue(new Error('network failed'))

    const events = await notifyDemoBookSubscribers({ book, authors }, { sendSms })

    expect(events).toEqual([
      expect.objectContaining({
        success: false,
        provider: 'smspilot',
        emulated: true,
        error: 'Demo SMS bridge недоступен.',
      }),
    ])
    expect(JSON.stringify(getDemoSmsLog())).not.toContain('apikey')
    expect(JSON.stringify(getDemoSmsLog())).not.toContain('XXXXXXXXXXXX')
  })
})
