create table if not exists affiliate_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text not null,
  website text,
  platforms text[] not null default '{}',
  audience_size text,
  promo_plan text,
  status text not null default 'pending'
);

create index on affiliate_leads (email);
create index on affiliate_leads (created_at desc);
