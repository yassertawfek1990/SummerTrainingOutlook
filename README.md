# Training Course Platform

A full course delivery site: students sign up, receive a daily PDF by email at
a fixed unlock time, the next day's quiz unlocks at a fixed time after that,
and everything shows up on a dashboard + leaderboard.

## How the scheduling works

- Every `course_day` row has two absolute timestamps: `pdf_unlock_at` and
  `quiz_unlock_at`. These are the same for every student — it's one shared
  cohort schedule, not per-student.
- A cron job (`/api/cron/unlock-content`) runs several times across each
  unlock hour (see "Pacing sends" below). Each run checks: "which days just
  unlocked, and who hasn't been emailed about it yet?" and sends + logs a
  limited batch of those emails, rather than firing everyone at once.
- **Late joiners don't get spammed with old backlog emails.** The cron only
  looks at unlocks from the last 30 hours. If someone signs up on day 20, they
  won't get 19 emails — they'll see days 1–19 already sitting unlocked on
  their dashboard (since the schedule is shared), and they'll start getting
  emails from whatever unlocks next.
- The dashboard itself doesn't depend on email at all — it just shows any day
  where `pdf_unlock_at <= now`. Email is a notification on top of that.

## One-time setup

### 1. Supabase (auth + database)

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor**, paste the entire contents of `supabase/schema.sql`,
   and run it. This creates all tables, security rules, and the trigger that
   turns signup form data into a profile row.
3. Go to **Project Settings > API** and copy: `Project URL`, `anon public`
   key, and `service_role` key (keep this one secret).
4. Go to **Authentication > Sign In / Providers** and confirm Email is
   enabled. Under **Authentication > URL Configuration**, set your Site URL
   once you have your Vercel domain (step 3 below).
5. By default Supabase requires email confirmation before login — that's why
   the signup page shows a "check your email" message. You can turn this off
   under **Authentication > Sign In / Email** if you'd rather let students in
   immediately.

### 2. Gmail SMTP (email sending)

This sends through your own Gmail account using an App Password — no Google
Cloud Console, no OAuth consent screens, no expiring tokens, and no company
IT approval needed. For a course this size, it's the simplest reliable
option.

1. **Turn on 2-Step Verification** on the Gmail account you want to send
   from, if it isn't already: [myaccount.google.com/security](https://myaccount.google.com/security).
   App Passwords require this to be on.
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
   enter a name like "Course Platform", and click **Create**.
3. Copy the 16-character password shown (spaces don't matter, you can include
   or strip them) — this goes in `GMAIL_APP_PASSWORD`. You won't be able to
   view it again after closing the dialog, so copy it now.
4. Set `GMAIL_USER` to that Gmail address, and `GMAIL_SENDER_NAME` to
   whatever display name you want students to see (e.g. your course name).

**Daily quota:** a free personal Gmail account is capped at **100 emails/day
sent via SMTP**, with roughly 20/hour recommended before spam heuristics get
suspicious. For 36 students × 2 emails/day (72 total), you're comfortably
under the daily cap — the "Pacing sends" section below is what keeps you
under the hourly rate too, by spreading sends across the hour instead of
firing all 36 at once.

### 3. Deploy to Vercel

