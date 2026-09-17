# Baseline

**Your starting point. Your routine.**

Baseline is an iPhone app that turns a user's starting point, goals, and optional face/posture photos into a personalized wellness routine covering skincare, training, posture, and daily habits.

## Current build

- Capacitor + native iOS
- Mobile-first iPhone UI with safe-area support
- Baseline app icon and in-app branding
- Email OTP account authentication
- Supabase database for profiles and saved plans
- Personalized dashboard with daily tasks and progress
- Gemini 3.6 Flash through a protected Supabase Edge Function
- Unsigned IPA output for SideStore

## Backend setup

Before the app can create accounts or save plans, configure the Supabase project described in [`supabase/README.md`](supabase/README.md).

Do **not** commit API secrets to this repository.

## iPhone build

The repository includes `codemagic.yaml` for the unsigned iOS build. The resulting artifact is:

```text
ios/App/unsigned.ipa
```

The IPA is intentionally unsigned and can be signed on-device with SideStore.

## Privacy notes

Baseline stores account information and the generated plan in Supabase. Uploaded photos are sent to the configured AI Edge Function for analysis and are not written to the Baseline database by the app.

The AI feature provides general wellness guidance and is not a medical diagnostic service.
