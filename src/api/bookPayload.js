export function createBookInput({ title, year, description, isbn, author_ids }) {
  return {
    title,
    year,
    description,
    isbn,
    author_ids: [...author_ids],
  }
}

export function createBookFormData(book) {
  const payload = createBookInput(book)
  const formData = new FormData()

  formData.append('title', payload.title)
  formData.append('year', String(payload.year))
  formData.append('description', payload.description)
  formData.append('isbn', payload.isbn)

  payload.author_ids.forEach((authorId) => {
    formData.append('author_ids[]', String(authorId))
  })

  formData.append('cover', book.cover)

  return formData
}
