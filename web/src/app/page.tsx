import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalysesList } from "@/components/AnalysesList";
import { SignOutButton } from "@/components/SignOutButton";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Your repos</h1>
          <p className="truncate text-sm text-gray-500">{user.email}</p>
        </div>
        <div className="shrink-0 whitespace-nowrap pt-1">
          <SignOutButton />
        </div>
      </div>

      <AnalysesList />
    </main>
  );
}
