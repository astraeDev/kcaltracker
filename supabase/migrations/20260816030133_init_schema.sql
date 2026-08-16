create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============================================================
-- UUID v7
-- ============================================================
-- quand PG18 est dispo, remplacer le corps par `select uuidv7();`
create or replace function uuid_generate_v7()
returns uuid
language sql
volatile
set search_path = ''
as $$
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;

-- ============================================================
-- ENUMS
-- ============================================================

create type gender_enum as enum ('male', 'female');

create type activity_level_enum as enum (
  'sedentary',   -- sédentaire
  'light',       -- légèrement actif (1-3j/sem)
  'moderate',    -- modérément actif (3-5j/sem)
  'active',      -- très actif (6-7j/sem)
  'extreme'      -- extrêmement actif (2x/jour)
);

create type goal_type_enum as enum ('maintain', 'gain', 'lose');

create type food_source_enum as enum ('ciqual', 'user');

create type unit_type_enum as enum ('grams', 'ml', 'unit');

create type nutrient_category_enum as enum ('macro', 'fatty_acid', 'sugar', 'vitamin', 'mineral', 'other');

create type nutrient_value_type_enum as enum ('measured', 'traces', 'less_than', 'not_measured');

create type confidence_code_enum as enum ('A', 'B', 'C', 'D');

-- ============================================================
-- PROFILES
-- ============================================================

