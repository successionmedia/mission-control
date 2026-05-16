-- Ad Factory Tables for Mission Control
-- Run this in Supabase SQL Editor

-- 1. Brands table — reusable across jobs, can be auto-built from a landing page URL
create table if not exists ad_factory_brands (
  slug text primary key,                                -- 'tryherskin', 'nutrotonic'
  name text not null,
  landing_url text,
  brand_dna_md text not null,                           -- full brand-dna.md content
  prompt_modifier text not null,                        -- bottom paragraph, prepended to every prompt
  product_image_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Jobs table — one row per ad-factory run
create table if not exists ad_factory_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_name text not null,
  brand_slug text not null references ad_factory_brands(slug) on delete restrict,
  brand_dna_snapshot text,                              -- snapshot of brand_dna_md at job time
  output_type text not null default 'static_ad',        -- 'lifestyle' | 'product_shot' | 'static_ad'
  aspect_ratio text not null default '1:1',
  resolution text not null default '2K',
  product_image_urls jsonb not null default '[]'::jsonb,
  style_image_urls jsonb not null default '[]'::jsonb,
  prompts jsonb not null,                               -- input prompts: [{number,name,prompt,reason?}]
  total_prompts int not null default 0,
  completed_prompts int not null default 0,
  results jsonb not null default '[]'::jsonb,           -- [{number,name,status,kie_task_id,image_url,error}]
  status text not null default 'pending',               -- pending|generating|completed|partial|failed
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_ad_factory_jobs_created_at on ad_factory_jobs (created_at desc);
create index if not exists idx_ad_factory_jobs_status on ad_factory_jobs (status);
create index if not exists idx_ad_factory_jobs_brand on ad_factory_jobs (brand_slug);

-- Permissive RLS (matches other personal automations — no auth in app yet)
alter table ad_factory_brands enable row level security;
alter table ad_factory_jobs enable row level security;

drop policy if exists "Allow all on ad_factory_brands" on ad_factory_brands;
create policy "Allow all on ad_factory_brands" on ad_factory_brands for all using (true) with check (true);

drop policy if exists "Allow all on ad_factory_jobs" on ad_factory_jobs;
create policy "Allow all on ad_factory_jobs" on ad_factory_jobs for all using (true) with check (true);

-- Storage bucket: ad-factory (public)
-- Note: this must be created via Supabase Studio UI OR via the JS SDK at app startup.
-- Bucket name: ad-factory
-- Public: true
-- File size limit: 50MB (recommended)
-- Allowed MIME types: image/png, image/jpeg, image/webp
