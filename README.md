# Каталог книг

Frontend тестового задания для каталога книг. Реализованы базовая API-инфраструктура и authentication; каталог, CRUD, отчёты, mock API и SMS пока не реализованы.

## Стек

- Vue 3 и Vite;
- Vue Router и Pinia;
- Axios;
- Bootstrap 5 и SCSS;
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

```bash
npm run dev
```

## Проверки

```bash
npm run lint
npm run test
npm run build
```

Для интерактивного режима тестов доступен `npm run test:watch`.

## Environment variables

| Переменная          | Значение по умолчанию | Назначение                                                                                 |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL` | `/api/v1`             | Base URL основного API. HTTP-клиент использует тот же fallback, если переменная не задана. |
| `VITE_USE_MOCK_API` | `false`               | Зарезервированный флаг будущего mock mode; MSW на этапе 0 не подключён.                    |

В `.env.example` нет credentials или других секретов. Переменные с префиксом `VITE_` попадают в browser bundle и не должны содержать секретные значения.

## Authentication

Вход выполняется только через описанный в OpenAPI `POST /auth/login`. Полученный Bearer JWT, `expires_at` и объект пользователя сохраняются в `localStorage`; username/password отдельно не сохраняются. При старте структура сессии и срок действия проверяются, а повреждённая или истёкшая запись удаляется. Ответ `401` очищает сессию, тогда как `403` не выполняет logout.

В исходном контракте нет `/auth/me`, refresh token и server-side logout. Поэтому восстановление выполняется только из локальной сессии, а кнопка выхода удаляет её на клиенте. Route guards улучшают UX, но backend остаётся источником авторизации.

## API assumptions

- Единственный source of truth для production API — [`book.yaml`](./book.yaml). Frontend не должен придумывать отсутствующие production endpoints.
- OpenAPI описывает `author_ids` как multipart-массив, но явно не определяет его wire encoding.
- Рабочее предположение для заявленного Yii2/PHP backend: элементы будут отправляться как `author_ids[]=1`, `author_ids[]=2`. Когда Books API будет реализован, эта сериализация должна находиться только в API layer, чтобы формат менялся в одном месте.
- Ограничения cover, year и ISBN, отсутствующие в OpenAPI, не считаются backend requirements. Будущая UX-валидация будет отделена от серверного контракта.
- `/auth/me`, refresh token и logout endpoint отсутствуют. Auth-реализация ограничена `/auth/login` и client-side lifecycle сессии.
- Subscription/SMS API в исходной спецификации отсутствует и в будущем останется изолированным demo-extension. На этапе 0 он не реализован.

## Документация

- [OpenAPI-спецификация](./book.yaml)
- [План реализации](./docs/implementation-plan.md)
