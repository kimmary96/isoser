alter table public.profiles
add column if not exists address text,
add column if not exists region text,
add column if not exists region_detail text;

create index if not exists idx_profiles_region
on public.profiles(region);