1. Push this project to a GitHub repo, then import it at
   [vercel.com/new](https://vercel.com/new).
2. In **Project Settings > Environment Variables**, add everything from
   `.env.example` with your real values.
3. Deploy. Copy your live URL (e.g. `https://your-app.vercel.app`) into the
   `NEXT_PUBLIC_SITE_URL` env var, then redeploy so emails link correctly.
4. Vercel automatically provisions `CRON_SECRET` for you and injects it — you
   don't need to set it yourself on Vercel (only for local testing).

## Pacing sends (instead of one big burst)

Rather than emailing all 36 (or however many) students the instant the clock
hits 9PM, sends are spread out:

- `vercel.json` triggers the cron route **four times across each unlock
  hour** (`:00`, `:15`, `:30`, `:45`) instead of once.
- Each run only sends up to `MAX_EMAILS_PER_RUN` (default 12, set in
  `app/api/cron/unlock-content/route.ts`) and pauses `DELAY_BETWEEN_EMAILS_MS`
  (default 2 seconds) between each one. Whoever's left waits for the next run.
- The `email_log` table means this is safe to run as often as it likes —
  anyone already emailed for a given day is skipped automatically.

For 36 students, that spreads sending across roughly 3 of the 4 scheduled
runs — comfortably gentle regardless of which mailbox is sending through the
API rather than a dedicated bulk provider. Adjust `MAX_EMAILS_PER_RUN` up or
down depending on your class size and how gently you want it paced.

One honest caveat: Vercel's free Hobby plan doesn't guarantee cron fires at
the exact minute — it can land anywhere within the scheduled hour. That
doesn't break anything here (the batching + `email_log` dedup handle it
regardless of exact timing), it just means the four runs might not be
precisely 15 minutes apart in practice, only "spread somewhere across the
hour."

### 4. Timezone — important

Vercel Cron schedules in `vercel.json` are in **UTC only**. This project ships
with:

```json
"schedule": "0 19 * * *"   // PDF unlock cron
"schedule": "0 13 * * *"   // Quiz unlock cron
```

`19:00 UTC` and `13:00 UTC` line up with **9:00 PM and 3:00 PM Cairo time**
when Egypt is on standard time (UTC+2). If Egypt is observing daylight saving
at the time (UTC+3), shift both by one hour (`18:00` / `12:00` UTC) — check
before your course starts and adjust `vercel.json` if needed, then redeploy.

Note: on Vercel's free Hobby plan, cron jobs can land anywhere within the
scheduled hour (e.g. "9:19 PM" instead of "9:00 PM exactly") — this doesn't
affect what's unlocked (that's driven by the timestamps in your database, not
by when the cron happens to fire), it only affects how promptly the email
goes out. If you need tighter timing, Vercel Pro ($20/mo) gives per-minute
precision.

### 5. Add your course content

1. Log in with the email address you set as `ADMIN_EMAIL`.
2. Visit `/admin` — a form to add each day: topic, a PDF file (uploaded
   directly, no external hosting needed), unlock times, and quiz questions
   with multiple choice answers.
3. PDFs upload straight to Supabase Storage in a `course-pdfs` bucket
   (created automatically by `schema.sql`) and get a public URL used for
   both the dashboard link and the emailed link.

**Storage limits to know:** the free Supabase tier gives you **1GB total
file storage** — your ~100MB of course PDFs uses about a tenth of that, with
room to spare. The one setting worth checking: Supabase defaults to a
**50MB max per individual file upload**. If any single PDF is larger than
that, raise the limit in the Supabase dashboard under **Storage → course-pdfs
→ bucket settings → file size limit** before uploading it.

**Importing quizzes from Excel:** on the `/admin` page, above the manual
question builder, there's an "Import questions from Excel" uploader plus a
"Download template" link (`public/quiz-template.xlsx`). The template has two
tabs — `Quiz Questions` (fill in one row per question: the question text,
4 options, and which option number 1-4 is correct) and `Instructions`. Pick
the file and it fills in the question builder below, so you can still glance
over it before saving.

Since Google Forms doesn't export its questions as a spreadsheet (only
response data), the practical path is a one-time transcription: open each
form, copy the question + option text into the template's matching columns,
save, and import. Once it's in the template format, re-uploading for future
runs of the course is instant.

## Importing quizzes from Excel (or your existing Google Forms)

The `/admin` page has an **"Import questions from Excel"** upload, so you
don't have to retype your quizzes by hand.

**Template format** (download it directly from the admin page, or find it at
`public/quiz-template.xlsx` in this repo):

