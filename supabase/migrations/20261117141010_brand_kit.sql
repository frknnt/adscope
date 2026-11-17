-- Brand kit (P1.1): colours, typeface, tagline, audience note, mandatory phrases, website.
-- Same ownership model as the rest of brands: owner writes, owner and team viewers read (policies unchanged).
alter table public.brands
  add column primary_color text check (primary_color ~ '^#[0-9a-f]{6}$'),
  add column secondary_color text check (secondary_color ~ '^#[0-9a-f]{6}$'),
  add column font text check (font in ('inter', 'manrope', 'montserrat', 'poppins', 'nunito', 'playfair-display')),
  add column tagline text check (char_length(tagline) <= 120),
  add column audience_note text check (char_length(audience_note) <= 400),
  add column required_phrases text[] not null default '{}'
    check (cardinality(required_phrases) <= 10 and char_length(array_to_string(required_phrases, '|')) <= 1700),
  add column website text check (char_length(website) <= 300 and website ~ '^https://');

-- Column-level grants: the new columns are user-writable like the other text fields; logo_path stays server-only.
grant insert (primary_color, secondary_color, font, tagline, audience_note, required_phrases, website) on public.brands to authenticated;
grant update (primary_color, secondary_color, font, tagline, audience_note, required_phrases, website) on public.brands to authenticated;
