const SMSPILOT_API_URL = 'https://smspilot.ru/api.php'
const DEMO_SMS_ENDPOINT = '/__demo/sms/send'
const MAX_REQUEST_SIZE = 16 * 1024

function failure(message) {
  return {
    success: false,
    provider: 'smspilot',
    emulated: true,
    message,
  }
}

function getProviderErrorMessage(payload) {
  const error = payload?.error

  if (!error || typeof error !== 'object') {
    return null
  }

  if (typeof error.description_ru === 'string' && error.description_ru.trim()) {
    return error.description_ru.trim()
  }

  if (typeof error.description === 'string' && error.description.trim()) {
    return error.description.trim()
  }

  return 'SMSPILOT emulator отклонил запрос.'
}

export async function sendSmsPilotEmulator({
  phone,
  message,
  apiKey,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return failure('SMSPILOT emulator key не настроен на demo server.')
  }

  const body = new URLSearchParams({
    send: message,
    to: phone,
    apikey: apiKey.trim(),
    format: 'json',
    test: '1',
  })

  try {
    const response = await fetchImpl(SMSPILOT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    let payload

    try {
      payload = await response.json()
    } catch {
      return failure('SMSPILOT emulator вернул некорректный ответ.')
    }

    const providerError = getProviderErrorMessage(payload)

    if (!response.ok || providerError) {
      return failure(providerError || 'SMSPILOT emulator временно недоступен.')
    }

    const sentMessage = Array.isArray(payload?.send) ? payload.send[0] : null

    if (!sentMessage || sentMessage.server_id === undefined || sentMessage.server_id === null) {
      return failure('SMSPILOT emulator не подтвердил обработку сообщения.')
    }

    return {
      success: true,
      provider: 'smspilot',
      emulated: true,
      server_id: String(sentMessage.server_id),
    }
  } catch {
    return failure('Не удалось связаться с SMSPILOT emulator.')
  }
}

async function readJsonBody(request) {
  let body = ''

  for await (const chunk of request) {
    body += chunk.toString('utf8')

    if (body.length > MAX_REQUEST_SIZE) {
      throw new Error('Request body is too large.')
    }
  }

  return JSON.parse(body || '{}')
}

function writeJson(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

export function createDemoSmsMiddleware({ apiKey, fetchImpl = globalThis.fetch }) {
  return async function demoSmsMiddleware(request, response, next) {
    const requestPath = request.url?.split('?')[0]

    if (requestPath !== DEMO_SMS_ENDPOINT) {
      next()
      return
    }

    if (request.method !== 'POST') {
      writeJson(response, 405, failure('Допустим только POST-запрос.'))
      return
    }

    let payload

    try {
      payload = await readJsonBody(request)
    } catch {
      writeJson(response, 400, failure('Некорректное тело запроса.'))
      return
    }

    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : ''
    const message = typeof payload.message === 'string' ? payload.message.trim() : ''

    if (!/^\d{10,15}$/.test(phone)) {
      writeJson(response, 400, failure('Номер телефона имеет неверный формат.'))
      return
    }

    if (!message || message.length > 320) {
      writeJson(response, 400, failure('Текст сообщения отсутствует или слишком длинный.'))
      return
    }

    const result = await sendSmsPilotEmulator({
      phone,
      message,
      apiKey,
      fetchImpl,
    })

    writeJson(response, result.success ? 200 : 502, result)
  }
}

export function demoSmsPilotPlugin({ apiKey } = {}) {
  return {
    name: 'demo-smspilot-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(createDemoSmsMiddleware({ apiKey }))
    },
  }
}
