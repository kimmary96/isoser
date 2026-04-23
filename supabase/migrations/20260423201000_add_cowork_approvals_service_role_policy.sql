alter table if exists public.cowork_approvals
enable row level security;

drop policy if exists "cowork_approvals_service_role_all" on public.cowork_approvals;

create policy "cowork_approvals_service_role_all"
on public.cowork_approvals
for all
to service_role
using (true)
with check (true);

