<script setup>
import BookCover from './BookCover.vue'

defineProps({
  book: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <article class="card h-100 border-0 shadow-sm" data-testid="book-card">
    <BookCover :src="book.cover_url" :title="book.title" />
    <div class="card-body d-flex flex-column">
      <h2 class="h5 card-title">
        <RouterLink v-if="Number.isInteger(book.id)" :to="`/books/${book.id}`">
          {{ book.title || 'Название не указано' }}
        </RouterLink>
        <span v-else>{{ book.title || 'Название не указано' }}</span>
      </h2>

      <p class="card-text text-body-secondary mb-2">
        {{ Number.isInteger(book.year) ? book.year : 'Год не указан' }}
      </p>

      <ul v-if="Array.isArray(book.authors) && book.authors.length" class="list-inline mb-2">
        <li
          v-for="author in book.authors"
          :key="author.id ?? author.full_name"
          class="list-inline-item"
        >
          <RouterLink v-if="Number.isInteger(author.id)" :to="`/authors/${author.id}`">
            {{ author.full_name || 'Имя автора не указано' }}
          </RouterLink>
          <span v-else>{{ author.full_name || 'Имя автора не указано' }}</span>
        </li>
      </ul>

      <p v-if="book.isbn" class="card-text small mt-auto mb-0">ISBN: {{ book.isbn }}</p>
    </div>
  </article>
</template>
