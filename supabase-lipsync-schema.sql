-- Lipsync automation: jobs that lipsync an audio file to a character image via WaveSpeed InfiniteTalk

create table if not exists lipsync_jobs (
  id uuid primary key default gen_random_uuid(),
  title text,
  audio_url text not null,
  image_url text not null,
  resolution text not null default '480p',
  wavespeed_task_id text,
  status text not null default 'pending', -- pending | processing | completed | failed
  result_video_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists lipsync_jobs_created_at_idx on lipsync_jobs (created_at desc);
create index if not exists lipsync_jobs_status_idx on lipsync_jobs (status);

alter table lipsync_jobs enable row level security;

drop policy if exists "lipsync_jobs all" on lipsync_jobs;
create policy "lipsync_jobs all" on lipsync_jobs for all using (true) with check (true);

-- Storage buckets for input audio + image and the cached result video.
-- Run from Supabase SQL editor; if buckets already exist this is a no-op.
insert into storage.buckets (id, name, public)
values ('lipsync-audio', 'lipsync-audio', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('lipsync-images', 'lipsync-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('lipsync-videos', 'lipsync-videos', true)
on conflict (id) do nothing;

-- Permissive storage policies (matches the rest of Mission Control)
drop policy if exists "lipsync_audio all" on storage.objects;
create policy "lipsync_audio all" on storage.objects for all
  using (bucket_id in ('lipsync-audio', 'lipsync-images', 'lipsync-videos'))
  with check (bucket_id in ('lipsync-audio', 'lipsync-images', 'lipsync-videos'));
