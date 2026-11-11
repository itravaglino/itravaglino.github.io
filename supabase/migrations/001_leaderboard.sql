-- /trader/ leaderboard. Safe to run more than once.
-- anon may select scores. anon may not insert, update, or delete.
-- Writes go through submit_score only.

create extension if not exists pgcrypto;

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  day date not null,
  name text not null,
  score integer not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.score_limits (
  mode text not null,
  day date not null,
  fingerprint text not null,
  primary key (mode, day, fingerprint)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scores_mode_chk') then
    alter table public.scores
      add constraint scores_mode_chk check (mode in ('daily', 'portfolio'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scores_name_chk') then
    alter table public.scores
      add constraint scores_name_chk check (char_length(name) between 1 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scores_score_chk') then
    alter table public.scores
      add constraint scores_score_chk check (
        (mode = 'daily' and score between -20000 and 30000)
        or (mode = 'portfolio' and score between -100000 and 100000)
      );
  end if;
end $$;

create index if not exists scores_rank_idx
  on public.scores (mode, day, score desc, created_at asc);

alter table public.scores enable row level security;
alter table public.score_limits enable row level security;

drop policy if exists scores_select_public on public.scores;
create policy scores_select_public
  on public.scores
  for select
  to anon
  using (true);

revoke all on table public.scores from public, anon, authenticated;
grant select on table public.scores to anon;

revoke all on table public.score_limits from public, anon, authenticated;

drop function if exists public.top10(text, date);
drop function if exists public.get_top10(text, date);

create function public.get_top10(mode text, day date)
returns table(name text, score integer, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, s.score, s.created_at
  from public.scores s
  where s.mode = get_top10.mode
    and (get_top10.mode <> 'daily' or s.day = get_top10.day)
  order by s.score desc, s.created_at asc
  limit 10;
$$;

create or replace function public.submit_score(
  p_mode text,
  p_day date,
  p_name text,
  p_score integer,
  p_details jsonb,
  p_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_today date;
  v_tenth integer;
  v_count integer;
  v_word text;
  v_blocked text[] := array[
    'fuck', 'shit', 'bitch', 'asshole', 'nigger', 'faggot', 'cunt',
    'puta', 'mierda', 'cabron', 'cabrón'
  ];
begin
  if p_mode not in ('daily', 'portfolio') then
    return jsonb_build_object('ok', false, 'error', 'mode');
  end if;

  v_today := (timezone('America/Argentina/Cordoba', now()))::date;
  if p_day is distinct from v_today then
    return jsonb_build_object('ok', false, 'error', 'day');
  end if;

  if p_mode = 'daily' and (p_score < -20000 or p_score > 30000) then
    return jsonb_build_object('ok', false, 'error', 'score');
  end if;
  if p_mode = 'portfolio' and (p_score < -100000 or p_score > 100000) then
    return jsonb_build_object('ok', false, 'error', 'score');
  end if;

  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{8,64}$' then
    return jsonb_build_object('ok', false, 'error', 'fingerprint');
  end if;

  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    return jsonb_build_object('ok', false, 'error', 'name');
  end if;
  if v_name !~ '^[[:alnum:]][[:alnum:] ._''’-]{0,19}$' then
    return jsonb_build_object('ok', false, 'error', 'name');
  end if;
  foreach v_word in array v_blocked loop
    if position(v_word in lower(v_name)) > 0 then
      return jsonb_build_object('ok', false, 'error', 'name');
    end if;
  end loop;

  if p_details is null or jsonb_typeof(p_details) <> 'object' or octet_length(p_details::text) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'details');
  end if;

  select count(*) into v_count
  from public.scores
  where mode = p_mode
    and (p_mode <> 'daily' or scores.day = v_today);

  select s.score into v_tenth
  from public.scores s
  where s.mode = p_mode
    and (p_mode <> 'daily' or s.day = v_today)
  order by s.score desc, s.created_at asc
  offset 9
  limit 1;

  if v_count >= 10 and (v_tenth is null or p_score <= v_tenth) then
    return jsonb_build_object('ok', false, 'error', 'not_top10');
  end if;

  perform 1
  from public.score_limits
  where mode = p_mode and score_limits.day = v_today and fingerprint = p_fingerprint;
  if found then
    return jsonb_build_object('ok', false, 'error', 'rate');
  end if;

  insert into public.score_limits (mode, day, fingerprint)
  values (p_mode, v_today, p_fingerprint);

  insert into public.scores (mode, day, name, score, details)
  values (p_mode, v_today, v_name, p_score, p_details);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_top10(text, date) from public, anon, authenticated;
revoke all on function public.submit_score(text, date, text, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.get_top10(text, date) to anon;
grant execute on function public.submit_score(text, date, text, integer, jsonb, text) to anon;
