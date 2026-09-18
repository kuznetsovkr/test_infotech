# План реализации каталога книг

## 1. Цель и границы

План основан на полном разборе исходной OpenAPI-спецификации [`book.yaml`](../book.yaml), версия `3.0.3`. Основное приложение должно обращаться только к операциям, которые в ней описаны. В частности, основной API ограничен префиксом `/api/v1` и не расширяется frontend-кодом вымышленными методами.

Функция подписки и отправки SMS отсутствует в исходном контракте. Она будет реализована только как явно отделённое development/demo-extension с собственным пространством URL, флагом включения и документацией. Эти demo URL не являются частью `/api/v1` и не должны восприниматься как предлагаемые существующим backend.

Основные принципы реализации:

- Vue 3 Composition API, JavaScript, Vite, Vue Router, Pinia и Axios;
- Bootstrap 5 для базовой сетки и компонентов, SCSS для небольшого слоя проектных стилей;
- один небольшой HTTP/API layer без запросов из presentation-компонентов;
- Pinia только для действительно глобального состояния (прежде всего сессия), без дублирования серверных данных во множестве store;
- URL каталога — источник состояния публичных фильтров и пагинации;
- MSW повторяет исходный контракт, а не задаёт альтернативный интерфейс для frontend;
- доступность и все состояния асинхронного UI рассматриваются как часть функциональности, а не как финальная полировка.

## 2. Зафиксированный контракт OpenAPI

В спецификации описаны 8 path-шаблонов и 14 операций:

- `POST /auth/login`;
- `GET /books`, `POST /books`;
- `GET /books/{id}`, `PUT /books/{id}`, `PATCH /books/{id}`, `DELETE /books/{id}`;
- `GET /authors`, `POST /authors`;
- `GET /authors/{id}`, `PUT /authors/{id}`, `DELETE /authors/{id}`;
- `GET /reports/top-authors`.

Публичными являются чтение книг и авторов, а также отчёт. Все операции изменения содержат `security: bearerAuth`. Глобальная security-схема не задана, поэтому frontend не должен добавлять токен к запросам как условие доступа к публичным данным, хотя interceptor может безопасно прикладывать существующий Bearer token ко всем запросам к нашему API.

Ответы с данными используют envelope вида `{ success, data }`. Ошибки, для которых схема описана, используют `{ success: false, errors: [{ field, message }] }`.

## 3. Requirements matrix

