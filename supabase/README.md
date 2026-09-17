# Baseline backend setup

This project uses Supabase for:
- email OTP authentication
- user profiles
- saved personalized plans
- a protected Edge Function for Gemini calls

The app intentionally does **not** store uploaded face/posture photos in the database.

## 1. Create a Supabase project

Create a project at https://supabase.com/.

In **Authentication → Providers → Email**, enable Email.

For a 6-digit code instead of a magic link, edit the email template so it includes:

```text
{{ .Token }}
```

and does not rely only on `{{ .ConfirmationURL }}`.

Supabase's `signInWithOtp()` and `verifyOtp()` APIs handle the email-code flow.

## 2. Create the database

Open **SQL Editor** and run:

```text
supabase/schema.sql
```

This creates `profiles` and `plans` and enables Row Level Security so an authenticated user can only read/write their own rows.

## 3. Add the Supabase client configuration

Open:

```text
www/config.js
```

Replace:

```js
SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
SUPABASE_PUBLISHABLE_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY"
```

with the project's URL and **publishable key** from Supabase Settings → API Keys.

Never put a Supabase secret/service-role key in `www/config.js`.

## 4. Configure the Gemini server secret

The app does not send the Gemini API key directly from the iPhone.

Deploy the Edge Function in:

```text
supabase/functions/baseline-ai/index.ts
```

Then add a Supabase Edge Function secret named:

```text
GEMINI_API_KEY
```

The secret stays on the server.

For CLI deployment, after installing/authenticating the Supabase CLI:

```bash
supabase functions deploy baseline-ai
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Do not commit the Gemini key to GitHub.

## 5. Deploy

The app invokes:

```text
baseline-ai
```

only after the user is authenticated.

The function verifies the user's Supabase JWT before calling Gemini.

## Important authentication terminology

Baseline uses **email OTP authentication**: the user's email address is verified by a one-time code sent to that inbox.

That is passwordless email authentication. It is **not the same thing as a traditional two-factor setup** where a password is combined with a separate second factor. If true MFA is required later, add a separate second factor such as TOTP.
