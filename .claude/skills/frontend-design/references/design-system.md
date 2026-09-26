# Design conventions — web/

This is the baseline the frontend-design skill audits new and existing screens against. It's derived from what's implemented in `web/src` (login page, dashboard header/hero, submit form, analyses list and its expanded result panel) — treat it as the source of truth, and update it deliberately when a change is a conscious design decision rather than drift.

## Color

Tailwind's default palette, no custom tokens.

| Role | Classes |
|---|---|
| App page background | `bg-gray-50` (set once on `<body>` in `layout.tsx`); cards sit on it as `bg-white` |
| Card/container surface | `bg-white` with `border border-gray-200` and `shadow-sm` |
| Nested surface inside an expanded card | `bg-gray-50/70` panel, white inner cards |
| Primary action | `bg-blue-700` bg, `hover:bg-blue-600`, `active:bg-blue-800`, white text |
| Primary dark action (GitHub OAuth button) | `bg-gray-900` bg, `hover:bg-gray-800`, `active:bg-black`, white text |
| Secondary action (Copy report, Sign out, Download as PDF) | `bg-white border-gray-300 text-gray-700`, `hover:bg-gray-50`, `active:bg-gray-100` |
| Brand gradient (login brand panel only) | `bg-linear-to-br from-blue-700 via-blue-800 to-indigo-900`. Text on the panel: `text-white` or `text-blue-100` (min `text-blue-200` at `text-xs`) |
| Heading text | `text-gray-900` |
| Body / secondary text | `text-gray-600` (never lighter for text — `gray-500` is only for decorative icons and borders) |
| Form labels | `text-gray-800`; card titles `text-gray-900` |
| Borders / inputs | `border-gray-300` (inputs), `border-gray-200` (cards, dividers) |
| Error text / callout | text `text-red-700` (inline) or `border-red-200 bg-red-50 text-red-800` (block) |
| Success callout | `border-green-200 bg-green-50 text-green-800` |

Status badge colors (`StatusBadge.tsx`) — reuse this mapping for any new status-like indicator, don't invent new colors per status:

| Status | Classes | Marker |
|---|---|---|
| `queued` | `bg-gray-100 text-gray-800` | grey dot |
| `running` | `bg-blue-100 text-blue-800` | pulsing blue dot |
| `complete` | `bg-green-100 text-green-800` | check icon |
| `failed` | `bg-red-100 text-red-800` | x icon |

Finding severity (`FindingsList.tsx`) — same rule, one mapping:

| Severity | Badge | Card left accent | Icon |
|---|---|---|---|
| `critical` | `bg-red-100 text-red-800` | `border-l-red-500` | alert-circle |
| `warn` | `bg-amber-100 text-amber-900` | `border-l-amber-500` | alert-triangle |
| `info` | `bg-sky-100 text-sky-900` | `border-l-sky-400` | info |

Any new color pairing must meet WCAG AA contrast (4.5:1 body text, 3:1 large text/UI). axe can't judge text over gradients or translucent layers (it reports them as "incomplete"), so measure those by hand — the login brand panel was checked by sampling rendered pixels (lowest ratio 5.03:1).

## Typography

No custom font — system stack from Tailwind's default `font-sans`, `antialiased` on `<body>`.

| Use | Classes |
|---|---|
| Page title (`h1`) | `text-2xl sm:text-3xl font-semibold tracking-tight` |
| Section title (`h2`, e.g. "Your analyses") | `text-lg font-semibold tracking-tight` |
| Card sub-section title (`h3`: Proposal, Findings, Usage & cost) | `text-sm font-semibold text-gray-900` |
| Lead paragraph under the page title | `text-base leading-relaxed text-gray-600` |
| Body text, form inputs, buttons | `text-sm` |
| Meta text (submitted time, hints, table headers) | `text-xs`/`text-sm` + `text-gray-600` |
| Status/severity badge text | `text-xs font-medium` |
| Numbers in tables and stat tiles | add `tabular-nums` |
| File paths and code | `font-mono text-xs` on `bg-gray-100 rounded-md` |

Agent-written Markdown is rendered by `MarkdownProposal`, which styles elements to the sizes above. Its `headingOffset` prop shifts the *tag* (not the look) so embedded `#`/`##` headings become `h4`+ under the page's own h1/h2/h3 outline — keep that when embedding Markdown anywhere new.

## Spacing

Tailwind's default scale (4px increments). Observed conventions:

