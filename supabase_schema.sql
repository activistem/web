-- ============================================================
-- Activistem! Database Schema  (idempotent — safe to re-run)
-- Run in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLES
-- ────────────────────────────────────────────────────────────

-- profiles
create table if not exists profiles (
  id              uuid        primary key references auth.users on delete cascade,
  username        text        unique,
  full_name       text,
  role            text,
  location        text,
  bio             text,
  avatar_color    text        not null default '#7C5BF5',
  tags            text[]      not null default '{}',
  followers_count int         not null default 0,
  projects_count  int         not null default 0,
  created_at      timestamptz not null default now()
);

-- posts
create table if not exists posts (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references profiles(id) on delete cascade,
  content        text        not null check (char_length(content) <= 500),
  hashtags       text[]      not null default '{}',
  likes_count    int         not null default 0,
  comments_count int         not null default 0,
  shares_count   int         not null default 0,
  created_at     timestamptz not null default now()
);

-- post_likes
create table if not exists post_likes (
  id      uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id)    on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  unique(post_id, user_id)
);

-- connections (follow)
create table if not exists connections (
  id           uuid        primary key default gen_random_uuid(),
  follower_id  uuid        not null references profiles(id) on delete cascade,
  following_id uuid        not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique(follower_id, following_id),
  check (follower_id <> following_id)
);

-- projects
create table if not exists projects (
  id             uuid        primary key default gen_random_uuid(),
  owner_id       uuid        not null references profiles(id) on delete cascade,
  title          text        not null check (char_length(title) <= 100),
  description    text,
  category       text,
  category_color text        not null default '#7C5BF5',
  progress       int         not null default 0 check (progress between 0 and 100),
  deadline       text,
  members_count  int         not null default 1,
  created_at     timestamptz not null default now()
);

-- project_members
create table if not exists project_members (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references projects(id)  on delete cascade,
  user_id    uuid        not null references profiles(id)  on delete cascade,
  joined_at  timestamptz not null default now(),
  unique(project_id, user_id)
);

-- posts.image_url (後方互換) / image_urls (複数画像)
alter table posts add column if not exists image_url  text;
alter table posts add column if not exists image_urls text[] not null default '{}';

-- profiles.avatar_url / links (プロフィール画像・複数リンク)
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists website_url text;
alter table profiles add column if not exists links text[] not null default '{}';

-- ────────────────────────────────────────────────────────────
-- 1-b. STORAGE  (post-images / avatars bucket)
-- ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Storage RLS — 既存ポリシーを一旦削除してから再作成
do $$ declare r record; begin
  for r in select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'post_images_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "post_images_select" on storage.objects
  for select using (bucket_id = 'post-images');

create policy "post_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "post_images_delete" on storage.objects
  for delete using (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- avatars バケット
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$ declare r record; begin
  for r in select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'avatars_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ────────────────────────────────────────────────────────────

create index if not exists idx_posts_user_id        on posts(user_id);
create index if not exists idx_posts_created_at     on posts(created_at desc);
create index if not exists idx_post_likes_post_id   on post_likes(post_id);
create index if not exists idx_post_likes_user_id   on post_likes(user_id);
create index if not exists idx_connections_follower  on connections(follower_id);
create index if not exists idx_connections_following on connections(following_id);
create index if not exists idx_projects_created_at  on projects(created_at desc);
create index if not exists idx_project_members_user on project_members(user_id);

-- ────────────────────────────────────────────────────────────
-- 3. ROW-LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

alter table profiles        enable row level security;
alter table posts           enable row level security;
alter table post_likes      enable row level security;
alter table connections     enable row level security;
alter table projects        enable row level security;
alter table project_members enable row level security;

-- Drop existing policies before recreating (idempotent)
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
    where schemaname = 'public'
    and tablename in ('profiles','posts','post_likes','connections','projects','project_members')
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles
create policy "profiles_select"  on profiles for select  using (true);
create policy "profiles_insert"  on profiles for insert  with check (auth.uid() = id);
create policy "profiles_update"  on profiles for update  using (auth.uid() = id);

-- posts
create policy "posts_select"     on posts for select  using (true);
create policy "posts_insert"     on posts for insert  with check (auth.uid() = user_id);
create policy "posts_delete"     on posts for delete  using (auth.uid() = user_id);

-- post_likes
create policy "likes_select"     on post_likes for select  using (true);
create policy "likes_insert"     on post_likes for insert  with check (auth.uid() = user_id);
create policy "likes_delete"     on post_likes for delete  using (auth.uid() = user_id);

-- connections
create policy "conn_select"      on connections for select  using (true);
create policy "conn_insert"      on connections for insert  with check (auth.uid() = follower_id);
create policy "conn_delete"      on connections for delete  using (auth.uid() = follower_id);

-- projects
create policy "proj_select"      on projects for select  using (true);
create policy "proj_insert"      on projects for insert  with check (auth.uid() = owner_id);
create policy "proj_update"      on projects for update  using (auth.uid() = owner_id);
create policy "proj_delete"      on projects for delete  using (auth.uid() = owner_id);

-- project_members
create policy "pm_select"        on project_members for select  using (true);
create policy "pm_insert"        on project_members for insert  with check (auth.uid() = user_id);
create policy "pm_delete"        on project_members for delete  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 4. TRIGGERS  (auto-maintain count columns)
-- ────────────────────────────────────────────────────────────

-- 4-a. Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, username, role, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'username',  new.id::text),
    coalesce(new.raw_user_meta_data->>'role',       'メンバー'),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#7C5BF5')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 4-b. post_likes → posts.likes_count
create or replace function sync_likes_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_likes_count on post_likes;
create trigger trg_likes_count
  after insert or delete on post_likes
  for each row execute procedure sync_likes_count();

-- 4-c. connections → profiles.followers_count
create or replace function sync_followers_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update profiles set followers_count = followers_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_followers_count on connections;
create trigger trg_followers_count
  after insert or delete on connections
  for each row execute procedure sync_followers_count();

-- 4-d. project_members → projects.members_count
create or replace function sync_members_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update projects set members_count = members_count + 1 where id = new.project_id;
  elsif tg_op = 'DELETE' then
    update projects set members_count = greatest(members_count - 1, 0) where id = old.project_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_members_count on project_members;
create trigger trg_members_count
  after insert or delete on project_members
  for each row execute procedure sync_members_count();

-- ────────────────────────────────────────────────────────────
-- Done!  All tables, indexes, RLS policies, and triggers set.
-- ────────────────────────────────────────────────────────────
