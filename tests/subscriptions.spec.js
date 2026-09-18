import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuthorSubscription from '../src/components/authors/AuthorSubscription.vue'
import {
  appendDemoSmsLog,
  DEMO_SMS_LOG_STORAGE_KEY,
  DEMO_SUBSCRIPTIONS_STORAGE_KEY,
  getDemoSmsLog,
  getDemoSubscriptions,
  normalizeDemoPhone,
  resetDemoSubscriptionState,
  subscribeToDemoAuthor,
} from '../src/mocks/subscriptions'

beforeEach(() => {
  globalThis.localStorage.clear()
  resetDemoSubscriptionState()
})

describe('demo subscription storage', () => {
  it('normalizes supported phone formatting and rejects invalid values', () => {
    expect(normalizeDemoPhone('+7 999 123-45-67')).toBe('79991234567')
    expect(normalizeDemoPhone('+44 (20) 1234-5678')).toBe('442012345678')
    expect(normalizeDemoPhone('123')).toBeNull()
    expect(normalizeDemoPhone('+7 999 ABC-45-67')).toBeNull()
    expect(normalizeDemoPhone('++79991234567')).toBeNull()
  })

  it('stores an author/phone pair idempotently', () => {
    const first = subscribeToDemoAuthor({ authorId: 3, phone: '+7 999 123-45-67' })
    const duplicate = subscribeToDemoAuthor({ authorId: 3, phone: '79991234567' })

    expect(first.created).toBe(true)
    expect(duplicate.created).toBe(false)
    expect(duplicate.subscription).toEqual(first.subscription)
    expect(getDemoSubscriptions()).toEqual([
      expect.objectContaining({ author_id: 3, phone: '79991234567' }),
    ])
  })

  it('restores subscriptions from storage after module recreation', async () => {
    subscribeToDemoAuthor({ authorId: 5, phone: '+7 (921) 555-01-02' })

    vi.resetModules()
    const recreatedStorage = await import('../src/mocks/subscriptions')

    expect(recreatedStorage.getDemoSubscriptions()).toEqual([
      expect.objectContaining({ author_id: 5, phone: '79215550102' }),
    ])
  })

  it('recovers safely from corrupted storage and reset clears both stores', () => {
    globalThis.localStorage.setItem(DEMO_SUBSCRIPTIONS_STORAGE_KEY, '{broken')
    globalThis.localStorage.setItem(DEMO_SMS_LOG_STORAGE_KEY, 'not-json')

    expect(getDemoSubscriptions()).toEqual([])
    expect(getDemoSmsLog()).toEqual([])

    subscribeToDemoAuthor({ authorId: 1, phone: '79991234567' })
    appendDemoSmsLog({
      phone: '79991234567',
      book_id: 50,
      book_title: 'Demo book',
      author_ids: [1],
      author_names: ['Demo Author'],
      success: true,
      server_id: '1000',
    })

    resetDemoSubscriptionState()

    expect(globalThis.localStorage.getItem(DEMO_SUBSCRIPTIONS_STORAGE_KEY)).toBeNull()
    expect(globalThis.localStorage.getItem(DEMO_SMS_LOG_STORAGE_KEY)).toBeNull()
  })
})

describe('AuthorSubscription', () => {
  it('is usable without authentication and stores a normalized phone', async () => {
    const wrapper = mount(AuthorSubscription, {
      props: { authorId: 7, authorName: 'Гостевой автор' },
    })

    expect(wrapper.text()).toContain('Демонстрационная подписка')
    expect(wrapper.get('input[type="tel"]').attributes('aria-invalid')).toBe('false')

    await wrapper.get('input[type="tel"]').setValue('+7 999 123-45-67')
    await wrapper.get('form').trigger('submit')
    await Promise.resolve()

    expect(wrapper.text()).toContain('Демонстрационная подписка сохранена.')
    expect(getDemoSubscriptions()).toEqual([
      expect.objectContaining({ author_id: 7, phone: '79991234567' }),
    ])
  })

  it('blocks an invalid phone and reports a duplicate subscription', async () => {
    const wrapper = mount(AuthorSubscription, {
      props: { authorId: 8, authorName: 'Demo Author' },
    })
    const input = wrapper.get('input[type="tel"]')

    await input.setValue('123')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.text()).toContain('Введите номер из 10–15 цифр')
    expect(getDemoSubscriptions()).toEqual([])

    await input.setValue('79991234567')
    await wrapper.get('form').trigger('submit')
    await Promise.resolve()
    await input.setValue('+7 999 123-45-67')
    await wrapper.get('form').trigger('submit')
    await Promise.resolve()

    expect(wrapper.text()).toContain('Этот номер уже подписан')
    expect(getDemoSubscriptions()).toHaveLength(1)
  })
})
