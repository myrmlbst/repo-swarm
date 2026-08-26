# Design conventions — web/

This is the baseline the frontend-design skill audits new and existing screens against. It's derived from what's already implemented in `web/src` (login page, dashboard, submit form, analyses list) — treat it as the source of truth, and update it deliberately when a change is a conscious design decision rather than drift.

## Color

Tailwind's default palette, no custom tokens.

| Role | Classes |
|---|---|
| Page background | `bg-gray-50` (auth screens) or `bg-white`/default (dashboard) |
| Card/container surface | `bg-white` with `border border-gray-200` |
| Primary action | `bg-blue-600` bg, `hover:bg-blue-500`, white text |
| Primary dark action (GitHub OAuth button) | `bg-gray-900` bg, `hover:bg-gray-800`, white text |
| Heading text | `text-gray-900` |
| Secondary/muted text | `text-gray-500` |
| Form labels | `text-gray-700` |
| Borders / inputs | `border-gray-300` |
| Error text | `text-red-600` |
| Status badges | see table below |

Status badge colors (`AnalysesList`'s `STATUS_STYLES`) — reuse this mapping for any new status-like indicator, don't invent new colors per status:

| Status | Classes |
|---|---|
| `queued` | `bg-gray-100 text-gray-700` |
| `running` | `bg-blue-100 text-blue-700` |
| `complete` | `bg-green-100 text-green-700` |
| `failed` | `bg-red-100 text-red-700` |

Any new color pairing must meet WCAG AA contrast (4.5:1 body text, 3:1 large text/UI) — the accessibility-review skill's axe scan catches violations, but check by eye too since axe only sees rendered states it's told to visit.

## Typography

No custom font — system stack from Tailwind's default `font-sans`.

| Use | Classes |
|---|---|
| Page/section title (e.g. "Your repos", login heading) | `text-xl font-semibold` |
| Body text, form inputs, buttons | `text-sm` |
| Secondary/meta text (email under heading) | `text-sm text-gray-500` |
| Status badge text | `text-xs font-medium` |

## Spacing

Tailwind's default scale (4px increments). Observed conventions:

- Page container padding: `px-6 py-12` (dashboard), centered card `p-8` (login)
- Vertical rhythm between sections: `space-y-6` or `space-y-8`
- Vertical rhythm within a form: `space-y-4`
- Inline control gaps (input + button row): `gap-2`
- List items: `px-4 py-3` inside a `divide-y divide-gray-200` container

## Layout

- Auth screens (`/login`): centered card, `max-w-sm`, vertically and horizontally centered in the viewport (`flex min-h-screen items-center justify-center`)
- Dashboard (`/`): single column, `max-w-2xl mx-auto`, not a sidebar/multi-column layout — don't introduce one without discussing it first, the product surface is intentionally small right now
- No responsive breakpoint variants exist yet (no `sm:`/`md:`/`lg:` prefixes in the current components) — the mobile screenshot from `screenshot-pages.mjs` is what tells you whether one is needed. A `max-w-*` container that doesn't clip or overflow at 375px wide usually doesn't need one; if text wraps badly or the submit-row overflows, add breakpoint-specific classes rather than redesigning the layout.

## Components

- **Buttons**: `rounded-md px-4 py-2 text-sm font-medium`, plus a color pairing from the table above. Disabled state: `disabled:opacity-50`.
- **Inputs**: `rounded-md border border-gray-300 px-3 py-2 text-sm`.
- **Cards/containers**: `rounded-md` or `rounded-lg` (login card), `border border-gray-200`.
- **Status badges**: `rounded-full px-2 py-0.5 text-xs font-medium` + color pairing.

## What "consistent" means for this audit

When reviewing a screenshot, check for:
1. Any element that doesn't match a token above (an off-scale font size, a color not in the tables, inconsistent border-radius).
2. Misaligned or uneven spacing between visually-similar elements (e.g. two buttons with different padding).
3. Missing hover/disabled/focus states on interactive elements that have them elsewhere in the app.
4. Layout breakage at the mobile viewport (375px) — overflow, clipped text, elements running off-screen.

Fix by reusing an existing token/pattern first. Only introduce a new one if nothing in this doc fits, and if so, add it here as part of the same change.
