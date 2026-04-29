-- Seed for "Test typológie pri vedení ľudí".
-- Run after supabase/schema.sql and after creating the Libellius organization.

insert into public.organizations (name, slug)
values ('Libellius', 'libellius')
on conflict (slug) do update
set name = excluded.name;

drop policy if exists typology_results_select_own_or_org_admin on public.typology_results;
drop policy if exists typology_results_write_own on public.typology_results;
drop policy if exists typology_results_insert_own on public.typology_results;
drop policy if exists typology_results_update_own on public.typology_results;

with org as (
  select id from public.organizations where slug = 'libellius'
),
existing_test as (
  select tt.id
  from public.typology_tests tt
  join org on org.id = tt.organization_id
  where tt.title = 'Test typológie pri vedení ľudí'
  limit 1
),
inserted_test as (
  insert into public.typology_tests (organization_id, title, description, status)
  select
    org.id,
    'Test typológie pri vedení ľudí',
    'Dotazník pracovného a líderského štýlu pre rozvojový program.',
    'active'
  from org
  where not exists (select 1 from existing_test)
  returning id
),
target_test as (
  select id from existing_test
  union all
  select id from inserted_test
),
question_rows (question_no, option_key, style_code, statement, sort_order) as (
  values
    (1, 'a', 'b', 'Rád preberám iniciatívu a určujem smer.', 1),
    (1, 'b', 'd', 'Rád podporujem spoluprácu a dobré vzťahy.', 2),
    (1, 'c', 'c', 'Rád si veci premyslím a postupujem systematicky.', 3),
    (1, 'd', 'a', 'Rád ovplyvňujem ľudí a nadchýnam ich pre svoje nápady.', 4),
    (2, 'a', 'b', 'V konflikte idem priamo k veci a otvorene ho riešim.', 5),
    (2, 'b', 'a', 'V konflikte sa snažím situáciu odľahčiť a uvoľniť atmosféru.', 6),
    (2, 'c', 'd', 'V konflikte sa snažím zmierniť napätie a nájsť dohodu.', 7),
    (2, 'd', 'c', 'V konflikte sa držím faktov a argumentov.', 8),
    (3, 'a', 'd', 'Rád pomáham ostatným a podporujem tím.', 9),
    (3, 'b', 'c', 'Rád zabezpečujem kvalitu a správnosť.', 10),
    (3, 'c', 'b', 'Rád dosahujem výsledky a napredujem.', 11),
    (3, 'd', 'a', 'Rád prinášam nové nápady a možnosti.', 12),
    (4, 'a', 'c', 'Rozhodujem sa na základe analýzy.', 13),
    (4, 'b', 'd', 'Rozhodujem sa s ohľadom na ľudí.', 14),
    (4, 'c', 'b', 'Rozhodujem sa rýchlo a priamo.', 15),
    (4, 'd', 'a', 'Rozhodujem sa skôr intuitívne.', 16),
    (5, 'a', 'c', 'Rád pracujem s detailmi a dátami.', 17),
    (5, 'b', 'b', 'Rád mám veci pod kontrolou.', 18),
    (5, 'c', 'd', 'Rád vytváram stabilné prostredie.', 19),
    (5, 'd', 'a', 'Rád som v kontakte s ľuďmi a komunikujem.', 20),
    (6, 'a', 'c', 'Rád dodržiavam postupy a pravidlá.', 21),
    (6, 'b', 'b', 'Rád súťažím a prekonávam výzvy.', 22),
    (6, 'c', 'd', 'Rád spolupracujem a vychádzam v ústrety.', 23),
    (6, 'd', 'a', 'Rád presviedčam a ovplyvňujem druhých.', 24),
    (7, 'a', 'b', 'Pod tlakom sa sústredím na dosiahnutie výsledku.', 25),
    (7, 'b', 'd', 'Pod tlakom sa snažím upokojiť situáciu a ľudí.', 26),
    (7, 'c', 'c', 'Pod tlakom spomaľujem a kontrolujem detaily.', 27),
    (7, 'd', 'a', 'Pod tlakom reagujem rýchlo a improvizujem.', 28),
    (8, 'a', 'b', 'Pôsobím rozhodne a sebavedomo.', 29),
    (8, 'b', 'a', 'Pôsobím nadšene a motivujem ostatných.', 30),
    (8, 'c', 'd', 'Pôsobím pokojne a vyrovnane.', 31),
    (8, 'd', 'c', 'Pôsobím rezervovane a vecne.', 32),
    (9, 'a', 'd', 'Rád budujem dlhodobé vzťahy.', 33),
    (9, 'b', 'b', 'Rád pracujem samostatne na cieľoch.', 34),
    (9, 'c', 'c', 'Rád sa sústredím na presnosť.', 35),
    (9, 'd', 'a', 'Rád nadväzujem nové kontakty.', 36),
    (10, 'a', 'c', 'Keď nastane chyba, analyzujem príčinu.', 37),
    (10, 'b', 'd', 'Keď nastane chyba, zameriam sa na dopad na ľudí.', 38),
    (10, 'c', 'a', 'Keď nastane chyba, snažím sa situáciu odľahčiť.', 39),
    (10, 'd', 'b', 'Keď nastane chyba, riešim ju okamžite a priamo.', 40),
    (11, 'a', 'a', 'Rád hovorím a zdieľam svoje myšlienky.', 41),
    (11, 'b', 'd', 'Rád počúvam a dávam priestor druhým.', 42),
    (11, 'c', 'c', 'Rád si veci organizujem a plánujem.', 43),
    (11, 'd', 'b', 'Rád rozhodujem rýchlo.', 44),
    (12, 'a', 'a', 'Rád presviedčam a získavam si ľudí.', 45),
    (12, 'b', 'c', 'Rád analyzujem situácie.', 46),
    (12, 'c', 'd', 'Rád podporujem druhých.', 47),
    (12, 'd', 'b', 'Rád dosahujem výsledky.', 48),
    (13, 'a', 'd', 'V neistote sa radím s ostatnými.', 49),
    (13, 'b', 'c', 'V neistote si zbieram viac informácií.', 50),
    (13, 'c', 'a', 'V neistote sa riadim pocitom a intuíciou.', 51),
    (13, 'd', 'b', 'V neistote sa rozhodujem rýchlo a idem do akcie.', 52),
    (14, 'a', 'd', 'Rád pristupujem k ľuďom citlivo.', 53),
    (14, 'b', 'b', 'Rád konám rázne a rozhodne.', 54),
    (14, 'c', 'a', 'Rád nadchnem ľudí pre myšlienku.', 55),
    (14, 'd', 'c', 'Rád zvažujem riziká.', 56),
    (15, 'a', 'a', 'Zmena ma baví a prináša mi energiu.', 57),
    (15, 'b', 'd', 'Zmenu prijímam postupne a opatrne.', 58),
    (15, 'c', 'c', 'Pri zmene potrebujem čas na pochopenie.', 59),
    (15, 'd', 'b', 'Zmenu beriem ako výzvu a príležitosť.', 60),
    (16, 'a', 'a', 'Rád pôsobím pozitívne a optimisticky.', 61),
    (16, 'b', 'b', 'Rád si stojím za svojím názorom.', 62),
    (16, 'c', 'c', 'Rád hodnotím a posudzujem fakty.', 63),
    (16, 'd', 'd', 'Rád vnímam potreby druhých.', 64),
    (17, 'a', 'a', 'Rád dávam najavo svoje emócie.', 65),
    (17, 'b', 'd', 'Rád sa starám o dobré vzťahy.', 66),
    (17, 'c', 'c', 'Rád postupujem disciplinovane.', 67),
    (17, 'd', 'b', 'Rád preberám kontrolu nad situáciou.', 68),
    (18, 'a', 'a', 'Rád získavam uznanie za svoju prácu.', 69),
    (18, 'b', 'd', 'Rád robím veci tak, aby boli prijateľné pre všetkých.', 70),
    (18, 'c', 'c', 'Rád robím veci precízne.', 71),
    (18, 'd', 'b', 'Rád dosahujem náročné ciele.', 72),
    (19, 'a', 'b', 'Rád iniciujem zmeny.', 73),
    (19, 'b', 'd', 'Rád udržiavam harmóniu.', 74),
    (19, 'c', 'c', 'Rád zachovávam poriadok a systém.', 75),
    (19, 'd', 'a', 'Rád prichádzam s novými nápadmi.', 76),
    (20, 'a', 'a', 'Do spolupráce prinášam energiu a nápady.', 77),
    (20, 'b', 'c', 'V spolupráci dbám na kvalitu a presnosť.', 78),
    (20, 'c', 'b', 'V spolupráci preberám iniciatívu.', 79),
    (20, 'd', 'd', 'V spolupráci podporujem ostatných.', 80),
    (21, 'a', 'a', 'Pracujem rýchlo a spontánne.', 81),
    (21, 'b', 'c', 'Pracujem premyslene a systematicky.', 82),
    (21, 'c', 'b', 'Pracujem rýchlo a cieľavedomo.', 83),
    (21, 'd', 'd', 'Pracujem pokojne a stabilne.', 84),
    (22, 'a', 'd', 'Rád podporujem ostatných.', 85),
    (22, 'b', 'c', 'Rád zbieram informácie.', 86),
    (22, 'c', 'b', 'Rád pôsobím energicky a dynamicky.', 87),
    (22, 'd', 'a', 'Rád komunikujem s ľuďmi a prepájam ich.', 88),
    (23, 'a', 'c', 'Rád pracujem s faktami.', 89),
    (23, 'b', 'b', 'Rád hovorím priamo.', 90),
    (23, 'c', 'a', 'Rád vytváram priateľskú atmosféru.', 91),
    (23, 'd', 'd', 'Rád komunikujem pokojne.', 92),
    (24, 'a', 'b', 'Uprednostňujem výsledok a efektivitu.', 93),
    (24, 'b', 'd', 'Uprednostňujem dobré vzťahy a spoluprácu.', 94),
    (24, 'c', 'a', 'Uprednostňujem zaujímavé a nové veci.', 95),
    (24, 'd', 'c', 'Uprednostňujem presnosť a kvalitu.', 96)
)
insert into public.typology_questions (
  test_id,
  question_no,
  option_key,
  style_code,
  statement,
  sort_order
)
select
  target_test.id,
  question_rows.question_no,
  question_rows.option_key,
  question_rows.style_code,
  question_rows.statement,
  question_rows.sort_order
from target_test
cross join question_rows
on conflict (test_id, question_no, option_key) do update
set
  style_code = excluded.style_code,
  statement = excluded.statement,
  sort_order = excluded.sort_order;

update public.typology_tests
set status = 'active'
where title = 'Test typológie pri vedení ľudí'
  and organization_id = (select id from public.organizations where slug = 'libellius');
