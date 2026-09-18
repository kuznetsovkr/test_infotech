export const AUTH_STORAGE_KEY = 'bookCatalog.authSession'

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function load(storage = getDefaultStorage()) {
  if (!storage) {
    return null
  }

  try {
    const serializedSession = storage.getItem(AUTH_STORAGE_KEY)

    if (!serializedSession) {
      return null
    }

    return JSON.parse(serializedSession)
  } catch {
    clear(storage)
    return null
  }
}

function save(session, storage = getDefaultStorage()) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  } catch {
    clear(storage)
  }
}

function clear(storage = getDefaultStorage()) {
  if (!storage) {
    return
  }

  try {
    storage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export const authSessionStorage = {
  clear,
  load,
  save,
}
