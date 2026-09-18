import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/reports.api', () => ({
  getTopAuthors: vi.fn(),
}))

import { getTopAuthors } from '../src/api/reports.api'
import { createAppRouter } from '../src/router'
import TopAuthorsReportView from '../src/views/TopAuthorsReportView.vue'

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('TopAuthorsReportView', () => {
  let wrapper

  beforeEach(() => {
    getTopAuthors.mockResolvedValue({ year: 2025, items: [] })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.clearAllMocks()
  })

  async function mountView(path = '/reports/top-authors', { flush = true } = {}) {
    const router = createAppRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()
    wrapper = mount(TopAuthorsReportView, { global: { plugins: [router] } })

    if (flush) {
      await flushPromises()
    } else {
      await wrapper.vm.$nextTick()
    }

    return router
  }

  it('не запрашивает отчёт для пустого и нецелого года', async () => {
    await mountView()
    expect(getTopAuthors).not.toHaveBeenCalled()

    await wrapper.get('#report-year').setValue('')
    await wrapper.get('form').trigger('submit')
    expect(getTopAuthors).not.toHaveBeenCalled()
    expect(wrapper.get('#report-year-error').text()).toBe('Укажите год.')

    await wrapper.get('#report-year').setValue('2025.5')
    await wrapper.get('form').trigger('submit')
    expect(getTopAuthors).not.toHaveBeenCalled()
    expect(wrapper.get('#report-year-error').text()).toBe('Год должен быть целым числом.')
  })

  it('синхронизирует valid submit с URL и вызывает API', async () => {
    const router = await mountView()

    await wrapper.get('#report-year').setValue('2025')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.query.year).toBe('2025')
    expect(getTopAuthors).toHaveBeenCalledWith(
      2025,
      expect.objectContaining({ signal: expect.anything() }),
    )
  })

  it('восстанавливает valid year из URL и автоматически загружает отчёт', async () => {
    await mountView('/reports/top-authors?year=2024')

    expect(wrapper.get('#report-year').element.value).toBe('2024')
    expect(getTopAuthors).toHaveBeenCalledWith(
      2024,
      expect.objectContaining({ signal: expect.anything() }),
    )
  })

  it('не делает request для невалидного query year', async () => {
    await mountView('/reports/top-authors?year=invalid')

    expect(getTopAuthors).not.toHaveBeenCalled()
    expect(wrapper.get('#report-year-error').text()).toContain('должен быть целым числом')
  })

  it('показывает server rank, имя, books_count и ссылку на автора', async () => {
    getTopAuthors.mockResolvedValue({
      year: 2025,
      items: [
        {
          rank: 2,
          author_id: 10,
          full_name: 'Анна Авторова',
          books_count: 12,
        },
      ],
    })
    await mountView('/reports/top-authors?year=2025')

    const row = wrapper.get('tbody tr')
    expect(row.text()).toContain('2')
    expect(row.text()).toContain('Анна Авторова')
    expect(row.text()).toContain('12')
    expect(row.get('a[href="/authors/10"]').exists()).toBe(true)
  })

  it('показывает empty state для пустого items', async () => {
    await mountView('/reports/top-authors?year=2025')

    expect(wrapper.text()).toContain('За выбранный год данные не найдены.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('показывает loading state и блокирует submit', async () => {
    const request = createDeferred()
    getTopAuthors.mockReturnValue(request.promise)
    await mountView('/reports/top-authors?year=2025', { flush: false })

    expect(wrapper.get('[role="status"]').text()).toContain('Загрузка отчёта')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()

    request.resolve({ year: 2025, items: [] })
    await flushPromises()
  })

  it('показывает понятную ошибку для backend 400', async () => {
    getTopAuthors.mockRejectedValue({ response: { status: 400 } })
    await mountView('/reports/top-authors?year=2025')

    expect(wrapper.get('#report-year-error').text()).toContain('Сервер не принял год')
  })

  it('показывает generic error с возможностью retry', async () => {
    getTopAuthors.mockRejectedValue(new Error('Network error'))
    await mountView('/reports/top-authors?year=2025')

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Не удалось загрузить отчёт')
    expect(alert.get('button').text()).toContain('Повторить загрузку')
  })

  it('не позволяет устаревшему response перезаписать новый отчёт', async () => {
    const firstRequest = createDeferred()
    getTopAuthors.mockReturnValueOnce(firstRequest.promise).mockResolvedValueOnce({
      year: 2025,
      items: [{ rank: 1, author_id: 2, full_name: 'Новый результат', books_count: 8 }],
    })
    const router = await mountView('/reports/top-authors?year=2024', { flush: false })

    await router.push('/reports/top-authors?year=2025')
    await flushPromises()
    firstRequest.resolve({
      year: 2024,
      items: [{ rank: 1, author_id: 1, full_name: 'Устаревший результат', books_count: 20 }],
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Новый результат')
    expect(wrapper.text()).not.toContain('Устаревший результат')
  })
})
