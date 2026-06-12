-- One-time 6-digit TAN codes for the custom email auth flow.
-- Codes are emailed from auth@papirun.net by /api/auth/send-tan and validated
-- by /api/auth/verify-tan. Only the sha256 hash is stored, never the code.
CREATE TABLE public.auth_tans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_tans_email ON public.auth_tans(email, created_at DESC);

-- Deny-all RLS: no policies on purpose — only the service role (which
-- bypasses RLS) may touch TAN rows. Clients never see them.
ALTER TABLE public.auth_tans ENABLE ROW LEVEL SECURITY;
