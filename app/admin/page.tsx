import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AddDayForm from "./AddDayForm";
import ImportScoresForm from "./ImportScoresForm";
import Logo from "@/app/components/Logo";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo className="h-9" />
            <div>
              <h1 className="text-2xl font-bold text-ink mb-1">Add a Course Day</h1>
              <p className="text-gray-500 text-sm">
                Set the exact unlock times below — the times you pick here are
                what drive both the dashboard unlock and the automated emails.
              </p>
            </div>
          </div>
          <Link
            href="/admin/activity"
            className="whitespace-nowrap text-sm font-medium text-ink underline"
          >
            View student activity →
          </Link>
        </div>

        <div>
          <AddDayForm />
        </div>

        <div>
          <ImportScoresForm />
        </div>
      </div>
    </div>
  );
}