- Page container: `mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12` (header uses the same width and horizontal padding so the wordmark aligns with the content edge)
- Vertical rhythm between page sections: `space-y-8`; within a section: `space-y-3`; between panel sub-sections inside an expanded card: `space-y-6`
- Card padding: `p-4` (row header), `p-3 sm:p-5` (expanded panel), `p-4 sm:p-5` (submit card), `p-6 sm:p-8` (login card)
- Inline control gaps: `gap-2`; icon-to-label gaps `gap-1.5`/`gap-2`
- Lists of cards: `space-y-3` (analyses), `space-y-2` (findings)

## Layout & responsiveness

- **Dashboard (`/`)**: sticky header (`h-14`, `bg-white/95 backdrop-blur`, bottom border) with the "Repo Swarm" wordmark (plain text, no logo asset) left and avatar/email/Sign out right; below it a single column, `max-w-3xl`. No sidebar or multi-column layout — the product surface is intentionally small.
- **Login (`/login`)**: on `lg:` and up a two-column split (`lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]`) with the brand panel on the left; below `lg` the panel is hidden and the wordmark sits above a bordered card, `max-w-sm`. Both columns live inside `<main>` (axe's `region` rule).
- **Breakpoints in use**: `sm:` (640px) switches the submit row and each analysis row from stacked to side-by-side and reveals the email beside the avatar; `lg:` (1024px) reveals the login brand panel. Design mobile-first at 375px; add a breakpoint only when the 375px screenshot needs it.
- **Tables**: wrap in `overflow-x-auto` with a sensible `min-w-*`, and use `px-2 sm:px-3` / `text-[13px] sm:text-sm` so a 4-column table fits 375px without scrolling.
- **Print**: everything outside the report is `print:hidden` (page header, hero, form, list, footnote); the report itself is a `hidden print:block` block inside `AnalysesList`. Anything new added to a page must carry `print:hidden` too.

## Components

- **Buttons**: primary `h-11 rounded-lg px-4/5 text-sm font-semibold shadow-sm`; secondary/toolbar `h-9 rounded-lg px-3 text-sm font-medium`; ghost (Details toggle) `h-9 rounded-lg px-3 hover:bg-gray-100`. Disabled: `disabled:cursor-not-allowed disabled:opacity-60`. Loading: swap in `SpinnerIcon` with `animate-spin`, keep the label.
- **Inputs**: `h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm hover:border-gray-400`, always with a visible `<label>`; hints/errors wired with `aria-describedby`. `placeholder:text-gray-500`.
- **Cards**: radius scale is `rounded-lg` (inner cards, inputs, buttons) < `rounded-xl`/`rounded-2xl` (page-level cards: submit form, analysis rows, login card) < `rounded-full` (badges, avatar). `shadow-sm` on cards, none on flat panels.
- **Status/severity badges**: `rounded-full px-2.5 py-1 text-xs font-medium` (status) or `px-2 py-0.5` (severity, inside cards) + color pairing above. Never color alone — always a word plus a marker/icon.
- **Icons**: inline SVGs from `components/icons.tsx` (outline, `currentColor`, `aria-hidden`), sized `size-3`–`size-4` inline with text. Add new glyphs there rather than pulling an icon package.
- **Empty / loading / error states**: empty = dashed-border card with an icon tile, title and one sentence; loading = skeleton cards (`animate-pulse`) inside a `role="status"` region with sr-only text; error = red callout with icon and `role="alert"`.
- **Native disclosure**: informational findings use `<details>/<summary>` (keyboard-accessible for free) with a rotating chevron and `FOCUS_RING` on the summary.

## Accessibility conventions (checked by the accessibility-review skill)

- One `<h1>` per page inside `<main id="main" tabIndex={-1}>`; a skip link is the first Tab stop (in `layout.tsx`); heading levels never skip.
- Every interactive element carries `FOCUS_RING` from `lib/styles.ts`. Minimum control height is `h-9` (36px); primary and form controls are `h-11`.
- Dynamic changes that would otherwise be silent get a `role="status"` sr-only region (in-progress count, "Report copied to clipboard"); failures use `role="alert"`.
- External links say `(opens in a new tab)` in sr-only text. Toggles use `aria-expanded`, plus `aria-controls` only while the panel exists.
- Decorative motion (spinner, pulse, chevron rotation, smooth scroll) is collapsed globally by the `prefers-reduced-motion` block in `globals.css`.

## What "consistent" means for this audit

When reviewing a screenshot, check for:
1. Any element that doesn't match a token above (an off-scale font size, a color not in the tables, inconsistent border-radius).
2. Misaligned or uneven spacing between visually-similar elements (e.g. two buttons with different heights).
3. Missing hover/active/disabled/focus states on interactive elements that have them elsewhere in the app.
4. Layout breakage at the mobile viewport (375px) — overflow, clipped text or table columns, elements running off-screen.

Fix by reusing an existing token/pattern first. Only introduce a new one if nothing in this doc fits, and if so, add it here as part of the same change.
