-- Read-only: lists the public schema (tables, columns, constraints, indexes,
-- RLS policies, functions, triggers). Changes nothing.
-- Paste into Supabase Dashboard > SQL Editor, run, then copy the single
-- "schema" cell into supabase/schema_dump.txt.
with
tbls as (
  select string_agg(
    format(E'TABLE %I (rls=%s)\n%s', c.relname, c.relrowsecurity,
      (select string_agg(format('  %I %s%s%s', a.attname,
                format_type(a.atttypid, a.atttypmod),
                case when a.attnotnull then ' not null' else '' end,
                coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')), E'\n' order by a.attnum)
       from pg_attribute a
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)),
    E'\n\n' order by c.relname) as s
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
cons as (
  select string_agg(format('CONSTRAINT %s.%s: %s', conrelid::regclass, conname, pg_get_constraintdef(oid)), E'\n' order by conrelid::regclass::text, conname) as s
  from pg_constraint where connamespace = 'public'::regnamespace
),
idx as (
  select string_agg(indexdef, E'\n' order by tablename, indexname) as s
  from pg_indexes where schemaname = 'public'
),
pol as (
  select string_agg(format('POLICY %s ON %s FOR %s TO %s USING (%s) WITH CHECK (%s)',
           policyname, tablename, cmd, array_to_string(roles, ','), qual, with_check), E'\n' order by tablename, policyname) as s
  from pg_policies where schemaname = 'public'
),
fns as (
  select string_agg(pg_get_functiondef(p.oid), E'\n\n' order by p.proname) as s
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
),
trg as (
  select string_agg(pg_get_triggerdef(t.oid), E'\n' order by t.tgrelid::regclass::text) as s
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
),
typ as (
  select string_agg(format('ENUM %s: %s', t.typname,
           (select string_agg(e.enumlabel, ', ' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid)), E'\n') as s
  from pg_type t where t.typnamespace = 'public'::regnamespace and t.typtype = 'e'
)
select concat_ws(E'\n\n-----\n\n',
  (select s from tbls), (select s from typ), (select s from cons), (select s from idx),
  (select s from pol), (select s from trg), (select s from fns)) as schema;
