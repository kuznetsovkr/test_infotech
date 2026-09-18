import { ref } from 'vue'

import { getAuthors } from '../api/authors.api'
import { isRequestCanceled } from '../api/errors'
import { useLatestRequest } from './useLatestRequest'

export function useAuthorSearch({ pageSize = 10 } = {}) {
  const latestRequest = useLatestRequest()
  const searchInput = ref('')
  const results = ref([])
  const pagination = ref({ page: 1, totalPages: 0 })
  const isSearching = ref(false)
  const searchError = ref('')
  const hasSearched = ref(false)

  async function searchAuthors(page = 1) {
    const request = latestRequest.begin()
    isSearching.value = true
    searchError.value = ''
    hasSearched.value = true

    try {
      const response = await getAuthors({
        page,
        perPage: pageSize,
        search: searchInput.value,
        signal: request.signal,
      })

      if (request.isLatest()) {
        results.value = response.items
        pagination.value = response.pagination
      }
    } catch (error) {
      if (request.isLatest() && !isRequestCanceled(error)) {
        results.value = []
        searchError.value = 'Не удалось загрузить авторов. Повторите попытку.'
      }
    } finally {
      if (request.isLatest()) {
        isSearching.value = false
      }
    }
  }

  function resetSearchResults() {
    latestRequest.cancel()
    results.value = []
    hasSearched.value = false
    searchError.value = ''
  }

  return {
    hasSearched,
    isSearching,
    pagination,
    resetSearchResults,
    results,
    searchAuthors,
    searchError,
    searchInput,
  }
}
