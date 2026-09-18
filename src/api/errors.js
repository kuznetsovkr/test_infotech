export function getHttpStatus(error) {
  return error?.response?.status ?? null
}

export function isRequestCanceled(error) {
  return (
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'AbortError' ||
    error?.name === 'CanceledError'
  )
}
