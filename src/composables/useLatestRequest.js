import { onBeforeUnmount } from 'vue'

export function useLatestRequest() {
  let sequence = 0
  let controller = null

  function cancel() {
    sequence += 1
    controller?.abort()
    controller = null
  }

  function begin() {
    cancel()
    controller = new AbortController()
    const requestSequence = sequence

    return {
      isLatest: () => requestSequence === sequence,
      signal: controller.signal,
    }
  }

  onBeforeUnmount(cancel)

  return {
    begin,
    cancel,
  }
}
