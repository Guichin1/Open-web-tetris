create table if not exists public.player_scores (
  player_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 16),
  best_score bigint not null check (best_score >= 0),
  updated_at timestamptz not null default now()
);

alter table public.player_scores enable row level security;

revoke all on table public.player_scores from anon, authenticated;
grant select on table public.player_scores to anon, authenticated;

drop policy if exists player_scores_public_read on public.player_scores;
create policy player_scores_public_read
  on public.player_scores
  for select
  to anon, authenticated
  using (true);

create or replace function public.submit_player_score(
  p_nickname text,
  p_score bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_nickname text := btrim(p_nickname);
begin
  if v_player_id is null then
    raise exception 'Sign in is required to submit a score.';
  end if;

  if v_nickname is null or char_length(v_nickname) not between 2 and 16 then
    raise exception 'Nickname must contain between 2 and 16 characters.';
  end if;

  if p_score is null or p_score < 0 then
    raise exception 'Score must be zero or greater.';
  end if;

  insert into public.player_scores (player_id, nickname, best_score)
  values (v_player_id, v_nickname, p_score)
  on conflict (player_id) do update
  set
    nickname = excluded.nickname,
    best_score = greatest(public.player_scores.best_score, excluded.best_score),
    updated_at = case
      when excluded.best_score > public.player_scores.best_score then now()
      else public.player_scores.updated_at
    end;
end;
$$;

revoke all on function public.submit_player_score(text, bigint) from public, anon, authenticated;
grant execute on function public.submit_player_score(text, bigint) to authenticated;
