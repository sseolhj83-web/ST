-- 1. PROFILES TABLE (사용자 프로필 정보)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  username text unique,
  avatar_url text,
  constraint username_length check (char_length(username) >= 2)
);

-- 2. USER STATS TABLE (사용자 전적/점수 정보)
create table public.user_stats (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  highest_score integer default 0 not null,
  total_frags integer default 0 not null,
  total_deaths integer default 0 not null,
  matches_played integer default 0 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. ROOMS TABLE (멀티플레이어 대기실/방 정보)
create table public.rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  host_id uuid references public.profiles(id) on delete cascade not null,
  host_username text not null,
  max_players integer default 4 not null,
  status text default 'waiting'::text check (status in ('waiting', 'playing', 'finished')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 테이블을 Supabase Realtime 복제(Replication) 리스트에 추가 (실시간 방 목록 갱신용)
alter publication supabase_realtime add table public.rooms;

-- 4. ROW LEVEL SECURITY (RLS) 설정
alter table public.profiles enable row level security;
alter table public.user_stats enable row level security;
alter table public.rooms enable row level security;

-- Profiles Policies
create policy "누구나 프로필을 조회할 수 있습니다." on public.profiles
  for select using (true);

create policy "본인의 프로필만 수정할 수 있습니다." on public.profiles
  for update using (auth.uid() = id);

-- User Stats Policies
create policy "누구나 전적을 조회할 수 있습니다." on public.user_stats
  for select using (true);

create policy "본인의 전적만 수정할 수 있습니다." on public.user_stats
  for update using (auth.uid() = user_id);

create policy "본인의 전적을 삽입할 수 있습니다." on public.user_stats
  for insert with check (auth.uid() = user_id);

-- Rooms Policies
create policy "누구나 방 목록을 조회할 수 있습니다." on public.rooms
  for select using (true);

create policy "인증된 사용자만 방을 생성할 수 있습니다." on public.rooms
  for insert with check (auth.role() = 'authenticated');

create policy "방장만 방 정보를 수정할 수 있습니다." on public.rooms
  for update using (auth.uid() = host_id);

create policy "방장만 방을 삭제(종료)할 수 있습니다." on public.rooms
  for delete using (auth.uid() = host_id);

-- 5. AUTOMATIC PROFILE/STATS CREATION ON SIGNUP (회원가입 시 프로필/전적 자동 생성 트리거)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    now()
  );

  insert into public.user_stats (user_id, highest_score, total_frags, total_deaths, matches_played)
  values (new.id, 0, 0, 0, 0);

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
