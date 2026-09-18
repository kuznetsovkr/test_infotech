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

export function getApiErrorItems(error) {
  const errors = error?.response?.data?.errors

  if (!Array.isArray(errors)) {
    return []
  }

  return errors
    .filter((item) => item && typeof item.message === 'string' && item.message.trim())
    .map((item) => ({
      field: typeof item.field === 'string' ? item.field : '',
      message: item.message.trim(),
    }))
}
