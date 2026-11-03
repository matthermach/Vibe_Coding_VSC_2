begin;

create or replace function public.valid_roadmap_payload(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  initiative jsonb;
  item_count integer := 0;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object'
    or octet_length(value::text) > 2000000
    or (value -> 'version') is distinct from '1'::jsonb
    or jsonb_typeof(value -> 'horizon') is distinct from 'string'
    or (value ->> 'horizon') !~ '^\d{4}-(0[1-9]|1[0-2])-01$'
    or jsonb_typeof(value -> 'teams') is distinct from 'array'
    or jsonb_typeof(value -> 'skills') is distinct from 'array'
    or jsonb_typeof(value -> 'initiatives') is distinct from 'array'
  then return false; end if;
  if jsonb_array_length(value -> 'teams') > 30
    or jsonb_array_length(value -> 'skills') > 30
    or jsonb_array_length(value -> 'initiatives') > 30
  then return false; end if;
  for initiative in select * from jsonb_array_elements(value -> 'initiatives') loop
    if jsonb_typeof(initiative -> 'items') is distinct from 'array' then return false; end if;
    item_count := item_count + jsonb_array_length(initiative -> 'items');
    if item_count > 200 then return false; end if;
  end loop;
  return true;
end;
$$;

create table if not exists public.roadmap_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.roadmap_workspaces (
  id text primary key check (id = 'main'),
  data jsonb check (public.valid_roadmap_payload(data)),
  revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.roadmap_workspaces (id) values ('main') on conflict (id) do nothing;

alter table public.roadmap_members enable row level security;
alter table public.roadmap_workspaces enable row level security;

revoke all on public.roadmap_members, public.roadmap_workspaces from public, anon, authenticated;
grant select on public.roadmap_members, public.roadmap_workspaces to authenticated;

drop policy if exists roadmap_members_read_self on public.roadmap_members;
create policy roadmap_members_read_self on public.roadmap_members
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists roadmap_workspace_read_members on public.roadmap_workspaces;
create policy roadmap_workspace_read_members on public.roadmap_workspaces
  for select to authenticated
  using (exists (select 1 from public.roadmap_members where user_id = (select auth.uid())));

create or replace function public.save_roadmap_workspace(expected_revision bigint, payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.roadmap_members where user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Brak dostepu do workspace.';
  end if;
  if expected_revision is null or expected_revision < 0 or payload is null then
    raise exception using errcode = '22023', message = 'Nieprawidlowy zapis workspace.';
  end if;
  update public.roadmap_workspaces as workspace
    set data = payload,
        revision = workspace.revision + 1,
        updated_at = now(),
        updated_by = auth.uid()
    where workspace.id = 'main' and workspace.revision = expected_revision
    returning workspace.revision into next_revision;
  if not found then
    raise exception using errcode = '40001', message = 'Plan zostal zmieniony przez innego uzytkownika.';
  end if;
  return next_revision;
end;
$$;

revoke all on function public.save_roadmap_workspace(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_roadmap_workspace(bigint, jsonb) to authenticated;

commit;