| Требование                             | Операция OpenAPI                                                                      | Планируемый UI                                                                                   | Авторизация                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Вход пользователя                      | `POST /auth/login`, JSON `username/password`                                          | `/login`, форма входа, общая и полевая ошибка, блокировка повторного submit                      | Публично; успешный ответ создаёт локальную сессию                    |
| Восстановление сессии после reload     | Отдельной операции нет; используются `token`, `user`, `expires_at` из `LoginResponse` | Выполняется до первого защищённого перехода; краткое начальное состояние инициализации           | Локально, без вымышленного `/me` или refresh endpoint                |
| Просмотр каталога                      | `GET /books`                                                                          | `/books`: карточки/список, пагинация, loading/empty/error                                        | Публично                                                             |
| Поиск книг                             | `GET /books?search=...`                                                               | Поисковая форма с label и submit, значение в query string                                        | Публично                                                             |
| Фильтр по году                         | `GET /books?year=...`                                                                 | Числовое поле/селектор года, значение в query string                                             | Публично                                                             |
| Фильтр по автору                       | `GET /books?author_id=...`; варианты авторов из `GET /authors`                        | Доступный searchable author filter, `author_id` в query string                                   | Публично                                                             |
| Пагинация книг                         | `GET /books?page=...&per-page=...`                                                    | Pagination с текущей/предыдущей/следующей страницей и выбором размера                            | Публично                                                             |
| Просмотр книги                         | `GET /books/{id}`                                                                     | `/books/:id`: обложка, название, год, описание, ISBN, ссылки на авторов                          | Публично                                                             |
| Создание книги                         | `POST /books`, `multipart/form-data`, `BookForm`                                      | `/books/new`, общая форма книги, обязательная обложка и минимум один автор                       | Bearer token; route meta `requiresAuth`                              |
| Редактирование книги без новой обложки | `PATCH /books/{id}`, JSON `BookInput`                                                 | `/books/:id/edit`, предварительно заполненная форма; отправляются редактируемые поля без `cover` | Bearer token; route meta `requiresAuth`                              |
| Редактирование книги с новой обложкой  | `PUT /books/{id}`, `multipart/form-data`, полный `BookForm`                           | Та же edit form; новая обложка переключает стратегию на PUT                                      | Bearer token; route meta `requiresAuth`                              |
| Удаление книги                         | `DELETE /books/{id}`                                                                  | Кнопка только в авторизованном UI, confirmation dialog, затем возврат в каталог                  | Bearer token; backend остаётся источником решения о доступе          |
| Просмотр списка авторов                | `GET /authors?search&page&per-page`                                                   | `/authors`: поиск, список, пагинация, все async states                                           | Публично                                                             |
| Просмотр автора и его книг             | `GET /authors/{id}`                                                                   | `/authors/:id`: ФИО и список `BookShort` со ссылками                                             | Публично                                                             |
| Создание автора                        | `POST /authors`, JSON `AuthorInput`                                                   | `/authors/new`, форма ФИО                                                                        | Bearer token; route meta `requiresAuth`                              |
| Изменение автора                       | `PUT /authors/{id}`, JSON `AuthorInput`                                               | `/authors/:id/edit`, предварительно заполненная форма                                            | Bearer token; route meta `requiresAuth`                              |
| Удаление автора                        | `DELETE /authors/{id}`                                                                | Кнопка в detail/edit UI и confirmation dialog                                                    | Bearer token; backend остаётся источником решения о доступе          |
| TOP-10 авторов за год                  | `GET /reports/top-authors?year=...`                                                   | `/reports/top-authors`: валидный год, таблица `rank / author / books_count`, async states        | Публично                                                             |
| Показ backend validation errors        | Ошибки `422` со схемой `Error` для create/update                                      | Ошибки рядом с полями плюс общая область формы для немаппируемых ошибок                          | Запрос зависит от соответствующей CRUD-операции                      |
| Подписка гостя на автора               | **В OpenAPI отсутствует**                                                             | Demo-форма на `/authors/:id`, видна только при включённом feature flag                           | Публичная demo-функция, не часть основного API                       |
| SMS о новой книге                      | **В OpenAPI отсутствует**                                                             | Пользователь не отправляет SMS вручную; demo-событие возникает после mock-create книги           | Только server-side development adapter и SMSPILOT emulator/test mode |

## 4. Неоднозначности и расхождения

### 4.1. Критические границы

1. В `book.yaml` нет сущностей подписчика/телефона, endpoints подписки, события публикации книги и операции SMS. Поэтому основной `src/api` не получит методов вида `subscribe()` или `sendSms()`. Demo-extension будет отделён и задокументирован в `docs/subscriptions-api.md`.
2. В `servers` указан только относительный URL `/api/v1`; адрес доступного backend не предоставлен. Нужны `VITE_API_BASE_URL` и необязательный MSW mode. Значение для локальной работы по умолчанию можно задать `/api/v1`, но не хардкодить удалённый host.
3. SMSPILOT нельзя вызывать из browser-кода: даже emulator credential и детали транспорта должны находиться в development server adapter. Переменная с ключом не должна иметь префикс `VITE_`.

### 4.2. Аутентификация

1. Нет `/auth/me`, refresh и logout endpoints. Значит logout только удаляет локальную сессию, reload восстанавливает сохранённые `token/user/expires_at`, а протухший `expires_at` приводит к очистке сессии. Проверить токен без API-запроса невозможно.
2. Поля `LoginResponse` формально не помечены `required`. Adapter должен валидировать минимально необходимые данные успешного ответа и выдавать управляемую ошибку при несовместимом payload, а не записывать частичную сессию.
3. В примере есть роль `user`, но enum и другие роли не определены. Не следует строить дополнительную role matrix. Для изменяющих маршрутов достаточно факта действующей сессии; окончательное решение принимают ответы backend `401/403`.
4. `401` на login — ошибка credentials и не должен запускать общий redirect loop. Для других защищённых запросов `401` очищает сессию и ведёт на `/login?redirect=...`. `403` показывает сообщение о недостаточных правах, но не удаляет валидную сессию.
5. Хранение Bearer token в `localStorage` выполняет требование восстановления после reload, но повышает влияние XSS. Для production предпочтительнее server-managed HttpOnly/SameSite cookie или полноценная refresh-схема; текущий контракт этого не предоставляет.

### 4.3. Книги и формы