create table profiles (
  id uuid primary key default uuid_generate_v7(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  bio text,
  is_public boolean not null default false,
  gender gender_enum not null,
  birth_date date not null,
  height_cm numeric not null,
  weight_kg numeric not null,
  activity_level activity_level_enum not null,
  goal_type goal_type_enum not null default 'maintain',
  daily_kcal_target numeric not null,
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
-- ============================================================

create table foods (
  id uuid primary key default uuid_generate_v7(),
  name text not null,
  owner_profile_id uuid references profiles(id) on delete cascade,  -- null si CIQUAL
  source food_source_enum not null default 'user',
  external_id text,                        -- alim_code CIQUAL, clé stable pour upsert
  is_shared boolean not null default false,   
  is_public boolean not null default false,   -- true pour les aliments CIQUAL

  unit_type unit_type_enum not null default 'grams',
  density_g_per_unit numeric,              -- grammes pour 1 unité de unit_type : requis si 'ml' (densité) ou 'unit' (poids moyen, ex 1 oeuf ≈ 50g), null si 'grams'

  category_name text,

  -- 5 macros principales, toujours pour 100 g — cache dérivé de `nutrients` pour les aliments CIQUAL
  kcal_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,

  expected_kcal numeric,                -- contrôle qualité (règle 4/4/9), calculé à l'import, jamais affiché

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint foods_owner_required_if_user
    check (source != 'user' or owner_profile_id is not null),
  constraint foods_macros_required_if_user
    check (source != 'user' or (
      kcal_per_100g is not null
      and protein_per_100g is not null
      and carbs_per_100g is not null
      and fat_per_100g is not null
    )),
  constraint foods_density_per_unit_type
    check (
      (unit_type = 'grams' and density_g_per_unit is null)
      or (unit_type in ('ml', 'unit') and density_g_per_unit is not null)
    )
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
-- ============================================================

create table nutrients (
  id uuid primary key default uuid_generate_v7(),
  food_id uuid not null references foods(id) on delete cascade,
  external_id text not null,               -- const_code CIQUAL (identifiant du nutriment)
  name_fr text not null,
  name_en text,
  unit text not null,                      -- normalisé à l'import : g | mg | µg | kcal | kJ
  category nutrient_category_enum not null default 'other',

  value_type nutrient_value_type_enum not null default 'measured',
  raw_value_text text,                     -- teneur brute avant conversion : "-", "traces", "<0,5", "12,4"
  value numeric,                           -- teneur convertie, exploitable directement (NULL si not_measured)

  confidence_code confidence_code_enum,    -- Fiabilité score de A à D

  created_at timestamptz not null default now()
);

create unique index nutrients_food_external_id_unique
  on nutrients (food_id, external_id);
create index nutrients_food_idx on nutrients (food_id);

alter table nutrients enable row level security;

-- lecture publique (dictionnaire global, aucune donnée personnelle), pas de policy
create policy "nutrients_select_all"
  on nutrients for select
  using (true);

-- ============================================================
-- RECIPES
-- ============================================================

create table recipes (
  id uuid primary key default uuid_generate_v7(),
  owner_profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  servings integer not null check (servings > 0),
  is_shared boolean not null default false,

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
  id uuid primary key default uuid_generate_v7(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  food_id uuid not null references foods(id) on delete restrict,  -- suppression bloquée si utilisé
  quantity numeric not null check (quantity > 0),  -- exprimée dans l'unit_type du food (g, ml, ou nombre d'unités)
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
  with check (
    recipe_id in (
      select id from recipes where owner_profile_id = (select id from profiles where user_id = auth.uid())
    )
    and food_id in (
      select id from foods where is_public = true or owner_profile_id = (select id from profiles where user_id = auth.uid())
    )
  );

create policy "recipe_items_update_via_recipe"
  on recipe_items for update
  using (recipe_id in (
    select id from recipes where owner_profile_id = (select id from profiles where user_id = auth.uid())
  ))
  with check (
    recipe_id in (
      select id from recipes where owner_profile_id = (select id from profiles where user_id = auth.uid())
    )
    and food_id in (
      select id from foods where is_public = true or owner_profile_id = (select id from profiles where user_id = auth.uid())
    )
  );

create policy "recipe_items_delete_via_recipe"
  on recipe_items for delete
  using (recipe_id in (
    select id from recipes where owner_profile_id = (select id from profiles where user_id = auth.uid())
  ));

-- ============================================================
-- JOURNAL_DAYS
-- ============================================================

create table journal_days (
  id uuid primary key default uuid_generate_v7(),
  profile_id uuid not null references profiles(id) on delete cascade,
  date date not null,  -- "clôture" = date + 1 jour de grâce, calculée à la volée, jamais stockée (voir policies)
  total_kcal numeric not null default 0,
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
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

create policy "journal_days_delete_own"
  on journal_days for delete
  using (
    profile_id = (select id from profiles where user_id = auth.uid())
    and current_date <= date + 1
  );

-- ============================================================
-- JOURNAL_ENTRIES
-- ============================================================

create table journal_entries (
  id uuid primary key default uuid_generate_v7(),
  journal_day_id uuid not null references journal_days(id) on delete cascade,
  food_id uuid references foods(id) on delete set null,
  recipe_id uuid references recipes(id) on delete set null,
  quantity numeric not null check (quantity > 0),

  -- snapshot immuable
  snapshot_name text not null,
  snapshot_kcal numeric not null,
  snapshot_protein numeric not null,
  snapshot_carbs numeric not null,
  snapshot_fat numeric not null,

  created_at timestamptz not null default now(),

  -- au plus une des deux ; les deux peuvent devenir null
  constraint journal_entries_food_or_recipe_not_both
    check (((food_id is not null)::int + (recipe_id is not null)::int) <= 1)
);

create index journal_entries_day_idx on journal_entries (journal_day_id);

alter table journal_entries enable row level security;

create policy "journal_entries_select_via_day"
  on journal_entries for select
  using (journal_day_id in (
    select id from journal_days where profile_id = (select id from profiles where user_id = auth.uid())
  ));

-- insert/update/delete : autorisé le jour même de journal_days.date ET le lendemain (jour de grâce jusqu'à 23h59)
-- Calculé à la volée sur `date`, Passé ce délai, l'entrée devient immuable
-- fait office de "snapshot" figé pour snapshot_kcal/protein/carbs/fat.
create policy "journal_entries_insert_via_day"
  on journal_entries for insert
  with check (journal_day_id in (
    select id from journal_days
    where profile_id = (select id from profiles where user_id = auth.uid())
      and current_date <= date + 1
  ));

create policy "journal_entries_update_via_day"
  on journal_entries for update
  using (journal_day_id in (
    select id from journal_days
    where profile_id = (select id from profiles where user_id = auth.uid())
      and current_date <= date + 1
  ))
  with check (journal_day_id in (
    select id from journal_days
    where profile_id = (select id from profiles where user_id = auth.uid())
      and current_date <= date + 1
  ));

create policy "journal_entries_delete_via_day"
  on journal_entries for delete
  using (journal_day_id in (
    select id from journal_days
    where profile_id = (select id from profiles where user_id = auth.uid())
      and current_date <= date + 1
  ));

-- ============================================================
-- RECIPE_LIKES
-- ============================================================

create table recipe_likes (
  recipe_id uuid not null references recipes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, profile_id)
);

alter table recipe_likes enable row level security;

-- ============================================================
-- RECIPE_RATINGS
-- ============================================================

create table recipe_ratings (
  recipe_id uuid not null references recipes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (recipe_id, profile_id)
);

alter table recipe_ratings enable row level security;

-- ============================================================
-- TRIGGERS
-- ============================================================
create or replace function recalc_recipe_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_recipe_id uuid;
begin
  target_recipe_id := coalesce(new.recipe_id, old.recipe_id);

  update public.recipes r
  set
    calculated_kcal = coalesce(sub.kcal, 0),
    calculated_protein = coalesce(sub.protein, 0),
    calculated_carbs = coalesce(sub.carbs, 0),
    calculated_fat = coalesce(sub.fat, 0),
    updated_at = now()
  from (
    select
      sum(f.kcal_per_100g * ri.quantity * coalesce(f.density_g_per_unit, 1) / 100.0) as kcal,
      sum(f.protein_per_100g * ri.quantity * coalesce(f.density_g_per_unit, 1) / 100.0) as protein,
      sum(f.carbs_per_100g * ri.quantity * coalesce(f.density_g_per_unit, 1) / 100.0) as carbs,
      sum(f.fat_per_100g * ri.quantity * coalesce(f.density_g_per_unit, 1) / 100.0) as fat
    from public.recipe_items ri
    join public.foods f on f.id = ri.food_id
    where ri.recipe_id = target_recipe_id
  ) sub
  where r.id = target_recipe_id;

  return null;
end;
$$;

create trigger recipe_items_recalc_cache
  after insert or update or delete on recipe_items
  for each row execute function recalc_recipe_cache();

-- 2. Agrégat du jour, upsert live tant que non clôturé (figé après clôture).
-- Garde-fou utile même si la RLS bloque déjà les écritures normales passé le délai :
-- un `on delete set null` (food/recipe supprimée) ou une écriture service_role
-- contournent la RLS mais déclenchent quand même ce trigger.
create or replace function recalc_journal_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_day_id uuid;
  day_date date;
begin
  target_day_id := coalesce(new.journal_day_id, old.journal_day_id);

  select date into day_date from public.journal_days where id = target_day_id;

  if current_date > day_date + 1 then
    return null;  -- jour clôturé (au-delà du jour de grâce) : agrégat figé, on ne recalcule plus
  end if;

  update public.journal_days jd
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
    from public.journal_entries
    where journal_day_id = target_day_id
  ) sub
  where jd.id = target_day_id;

  return null;
end;
$$;

create trigger journal_entries_recalc_day
  after insert or update or delete on journal_entries
  for each row execute function recalc_journal_day();

-- 3. updated_at automatique
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger foods_set_updated_at before update on foods
  for each row execute function set_updated_at();
create trigger recipes_set_updated_at before update on recipes
  for each row execute function set_updated_at();

-- ============================================================
-- PRIVILÈGES COLONNE PAR COLONNE
-- ============================================================

revoke update on table recipes from authenticated;
grant update (name, servings, is_shared) on table recipes to authenticated;