| Question | Option 1 | Option 2 | Option 3 | Option 4 | Correct Option |
|---|---|---|---|---|---|
| What is the first-line treatment for...? | ACE inhibitor | Opioid | Antihistamine | Antifungal | 1 |

- `Correct Option` is just the number (1–4) of the right answer
- Column names must match (case doesn't matter, extra columns are ignored)
- Uploading replaces whatever's currently in the question builder below it —
  you can still edit/fix individual questions after importing, before saving

### Pulling questions straight out of an existing Google Form

Since your quizzes already exist as Google Forms with correct answers
marked, this Apps Script reads a form's questions (multiple choice only) and
writes them into a new Google Sheet in the exact template format above — so
you can just download that sheet as `.xlsx` and upload it directly, no
manual retyping at all.

1. Open the Google Form → click the **⋮ (more)** menu → **Script editor**
   (or go to [script.google.com](https://script.google.com), New Project,
   and paste the form's ID in manually — see comment in the script).
2. Paste this in, replacing the placeholder if you're running it standalone:

```javascript
function exportFormToSheet() {
  // If running from the form's own script editor, this works as-is.
  // If running from script.google.com standalone, replace with:
  // const form = FormApp.openById('YOUR_FORM_ID_FROM_THE_URL');
  const form = FormApp.getActiveForm();

  const sheet = SpreadsheetApp.create(form.getTitle() + " - Quiz Import");
  const ws = sheet.getSheets()[0];
  ws.appendRow(["Question", "Option 1", "Option 2", "Option 3", "Option 4", "Correct Option"]);

  form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).forEach((item) => {
    const mc = item.asMultipleChoiceItem();
    const choices = mc.getChoices();
    const options = choices.map((c) => c.getValue());

    // Only works for Forms set up as a Quiz with correct answers marked —
    // otherwise correctIndex comes back -1 and the row is skipped.
    let correctIndex = -1;
    choices.forEach((c, i) => {
      if (c.isCorrectAnswer()) correctIndex = i;
    });

    if (correctIndex === -1 || options.length > 4) return; // skip, fix manually

    const row = [mc.getTitle(), ...options];
    while (row.length < 5) row.push(""); // pad to 4 options if fewer
    row.push(correctIndex + 1);
    ws.appendRow(row);
  });

  Logger.log("Done: " + sheet.getUrl());
}
```

3. Click **Run**. First run will ask you to authorize the script (it's only
   accessing your own form/sheet — normal for Apps Script).
4. Check the **Logs** (View → Logs) for the new sheet's URL, open it,
   **File → Download → Microsoft Excel (.xlsx)**, then upload that file on
   the `/admin` page.

This only picks up multiple-choice questions where the Form has "Make this a
quiz" enabled with correct answers marked — anything else (checkboxes,
short answer, or a non-quiz form) gets skipped since there's no correct
answer to import; add those manually in the question builder if you have any.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your real keys
npm run dev
```

To test the cron route locally without waiting for Vercel:

```bash
curl http://localhost:3000/api/cron/unlock-content \
  -H "Authorization: Bearer YOUR_CRON_SECRET_FROM_ENV"
```

## Project structure

```
app/
  signup/          Signup form (email, password, full name, phone)
  login/            Login form
  dashboard/        Main table: date, topic, PDF link, quiz/score
  quiz/[dayId]/     Quiz-taking page
  leaderboard/      Podium (top 3) + ranked list (top 10)
  admin/            Add course days + quiz questions (gated to ADMIN_EMAIL)
  api/
    cron/unlock-content/   Twice-daily job: unlocks days, sends emails
    quiz/submit/            Grades quizzes server-side, records attempts
    admin/upload-pdf/       Uploads a PDF to Supabase Storage, returns its URL
    admin/add-day/          Inserts a new course day + questions
lib/
  supabase/         Browser, server, and admin (service-role) clients
  mailer.ts         Email templates + sending via Gmail SMTP
supabase/
  schema.sql        Full database schema — run this first
```
