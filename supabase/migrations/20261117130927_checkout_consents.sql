-- Checkout consents (P0.3): before every paid checkout the user acknowledges the pre-contract
-- information form and accepts the distance sales contract. Both are stored in the existing
-- append-only user_consents table with the document version; RLS and grants are unchanged
-- (owner can read and insert own rows only).
alter table public.user_consents drop constraint if exists user_consents_consent_type_check;
alter table public.user_consents
  add constraint user_consents_consent_type_check
  check (consent_type in ('terms', 'kvkk_notice', 'privacy_policy', 'marketing_email', 'pre_information', 'distance_sales'));
