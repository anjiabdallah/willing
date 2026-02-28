# AGENTS.md

This file gives coding agents project-specific instructions for working in this repository.

## Project Overview

Willing is a full-stack TypeScript app:

- `client/`: React + Vite + React Router + Tailwind + DaisyUI
- `server/`: Express + Kysely + PostgreSQL + Zod

The server runs DB migrations automatically on startup in development mode.

## Repository Map

- `client/src/main.tsx`: route tree and page wiring
- `client/src/auth/*`: auth context, guards, user hooks
- `client/src/utils/requestServer.ts`: shared HTTP helper (includes JWT support)
- `client/src/utils/formUtils.tsx`: reusable form components (`FormField`, `FormRootError`, helpers)
- `client/src/schemas/auth.ts`: client-side form schemas

- `server/src/api/index.ts`: API router mounting (`/user`, `/admin`, `/organization`, `/volunteer`)
- `server/src/api/authorization.ts`: JWT parsing + role guard middleware
- `server/src/api/routes/**`: domain route handlers
- `server/src/db/tables.ts`: canonical Zod schemas + TS types for DB entities
- `server/src/db/migrations/*`: ordered SQL schema evolution
- `server/src/scripts/seed.ts`: dev seed data

## Setup and Run Commands

Run from repository root unless noted.

### Database

```bash
cd server
docker compose up -d
```

If `npm start` fails with migration `AggregateError`, check Postgres is listening on `5432`.

### Server

```bash
cd server
npm install
npm start
```

Useful server scripts:

- `npm run dev` (nodemon)
- `npm run migrate`
- `npm run seed`
- `npm run create-admin`
- `npm run lint`

### Client

```bash
cd client
npm install
npm start
```

Useful client scripts:

- `npm run build`
- `npm run lint`

## Core Engineering Rules

1. Reuse canonical schemas and types from `server/src/db/tables.ts`.
2. Do not recreate table schemas manually in route files or forms if reusable schema composition works.
3. Prefer schema composition (`omit`, `pick`, `extend`, `partial`) over duplicating validation logic.
4. For protected client API calls, use `requestServer(path, options, true)`.
5. Do not hardcode user IDs. Use auth context on client and `req.userJWT!.id` on server.
6. Keep response and payload shapes consistent across client and server.
7. Keep changes minimal and targeted; avoid unrelated refactors.

## Form and UI Conventions

1. Prefer `react-hook-form` + `zodResolver` for editable forms.
2. Use reusable form primitives from `client/src/utils/formUtils.tsx` when possible.
3. Keep existing DaisyUI/Tailwind visual language unless explicitly asked to redesign.
4. Handle loading, error, and success states explicitly.

## Reusable Components

All components are in `client/src/components/`. **Use these instead of recreating similar logic.**

### Layout & Navigation

- **`ColumnLayout`**: Responsive column layout with a sidebar and main content. Sidebar can be made sticky via `stickySidebar` prop (prefer true for most pages). Use for pages with side panels.
- **`Navbar`**: Standard top navbar with logo on left, optional `center` and `right` content slots. Sticky positioned. Use for all page headers.
- **`Footer`**: Standard footer with company info, contact email, and GitHub link. Use at bottom of main pages.

### Display Components

- **`Loading`**: DaisyUI loading spinner with configurable size (`xs`, `sm`, `md`, `lg`, `xl`). Use for loading states in buttons and pages.
- **`PostingCard`**: Display card for volunteer opportunity postings. Shows title, description, location, start/end dates, max volunteers, minimum age, and required skills. Accepts optional `footer` ReactNode for action buttons. Use for listing volunteer postings.
- **`SkillsList`**: Display skills as colored badges. Supports expandable view when more than `limit` skills (default 5). Can accept optional `action` render prop for per-skill actions (e.g., remove button). Use `enableLimit={false}` to show all skills.

### Form Components

- **`PasswordResetCard`**: Complete password reset form with current/new/confirm password fields. Integrates with `AuthContext`. Handles validation and success/error states. Use in settings pages.
- **`SkillsInput`**: Input field with add button for building a skill list. Supports Enter key to add. Displays current skills using `SkillsList` with remove buttons. Controlled via `skills` and `setSkills` props.
- **`ToggleButton`**: Form-integrated toggle button group for react-hook-form. Supports two modes:
  - **Compact mode** (`compact={true}`): Horizontal joined buttons, minimal styling
  - **Full mode** (default): Larger cards with icons and descriptions
  - Each option can have `value`, `label`, `description`, `Icon`, and `btnColor` properties
  - Automatically integrates with form state via `form` and `name` props

### Interactive Components

- **`LocationPicker`**: Interactive map with Leaflet and React-Leaflet for selecting geographic locations. Features:
  - Draggable marker for precise positioning
  - Search bar with geocoding (limited to Lebanon)
  - Click-to-place marker (when not `readOnly`)
  - Custom zoom controls
  - Dark theme support
  - Accepts `position` ([lat, lng]), `setPosition` callback, and optional `readOnly` flag
  - The `setPosition` callback receives optional `name` parameter when location selected via search

## Backend Conventions

1. Route modules should live under `server/src/api/routes/<domain>/`.
2. Enforce auth with `authorizeOnly(...)` where needed.
3. Validate request bodies with Zod before DB operations.
4. Keep DB operations typed via Kysely and shared table types.

## Migration Rules

1. Never modify old migrations that have likely been applied.
2. Add a new numbered migration file for schema changes (continue sequence in `server/src/db/migrations/`).
3. When adding/removing DB fields:
   - Update migration(s)
   - Update `server/src/db/tables.ts`
   - Update affected insert paths (e.g., signup flows, seed scripts)
4. Verify migration success locally after DB is running.

## Verification Checklist

Before finishing code changes:

1. Client type/build check:
   ```bash
   cd client && npm run type:check && npm run lint:check
   ```
2. Server type check:
   ```bash
   cd server && npm run type:check && npm run lint:check
   ```
3. If backend behavior changed, run server and validate endpoint flow manually.
4. If DB-dependent checks fail due to DB down, state it explicitly and include the exact command needed.

## Notes for Agents

AGENTS.md files may exist at multiple levels. The most specific one in the directory tree takes precedence for files under its scope.