1. `BookForm` требует `title`, `year`, `author_ids`, `cover`; одна и та же схема используется POST и PUT. Поэтому PUT без нового файла недопустим по контракту. Стратегия формы фиксируется так:
   - create — всегда POST с полным `FormData` и обложкой;
   - edit без нового файла — PATCH с JSON и без `cover`;
   - edit с новым файлом — PUT с полным `FormData`, включая все обязательные поля и новую обложку.
2. `BookInput` для PATCH не имеет required-полей и не содержит cover. Для предсказуемой edit form планируется отправлять текущее полное множество редактируемых JSON-полей (`title`, `year`, `description`, `isbn`, `author_ids`), но никогда `cover_url`; это всё ещё допустимый частичный запрос.
3. `author_ids` в multipart описан как массив, но `encoding` не уточнён. Зафиксировано рабочее предположение для заявленного Yii2/PHP backend: каждый id отправляется отдельной частью с именем `author_ids[]`, например `author_ids[]=1`, `author_ids[]=2`. Это не новое требование OpenAPI, а выбранное wire-level допущение. Сериализация будет сосредоточена в одном API helper, чтобы формат можно было изменить в одном месте и одинаково использовать в mock.
4. Бизнес-требование говорит об одном или нескольких авторах, но у `author_ids` нет `minItems: 1`. UI валидирует минимум одного автора согласно заданию; mock также возвращает `422` для пустого массива. Это намеренно более конкретное бизнес-правило, которого не хватает в схеме.
5. `description` и `isbn` существуют, но не обязательны в `BookForm`; ограничений длины и формата ISBN нет. UI не должен изобретать строгий ISBN-алгоритм или объявлять эти поля обязательными. Будущие trim и базовые проверки могут быть только UX-политикой, явно отделённой от OpenAPI и не представленной как backend requirement.
6. Для `year` указан только integer: нет min/max. Любая будущая дополнительная client-side проверка диапазона является UX-политикой, должна быть легко изменяемой и не подменяет backend validation.
7. Для cover отсутствуют допустимые MIME types и максимальный размер. Будущая проверка типа/размера и preview являются UX-политикой, а не частью production API-контракта; конкретные значения должны быть явно помечены как frontend defaults.
8. `cover_url` может быть абсолютным или относительным — это не определено. Нормализация URL должна находиться в одном adapter/helper; произвольно добавлять API prefix в компонентах нельзя. При недоступной обложке показывается локальный fallback с осмысленным alt.
9. Все свойства response-схем формально optional. UI использует defensive defaults и controlled error state для структурно некорректного ответа, но не маскирует несовместимый контракт пустым успешным экраном.

### 4.4. Списки и отчёт

1. Query-параметр API называется `per-page`, тогда как ответ содержит `per_page`. UI использует фиксированный размер страницы, а API adapter явно преобразует внутренний `perPage` в точное имя `per-page`.
2. Не определены пределы `page`, `per-page`, year и search, а также порядок сортировки. UI валидирует положительные page/per-page и integer year, но не добавляет недоступные sort-параметры.
3. Список авторов пагинирован. Нельзя загрузить «всех авторов» одним недокументированным большим `per-page`. Фильтр каталога и выбор авторов в форме должны поддерживать серверный search/pagination либо дозагрузку через документированные параметры.
4. Отчёт требует year и возвращает готовый `rank`. Frontend не запрашивает отчёт, пока year невалиден, не пересчитывает rank и не предполагает ровно 10 строк, если backend вернул меньше.
5. Удаление автора, у которого есть книги, не описывает `409` или правило каскада. UI показывает generic normalized error и не обещает каскадное удаление. Специальный сценарий появится только после расширения контракта.
6. Для list GET не описаны error responses. Network/5xx/неожиданный payload всё равно отображаются единообразно с retry, но mock не должен приписывать контракту новые бизнес-ошибки.

## 5. Routing

