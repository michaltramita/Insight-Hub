-- One-off production fix for an existing typology title.
-- Run in Supabase SQL Editor if the deployed app still shows the legacy title.

update public.typology_tests
set title = 'Analýza osobnostnej typológie'
where title in (
  'Test typológie pri vedení ľudí',
  'Test typológie pri vedení ludí'
);
