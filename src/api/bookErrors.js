import { mapApiFieldErrors } from './errors'

const BOOK_FORM_FIELDS = ['title', 'year', 'description', 'isbn', 'author_ids', 'cover']

export function mapBookValidationErrors(error) {
  const result = mapApiFieldErrors(error, BOOK_FORM_FIELDS)

  if (!result.formError && Object.keys(result.fieldErrors).length === 0) {
    result.formError = 'Проверьте введённые данные.'
  }

  return result
}
