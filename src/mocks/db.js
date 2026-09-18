import { createSeedState } from './seed'
import { resetDemoSubscriptionState } from './subscriptions'

export const DEMO_DB_STORAGE_KEY = 'infotech-demo-db-v1'

function canUseStorage() {
  return typeof globalThis.localStorage !== 'undefined'
}

function isStoredState(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray(value.authors) &&
    Array.isArray(value.books) &&
    Number.isInteger(value.nextAuthorId) &&
    Number.isInteger(value.nextBookId)
  )
}

function persistState(state) {
  if (!canUseStorage()) {
    return
  }

  try {
    globalThis.localStorage.setItem(DEMO_DB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Demo persistence is best-effort; an unavailable storage must not break the API.
  }
}

function loadState() {
  if (canUseStorage()) {
    try {
      const storedState = JSON.parse(globalThis.localStorage.getItem(DEMO_DB_STORAGE_KEY))

      if (isStoredState(storedState)) {
        return storedState
      }
    } catch {
      // Fall back to deterministic seed data when the stored demo state is corrupted.
    }
  }

  const seedState = createSeedState()
  persistState(seedState)

  return seedState
}

let state = loadState()

export function getMockDatabase() {
  return state
}

export function mutateMockDatabase(mutation) {
  const result = mutation(state)
  persistState(state)

  return result
}

export function resetMockDatabase() {
  state = createSeedState()
  persistState(state)
  resetDemoSubscriptionState()

  return state
}
