# Каталог книг

Frontend тестового задания для каталога книг. Реализованы публичный каталог, TOP-10 отчёт, authentication, CRUD книг и авторов, а также необязательный локальный demo API на MSW. Subscription/SMS functionality пока не реализована.

## Стек

- Vue 3 и Vite;
- Vue Router и Pinia;
- Axios;
- Bootstrap 5 и SCSS;
- MSW для изолированного demo mode;
- Vitest и Vue Test Utils;
- ESLint и Prettier.

## Требования

- рекомендуемая версия — Node.js 24 LTS; `.nvmrc` позволяет выбрать эту линию командой `nvm use`;
- поддерживаемые проектом линии: Node.js `^22.22.2` и `^24.15.0`;
- Node.js 23 не поддерживается, поскольку эта линия достигла EOL;
- Node.js 26 сейчас находится в статусе Current и не заявлен как LTS-версия проекта;
- npm 10+.

## Установка

```bash
npm install
```

Скопируйте пример environment-файла и при необходимости измените значения:

```bash
cp .env.example .env
```

Для PowerShell:

```powershell
Copy-Item .env.example .env
```

## Запуск development server

Production-like запуск использует адрес backend из `VITE_API_BASE_URL` и не включает MSW:

```bash
npm run dev
```

## Demo mode

Demo mode позволяет проверить существующие экраны без Yii2 backend и внешних сервисов:

```bash
npm install
npm run dev:demo
```

Демонстрационные credentials:

```text
username: demo
password: demo
```

Команда использует tracked-конфигурацию `.env.demo`: MSW browser worker запускается до монтирования Vue только при `VITE_USE_MOCK_API=true`. Обычные `npm run dev` и `npm run build` его не запускают. Production-контракт и API adapters остаются теми же и определяются [`book.yaml`](./book.yaml); demo handlers локально воспроизводят используемые endpoints `/api/v1`.

Seed содержит 24 тестовых автора и 36 книг. Обложки seed-книг — локальные SVG data URL, загруженные в формах файлы сохраняются как data URL только внутри mock infrastructure. Нормализованная demo-база сохраняется между reload в `localStorage` под отдельным ключом `infotech-demo-db-v1`; экспортированная `resetMockDatabase()` восстанавливает исходный seed для тестов и будущих demo tools.

Mock-only поведение удаления автора: его id удаляется из связей книг, а книги без оставшихся авторов удаляются. Исходный OpenAPI не определяет этот случай, поэтому данное правило не является production assumption и не реализовано во frontend UI.

Demo build можно отдельно проверить командой:

```bash
npm run build:demo
```

## Проверки

```bash
npm run lint
npm run test
npm run build
```

Для интерактивного режима тестов доступен `npm run test:watch`.

## Environment variables

| Переменная          | Значение по умолчанию | Назначение                                                                                      |
| ------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | `/api/v1`             | Base URL основного API. HTTP-клиент использует тот же fallback, если переменная не задана.      |
| `VITE_USE_MOCK_API` | `false`               | Включает локальный MSW demo API при точном значении `true`; обычный режим остаётся выключенным. |

В `.env.example` нет credentials или других секретов. Переменные с префиксом `VITE_` попадают в browser bundle и не должны содержать секретные значения.

## Authentication

Вход выполняется только через описанный в OpenAPI `POST /auth/login`. Полученный Bearer JWT, `expires_at` и объект пользователя сохраняются в `localStorage`; username/password отдельно не сохраняются. При старте структура сессии и срок действия проверяются, а повреждённая или истёкшая запись удаляется. Ответ `401` очищает сессию, тогда как `403` не выполняет logout.

В исходном контракте нет `/auth/me`, refresh token и server-side logout. Поэтому восстановление выполняется только из локальной сессии, а кнопка выхода удаляет её на клиенте. Route guards улучшают UX, но backend остаётся источником авторизации.

## Публичный каталог

- `/books` — поиск, фильтры по году/автору и пагинация книг;
- `/books/:id` — публичная страница книги;
- `/authors` — поиск и пагинация авторов;
- `/authors/:id` — автор и его `BookShort`-список.

Гость использует каталог авторов в режиме чтения. После входа доступны создание,
редактирование и удаление авторов через защищённые маршруты `/authors/new` и
`/authors/:id/edit`. Поведение при удалении автора, у которого есть книги, определяет backend:
исходный контракт не задаёт отдельного frontend-правила для этого случая.

Для книг guest также получает read-only доступ, а authenticated user — защищённые маршруты
`/books/new` и `/books/:id/edit`, а также удаление с подтверждением. Создание выполняется
через multipart `POST /books`. Редактирование без новой обложки использует JSON
`PATCH /books/{id}`, а выбор нового файла переключает запрос на полный multipart
`PUT /books/{id}`.

Поиск отправляется по submit, без запроса на каждый ввод символа. `search`, `year`, `author_id` и `page` синхронизируются с URL; для API фиксированный размер страницы преобразуется в точный параметр `per-page`.

Фильтр автора реализован как отдельный серверный поиск по Authors API с собственной пагинацией. Он не загружает только первые 20 авторов и не выдаёт их за полный список; выбранный `author_id` восстанавливается через публичный detail endpoint.

## Публичный отчёт

`/reports/top-authors` показывает полученный от backend TOP-10 авторов за выбранный целый год.
Год синхронизируется с query parameter `year`, поэтому URL можно сохранить или передать.
Валидный `?year=2025` автоматически загружает отчёт; отсутствующее или некорректное значение
не вызывает API request.

## API assumptions

- Единственный source of truth для production API — [`book.yaml`](./book.yaml). Frontend не должен придумывать отсутствующие production endpoints.
- OpenAPI описывает `author_ids` как multipart-массив, но явно не определяет его wire encoding.
- Рабочее предположение для заявленного Yii2/PHP backend: элементы multipart-массива отправляются как `author_ids[]=1`, `author_ids[]=2`. Сериализация находится только в API layer, чтобы формат менялся в одном месте.
- Ограничения cover, year и ISBN, отсутствующие в OpenAPI, не считаются backend requirements. Frontend проверяет только техническую корректность integer year и MIME `image/*`; ограничения размера и допустимых форматов файла определяет backend.
- `/auth/me`, refresh token и logout endpoint отсутствуют. Auth-реализация ограничена `/auth/login` и client-side lifecycle сессии.
- Subscription/SMS API в исходной спецификации отсутствует и в будущем останется изолированным demo-extension. На этапе 0 он не реализован.

## Документация

- [OpenAPI-спецификация](./book.yaml)
- [План реализации](./docs/implementation-plan.md)