| Route                  | View                   | Доступ/поведение                                                                     |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| `/`                    | redirect на `/books`   | Публично                                                                             |
| `/books`               | `BooksCatalogView`     | Публично; query: `search`, `year`, `author_id`, `page`                               |
| `/books/new`           | `BookCreateView`       | `requiresAuth`; redirect на login с сохранением исходного URL                        |
| `/books/:id`           | `BookDetailsView`      | Публично; числовой id проверяется до запроса                                         |
| `/books/:id/edit`      | `BookEditView`         | `requiresAuth`; числовой id проверяется до запроса                                   |
| `/authors`             | `AuthorsListView`      | Публично; query: `search`, `page`                                                    |
| `/authors/new`         | `AuthorCreateView`     | `requiresAuth`                                                                       |
| `/authors/:id`         | `AuthorDetailsView`    | Публично; содержит demo subscription form только при feature flag                    |
| `/authors/:id/edit`    | `AuthorEditView`       | `requiresAuth`                                                                       |
| `/reports/top-authors` | `TopAuthorsReportView` | Публично; `year` синхронизирован с query и запрос выполняется только после валидации |
| `/login`               | `LoginView`            | Публично; действующая сессия ведёт на безопасный `redirect` или `/books`             |
| `/:pathMatch(.*)*`     | `NotFoundView`         | Публично, понятные ссылки назад                                                      |

Порядок объявления статических routes (`/new`) должен исключать их интерпретацию как `:id`. Guard проверяет завершённую hydration auth store и `expires_at`. Скрытие кнопок в UI — только удобство; оно не заменяет проверку backend.

## 6. Предлагаемая структура проекта

```text
.
├─ docs/
│  ├─ implementation-plan.md
│  └─ subscriptions-api.md
├─ public/
│  └─ mock-covers/
├─ src/
│  ├─ api/
│  │  ├─ http.js
│  │  ├─ auth.api.js
│  │  ├─ books.api.js
│  │  ├─ authors.api.js
│  │  ├─ reports.api.js
│  │  ├─ errors.js
│  │  ├─ bookFormData.js
│  │  └─ mediaUrl.js
│  ├─ stores/
│  │  └─ auth.js
│  ├─ router/
│  │  ├─ index.js
│  │  └─ guards.js
│  ├─ views/
│  │  ├─ auth/LoginView.vue
│  │  ├─ books/BooksCatalogView.vue
│  │  ├─ books/BookDetailsView.vue
│  │  ├─ books/BookCreateView.vue
│  │  ├─ books/BookEditView.vue
│  │  ├─ authors/AuthorsListView.vue
│  │  ├─ authors/AuthorDetailsView.vue
│  │  ├─ authors/AuthorCreateView.vue
│  │  ├─ authors/AuthorEditView.vue
│  │  ├─ reports/TopAuthorsReportView.vue
│  │  └─ NotFoundView.vue
│  ├─ components/
│  │  ├─ layout/AppHeader.vue
│  │  ├─ common/AsyncState.vue
│  │  ├─ common/ApiErrorAlert.vue
│  │  ├─ common/AppPagination.vue
│  │  ├─ common/ConfirmDialog.vue
│  │  ├─ books/BookCard.vue
│  │  ├─ books/BookFilters.vue
│  │  ├─ books/BookForm.vue
│  │  ├─ books/CoverInput.vue
│  │  ├─ authors/AuthorForm.vue
│  │  ├─ authors/AuthorPicker.vue
│  │  └─ demo/AuthorSubscriptionForm.vue
│  ├─ composables/
│  │  ├─ useRequestState.js
│  │  ├─ useRouteQuery.js
│  │  ├─ useBackendErrors.js
│  │  └─ useCoverPreview.js
│  ├─ demo/
│  │  ├─ subscriptions.api.js
│  │  └─ bookCreatedEvent.js
│  ├─ mocks/
│  │  ├─ browser.js
│  │  ├─ handlers.js
│  │  ├─ db.js
│  │  └─ fixtures.js
│  ├─ styles/
│  │  ├─ main.scss
│  │  ├─ _variables.scss
│  │  └─ _accessibility.scss
│  ├─ App.vue
│  └─ main.js
├─ dev-server/
│  └─ sms-demo/
│     ├─ middleware.js
│     ├─ repository.js
│     ├─ smspilotAdapter.js
│     └─ validation.js
├─ tests/
│  ├─ setup.js
│  ├─ unit/
│  └─ components/
├─ .env.example
├─ eslint.config.js
├─ vite.config.js
└─ package.json
```

`views` координируют загрузку и navigation, переиспользуемые компоненты отвечают за представление/ввод, `api` знает исходный `/api/v1` contract, а `demo`/`dev-server` знают только bonus-flow. Не нужен отдельный repository/domain/service слой поверх каждого API-файла. Серверные списки книг и авторов по умолчанию живут в состоянии соответствующего view/composable; глобальный store для них добавляется только при доказанной необходимости кэширования.

