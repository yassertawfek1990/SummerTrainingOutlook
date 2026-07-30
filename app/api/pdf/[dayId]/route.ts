import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { dayId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: day } = await supabase
    .from("course_days")
    .select("pdf_url, pdf_unlock_at")
    .eq("id", params.dayId)
    .single();

  if (!day) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Don't let a direct link guess bypass the unlock schedule.
  if (new Date(day.pdf_unlock_at).getTime() > Date.now()) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Log the view — upsert so repeat opens increment a counter rather than
  // erroring on the unique(student_id, course_day_id) constraint.
  const { data: existing } = await supabase
    .from("pdf_views")
    .select("id, view_count")
    .eq("student_id", user.id)
    .eq("course_day_id", params.dayId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("pdf_views")
      .update({
        view_count: existing.view_count + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("pdf_views").insert({
      student_id: user.id,
      course_day_id: params.dayId,
    });
  }

  return NextResponse.redirect(day.pdf_url);
}
