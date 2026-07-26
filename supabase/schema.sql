-- ============================================================
-- Training Course Platform — Database Schema
-- Run this in Supabase: Project > SQL Editor > New Query > paste > Run
-- ============================================================

-- 1. Profiles (extends Supabase auth.users with phone + certificate name)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  phone text not null,
  email text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view all profiles (needed for leaderboard names)"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- Reads full_name and phone out of the signup metadata (see app/signup/page.tsx).
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Course days — one row per day of the course. Global schedule, same for everyone.
create table course_days (
  id uuid primary key default gen_random_uuid(),
  day_number int not null unique,
  topic_name text not null,
  pdf_url text not null,
  pdf_unlock_at timestamptz not null,
  quiz_unlock_at timestamptz not null,
  created_at timestamptz default now()
);

alter table course_days enable row level security;

create policy "Everyone can view course days"
  on course_days for select using (true);

-- 3. Quiz questions — simple structure: each course_day has one quiz made
-- of however many questions you add. Options stored as JSON array of strings,
-- correct_index points at the right one.
create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  course_day_id uuid references course_days(id) on delete cascade not null,
  question_order int not null default 0,
  question_text text not null,
  options jsonb not null, -- e.g. ["Option A", "Option B", "Option C", "Option D"]
  correct_index int not null
);

alter table quiz_questions enable row level security;

-- Students should NOT be able to read correct_index before attempting — but for
-- simplicity of this build we allow reading all columns once the quiz is unlocked,
-- and rely on the frontend not to reveal it, plus the submit route re-grading
-- server-side so a tampered frontend can't fake a score. See app/api/quiz/submit.
create policy "Everyone can view quiz questions"
  on quiz_questions for select using (true);

-- 4. Attempts — one row per student per quiz taken
create table attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade not null,
  course_day_id uuid references course_days(id) on delete cascade not null,
  score int not null,        -- number correct
  total int not null,        -- total questions
  taken_at timestamptz default now(),
  unique (student_id, course_day_id)
);

alter table attempts enable row level security;

create policy "Users can view their own attempts"
  on attempts for select using (auth.uid() = student_id);

create policy "Users can insert their own attempts"
  on attempts for insert with check (auth.uid() = student_id);

-- Leaderboard needs everyone's scores — expose a read-only view instead of
-- opening up the whole attempts table.
create view leaderboard as
  select
    p.id as student_id,
    p.full_name,
    coalesce(sum(a.score), 0) as total_score,
    coalesce(sum(a.total), 0) as total_possible,
    count(a.id) as quizzes_taken
  from profiles p
  left join attempts a on a.student_id = p.id
  group by p.id, p.full_name
  order by total_score desc;

-- Note: attempts RLS only lets a student read their own rows, so a plain client-side
-- query against this view would only ever sum "my own" score. The leaderboard page
-- in this project therefore reads this view from a server route using the Supabase
-- service role key (bypasses RLS) rather than querying it directly from the browser.

-- 5. Email log — prevents double-sending and prevents backfilling old emails
-- to students who enroll late (see /api/cron/unlock-content for the logic).
create table email_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade not null,
  course_day_id uuid references course_days(id) on delete cascade not null,
  email_type text not null check (email_type in ('pdf', 'quiz')),
  sent_at timestamptz default now(),
  unique (student_id, course_day_id, email_type)
);

alter table email_log enable row level security;

create policy "Users can view their own email log"
  on email_log for select using (auth.uid() = student_id);

-- 6. Storage bucket for PDFs. Public read (so email links + dashboard links
-- work without extra auth), writes restricted to the service role only (the
-- admin upload route uses the service role key, bypassing this policy check
-- entirely — this policy just blocks random anon/browser uploads).
insert into storage.buckets (id, name, public)
values ('course-pdfs', 'course-pdfs', true)
on conflict (id) do nothing;

create policy "Public can read course PDFs"
  on storage.objects for select
  using (bucket_id = 'course-pdfs');

-- ============================================================
-- Done. Next: add your course days (see /admin page once deployed),
-- or insert a test row manually:
--
-- insert into course_days (day_number, topic_name, pdf_url, pdf_unlock_at, quiz_unlock_at)
-- values (1, 'Introduction to Pharmacology', 'https://example.com/day1.pdf',
--         '2026-07-23 21:00:00+02', '2026-07-24 15:00:00+02');
-- ============================================================
