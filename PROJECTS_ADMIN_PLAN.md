# Plan: Projekty a ucastnici v admin rozhrani

## Aktualny stav

- Admin UI je centralizovane v `Libellius-Insight/components/admin/AdminUsersView.tsx`.
- Data pre admin nacitava `Libellius-Insight/services/adminAccess.ts` cez `admin_list_users`, `organizations`, `modules` a `typology_tests`.
- Vytvorenie pouzivatela ide cez `Libellius-Insight/api/admin-create-user.ts`, ktore vytvori Supabase Auth usera a zavola RPC `admin_finalize_created_user`.
- Pouzivatel je ulozeny v `profiles`; firma je dnes volny text `company_name`.
- `organizations` uz existuju a sluzia ako technicka organizacna/RLS hranica. Nepouzivame ich ako firemne projekty.
- Moduly su v `module_assignments` a su dnes viazane globalne na `(user_id, module_code)`.
- Spristupnenie vysledkov typologie je dnes globalne pre test cez `typology_tests.participant_results_available_at`, nie na urovni pouzivatela alebo projektu.

## Navrhovany datovy model

Pridavam novu projektovu vrstvu bez zmeny existujucich pouzivatelskych dat:

- `company_projects`
  - `id`
  - `organization_id`
  - `name`
  - `company_name`
  - `description`
  - `contact_person_name`
  - `contact_person_email`
  - `status`: `active | completed | archived`
  - `module_codes`
  - `result_access_date`
  - audit polia `created_by`, `created_at`, `updated_at`
- `company_project_participants`
  - `project_id`
  - `user_id`
  - `added_by`
  - `added_at`

Vztah projekt-pouzivatel je many-to-many cez `company_project_participants`. Tym ostava otvorena moznost, aby jeden pouzivatel patril v buducnosti do viacerych projektov.

## Spatna kompatibilita

- `profiles.company_name`, `profiles.organization_id` a existujuce `module_assignments` ostavaju zachovane.
- Existujuci pouzivatelia bez projektu sa nestratia. V UI budu zobrazovani v sekcii `Nezaradeni pouzivatelia`.
- Spristupnenie typologickych vysledkov je nastavene cisto projektovo.
- Admin stale uvidi aj povodny zoznam vsetkych pouzivatelov s povodnymi akciami.

## Subory, ktore budem menit

- `PROJECTS_ADMIN_PLAN.md`
- `Libellius-Insight/services/adminAccess.ts`
  - nove typy pre projekty,
  - nacitanie projektov a ich ucastnikov,
  - create/update/archive projektu,
  - pridanie/odstranenie ucastnika,
  - projektove nastavenie datumu spristupnenia vysledkov.
- `Libellius-Insight/api/admin-create-user.ts`
  - volitelny `projectId`,
  - priradenie novovytvoreneho pouzivatela do projektu.
- `Libellius-Insight/api/admin-create-user.test.ts`
  - doplnenie testu pre priradenie do projektu.
- `Libellius-Insight/components/admin/AdminUsersView.tsx`
  - header `Projekty a ucastnici`,
  - vyhladavanie cez projekt, firmu, meno a email,
  - zoznam projektov,
  - detail projektu s ucastnikmi,
  - modal na vytvorenie/upravu projektu,
  - flow na priradenie existujuceho pouzivatela,
  - vytvorenie pouzivatela priamo z projektu s predvyplnenou firmou/modulmi.
- `Libellius-Insight/supabase/company_projects_admin.sql`
  - nova migracia pre tabulky, indexy, RLS a admin policies.

## Admin UI

- Horny panel ostane v existujucom vizualnom style: velky nadpis, cierne primarne tlacidla, biele karty, zaoblene rohy, jemne tiene.
- Nadpis bude `Projekty a ucastnici`.
- Akcie hore:
  - `Vytvorit projekt`
  - `Vytvorit pouzivatela`
  - `Obnovit`
- Projekty budu zobrazene ako karty/accordion polozky.
- Rozbaleny projekt zobrazi zakladne info, moduly, datum spristupnenia vysledkov a zoznam ucastnikov.
- Povodne akcie nad pouzivatelmi ostanu dostupne v povodnom zozname pouzivatelov.
- Pouzivatelia bez projektu budu v sekcii `Nezaradeni pouzivatelia`.

## Pridavanie ucastnikov

- Novy pouzivatel z projektu:
  - predvyplni `companyName`,
  - predvyplni `projectId`,
  - predvyplni moduly z projektu.
- Existujuci pouzivatel:
  - admin ho vyberie zo zoznamu a priradi do projektu cez `company_project_participants`.

## Spristupnenie vysledkov

- Spristupnenie pre ucastnika je riadene cez `company_projects.result_access_date`.
- Ak je pouzivatel v projekte bez nastaveneho datumu, vysledky ostavaju zamknute.
- Globalna sekcia spristupnenia na urovni testu je vypnuta.

## Follow-up

- Projektovo izolovane typologicke testy cez `typology_tests.project_id`.
- Projektovo scoped modulove priradenia, ak bude potrebne mat rovnakeho pouzivatela s rovnakym modulom vo viacerych projektoch.
- Transakcne RPC pre hromadne akcie a audit log.
- Export ucastnikov projektu, ak sa zavedie jednotny exportny service.
