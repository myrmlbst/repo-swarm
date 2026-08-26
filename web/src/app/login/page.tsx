"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { FOCUS_RING } from "@/lib/styles";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

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
      setMessage(error.message);
      return;
    }

    if (mode === "sign-up") {
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }

    window.location.href = "/";
  }

  async function handleGithubLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-gray-900">
          {mode === "sign-in" ? "Log in" : "Create an account"}
        </h1>

        <button
          type="button"
          onClick={handleGithubLogin}
          className={`flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 ${FOCUS_RING}`}
        >
          Continue with GitHub
        </button>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <div className="h-px flex-1 bg-gray-200" />
          or
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FOCUS_RING}`}
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FOCUS_RING}`}
            />
          </div>

          {message && (
            <p role="alert" className="text-sm text-red-600">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 ${FOCUS_RING}`}
          >
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
          className={`w-full rounded-md text-center text-sm text-gray-500 hover:text-gray-700 ${FOCUS_RING}`}
        >
          {mode === "sign-in"
            ? "Need an account? Sign up"
            : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}
