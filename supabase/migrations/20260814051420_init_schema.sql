-- ============================================================
-- KcalTracker — Schéma initial (MVP + préparation V1.5)
-- v2 : OpenFoodFacts retiré du schéma, macros cachées sur foods,
--      nutrients = table complète (brute + convertie) par aliment
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

create type sex_enum as enum ('male', 'female');

create type activity_level_enum as enum (
  'sedentary',   -- sédentaire
  'light',       -- légèrement actif (1-3j/sem)
  'moderate',    -- modérément actif (3-5j/sem)
  'active',      -- très actif (6-7j/sem)
  'extreme'      -- extrêmement actif (2x/jour)
);

create type goal_type_enum as enum ('maintenance', 'surplus', 'deficit');

create type food_source_enum as enum ('ciqual', 'user');
-- ⚠️ 'openfoodfacts' retiré volontairement. Réintroduction en V2 = simple migration
--    (ALTER TYPE food_source_enum ADD VALUE 'openfoodfacts').

create type unit_type_enum as enum ('grams', 'ml', 'unit');

create type nutrient_category_enum as enum ('macro', 'fatty_acid', 'sugar', 'vitamin', 'mineral', 'other');

create type nutrient_value_type_enum as enum ('measured', 'traces', 'less_than', 'not_measured');

create type confidence_code_enum as enum ('A', 'B', 'C', 'D');

-- ============================================================
-- PROFILES
-- ============================================================

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  bio text,
  is_public boolean not null default false,
  sex sex_enum not null,
  birth_date date not null,               -- indispensable au calcul du BMR
  height_cm numeric not null,
  weight_kg numeric not null,
  activity_level activity_level_enum not null,
  goal_type goal_type_enum not null default 'maintenance',
  daily_kcal_target numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own_or_public"
  on profiles for select
  using (user_id = auth.uid() or is_public = true);

create policy "profiles_insert_own"
  on profiles for insert
  with check (user_id = auth.uid());

create policy "profiles_update_own"
  on profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "profiles_delete_own"
  on profiles for delete
  using (user_id = auth.uid());

-- ============================================================
-- FOODS
-- Table de référence utilisée par tous les composants de l'app.
-- Contient les 5 macros principales EN CACHE (copie dérivée de `nutrients`
-- pour les aliments CIQUAL, saisie directe pour les aliments perso).
-- ============================================================

create table foods (
  id bigint generated always as identity primary key,
  name text not null,
  owner_profile_id uuid references profiles(id) on delete cascade,  -- null si CIQUAL
  source food_source_enum not null default 'user',
  external_id text,                        -- alim_code CIQUAL, clé stable pour upsert
  is_shared boolean not null default false,   -- préparation V1.5, aucune logique/UI dessus en MVP
  is_public boolean not null default false,   -- true pour les aliments CIQUAL/seed

  unit_type unit_type_enum not null default 'grams',
  density_g_per_ml numeric,                -- utilisé uniquement si unit_type = 'ml'

  category_name text,                      -- ex "fruits et légumes", texte libre CIQUAL, un seul niveau

  -- 5 macros principales, toujours pour 100 g — cache dérivé de `nutrients` pour les aliments CIQUAL
  kcal_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,

  kcal_from_macros numeric,                -- contrôle qualité (règle 4/4/9), calculé à l'import, jamais affiché

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint foods_owner_required_if_user
    check (source != 'user' or owner_profile_id is not null),
  constraint foods_density_only_if_ml
    check (unit_type = 'ml' or density_g_per_ml is null)
);

create unique index foods_external_id_unique
  on foods (source, external_id)
  where external_id is not null;

create index foods_owner_idx on foods (owner_profile_id);
create index foods_name_trgm_idx on foods using gin (name gin_trgm_ops);
-- index trigram : permet une recherche ILIKE '%...%' rapide et tolérante aux fautes de frappe

alter table foods enable row level security;

create policy "foods_select_public_or_own"
  on foods for select
  using (
    is_public = true
    or owner_profile_id = (select id from profiles where user_id = auth.uid())
  );

create policy "foods_insert_own"
  on foods for insert
  with check (
    source = 'user'
    and owner_profile_id = (select id from profiles where user_id = auth.uid())
  );

create policy "foods_update_own"
  on foods for update
  using (
    source = 'user'
    and owner_profile_id = (select id from profiles where user_id = auth.uid())
  )
  with check (
    source = 'user'
    and owner_profile_id = (select id from profiles where user_id = auth.uid())
  );

create policy "foods_delete_own"
  on foods for delete
  using (
    source = 'user'
    and owner_profile_id = (select id from profiles where user_id = auth.uid())
  );

-- ============================================================
-- NUTRIENTS
-- Détail COMPLET de tous les nutriments CIQUAL par aliment (macros,
-- vitamines, minéraux, sucres, graisses saturées...). Source de vérité
-- unique, utilisée uniquement par la fiche produit détaillée.
-- N'existe que pour les aliments source='ciqual' — un aliment perso
-- n'a pas de lignes ici (l'utilisateur saisit juste les 5 macros sur foods).
-- ============================================================

