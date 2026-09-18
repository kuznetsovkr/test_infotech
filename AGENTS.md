# Project

Frontend test assignment for a book catalog.

Source of truth for backend API:

* `book.yaml`

Implementation plan:

* `docs/implementation-plan.md`

Production subscription proposal:

* `docs/subscriptions-api.md`

# Stack

Use:

* Vue 3
* Vite
* JavaScript
* Vue Router
* Pinia
* Axios
* Bootstrap 5
* SCSS
* Vitest
* Vue Test Utils

Do not introduce Nuxt, TypeScript, jQuery, another UI framework, or a new state-management library unless required by an existing project constraint.

# API rules

`book.yaml` is authoritative.

Do not invent undocumented production API endpoints.

Keep HTTP calls inside `src/api` or appropriate service modules.

API base URL must come from environment configuration.

Preserve backend response shapes instead of silently changing them in mocks.

# Auth

Authenticated requests use Bearer JWT.

Protected UI routes must use router metadata/guards.

Handle expired sessions and 401 responses consistently.

Do not treat hidden frontend controls as authorization.

# Books

Creation uses multipart/form-data.

For editing:

* without a new cover, prefer PATCH with JSON;
* with a new cover, use PUT with complete multipart/form-data.

Keep multipart serialization in the API layer.

# Errors

Provide meaningful:

* loading;
* empty;
* 400;
* 401;
* 403;
* 404;
* 422;
* generic network error states.

Map 422 field validation errors to form controls when possible.

# SMS / subscriptions

Subscription endpoints are missing from the provided OpenAPI.

Keep subscription/SMS functionality isolated as demo functionality.

Do not present mock/demo APIs as part of the supplied production contract.

Real SMS credentials must never be bundled into production frontend code.

Document the production architecture in `docs/subscriptions-api.md`.

# Code quality

Prefer small focused components.

Avoid unnecessary abstractions.

Do not duplicate request/error/loading logic unnecessarily.

Do not leave dead code or commented-out experiments.

Use semantic HTML and accessible labels/buttons.

# Verification

Before considering a task complete, run the relevant checks.

Before final completion run:

npm run lint
npm run test
npm run build

Fix failures instead of merely documenting them.

After each substantial task, inspect `git diff` for unintended changes.
