const DEMO_SMS_ENDPOINT = '/__demo/sms/send'
const NODE_TEST_ORIGIN = 'http://book-catalog.test'

function failedResult(message) {
  return {
    success: false,
    provider: 'smspilot',
    emulated: true,
    message,
  }
}

function getBridgeUrl() {
  if (typeof globalThis.location?.origin === 'string') {
    return new URL(DEMO_SMS_ENDPOINT, globalThis.location.origin).toString()
  }

  return new URL(DEMO_SMS_ENDPOINT, NODE_TEST_ORIGIN).toString()
}

export async function sendDemoSms({ phone, message }, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(getBridgeUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, message }),
    })
    const payload = await response.json()

    if (
      payload?.provider !== 'smspilot' ||
      payload?.emulated !== true ||
      typeof payload?.success !== 'boolean'
    ) {
      return failedResult('Demo SMS bridge вернул некорректный ответ.')
    }

    return payload
  } catch {
    return failedResult('Demo SMS bridge недоступен.')
  }
}