create table nutrients (
  id bigint generated always as identity primary key,
  food_id bigint not null references foods(id) on delete cascade,
  external_id text not null,               -- const_code CIQUAL (identifiant du nutriment)
  name_fr text not null,
  name_en text,
  unit text not null,                      -- normalisé à l'import : g | mg | µg | kcal | kJ
  category nutrient_category_enum not null default 'other',

  value_type nutrient_value_type_enum not null default 'measured',
  raw_value_text text,                     -- teneur brute avant conversion : "-", "traces", "<0,5", "12,4"
  value numeric,                           -- teneur convertie, exploitable directement (NULL si not_measured)

  confidence_code confidence_code_enum,    -- A=très fiable à D=moins fiable

  created_at timestamptz not null default now()
);

create unique index nutrients_food_external_id_unique
  on nutrients (food_id, external_id);
create index nutrients_food_idx on nutrients (food_id);

alter table nutrients enable row level security;

-- lecture publique (dictionnaire global, aucune donnée personnelle)
create policy "nutrients_select_all"
  on nutrients for select
  using (true);

-- pas de policy insert/update/delete : écriture réservée au rôle service (script d'import), hors RLS applicative

-- ============================================================
-- RECIPES
-- ============================================================

create table recipes (
  id bigint generated always as identity primary key,
  owner_profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  servings integer not null check (servings > 0),
  is_shared boolean not null default false,   -- préparation V1.5, aucune logique/UI dessus en MVP

  -- total de LA RECETTE ENTIÈRE (somme de tous les recipe_items), pas par portion
  calculated_kcal numeric not null default 0,
  calculated_protein numeric not null default 0,
  calculated_carbs numeric not null default 0,
  calculated_fat numeric not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_owner_idx on recipes (owner_profile_id);

alter table recipes enable row level security;

create policy "recipes_select_own"
  on recipes for select
  using (owner_profile_id = (select id from profiles where user_id = auth.uid()));

create policy "recipes_insert_own"
  on recipes for insert
  with check (owner_profile_id = (select id from profiles where user_id = auth.uid()));

create policy "recipes_update_own"
  on recipes for update
  using (owner_profile_id = (select id from profiles where user_id = auth.uid()))
  with check (owner_profile_id = (select id from profiles where user_id = auth.uid()));

create policy "recipes_delete_own"
  on recipes for delete
  using (owner_profile_id = (select id from profiles where user_id = auth.uid()));

-- ============================================================
-- RECIPE_ITEMS
-- ============================================================

create table recipe_items (
  id bigint generated always as identity primary key,
  recipe_id bigint not null references recipes(id) on delete cascade,
  food_id bigint not null references foods(id) on delete restrict,  -- suppression bloquée si utilisé
  quantity numeric not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index recipe_items_recipe_idx on recipe_items (recipe_id);
create index recipe_items_food_idx on recipe_items (food_id);

alter table recipe_items enable row level security;

create policy "recipe_items_select_via_recipe"
  on recipe_items for select
  using (recipe_id in (
    select id from recipes where owner_profile_id = (select id from profiles where user_id = auth.uid())
  ));

create policy "recipe_items_insert_via_recipe"
  on recipe_items for insert
  with check (recipe_id in (
    select id from recipes where owner_profile_id = (select id from profiles where user_id = auth.uid())
  ));

create policy "recipe_items_update_via_recipe"
  on recipe_items for update
  using (recipe_id in (
    select id from recipes where owner_profile_id = (select id from profiles where user_id = auth.uid())
  ))
  with check (recipe_id in (
    select id from recipes where owner_profile_id = (select id from profiles where user_id = auth.uid())
  ));

create policy "recipe_items_delete_via_recipe"
  on recipe_items for delete
  using (recipe_id in (
    select id from recipes where owner_profile_id = (select id from profiles where user_id = auth.uid())
  ));

-- ============================================================
-- JOURNAL_DAYS
-- ============================================================

create table journal_days (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  total_kcal numeric not null default 0,
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, date)
);

create index journal_days_profile_date_idx on journal_days (profile_id, date);

alter table journal_days enable row level security;

create policy "journal_days_select_own"
  on journal_days for select
  using (profile_id = (select id from profiles where user_id = auth.uid()));

create policy "journal_days_insert_own"
  on journal_days for insert
  with check (profile_id = (select id from profiles where user_id = auth.uid()));

create policy "journal_days_update_own"
  on journal_days for update
  using (profile_id = (select id from profiles where user_id = auth.uid()))
  with check (profile_id = (select id from profiles where user_id = auth.uid()));

create policy "journal_days_delete_own"
  on journal_days for delete
  using (profile_id = (select id from profiles where user_id = auth.uid()));

-- ============================================================
-- JOURNAL_ENTRIES
-- ============================================================

create table journal_entries (
  id bigint generated always as identity primary key,
  journal_day_id bigint not null references journal_days(id) on delete cascade,
  food_id bigint references foods(id) on delete set null,
  recipe_id bigint references recipes(id) on delete set null,
  quantity numeric not null check (quantity > 0),
  -- unité de quantity : grammes/mL/nb d'unités si food_id, nb de portions (2 décimales max) si recipe_id

  -- snapshot immuable, valeurs TOTALES pour la quantity saisie (déjà multipliées)
  snapshot_name text not null,
  snapshot_kcal numeric not null,
  snapshot_protein numeric not null,
  snapshot_carbs numeric not null,
  snapshot_fat numeric not null,

  created_at timestamptz not null default now(),

  constraint journal_entries_food_xor_recipe
    check (((food_id is not null)::int + (recipe_id is not null)::int) = 1)
);

create index journal_entries_day_idx on journal_entries (journal_day_id);

alter table journal_entries enable row level security;

create policy "journal_entries_select_via_day"
  on journal_entries for select
  using (journal_day_id in (
    select id from journal_days where profile_id = (select id from profiles where user_id = auth.uid())
  ));

create policy "journal_entries_insert_via_day"
  on journal_entries for insert
  with check (journal_day_id in (
    select id from journal_days where profile_id = (select id from profiles where user_id = auth.uid())
  ));

create policy "journal_entries_update_via_day"
  on journal_entries for update
  using (journal_day_id in (
    select id from journal_days where profile_id = (select id from profiles where user_id = auth.uid())
  ))
  with check (journal_day_id in (
    select id from journal_days where profile_id = (select id from profiles where user_id = auth.uid())
  ));

create policy "journal_entries_delete_via_day"
  on journal_entries for delete
  using (journal_day_id in (
    select id from journal_days where profile_id = (select id from profiles where user_id = auth.uid())
  ));

-- ============================================================
-- TABLES PRÉPARÉES POUR LA V1.5 — RLS activée, ZÉRO policy (verrouillées)
-- ============================================================

create table recipe_likes (
  recipe_id bigint not null references recipes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, profile_id)
);

alter table recipe_likes enable row level security;
-- ⚠️ aucune policy créée volontairement : personne n'y accède, même le propriétaire, jusqu'à la V1.5

create table ratings (
  recipe_id bigint not null references recipes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (recipe_id, profile_id)
);

alter table ratings enable row level security;
-- ⚠️ aucune policy créée volontairement : personne n'y accède, même le propriétaire, jusqu'à la V1.5

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 1. Cache nutrition de la recette (recalculé à chaque insert/update/delete sur recipe_items)
--    Lit directement foods.kcal_per_100g etc. — c'est exactement pour ce genre de lecture
--    fréquente et simple que les 5 macros sont cachées sur `foods`.
create or replace function recalc_recipe_cache()
returns trigger as $$
declare
  target_recipe_id bigint;
begin
  target_recipe_id := coalesce(new.recipe_id, old.recipe_id);

  update recipes r
  set
    calculated_kcal = coalesce(sub.kcal, 0),
    calculated_protein = coalesce(sub.protein, 0),
    calculated_carbs = coalesce(sub.carbs, 0),
    calculated_fat = coalesce(sub.fat, 0),
    updated_at = now()
  from (
    select
      sum(f.kcal_per_100g * ri.quantity / 100.0) as kcal,
      sum(f.protein_per_100g * ri.quantity / 100.0) as protein,
      sum(f.carbs_per_100g * ri.quantity / 100.0) as carbs,
      sum(f.fat_per_100g * ri.quantity / 100.0) as fat
    from recipe_items ri
    join foods f on f.id = ri.food_id
    where ri.recipe_id = target_recipe_id
  ) sub
  where r.id = target_recipe_id;

  return null;
end;
$$ language plpgsql security definer;

create trigger recipe_items_recalc_cache
  after insert or update or delete on recipe_items
  for each row execute function recalc_recipe_cache();

-- 2. Agrégat du jour, upsert live tant que non clôturé (figé après clôture)
create or replace function recalc_journal_day()
returns trigger as $$
declare
  target_day_id bigint;
  is_day_closed boolean;
begin
  target_day_id := coalesce(new.journal_day_id, old.journal_day_id);

  select is_closed into is_day_closed from journal_days where id = target_day_id;

  if is_day_closed then
    return null;  -- jour clôturé : agrégat figé, on ne recalcule plus
  end if;

  update journal_days jd
  set
    total_kcal = coalesce(sub.kcal, 0),
    total_protein = coalesce(sub.protein, 0),
    total_carbs = coalesce(sub.carbs, 0),
    total_fat = coalesce(sub.fat, 0),
    updated_at = now()
  from (
    select
      sum(snapshot_kcal) as kcal,
      sum(snapshot_protein) as protein,
      sum(snapshot_carbs) as carbs,
      sum(snapshot_fat) as fat
    from journal_entries
    where journal_day_id = target_day_id
  ) sub
  where jd.id = target_day_id;

  return null;
end;
$$ language plpgsql security definer;

create trigger journal_entries_recalc_day
  after insert or update or delete on journal_entries
  for each row execute function recalc_journal_day();

-- 3. updated_at automatique
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger foods_set_updated_at before update on foods
  for each row execute function set_updated_at();
create trigger recipes_set_updated_at before update on recipes
  for each row execute function set_updated_at();