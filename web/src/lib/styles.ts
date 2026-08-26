/**
 * Chromium (and some other browsers) don't show a visible focus indicator on
 * <button>/<a> for programmatic or mouse focus, only for real keyboard
 * navigation via :focus-visible — but Tailwind's reset means even that
 * keyboard-triggered outline doesn't reliably render across browsers here.
 * Apply this to every interactive element so keyboard users can see focus.
 */
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
