"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { FOCUS_RING } from "@/lib/styles";
import { Wordmark } from "@/components/Wordmark";
import {
  AlertCircleIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  // GitHubIcon, // re-enable with the GitHub button below
  SpinnerIcon,
} from "@/components/icons";

const FEATURES = [
  {
    title: "Specialist agents in parallel",
    body: "Code, cloud and security agents each get a narrow job instead of one giant prompt.",
  },
  {
    title: "Findings show their sources",
    body: "Every finding points at the files and reference docs it came from.",
  },
  {
    title: "Costs you can see",
    body: "Each run breaks down time, tokens and spend per agent.",
  },
];

const INPUT_CLASSES = `mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 hover:border-gray-400 ${FOCUS_RING}`;

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{
    kind: "error" | "info";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  // const [githubLoading, setGithubLoading] = useState(false);

  const supabase = createClient();

  // Errors from the OAuth round-trip arrive as ?error=… (our callback route)
  // or #error_description=… (Supabase, e.g. a redirect URL that isn't allowed).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const text =
      params.get("error") ??
      hash.get("error_description") ??
      params.get("error_description");
    if (!text) return;
    setMessage({ kind: "error", text });
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setMessage({ kind: "error", text: error.message });
      return;
    }

    if (mode === "sign-up") {
      setMessage({
        kind: "info",
        text: "Check your email to confirm your account, then sign in.",
      });
      return;
    }

    window.location.href = "/";
  }

  // GitHub login is disabled for now (needs a GitHub OAuth App + Supabase
  // provider setup, see README). Uncomment this, the state above, the
  // GitHubIcon import and the button in the JSX to bring it back.
  // async function handleGithubLogin() {
  //   setGithubLoading(true);
  //   setMessage(null);
  //
  //   const { error } = await supabase.auth.signInWithOAuth({
  //     provider: "github",
  //     options: { redirectTo: `${window.location.origin}/auth/callback` },
  //   });
  //
  //   // On success the browser is already navigating to GitHub, so only reset
  //   // the button if something went wrong.
  //   if (error) {
  //     setGithubLoading(false);
  //     setMessage({ kind: "error", text: error.message });
  //   }
  // }

  return (
    <main
      id="main"
      tabIndex={-1}
      className="grid min-h-dvh focus:outline-none lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
    >
      {/* Brand panel: desktop only. On small screens the name moves above
          the form instead, so the form is the first thing on the page. */}
      <div className="relative hidden overflow-hidden bg-linear-to-br from-blue-700 via-blue-800 to-indigo-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-indigo-400/20 blur-3xl"
        />

        <div className="relative">
          <Wordmark light />
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <p className="text-3xl font-semibold leading-tight tracking-tight">
              A second opinion on your repo before you ship it.
            </p>
            <p className="text-base leading-relaxed text-blue-100">
              Point Repo Swarm at a GitHub repository and get a reviewed AWS
              deployment and security proposal in about a minute.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/15">
                  <CheckIcon className="size-3" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{feature.title}</p>
                  <p className="text-sm leading-relaxed text-blue-100">
                    {feature.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-blue-200">
          Reviews are generated by AI agents. Verify important findings before
          acting on them.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-6 lg:bg-white">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex justify-center lg:hidden">
            <Wordmark />
          </div>

          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
            <div className="space-y-1 text-center lg:text-left">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {mode === "sign-in" ? "Log in" : "Create an account"}
              </h1>
              <p className="text-sm text-gray-600">
                {mode === "sign-in"
                  ? "Welcome back. Sign in to see your analyses."
                  : "Sign up to start reviewing repositories."}
              </p>
            </div>

            {/* GitHub login disabled for now — uncomment to re-enable.
            <button
              type="button"
              onClick={handleGithubLogin}
              disabled={githubLoading}
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 active:bg-black disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {githubLoading ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <GitHubIcon className="size-4" />
              )}
              {githubLoading ? "Redirecting..." : "Continue with GitHub"}
            </button>

            <div className="flex items-center gap-3 text-xs text-gray-600">
              <div className="h-px flex-1 bg-gray-200" />
              or
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            */}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-800"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT_CLASSES}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-800"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "sign-in" ? "current-password" : "new-password"
                    }
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby={
                      mode === "sign-up" ? "password-hint" : undefined
                    }
                    className={`${INPUT_CLASSES} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    className={`absolute right-1 top-1.5 grid size-11 place-items-center rounded-lg text-gray-600 hover:text-gray-900 ${FOCUS_RING}`}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
                {mode === "sign-up" && (
                  <p
                    id="password-hint"
                    className="mt-1.5 text-xs text-gray-600"
                  >
                    At least 6 characters.
                  </p>
                )}
              </div>

              {message && (
                <p
                  role={message.kind === "error" ? "alert" : "status"}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    message.kind === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-green-200 bg-green-50 text-green-800"
                  }`}
                >
                  {message.kind === "error" ? (
                    <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <CheckIcon className="mt-0.5 size-4 shrink-0" />
                  )}
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
              >
                {loading && <SpinnerIcon className="size-4 animate-spin" />}
                {loading
                  ? "Please wait..."
                  : mode === "sign-in"
                    ? "Log in"
                    : "Sign up"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                setMessage(null);
              }}
              className={`w-full rounded-lg py-2 text-center text-sm font-medium text-gray-700 hover:text-gray-900 ${FOCUS_RING}`}
            >
              {mode === "sign-in"
                ? "Need an account? Sign up"
                : "Already have an account? Log in"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
