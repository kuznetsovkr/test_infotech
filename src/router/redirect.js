const INTERNAL_ORIGIN = 'http://book-catalog.local'

export function getSafeInternalRedirect(value) {
  const candidate = Array.isArray(value) ? value[0] : value

  if (
    typeof candidate !== 'string' ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\')
  ) {
    return null
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN)

    if (url.origin !== INTERNAL_ORIGIN) {
      return null
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function resolvePostLoginRedirect(router, value) {
  const target = getSafeInternalRedirect(value)

  if (!target) {
    return '/'
  }

  const resolvedTarget = router.resolve(target)

  if (resolvedTarget.name === 'login' || resolvedTarget.matched.length === 0) {
    return '/'
  }

  return resolvedTarget.fullPath
}
