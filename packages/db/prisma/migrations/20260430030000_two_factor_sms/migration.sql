-- Phase 6 step 2: opt-in SMS dispatch for the 2FA code on password login.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "twoFactorSms" BOOLEAN NOT NULL DEFAULT false;