## 7. Data flow

### 7.1. Запуск приложения и mock mode

1. `main.js` читает `VITE_USE_MOCK_API` строгим сравнением со строкой `true`.
2. Если mock включён, динамически импортируется и запускается MSW worker; Vue монтируется только после готовности worker, чтобы первый запрос не ушёл в сеть.
3. Создаётся Pinia, auth store синхронно/детерминированно восстанавливает сохранённую сессию и отбрасывает повреждённую или истёкшую.
4. Router guard получает уже инициализированное состояние и разрешает маршрут либо ведёт на login.

Client env variables:

- `VITE_API_BASE_URL=/api/v1`;
- `VITE_USE_MOCK_API=true|false`;

Server-only переменная demo adapter — `SMSPILOT_API_KEY` без префикса `VITE_`. Она читается только Vite middleware в `dev:demo` и не попадает в `import.meta.env` browser bundle.

### 7.2. HTTP и auth

1. Единый Axios instance получает base URL из env.
2. Request interceptor читает актуальный token из auth store; store проверяет локальный expiry, после чего interceptor добавляет `Authorization: Bearer ...`.
3. Response interceptor на `401` очищает сессию; login route исключён из redirect cycle, а остальные routes получают безопасный internal redirect.
4. `403` остаётся прикладной ошибкой текущей операции. Общая error infrastructure разбирает `errors[]` в field map и form-level messages, а book-specific mapper задаёт только список поддерживаемых полей.
5. API adapters возвращают полезный `data` после минимальной проверки envelope. Компоненты не разбирают Axios response и не знают base URL.

Состояние auth store: `token`, `user`, `expiresAt`; getter `isAuthenticated`; actions `login`, `restoreSession`, `logout`. В persisted value сохраняются только данные сессии, не ошибки формы и не transient loading.

### 7.3. Каталог и URL query

1. Route query является каноническим состоянием `search/year/author_id/page`; размер страницы фиксирован во view и передаётся API adapter отдельно.
2. Composable парсит query в валидные значения, удаляет мусор и применяет defaults без бесконечных replace-навигаций.
3. Search/filter применяются по submit и сбрасывают `page` на 1. Явная навигация по странице обновляет `page`.
4. API adapter мапит внутренний `perPage` в `per-page` и не отправляет пустые параметры.
5. Watch route запускает запрос. Предыдущий Axios request отменяется либо его устаревший результат игнорируется, чтобы медленный ответ не перезаписал более новый фильтр.
6. Response обновляет items и pagination. UI сохраняет фильтры при retry, показывает skeleton/spinner с доступным текстом, отдельные empty/error states и не считает ошибку пустым результатом.

Фильтр автора получает варианты через документированный paginated `GET /authors`; при search запрашивается следующая страница или уточнённый запрос. Выбранный `author_id` сохраняется, даже если соответствующий option ещё не входит в текущую страницу результатов.

### 7.4. Book form

1. Create/Edit view загружает нужные исходные данные и передаёт в один `BookForm` mode и initial values.
2. Form держит draft, touched state, client errors, backend errors, `isSubmitting` и выбранный `File`. Изменение поля очищает только относящуюся к нему backend-ошибку.
3. До submit проверяются title, integer year, минимум один author, а также cover policy. Для edit существующий `cover_url` отображается отдельно от preview нового файла.
4. `isSubmitting` блокирует кнопки и повторное событие submit; визуальный spinner имеет доступный текст.
5. Create вызывает `booksApi.create(toBookFormData(...))`.
6. Edit выбирает метод только по наличию нового `File`: `updatePartial(id, json)` или `replace(id, FormData)`.
7. При `422` нормализованные поля (`author_ids`, индексированные варианты вроде `author_ids.0`, `cover`) привязываются к соответствующим контролам. Неизвестные field names остаются в form-level summary.
8. После успеха выполняется переход на detail созданной/обновлённой книги. В demo mode notification side effect инициируется внутри MSW create handler; его сбой не превращает успешно созданную книгу в ошибку CRUD.

### 7.5. Удаление

1. Кнопка открывает контролируемый confirmation dialog с названием сущности и безопасным initial focus.
2. Во время DELETE confirm/close отключены.
3. `204` приводит к навигации на соответствующий список с уведомлением.
4. `401/403/404` и network errors показываются явно. Optimistic delete не нужен: он усложнит поведение без пользы для тестового задания.

