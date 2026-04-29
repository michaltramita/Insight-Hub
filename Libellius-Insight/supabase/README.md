# Supabase setup pre Libellius InsightHub

## 1. Vytvorenie schémy

V Supabase otvorte `SQL Editor`, vložte celý obsah súboru:

```text
supabase/schema.sql
```

a spustite ho.

Skript vytvorí:

- organizácie,
- používateľské profily,
- moduly aplikácie,
- priradenia modulov používateľom,
- základ pre test typológie pri vedení ľudí,
- RLS pravidlá pre bezpečný prístup k dátam.

## 1.1. Nahratie otázok typologického testu

Po schéme spustite aj:

```text
supabase/seed_typology_leadership.sql
```

Tento skript vytvorí aktívny test `Test typológie pri vedení ľudí`, nahrá 24
štvoríc tvrdení z Excel šablóny a nastaví výsledky tak, aby ich účastník po
odoslaní nečítal priamo v aplikácii.

## 1.2. Doplnková migrácia pre údaje účastníka

Ak už schéma v Supabase existuje zo skoršej verzie, spustite ešte:

```sql
alter table public.profiles
add column if not exists company_name text;
```

Nová inštalácia tento stĺpec už obsahuje v `schema.sql`.

## 2. Vytváranie používateľov

Účty vytvára administrátor ručne v Supabase v časti `Authentication -> Users`.
Používateľom nastavte email a heslo. Verejnú registráciu odporúčame vypnúť v
`Authentication -> Providers -> Email` cez možnosť `Allow new users to sign up`.

Trigger automaticky vytvorí riadok v `public.profiles`. Noví používatelia majú
predvolenú rolu `participant`.

Potom si môžete používateľa povýšiť na admina:

```sql
update public.profiles
set role = 'admin'
where email = 'vas-email@firma.sk';
```

## 3. Organizácia

```sql
insert into public.organizations (name, slug)
values ('Libellius', 'libellius')
on conflict (slug) do update
set name = excluded.name;
```

Používateľa priraďte do organizácie:

```sql
update public.profiles
set organization_id = (
  select id from public.organizations where slug = 'libellius'
)
where email = 'vas-email@firma.sk';
```

## 4. Priradenie modulov

Používateľ uvidí iba moduly, ktoré má v `module_assignments`.

```sql
insert into public.module_assignments (user_id, organization_id, module_code)
select
  p.id,
  p.organization_id,
  module_code
from public.profiles p
cross join (
  values
    ('360_FEEDBACK'),
    ('ZAMESTNANECKA_SPOKOJNOST'),
    ('TYPOLOGY_LEADERSHIP')
) as modules(module_code)
where p.email = 'vas-email@firma.sk'
on conflict (user_id, module_code) do update
set status = 'active';
```

Pre účastníka typologického testu stačí priradiť iba:

```sql
insert into public.module_assignments (user_id, organization_id, module_code)
select
  p.id,
  p.organization_id,
  'TYPOLOGY_LEADERSHIP'
from public.profiles p
where p.email = 'ucastnik@firma.sk'
on conflict (user_id, module_code) do update
set status = 'active';
```
