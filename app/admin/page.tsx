import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddDayForm from "./AddDayForm";

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
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-ink mb-1">Add a Course Day</h1>
        <p className="text-gray-500 text-sm mb-8">
          Set the exact unlock times below — the times you pick here are what
          drive both the dashboard unlock and the automated emails.
        </p>
        <AddDayForm />
      </div>
    </div>
  );
}