### 7.6. Report

1. Начальное значение берётся из `route.query.year`; пустое/нецелое значение показывает подсказку и не делает запрос.
2. Валидный submit обновляет URL и вызывает `reportsApi.getTopAuthors(year)`.
3. Таблица использует полученные `rank`, `full_name`, `books_count`; имя ведёт на `/authors/{author_id}`.
4. Loading/error/empty разнесены. Ошибка `400` показывается рядом с year/form summary, а не как «нет результатов».

## 8. Mock API

MSW handlers должны повторить операции, request content types, query names, status codes и response envelopes из `book.yaml`:

- login с документированными в будущем README demo credentials, ответом с будущим `expires_at` и ролью `user`;
- Bearer-проверка только на POST/PUT/PATCH/DELETE;
- фильтрация книг по `search/year/author_id`, пагинация по `page/per-page`;
- поиск/пагинация авторов;
- detail и `404`;
- create/update validation и `422 Error`;
- delete и `204`;
- вычисление TOP-10 из текущей in-memory базы по переданному year и `400` при невалидном year.

Mock state нормализован в памяти и сохраняется между reload в отдельном `localStorage`; `resetMockDatabase()` восстанавливает deterministic seed. Upload принимается как multipart, проверяется наличие required parts, а response использует локальный data URL `cover_url`. Нельзя менять frontend-сериализацию только потому, что handler проще обработает другой формат.

Для ручной проверки error state стоит предусмотреть детерминированный development-механизм в fixtures/handlers или тестах, но не добавлять недокументированные query-параметры в production API adapter.

## 9. SMS demo architecture

### 9.1. Изоляция

Bonus включается вместе с `VITE_USE_MOCK_API=true`. В основном namespace `/api/v1` не появляется ни одного нового production route. Подписки и diagnostic log используют отдельный demo storage, а единственный технический endpoint `POST /__demo/sms/send` принадлежит Vite development middleware и принимает только телефон и текст сообщения. Он не экспортируется из `src/api`; production build исключает MSW, subscription UI/storage и SMS bridge.

### 9.2. Demo flow

1. Гость открывает `/authors/:id`, вводит телефон в форме с label, подсказкой о тестовом режиме и согласием на demo-обработку.
2. Demo component нормализует телефон и идемпотентно сохраняет пару `author_id + phone` в отдельном `localStorage`.
3. Авторизованный demo user создаёт книгу через настоящий для frontend `POST /api/v1/books`, перехваченный MSW.
4. После успешного create сам MSW handler запускает независимый notification side effect, не меняющий `201` при ошибке отправки.
5. Demo notification infrastructure находит подписчиков каждого автора, дедуплицирует номера для одной книги и вызывает локальный Vite bridge.
6. Server-side adapter жёстко добавляет `test=1` и `format=json` к запросу SMSPILOT API-1. Результат сохраняется в diagnostic log без ключа, а UI показывает маскированный телефон.
7. Ошибка SMS показывается как отдельная demo diagnostic и не откатывает создание книги.

Ключ SMSPILOT хранится только в env Node/Vite development process без префикса `VITE_`; client получает лишь стабильный результат demo endpoint. Tracked `.env.demo` содержит официальный публичный emulator-only key, но никогда production credential.

### 9.3. Production proposal для `docs/subscriptions-api.md`

Документ должен явно пометить следующий контракт как предложение, которого нет в исходном OpenAPI. Минимальная production-модель:

- создание подписки backend endpoint с нормализованным телефоном, author id, consent timestamp и подтверждением телефона/отпиской;
- хранение персональных данных на backend с политикой retention, rate limiting и защитой от enumeration/abuse;
- после commit создания книги backend публикует надёжное событие `BookCreated`;
- worker/outbox читает событие, находит активные подписки, отправляет SMS server-to-server, делает retry/backoff и idempotency по `book_id + subscription_id`;
- provider key хранится в secret manager/server env, SMS delivery status и audit не передаются в публичный client bundle;
- browser никогда не сообщает backend, что книга «создана», и не вызывает SMSPILOT напрямую.

В документе можно предложить request/response/error schemas для будущего согласования, но не добавлять их в `book.yaml` и не выдавать за существующий backend.

## 10. Validation, UX и доступность

