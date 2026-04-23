create index if not exists idx_program_list_index_runtime_browse
on public.program_list_index (is_open, browse_rank, recommended_score desc, id);

create index if not exists idx_program_list_index_runtime_deadline
on public.program_list_index (is_open, browse_rank, deadline asc nulls last, recommended_score desc, id);

create index if not exists idx_program_list_facet_snapshots_latest
on public.program_list_facet_snapshots (scope, pool_limit, generated_at desc);
