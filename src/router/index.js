import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import AccountView from '../views/AccountView.vue'
import AuthorDetailsView from '../views/AuthorDetailsView.vue'
import AuthorsListView from '../views/AuthorsListView.vue'
import BookDetailsView from '../views/BookDetailsView.vue'
import BooksListView from '../views/BooksListView.vue'
import LoginView from '../views/LoginView.vue'
import { resolvePostLoginRedirect } from './redirect'

const routes = [
  {
    path: '/',
    redirect: { name: 'books' },
  },
  {
    path: '/books',
    name: 'books',
    component: BooksListView,
  },
  {
    path: '/books/:id',
    name: 'book-details',
    component: BookDetailsView,
  },
  {
    path: '/authors',
    name: 'authors',
    component: AuthorsListView,
  },
  {
    path: '/authors/:id',
    name: 'author-details',
    component: AuthorDetailsView,
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/account',
    name: 'account',
    component: AccountView,
    meta: {
      requiresAuth: true,
    },
  },
]

export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
  return createRouter({
    history,
    routes,
  })
}

export function registerAuthGuards(router, pinia) {
  router.beforeEach((to) => {
    const authStore = useAuthStore(pinia)

    if (!authStore.isAuthenticated && (authStore.token || authStore.expiresAt || authStore.user)) {
      authStore.logout()
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return {
        name: 'login',
        query: {
          redirect: to.fullPath,
        },
      }
    }

    if (to.name === 'login' && authStore.isAuthenticated) {
      return resolvePostLoginRedirect(router, to.query.redirect)
    }

    return true
  })
}

export function handleUnauthorized(router, authStore) {
  const isLoginRoute = router.currentRoute.value.name === 'login'
  const redirect = router.currentRoute.value.fullPath

  authStore.logout()

  if (isLoginRoute) {
    return null
  }

  return router.replace({
    name: 'login',
    query: {
      redirect,
    },
  })
}

const router = createAppRouter()

export default router