- Все controls имеют видимые `label`, ошибки связаны через `aria-describedby`, invalid state — через `aria-invalid`.
- После неуспешного submit focus перемещается на error summary или первый invalid control; после navigation сохраняется ожидаемое поведение router focus/title.
- Loading-индикаторы имеют текст для screen reader; background updates используют подходящий `aria-live`, без навязчивого озвучивания каждого keystroke.
- Карточки используют semantic article/list markup; таблица отчёта имеет `caption`, `thead`, scope для заголовков и responsive wrapper.
- Интерактивность не завязана на hover; видимый `:focus-visible` не удаляется Bootstrap reset/style overrides.
- Обложки имеют alt по названию книги, декоративный fallback не дублирует соседний текст.
- Layout проверяется минимум на узкой mobile ширине, tablet и desktop; формы не требуют горизонтального scroll.
- Сетевые ошибки дают retry, empty state объясняет влияние фильтров и предлагает их очистить.
- Все object URLs preview освобождаются при смене файла и unmount; активные request cancellation handlers также очищаются.
- В runtime не остаётся `console.error` от Vue warnings, необработанных Promise или accessibility проблем. Служебные demo-логи централизованы и выключены вне demo mode.

## 11. Минимальный набор тестов

Тесты выполняются Vitest + Vue Test Utils; network-level сценарии используют MSW, а не зависят от внешнего backend.

1. **Auth store:** успешная hydration валидной сессии; удаление повреждённой/истёкшей; logout очищает persistence.
2. **HTTP auth behavior:** Bearer добавляется при валидной сессии; защищённый `401` очищает её; login `401` не вызывает redirect loop; `403` не делает logout.
3. **Route guard:** гость перенаправляется с `/books/new` на `/login?redirect=...`, публичные routes доступны, authenticated user возвращается на безопасный internal redirect.
4. **Catalog query:** route query точно преобразуется в `search/year/author_id/page/per-page`; изменение фильтра сбрасывает page; invalid query нормализуется; loading/empty/error различаются.
5. **Book submit strategy:** create формирует multipart; edit без файла вызывает PATCH JSON; edit с файлом вызывает PUT FormData; `author_ids` сериализуются повторяющимися частями с ключом `author_ids[]`.
6. **Book validation:** create требует cover и хотя бы одного автора; отклоняет неподдерживаемый MIME/слишком большой файл; повторный submit заблокирован.
7. **Backend errors:** `422 errors[]` отображаются возле title/year/authors/cover, неизвестное поле попадает в form summary.
8. **Destructive action:** DELETE не вызывается до подтверждения, вызывается один раз после confirm и блокирует dialog на время запроса.
9. **Report:** invalid year не вызывает API; valid year показывает строки с server rank; отдельно проверяются empty и `400`.
10. **Author flow:** публичный detail отображает `BookShort`; защищённая author form отправляет `full_name` и показывает `422`.
11. **SMS demo adapter:** unit test с fake transport доказывает нормализацию/deduplication и вызов только emulator transport; browser test доказывает, что в собранном client-коде нет server key. Этот пункт обязателен, если bonus включён в итоговую реализацию.

Не требуется тестировать внутренности Vue/Bootstrap или делать snapshot каждого компонента. Приоритет — branching logic, контракт запросов, permissions UX и ошибки.

## 12. Последовательные этапы реализации

### Этап 0. Каркас и quality gate

- создать Vite/Vue проект и установить только согласованные зависимости;
- настроить ESLint, Prettier, Vitest, Vue Test Utils, jsdom, SCSS и Bootstrap;
- добавить `.env.example`, npm scripts и базовый test setup;
- убедиться, что пустой каркас проходит `npm run lint`, `npm run test`, `npm run build`.

**Результат:** воспроизводимая база без предметной логики.

### Этап 1. API foundation

- реализовать Axios instance, env base URL, error normalizer и response envelope checks;
- разделить auth/books/authors/reports adapters;
- реализовать единый FormData serializer с изолированным рабочим форматом `author_ids[]`;
- покрыть unit-тестами error mapping и сериализацию.

**Результат:** UI сможет работать с одним строгим представлением исходного контракта.

### Этап 2. MSW contract mock

- добавить fixtures/in-memory db и все 14 handlers;
- реализовать status/envelope/auth/filter/pagination/validation строго по спецификации;
- настроить conditional worker startup и demo credentials;
- написать smoke tests основных handlers.

**Результат:** разработка не зависит от отсутствующего публичного backend URL.

### Этап 3. Shell, routing и auth

