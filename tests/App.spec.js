import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from '../src/App.vue'
import router from '../src/router'

describe('App', () => {
  it('монтирует приложение и отображает домашнюю страницу', async () => {
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
      },
    })

    expect(wrapper.get('[data-testid="home-view"]').text()).toContain('Каркас приложения готов')

    wrapper.unmount()
  })
})
