-- WELLNESS COMPASS — Supabase schema
-- Run this entire file in Supabase SQL Editor as the project owner.
create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Wellness member',
  role text not null default 'member' check (role in ('member','admin')),
  team_id uuid references public.teams(id) on delete set null,
  protein_target_g integer not null default 80 check (protein_target_g between 1 and 300),
  water_target_ml integer not null default 2500 check (water_target_ml between 250 and 8000),
  steps_target integer not null default 8000 check (steps_target between 100 and 50000),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null default current_date,
  protein_g integer not null default 0 check (protein_g between 0 and 500),
  water_ml integer not null default 0 check (water_ml between 0 and 15000),
  steps integer not null default 0 check (steps between 0 and 100000),
  protein_done boolean not null default false,
  water_done boolean not null default false,
  steps_done boolean not null default false,
  xp_earned integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, log_date)
);

create table if not exists public.points_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  points integer not null check (points >= 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  unique(user_id, achievement_key)
);

create index if not exists daily_logs_user_date_idx on public.daily_logs(user_id, log_date desc);
create index if not exists points_history_user_idx on public.points_history(user_id);
create index if not exists profiles_team_idx on public.profiles(team_id);

-- Create a profile for every new auth user. Public sign-up is enabled by design.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Wellness member'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- XP is computed on the server, never trusted from the browser.
-- Protein goal 20, water goal 15, steps goal 20, check-in 5, all-three bonus 15.
create or replace function public.save_daily_log(
  p_log_date date, p_protein_g integer, p_water_ml integer, p_steps integer
) returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_p boolean; v_w boolean; v_s boolean; v_xp integer;
begin
  if auth.uid() is null then raise exception 'You must sign in.'; end if;
  if p_log_date <> current_date then
    raise exception 'Only today can be updated in this version.';
  end if;
  if p_protein_g < 0 or p_protein_g > 500 or p_water_ml < 0 or p_water_ml > 15000 or p_steps < 0 or p_steps > 100000 then
    raise exception 'Please enter realistic values within the allowed limits.';
  end if;
  select * into v_profile from public.profiles where id = auth.uid();
  v_p := p_protein_g >= v_profile.protein_target_g;
  v_w := p_water_ml >= v_profile.water_target_ml;
  v_s := p_steps >= v_profile.steps_target;
  v_xp := 5 + (case when v_p then 20 else 0 end) + (case when v_w then 15 else 0 end)
            + (case when v_s then 20 else 0 end) + (case when v_p and v_w and v_s then 15 else 0 end);

  insert into public.daily_logs(user_id, log_date, protein_g, water_ml, steps, protein_done, water_done, steps_done, xp_earned, updated_at)
  values(auth.uid(), p_log_date, p_protein_g, p_water_ml, p_steps, v_p, v_w, v_s, v_xp, now())
  on conflict(user_id, log_date) do update set
    protein_g=excluded.protein_g, water_ml=excluded.water_ml, steps=excluded.steps,
    protein_done=excluded.protein_done, water_done=excluded.water_done, steps_done=excluded.steps_done,
    xp_earned=excluded.xp_earned, updated_at=now();

  -- Keep a single daily XP record in sync when a member edits today's check-in.
  delete from public.points_history where user_id=auth.uid() and log_date=p_log_date and reason like 'Daily check-in%';
  insert into public.points_history(user_id, log_date, points, reason)
  values(auth.uid(), p_log_date, v_xp, 'Daily check-in');

  insert into public.member_achievements(user_id, achievement_key)
  values(auth.uid(), 'first_checkin') on conflict do nothing;

  if (select count(*) from public.daily_logs where user_id=auth.uid() and water_done) >= 7 then
    insert into public.member_achievements(user_id, achievement_key) values(auth.uid(),'hydration_7') on conflict do nothing;
  end if;
  if (select count(*) from public.daily_logs where user_id=auth.uid() and protein_done) >= 7 then
    insert into public.member_achievements(user_id, achievement_key) values(auth.uid(),'protein_7') on conflict do nothing;
  end if;
  if (select count(*) from public.daily_logs where user_id=auth.uid() and steps_done) >= 7 then
    insert into public.member_achievements(user_id, achievement_key) values(auth.uid(),'steps_7') on conflict do nothing;
  end if;
  if (select count(*) from public.daily_logs where user_id=auth.uid() and log_date >= current_date - 6) = 7 then
    insert into public.member_achievements(user_id, achievement_key) values(auth.uid(),'streak_7') on conflict do nothing;
  end if;
  return v_xp;
end;
$$;

-- Read-only leaderboard views.
create or replace view public.leaderboard_view as
select p.id as user_id, p.display_name, coalesce(sum(d.xp_earned),0)::bigint as total_xp
from public.profiles p left join public.daily_logs d on d.user_id=p.id
group by p.id,p.display_name;

create or replace view public.team_leaderboard_view as
select t.id as team_id, coalesce(sum(d.xp_earned),0)::bigint as total_xp
from public.teams t
left join public.profiles p on p.team_id=t.id
left join public.daily_logs d on d.user_id=p.id
group by t.id;

create or replace view public.admin_member_summary with (security_invoker = true) as
select p.id,p.display_name,p.role,p.team_id,coalesce(sum(d.xp_earned),0)::bigint as total_xp,
       count(d.id)::bigint as checkin_days
from public.profiles p left join public.daily_logs d on d.user_id=p.id
group by p.id,p.display_name,p.role,p.team_id;

-- RLS: profiles are publicly readable for community display names/leaderboards.
-- Members can only update their own profile's safe fields. Role changes are admin-only.
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.daily_logs enable row level security;
alter table public.points_history enable row level security;
alter table public.member_achievements enable row level security;

drop policy if exists "Profiles readable by signed-in users" on public.profiles;
create policy "Profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
drop policy if exists "Members update own profile" on public.profiles;
create policy "Members update own profile" on public.profiles for update to authenticated
using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());
-- Prevent self-promotion: role cannot be changed by a member through direct updates.
create or replace function public.guard_profile_role()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator can change member roles.';
  end if;
  return new;
end; $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles for each row execute function public.guard_profile_role();

drop policy if exists "Teams visible to everyone signed in" on public.teams;
create policy "Teams visible to everyone signed in" on public.teams for select to authenticated using (true);
drop policy if exists "Admins manage teams" on public.teams;
create policy "Admins manage teams" on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Members read own logs and admins read all" on public.daily_logs;
create policy "Members read own logs and admins read all" on public.daily_logs for select to authenticated using (user_id=auth.uid() or public.is_admin());
drop policy if exists "Members read own points" on public.points_history;
create policy "Members read own points" on public.points_history for select to authenticated using (user_id=auth.uid() or public.is_admin());
drop policy if exists "Members read own achievements" on public.member_achievements;
create policy "Members read own achievements" on public.member_achievements for select to authenticated using (user_id=auth.uid() or public.is_admin());

grant usage on schema public to authenticated;
grant select on public.profiles, public.teams, public.daily_logs, public.points_history, public.member_achievements to authenticated;
grant update(display_name, team_id, protein_target_g, water_target_ml, steps_target, role) on public.profiles to authenticated;
grant insert, update, delete on public.teams to authenticated;
grant select on public.leaderboard_view, public.team_leaderboard_view, public.admin_member_summary to authenticated;
grant execute on function public.save_daily_log(date,integer,integer,integer) to authenticated;

-- IMPORTANT: after creating your account, promote your own account once using SQL:
-- update public.profiles set role='admin' where id=(select id from auth.users where email='YOUR_EMAIL');
-- Do not expose the service_role key in frontend code.
