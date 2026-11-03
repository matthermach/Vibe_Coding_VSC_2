begin;

insert into auth.users (id, email) values
  ('bf680b61-e211-4da3-96d2-001000000001', 'forma-rls-member@example.invalid'),
  ('bf680b61-e211-4da3-96d2-001000000002', 'forma-rls-outsider@example.invalid');
insert into public.roadmap_members (user_id) values ('bf680b61-e211-4da3-96d2-001000000001');

set local role anon;
do $$
begin
  begin
    perform * from public.roadmap_workspaces;
    raise exception 'FAIL: anon can read workspace';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_roadmap_workspace(0, '{}'::jsonb);
    raise exception 'FAIL: anon can execute save';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'bf680b61-e211-4da3-96d2-001000000002', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.roadmap_workspaces) then raise exception 'FAIL: outsider can read workspace'; end if;
  if exists (select 1 from public.roadmap_members) then raise exception 'FAIL: outsider can read members'; end if;
  begin
    perform public.save_roadmap_workspace(0, '{}'::jsonb);
    raise exception 'FAIL: outsider can save workspace';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'bf680b61-e211-4da3-96d2-001000000001', true);
set local role authenticated;
do $$
declare
  original_revision bigint;
  next_revision bigint;
  payload jsonb := '{"version":1,"horizon":"2026-11-01","skills":[],"teams":[],"initiatives":[]}'::jsonb;
begin
  select revision into strict original_revision from public.roadmap_workspaces where id = 'main';
  if (select count(*) from public.roadmap_members) <> 1 then raise exception 'FAIL: membership visibility'; end if;
  next_revision := public.save_roadmap_workspace(original_revision, payload);
  if next_revision <> original_revision + 1 then raise exception 'FAIL: revision did not increment'; end if;
  if (select data from public.roadmap_workspaces where id = 'main') is distinct from payload then raise exception 'FAIL: payload did not save'; end if;
  begin
    perform public.save_roadmap_workspace(original_revision, payload);
    raise exception 'FAIL: stale revision overwrote workspace';
  exception when serialization_failure then null;
  end;
  begin
    perform public.save_roadmap_workspace(next_revision, '{}'::jsonb);
    raise exception 'FAIL: malformed payload accepted';
  exception when check_violation then null;
  end;
  begin
    update public.roadmap_workspaces set data = payload where id = 'main';
    raise exception 'FAIL: direct update bypassed revision check';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.roadmap_members (user_id) values ('bf680b61-e211-4da3-96d2-001000000002');
    raise exception 'FAIL: member can grant permissions';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

delete from public.roadmap_members where user_id = 'bf680b61-e211-4da3-96d2-001000000001';
set local role authenticated;
do $$
begin
  if exists (select 1 from public.roadmap_workspaces) then raise exception 'FAIL: revoked member can read'; end if;
  begin
    perform public.save_roadmap_workspace(0, '{}'::jsonb);
    raise exception 'FAIL: revoked member can save';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;
select 'PASS: RLS, membership, writes, validation and revision conflicts' as result;