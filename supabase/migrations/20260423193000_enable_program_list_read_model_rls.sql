alter table public.program_list_index enable row level security;
alter table public.program_list_facet_snapshots enable row level security;

drop policy if exists "program_list_index_service_role_all" on public.program_list_index;
create policy "program_list_index_service_role_all"
on public.program_list_index
for all
to service_role
using (true)
with check (true);

drop policy if exists "program_list_facet_snapshots_service_role_all" on public.program_list_facet_snapshots;
create policy "program_list_facet_snapshots_service_role_all"
on public.program_list_facet_snapshots
for all
to service_role
using (true)
with check (true);