- создать App shell/navigation/NotFound;
- реализовать auth store, persistence, expiry, interceptors и guards;
- сделать login UI и состояния `401`/network error;
- проверить keyboard/focus и tests auth/guard.

**Результат:** публичные и защищённые ветки маршрутов работают предсказуемо.

### Этап 4. Публичные книги и авторы

- каталог, filters/query sync, async author selector и пагинация;
- detail книги;
- paginated authors list/search и author detail с его книгами;
- responsive/loading/error/empty states и retry;
- component tests query mapping и states.

**Результат:** весь read-only сценарий гостя, кроме отчёта, завершён.

### Этап 5. Публичный отчёт

- year input/query sync и validation-before-request;
- доступная responsive table и все states;
- tests invalid/valid/empty/error.

**Результат:** публичная часть исходного API полностью покрыта.

### Этап 6. CRUD авторов

- общий AuthorForm для create/edit;
- 422 field errors, submit lock, notifications;
- confirmation/delete/navigation;
- component tests create/edit/delete.

**Результат:** защищённый CRUD авторов завершён.

### Этап 7. CRUD книг

- BookForm, paginated/searchable AuthorPicker, CoverInput и preview cleanup;
- POST/PATCH/PUT branching и точная сериализация;
- 422 mapping, submit lock, confirmation/delete;
- focused tests для трёх submit branches и файлов.

**Результат:** функциональность авторизованного пользователя завершена по OpenAPI.

### Этап 8. Изолированный SMS bonus

- сначала создать `docs/subscriptions-api.md` с границами и production proposal;
- добавить feature flags, client demo wrappers и dev middleware;
- подключить только SMSPILOT emulator/test transport server-side;
- добавить persisted demo subscription flow, post-create MSW notification и tests с fake transport;
- проверить отсутствие ключа в production client bundle.

**Результат:** бонус демонстрируется, не меняя и не подменяя исходный API.

### Этап 9. Финальная проверка и README

- пройти ручные guest/auth/mobile/keyboard/error сценарии;
- удалить dead code и все предупреждения console;
- проверить production build с mock/SMS выключенными и demo build с ними включёнными;
- заполнить README: запуск, env, demo credentials, архитектура, matrix соответствия, mock mode, SMS demo, отсутствие subscription endpoints и production changes;
- выполнить финально `npm run lint`, `npm run test`, `npm run build`.

**Результат:** Definition of Done подтверждён командами и документацией.

## 13. Зафиксированные допущения

Разработка не останавливается ради уточнений, отсутствующих в исходном задании. До появления дополнительного согласованного контракта действуют следующие решения:

1. `book.yaml` остаётся единственным source of truth для production API и не расширяется frontend-командой.
2. Multipart-массив `author_ids` отправляется в Yii2/PHP-совместимом виде `author_ids[]`; serializer находится только в API layer.
3. Ограничения cover/year/ISBN, которых нет в OpenAPI, не объявляются backend requirements. Возможная client-side UX-валидация документируется отдельно и не противоречит серверным ошибкам.
4. Auth в будущем использует только `/auth/login` и client-side storage/lifecycle. `/auth/me`, refresh и logout endpoints не придумываются.
5. Subscription/SMS остаётся отдельным demo-extension и не включается в production API.

Неопределённые детали вроде абсолютности `cover_url` или поведения удаления автора с книгами обрабатываются defensive UI и общими ошибками, но не блокируют последовательные этапы реализации.

## 14. Definition of Done для будущей реализации

- Все публичные и защищённые сценарии из matrix работают через исходные операции `/api/v1`.
- Ни одного HTTP-запроса нет непосредственно в presentation-компонентах.
- Сессия восстанавливается, expiry/401/403 и guards ведут себя согласно разделу 7.
- POST/PUT/PATCH книг используют правильные content types и cover strategy.
- 422 отображается у полей; submit/delete защищены от повтора; удаление требует подтверждения.
- Фильтры каталога и отчёт воспроизводимы по URL.
- Mock mode отключаем и контрактно совместим; приложение может работать с реальным base URL без изменения компонентов.
- SMS demo выключаем, отделён от `/api/v1`, использует только server-side emulator adapter, а production gap задокументирован.
- Нет console errors, dead code и недоступных только мышью действий.
- README содержит все девять требуемых разделов.
- `npm run lint`, `npm run test`, `npm run build` завершаются успешно.
