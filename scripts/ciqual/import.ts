import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/database.types'
import { parsedFoodSchema, type ParsedFood } from './types'

type FoodInsert = Database['public']['Tables']['foods']['Insert']
type NutrientInsert = Database['public']['Tables']['nutrients']['Insert']

const BATCH_SIZE = 1000

// --write bascule du dry-run (comportement par défaut) vers l'écriture réelle.
const WRITE = process.argv.includes('--write')

// --limit N restreint aux N premiers aliments : test de fumée en écriture réelle
function parseLimitFlag(): number | null {
  const i = process.argv.indexOf('--limit')
  return i === -1 ? null : Number(process.argv[i + 1])
}
const LIMIT = parseLimitFlag()

function loadParsedFoods(): ParsedFood[] {
  const raw = readFileSync('data/ciqual/parsed.json', 'utf-8')
  return z.array(parsedFoodSchema).parse(JSON.parse(raw))
}

function toFoodInsert(food: ParsedFood): FoodInsert {
  return {
    name: food.name,
    source: 'ciqual',
    external_id: food.externalId,
    // default=false. foods_select_public_or_own exige is_public=true||owner_profile_id=soi or CIQUAL n'en a pas
    is_public: true,
    category_name: food.categoryName,
    kcal_per_100g: food.kcalPer100g,
    protein_per_100g: food.proteinPer100g,
    carbs_per_100g: food.carbsPer100g,
    fat_per_100g: food.fatPer100g,
    fiber_per_100g: food.fiberPer100g,
    expected_kcal: food.expectedKcal,
  }
}

function toNutrientInserts(food: ParsedFood, foodId: string): NutrientInsert[] {
  return food.nutrients.map((n) => ({
    food_id: foodId,
    external_id: n.externalId,
    name_fr: n.nameFr,
    unit: n.unit,
    category: n.category,
    value_type: n.valueType,
    value: n.value,
    raw_value_text: n.rawValueText,
    confidence_code: n.confidenceCode,
  }))
}

function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size))
  return chunks
}

// Boucle de batching générique, réutilisée pour foods ET nutrients
// `upsertBatch` est fourni par l'appelant déjà lié à la bonne table/options : ça garde le typage Supabase

async function upsertInBatches<Row, Selected>(
  rows: Row[],
  label: string,
  upsertBatch: (batch: Row[]) => PromiseLike<{ data: Selected[] | null; error: { message: string } | null }>
): Promise<Selected[]> {
  const batches = chunk(rows, BATCH_SIZE)
  const results: Selected[] = []

  for (const [i, batch] of batches.entries()) {
    const { data, error } = await upsertBatch(batch)
    if (error) {
      throw new Error(`Échec upsert "${label}", lot ${i + 1}/${batches.length} (${batch.length} lignes) : ${error.message}`)
    }
    results.push(...(data ?? []))
    console.log(`  ${label} — lot ${i + 1}/${batches.length} ok (${batch.length} lignes)`)
  }

  return results
}

function reportDryRun(foodInserts: FoodInsert[], foods: ParsedFood[]) {
  const nutrientCount = foods.reduce((sum, f) => sum + f.nutrients.length, 0)
  console.log('DRY-RUN — aucun appel réseau, aucune écriture.\n')
  console.log(`foods      : ${foodInserts.length} lignes -> ${chunk(foodInserts, BATCH_SIZE).length} lot(s) de ${BATCH_SIZE}`)
  console.log(`nutrients  : ${nutrientCount} lignes -> ${Math.ceil(nutrientCount / BATCH_SIZE)} lot(s) de ${BATCH_SIZE}`)
  console.log("\nRelancer avec --write pour écrire réellement (idéalement --write --limit 10 d'abord).")
}

async function main() {
  const allFoods = loadParsedFoods()
  const foods = LIMIT ? allFoods.slice(0, LIMIT) : allFoods
  const foodInserts = foods.map(toFoodInsert)

  if (!WRITE) {
    reportDryRun(foodInserts, foods)
    return
  }

  console.log(`Écriture réelle${LIMIT ? ` (limitée à ${LIMIT} aliments)` : ''}...\n`)

  const client = createAdminClient()

  // Phase 1 : foods d'abord — nutrients.food_id référence foods.id, donc l'aliment doit
  // exister avant qu'on puisse écrire ses nutriments. .select() récupère les id générés
  // dans la même requête que l'upsert 
  const upsertedFoods = await upsertInBatches<FoodInsert, { id: string; external_id: string | null }>(
    foodInserts,
    'foods',
    (batch) => client.from('foods').upsert(batch, { onConflict: 'source,external_id' }).select('id, external_id')
  )

  const foodIdByExternalId = new Map(upsertedFoods.map((f) => [f.external_id, f.id]))

  // Phase 2 : aplatir tous les nutriments en assignant le food_id retrouvé via la map.
  const nutrientInserts = foods.flatMap((food) => {
    const foodId = foodIdByExternalId.get(food.externalId)
    if (!foodId) {
      throw new Error(`Aucun id retourné pour l'aliment ${food.externalId} (${food.name}) après upsert foods`)
    }
    return toNutrientInserts(food, foodId)
  })

  // Pas de .select() ici : personne n'a besoin des id de nutrients en retour, et demander
  // return=representation sur 257 816 lignes coûterait de la bande passante pour rien.
  await upsertInBatches<NutrientInsert, never>(nutrientInserts, 'nutrients', (batch) =>
    client.from('nutrients').upsert(batch, { onConflict: 'food_id,external_id' })
  )

  console.log(`\n${upsertedFoods.length} aliments, ${nutrientInserts.length} nutriments importés.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
