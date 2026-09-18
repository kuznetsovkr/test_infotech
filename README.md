# INFOTECH Book Catalog

Frontend тестового задания: каталог книг и авторов на Vue 3, реализованный по предоставленному OpenAPI-контракту [`book.yaml`](./book.yaml). Проект можно запустить с реальным API либо полностью локально в MSW demo mode.

## Stack

- Vue 3, Vite, JavaScript;
- Vue Router, Pinia, Axios;
- Bootstrap 5, SCSS;
- MSW;
- Vitest, Vue Test Utils;
- ESLint, Prettier.

Рекомендуемая версия — Node.js 24 LTS (`.nvmrc`: `24`). Поле `engines` разрешает поддерживаемые линии `^22.22.2 || ^24.15.0`; EOL-линия Node.js 23 не поддерживается.

## Quick start — demo

```bash
npm install
npm run dev:demo
```

Yii2 backend для demo не нужен. Данные обслуживает MSW, а demo-сессия использует:

```text
username: demo
password: demo
```

## Standard API mode

Создайте локальный `.env` из примера:

```bash
cp .env.example .env
npm run dev
```

PowerShell: `Copy-Item .env.example .env`.

```dotenv
VITE_API_BASE_URL=/api/v1
VITE_USE_MOCK_API=false
```

`VITE_API_BASE_URL` может быть относительным или абсолютным URL совместимого backend. Обычные `npm run dev` и `npm run build` не запускают MSW или SMS bridge.

## Available functionality

### Guest

- каталог и страницы книг;
- каталог и страницы авторов;
- поиск, фильтры и пагинация с синхронизацией URL;
- публичный TOP-10 авторов за выбранный год;
- demo-подписка на автора при запуске в MSW mode.

### Authenticated user

- все возможности гостя;
- создание, изменение и удаление книг;
- создание, изменение и удаление авторов.

Frontend route guards и скрытие controls отвечают за UX. Окончательное решение об авторизации всегда принимает backend.

## Routes

| Route                  | Назначение                           | Доступ        |
| ---------------------- | ------------------------------------ | ------------- |
| `/books`               | Каталог книг                         | Public        |
| `/books/:id`           | Страница книги                       | Public        |
| `/books/new`           | Создание книги                       | Authenticated |
| `/books/:id/edit`      | Редактирование книги                 | Authenticated |
| `/authors`             | Каталог авторов                      | Public        |
| `/authors/:id`         | Автор и его книги                    | Public        |
| `/authors/new`         | Создание автора                      | Authenticated |
| `/authors/:id/edit`    | Редактирование автора                | Authenticated |
| `/reports/top-authors` | TOP-10 авторов за выбранный год      | Public        |
| `/login`               | Вход                                 | Public        |
| `/account`             | Минимальная проверка защищённого URL | Authenticated |

## API contract

[`book.yaml`](./book.yaml) — единственный source of truth для production API. Production layer не добавляет отсутствующие endpoints.

- Multipart encoding `author_ids` явно не определён. Для Yii2/PHP используется документированное предположение `author_ids[]=1`, `author_ids[]=2`; сериализация изолирована в `src/api/bookPayload.js`.
- Создание книги — `POST /books` с полным `multipart/form-data` и обязательной обложкой.
- Редактирование без нового cover — `PATCH /books/{id}` с JSON `BookInput`.
- Редактирование с новым cover — `PUT /books/{id}` с полным multipart `BookForm`.
- Ограничения размера cover и бизнес-правила для year/ISBN отсутствуют в OpenAPI. Frontend проверяет только integer year и image MIME.
- Subscription/SMS endpoints и модель телефона в исходном OpenAPI отсутствуют; bonus-функциональность не является production API.

## Authentication

Вход использует только `POST /auth/login` и Bearer JWT. `token`, `user` и `expires_at` сохраняются в `localStorage`; password не сохраняется. При reload структура и срок действия сессии проверяются, а истёкшая или повреждённая запись очищается.

Ответ `401` завершает локальную сессию и направляет пользователя на `/login`; `403` показывает ошибку доступа без logout. В контракте нет `/auth/me`, refresh token и server-side logout, поэтому такие запросы не выполняются. Redirect после входа разрешён только на внутренний route.

## Demo mode

`npm run dev:demo` включает browser MSW до монтирования Vue. Те же API adapters работают с mock и реальным backend без условий в presentation-компонентах.

- deterministic seed: 24 автора и 36 книг;
- поиск, фильтры, пагинация, auth, CRUD и report повторяют контракт;
- many-to-many хранится через `author_ids`, response relations формируются динамически;
- обложки работают без внешних CDN: seed использует SVG data URL, upload — data URL только внутри demo;
- база сохраняется между reload в `infotech-demo-db-v1`;
- `resetMockDatabase()` восстанавливает seed и очищает demo-подписки/SMS log.

Mock-only поведение удаления автора: его id удаляется из связей, а книги без оставшихся авторов удаляются. Это не production assumption.

## Bonus: subscriptions and SMSPILOT

Bonus доступен guest и authenticated user только в demo mode. Подписки и журнал сохраняются отдельно в `infotech-demo-subscriptions-v1` и `infotech-demo-sms-log-v1`; повторная пара `author_id + phone` идемпотентна, а телефон в UI журнала маскируется.

При создании книги MSW инициирует demo notification side effect. Browser обращается только к локальному `/__demo/sms/send`; Vite middleware добавляет server-side `SMSPILOT_API_KEY`, `format=json` и обязательный `test=1`, поэтому реальная SMS оператору не отправляется. Production credential отсутствует в frontend и не используется в `VITE_*`.

Реальный emulator HTTP request доступен только через `npm run dev:demo`. Static `npm run build:demo` сохраняет demo UI/MSW, но без server-side bridge записывает попытку как failed event. Production proposal с Yii2 endpoint, `BookCreated` event и background job описан в [`docs/subscriptions-api.md`](./docs/subscriptions-api.md).

## Testing

```bash
npm run lint
npm run test
npm run build
npm run build:demo
```

Дополнительно доступны `npm run test:watch`, `npm run format` и `npm run format:check`. Unit/component/integration tests не обращаются к реальному backend или SMSPILOT.

## Architecture

- `src/api` — Axios client, API adapters, response/error mapping и multipart serialization;
- `src/views` — route-level orchestration и состояния экранов;
- `src/components` — небольшие формы и presentation components;
- `src/composables` — latest-request cancellation и server-side author search;
- `src/stores` — Pinia auth session;
- `src/mocks` — изолированные MSW handlers, normalized demo DB и bonus notification flow;
- `vite` — demo-only server middleware для SMSPILOT emulator.

## Known limitations / assumptions

- Публичный Yii2 backend URL не предоставлен; для локальной проверки предназначен demo mode.
- Multipart-массив `author_ids[]` — documented Yii2/PHP assumption до подтверждения backend-командой.
- Production-поведение удаления автора, у которого есть книги, определяется backend и не задано исходным контрактом.
- Static demo build не может выполнить SMSPILOT request без server-side Vite bridge.

## Documentation

- [OpenAPI contract](./book.yaml)
- [Implementation plan](./docs/implementation-plan.md)
- [Subscriptions/SMS production proposal](./docs/subscriptions-api.md)
