export const DEMO_SUBSCRIPTIONS_STORAGE_KEY = 'infotech-demo-subscriptions-v1'
export const DEMO_SMS_LOG_STORAGE_KEY = 'infotech-demo-sms-log-v1'

const SMS_LOG_UPDATED_EVENT = 'infotech-demo-sms-log-updated'
const MAX_LOG_ENTRIES = 100

function canUseStorage() {
  return typeof globalThis.localStorage !== 'undefined'
}

function isValidSubscription(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Number.isInteger(value.author_id) &&
    value.author_id > 0 &&
    typeof value.phone === 'string' &&
    /^\d{10,15}$/.test(value.phone) &&
    typeof value.created_at === 'string' &&
    Number.isFinite(Date.parse(value.created_at))
  )
}

function isValidLogEntry(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.timestamp === 'string' &&
    Number.isFinite(Date.parse(value.timestamp)) &&
    typeof value.phone === 'string' &&
    typeof value.phone_masked === 'string' &&
    Number.isInteger(value.book_id) &&
    typeof value.book_title === 'string' &&
    Array.isArray(value.author_ids) &&
    Array.isArray(value.author_names) &&
    typeof value.success === 'boolean' &&
    value.provider === 'smspilot' &&
    value.emulated === true
  )
}

function readArray(key, validator) {
  if (!canUseStorage()) {
    return []
  }

  try {
    const value = JSON.parse(globalThis.localStorage.getItem(key))

    if (Array.isArray(value) && value.every(validator)) {
      return value
    }
  } catch {
    // Corrupted demo storage is discarded below.
  }

  try {
    globalThis.localStorage.removeItem(key)
  } catch {
    // Storage availability is best-effort in demo mode.
  }

  return []
}

function writeArray(key, value) {
  if (!canUseStorage()) {
    return false
  }

  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function announceSmsLogUpdate() {
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.Event === 'function') {
    globalThis.dispatchEvent(new globalThis.Event(SMS_LOG_UPDATED_EVENT))
  }
}

export function normalizeDemoPhone(value) {
  if (typeof value !== 'string') {
    return null
  }

  let normalized = value.trim().replace(/[\s()-]/g, '')

  if (normalized.startsWith('+')) {
    normalized = normalized.slice(1)
  }

  if (!/^\d{10,15}$/.test(normalized)) {
    return null
  }

  return normalized
}

export function maskDemoPhone(phone) {
  if (typeof phone !== 'string' || phone.length < 5) {
    return '••••'
  }

  return `${phone.slice(0, 2)}${'•'.repeat(Math.max(phone.length - 4, 2))}${phone.slice(-2)}`
}

export function getDemoSubscriptions() {
  return readArray(DEMO_SUBSCRIPTIONS_STORAGE_KEY, isValidSubscription)
}

export function subscribeToDemoAuthor({ authorId, phone, createdAt = new Date().toISOString() }) {
  const normalizedPhone = normalizeDemoPhone(phone)

  if (!Number.isInteger(authorId) || authorId <= 0 || !normalizedPhone) {
    return { created: false, error: 'Некорректные данные подписки.' }
  }

  const subscriptions = getDemoSubscriptions()
  const existingSubscription = subscriptions.find(
    (subscription) => subscription.author_id === authorId && subscription.phone === normalizedPhone,
  )

  if (existingSubscription) {
    return { created: false, subscription: existingSubscription }
  }

  const subscription = {
    author_id: authorId,
    phone: normalizedPhone,
    created_at: createdAt,
  }

  if (!writeArray(DEMO_SUBSCRIPTIONS_STORAGE_KEY, [...subscriptions, subscription])) {
    return { created: false, error: 'Не удалось сохранить демонстрационную подписку.' }
  }

  return { created: true, subscription }
}

export function findDemoSubscriptions(authorIds) {
  const selectedAuthorIds = new Set(
    Array.isArray(authorIds) ? authorIds.filter(Number.isInteger) : [],
  )

  return getDemoSubscriptions().filter((subscription) =>
    selectedAuthorIds.has(subscription.author_id),
  )
}

export function getDemoSmsLog({ authorId } = {}) {
  const entries = readArray(DEMO_SMS_LOG_STORAGE_KEY, isValidLogEntry)

  if (!Number.isInteger(authorId)) {
    return entries
  }

  return entries.filter((entry) => entry.author_ids.includes(authorId))
}

export function appendDemoSmsLog(entry) {
  const normalizedPhone = normalizeDemoPhone(entry.phone)

  if (!normalizedPhone) {
    return null
  }

  const normalizedEntry = {
    timestamp: entry.timestamp || new Date().toISOString(),
    phone: normalizedPhone,
    phone_masked: maskDemoPhone(normalizedPhone),
    book_id: entry.book_id,
    book_title: entry.book_title,
    author_ids: [...entry.author_ids],
    author_names: [...entry.author_names],
    success: Boolean(entry.success),
    provider: 'smspilot',
    emulated: true,
    ...(entry.server_id ? { server_id: String(entry.server_id) } : {}),
    ...(!entry.success && entry.error ? { error: String(entry.error) } : {}),
  }

  if (!isValidLogEntry(normalizedEntry)) {
    return null
  }

  const entries = getDemoSmsLog()
  writeArray(DEMO_SMS_LOG_STORAGE_KEY, [normalizedEntry, ...entries].slice(0, MAX_LOG_ENTRIES))
  announceSmsLogUpdate()

  return normalizedEntry
}

export function subscribeToSmsLogUpdates(listener) {
  if (typeof globalThis.addEventListener !== 'function') {
    return () => {}
  }

  globalThis.addEventListener(SMS_LOG_UPDATED_EVENT, listener)

  return () => globalThis.removeEventListener(SMS_LOG_UPDATED_EVENT, listener)
}

export function resetDemoSubscriptionState() {
  if (canUseStorage()) {
    try {
      globalThis.localStorage.removeItem(DEMO_SUBSCRIPTIONS_STORAGE_KEY)
      globalThis.localStorage.removeItem(DEMO_SMS_LOG_STORAGE_KEY)
    } catch {
      // Demo reset remains safe when storage is unavailable.
    }
  }

  announceSmsLogUpdate()
}
