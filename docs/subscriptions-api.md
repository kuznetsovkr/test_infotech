# Подписки и SMS: demo extension и production proposal

## Provided contract gap

Исходный [`book.yaml`](../book.yaml) не содержит subscription endpoints, модели подписчика/телефона или SMS endpoints. Поэтому описанная ниже функциональность не является частью предоставленного production API и не изменяет его.

## Demo implementation

В `VITE_USE_MOCK_API=true` страница автора показывает блок «Демонстрационная подписка». Подписка хранится только в browser `localStorage` под ключом `infotech-demo-subscriptions-v1` и содержит `author_id`, нормализованный `phone` и `created_at`. Одинаковая пара `author_id + phone` сохраняется идемпотентно.

После успешного mock `POST /books` demo infrastructure находит подписки всех авторов книги и группирует их по телефону. Один телефон получает не более одного уведомления для одной книги, даже если подписан на нескольких соавторов.

Browser обращается только к локальному `POST /__demo/sms/send` с `phone` и `message`. Этот endpoint реализован demo-only middleware Vite и доступен только через `npm run dev:demo`. Middleware добавляет `SMSPILOT_API_KEY`, `format=json` и обязательный `test=1`, затем выполняет server-side POST `application/x-www-form-urlencoded` в [официальный API-1](https://smspilot.ru/apikey.php?tab=api1) по адресу `https://smspilot.ru/api.php`.

`.env.demo` содержит только официальный публичный emulator key. Production credential в repository отсутствует. Static `npm run build:demo` сохраняет demo UI/MSW, но без работающего Vite middleware не может выполнить реальный emulator request; такая попытка будет записана как failed demo event.

Результаты сохраняются в `infotech-demo-sms-log-v1`. UI показывает маскированный телефон, книгу, авторов, timestamp, success/error и `server_id`, если он получен. API key в журнал не записывается. Ошибка SMS не меняет успешный результат создания книги.

## Proposed production contract

Ниже — только предложение для будущего Yii2 backend, не дополнение к текущему `book.yaml`.

```http
POST /api/v1/subscriptions
Content-Type: application/json

{
  "author_id": 123,
  "phone": "79991234567"
}
```

Повтор того же `author_id + phone` должен быть идемпотентным. Ответ может содержать opaque subscription id и token подтверждения/отмены. Отмену безопаснее выполнять через отдельный подтверждённый workflow, например `DELETE /api/v1/subscriptions/{id}` с одноразовым unsubscribe token, а не только по открытому номеру телефона.

## Production event flow

```text
Vue frontend
  → Yii2 subscription endpoint
  → database subscriptions

Yii2 book creation
  → BookCreated domain event
  → subscribers lookup
  → queue/background notification job
  → SMSPILOT
```

Frontend не должен вызывать SMSPILOT напрямую. Production API key хранится только в backend secret storage/environment и никогда не попадает в `VITE_*`, browser bundle или API response.

## Reliability and security

Production implementation должна предусматривать:

- подтверждение номера и безопасную отмену подписки;
- уникальность/idempotency подписки и notification job;
- асинхронную обработку, retry с ограничением и dead-letter/error state;
- masking персональных данных в логах;
- rate limiting и anti-abuse validation;
- аудит provider response без сохранения API key.
