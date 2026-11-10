create table if not exists audit_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text not null,
  domain text,
  result jsonb not null,
  source text default 'geo_analyzer'
);

create index on audit_results (email);
create index on audit_results (created_at desc);
