-- Migration: Prepare shared extensions and user_role enum values

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('super-admin', 'client-tenant');
  else
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'user_role'
        and e.enumlabel = 'super-admin'
    ) then
      execute 'alter type user_role add value ' || quote_literal('super-admin') || ';';
    end if;

    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'user_role'
        and e.enumlabel = 'client-tenant'
    ) then
      execute 'alter type user_role add value ' || quote_literal('client-tenant') || ';';
    end if;
  end if;
end
$$;

