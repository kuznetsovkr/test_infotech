import { sendDemoSms } from './smsBridge'
import { appendDemoSmsLog, findDemoSubscriptions } from './subscriptions'

function truncate(value, maxLength) {
  const normalized = String(value || '').trim()

  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`
}

function buildMessage(authorNames, bookTitle) {
  const authorLabel = authorNames.length > 1 ? 'авторов' : 'автора'
  const names = truncate(authorNames.join(', '), 60)
  const title = truncate(bookTitle, 60)

  return `Новая книга ${authorLabel} ${names}: «${title}»`
}

function buildTargets(book, authors) {
  const authorById = new Map(
    authors.filter((author) => Number.isInteger(author?.id)).map((author) => [author.id, author]),
  )
  const subscriptions = findDemoSubscriptions([...authorById.keys()])
  const targetsByPhone = new Map()

  for (const subscription of subscriptions) {
    const author = authorById.get(subscription.author_id)

    if (!author) {
      continue
    }

    const target = targetsByPhone.get(subscription.phone) || {
      phone: subscription.phone,
      authors: [],
    }

    if (!target.authors.some((item) => item.id === author.id)) {
      target.authors.push(author)
    }

    targetsByPhone.set(subscription.phone, target)
  }

  return [...targetsByPhone.values()].map((target) => ({
    ...target,
    message: buildMessage(
      target.authors.map((author) => author.full_name || `ID ${author.id}`),
      book.title,
    ),
  }))
}

export async function notifyDemoBookSubscribers({ book, authors }, { sendSms = sendDemoSms } = {}) {
  const targets = buildTargets(book, Array.isArray(authors) ? authors : [])
  const events = []

  for (const target of targets) {
    let result

    try {
      result = await sendSms({
        phone: target.phone,
        message: target.message,
      })
    } catch {
      result = {
        success: false,
        provider: 'smspilot',
        emulated: true,
        message: 'Demo SMS bridge недоступен.',
      }
    }

    const event = appendDemoSmsLog({
      phone: target.phone,
      book_id: book.id,
      book_title: book.title,
      author_ids: target.authors.map((author) => author.id),
      author_names: target.authors.map((author) => author.full_name || `ID ${author.id}`),
      success: result?.success === true,
      server_id: result?.server_id,
      error: result?.success === true ? undefined : result?.message || 'Неизвестная ошибка.',
    })

    if (event) {
      events.push(event)
    }
  }

  return events
}
