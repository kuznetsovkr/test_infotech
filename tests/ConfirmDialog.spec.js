import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ConfirmDialog from '../src/components/common/ConfirmDialog.vue'

let wrapper

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ConfirmDialog accessibility', () => {
  it('moves focus into the dialog, traps Tab, and restores focus after closing', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Удалить'
    document.body.append(opener)
    opener.focus()

    wrapper = mount(ConfirmDialog, {
      attachTo: document.body,
      props: {
        isOpen: false,
        title: 'Подтверждение',
        message: 'Подтвердите действие.',
      },
    })

    await wrapper.setProps({ isOpen: true })
    await nextTick()

    const dialog = document.body.querySelector('[role="dialog"]')
    const buttons = [...dialog.querySelectorAll('button')]

    expect(document.activeElement.textContent).toContain('Отмена')

    buttons.at(-1).focus()
    buttons.at(-1).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }))
    expect(document.activeElement).toBe(buttons[0])

    await wrapper.setProps({ isOpen: false })
    await nextTick()

    expect(document.activeElement).toBe(opener)
  })
})
