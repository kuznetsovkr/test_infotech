export const DEMO_CREDENTIALS = Object.freeze({
  username: 'demo',
  password: 'demo',
})

export const DEMO_TOKEN = 'infotech-demo-access-token'

const AUTHOR_NAMES = [
  'Алексей Воронцов',
  'Марина Белова',
  'Илья Соколов',
  'Елена Миронова',
  'Дмитрий Орлов',
  'Анна Крылова',
  'Сергей Лебедев',
  'Ольга Фёдорова',
  'Николай Волков',
  'Ирина Павлова',
  'Максим Новиков',
  'Татьяна Морозова',
  'Виктор Козлов',
  'Светлана Макарова',
  'Андрей Виноградов',
  'Наталья Семёнова',
  'Роман Богданов',
  'Юлия Зайцева',
  'Павел Комаров',
  'Вера Тихонова',
  'Константин Громов',
  'Лариса Егорова',
  'Михаил Ковалёв',
  'Дарья Мельникова',
]

const BOOK_TOPICS = [
  'Vue на практике',
  'Современный JavaScript',
  'Доступный веб',
  'Архитектура интерфейсов',
  'Чистые компоненты',
  'Проектирование API',
  'Тестирование приложений',
  'Веб без границ',
  'Истории о данных',
  'Надёжный frontend',
  'Интерфейсы для людей',
  'Путеводитель по браузеру',
]

function createSeedCover(bookNumber) {
  const hue = (bookNumber * 37) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520"><rect width="360" height="520" fill="hsl(${hue} 55% 38%)"/><rect x="28" y="28" width="304" height="464" rx="12" fill="none" stroke="white" stroke-opacity=".55" stroke-width="3"/><text x="180" y="228" text-anchor="middle" fill="white" font-family="sans-serif" font-size="27">DEMO BOOK</text><text x="180" y="286" text-anchor="middle" fill="white" font-family="sans-serif" font-size="54">${bookNumber}</text></svg>`

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function createSeedBooks() {
  return Array.from({ length: 36 }, (_, index) => {
    const id = index + 1
    const primaryAuthorId = (index % AUTHOR_NAMES.length) + 1
    const secondaryAuthorId = ((index + 7) % AUTHOR_NAMES.length) + 1
    const authorIds = [primaryAuthorId, secondaryAuthorId]

    if (id % 5 === 0) {
      authorIds.push(((index + 13) % AUTHOR_NAMES.length) + 1)
    }

    return {
      id,
      title: `${BOOK_TOPICS[index % BOOK_TOPICS.length]} — том ${Math.floor(index / 12) + 1}`,
      year: 2023 + (index % 3),
      description: `Демонстрационная книга №${id} для проверки каталога, фильтров и отчёта.`,
      isbn: `978-5-000${String(id).padStart(4, '0')}`,
      cover_url: createSeedCover(id),
      author_ids: [...new Set(authorIds)],
    }
  })
}

export function createSeedState() {
  return {
    authors: AUTHOR_NAMES.map((fullName, index) => ({
      id: index + 1,
      full_name: fullName,
    })),
    books: createSeedBooks(),
    nextAuthorId: AUTHOR_NAMES.length + 1,
    nextBookId: 37,
  }
}

export const SEED_AUTHOR_COUNT = AUTHOR_NAMES.length
export const SEED_BOOK_COUNT = 36
