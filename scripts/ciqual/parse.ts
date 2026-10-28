import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import { loadXmlRows } from './xml-load'
import { convertTeneur } from './convert-teneur'
import { classifyNutrient } from './nutrient-classification'
import {
  alimRowSchema,
  alimGrpRowSchema,
  constRowSchema,
  compoRowSchema,
  parsedFoodSchema,
  confidenceCodeSchema,
  type CompoRow,
  type ConfidenceCode,
  type ParsedFood,
  type ParsedNutrient,
} from './types'

// --- Nom CIQUAL "Protéines… (g/100 g)" -> { name, unit } --------------------
const UNIT_REGEX = /\(([a-zA-Zµ]+)\/100\s*g\)\s*$/

function splitUnit(nameWithUnit: string): { name: string; unit: string } {
  const m = nameWithUnit.match(UNIT_REGEX)
  if (!m) throw new Error(`Unité introuvable dans "${nameWithUnit}"`)
  return { name: nameWithUnit.slice(0, m.index).trim(), unit: m[1] }
}

// --- code_confiance -> 'A'..'D', ou null si vide/inconnu -------------------
function parseConfidenceCode(raw: string): ConfidenceCode | null {
  return confidenceCodeSchema.safeParse(raw).data ?? null
}

// --- const_code des 5 macros hissées au niveau de l'aliment ---------------
const ENERGY_KCAL = '328' // méthode réglementaire UE 1169/2011 (pas 333 = facteur Jones)
const PROTEIN = '25003' // N x 6.25 (pas 25000 = facteur Jones)
const CARBS = '31000'
const FAT = '40000'
const FIBER = '34100'

// --- Autres apports énergétiques, uniquement pour le contrôle qualité -----
const ALCOHOL = '60000'
const POLYOLS = '34000'
const ORGANIC_ACIDS = '65000'

function main() {
  // ------------------ Chargement des 4 fichiers XML ------------------
  const alims = loadXmlRows('data/ciqual/alim_2025_11_03.xml', 'ALIM', alimRowSchema)
  const groups = loadXmlRows('data/ciqual/alim_grp_2025_11_03.xml', 'ALIM_GRP', alimGrpRowSchema)
  const consts = loadXmlRows('data/ciqual/const_2025_11_03.xml', 'CONST', constRowSchema)
  const compos = loadXmlRows('data/ciqual/compo_2025_11_03.xml', 'COMPO', compoRowSchema)

  // ------------------ Index (Map = get O(1), pas de find dans la boucle) ------------------
  // annuaire groupe (ex: 05 = "Produits laitiers")
  const groupByCode = new Map(groups.map((g) => [g.alim_grp_code, g.alim_grp_nom_fr]))

  // const_code -> { name, unit }. splitUnit tourné 74 fois ici, pas 257 816 fois plus bas.
  const constByCode = new Map(consts.map((c) => [c.const_code, splitUnit(c.const_nom_fr)]))

  // annuaire aliment -> 74 nutriments, un seul parcours des 257 816 lignes.
  const compoByAlim = new Map<string, CompoRow[]>()
  for (const compo of compos) {
    const list = compoByAlim.get(compo.alim_code)
    if (list) list.push(compo)
    else compoByAlim.set(compo.alim_code, [compo])
  }

  let realWarnings = 0
  let explainedWarnings = 0

  // ------------------ Un ParsedFood par aliment ------------------
  const foods: ParsedFood[] = alims.map((alim) => {
    const rows = compoByAlim.get(alim.alim_code) ?? []

    // Chaque ligne COMPO -> un ParsedNutrient (jointure CONST + convertTeneur + classifyNutrient)
    const nutrients: ParsedNutrient[] = rows.map((row) => {
      const constDef = constByCode.get(row.const_code)
      if (!constDef) {
        throw new Error(`const_code "${row.const_code}" absent de CONST (alim ${alim.alim_code})`)
      }
      const conv = convertTeneur(row.teneur)
      return {
        externalId: row.const_code,
        nameFr: constDef.name,
        unit: constDef.unit,
        category: classifyNutrient(row.const_code),
        valueType: conv.valueType,
        value: conv.value,
        rawValueText: conv.rawValueText,
        confidenceCode: parseConfidenceCode(row.code_confiance),
      }
    })

    // Valeur d'un nutriment de CET aliment (<= 74 éléments, find OK).
    const valueByCode = (code: string) => nutrients.find((n) => n.externalId === code)?.value ?? null

    const kcalPer100g = valueByCode(ENERGY_KCAL)
    const proteinPer100g = valueByCode(PROTEIN)
    const carbsPer100g = valueByCode(CARBS)
    const fatPer100g = valueByCode(FAT)
    const fiberPer100g = valueByCode(FIBER)

    // ------------------ Contrôle qualité ------------------
    // Énergie attendue = modèle 4/4/9 (facteurs d'Atwater simplifiés).
    const expectedKcal =
      proteinPer100g !== null && carbsPer100g !== null && fatPer100g !== null
        ? proteinPer100g * 4 + carbsPer100g * 4 + fatPer100g * 9
        : null

    if (expectedKcal !== null && kcalPer100g !== null && kcalPer100g > 0) {
      const gapRatio = Math.abs(expectedKcal - kcalPer100g) / kcalPer100g
      const gapKcal = Math.abs(expectedKcal - kcalPer100g)

      if (gapRatio > 0.15 && gapKcal > 20) {
        const alcohol = valueByCode(ALCOHOL) ?? 0
        const polyols = valueByCode(POLYOLS) ?? 0
        const organicAcids = valueByCode(ORGANIC_ACIDS) ?? 0
        const fiber = fiberPer100g ?? 0
        const extras = [
          alcohol > 0 && `alcool ${alcohol}g`,
          polyols > 0 && `polyols ${polyols}g`,
          fiber > 2 && `fibres ${fiber}g`,
          organicAcids > 0.1 && `ac. organiques ${organicAcids}g`,
        ].filter(Boolean)

        if (extras.length > 0) {
          explainedWarnings++
          console.warn(
            `QA ignoré  ${alim.alim_code} (${alim.alim_nom_fr}) — écart ${(gapRatio * 100).toFixed(0)}% expliqué par ${extras.join(', ')}`
          )
        } else {
          realWarnings++
          console.warn(
            `QA RÉEL    ${alim.alim_code} (${alim.alim_nom_fr}) — déclaré ${kcalPer100g} kcal, 4/4/9 ~${expectedKcal.toFixed(0)} (écart ${(gapRatio * 100).toFixed(0)}%)`
          )
        }
      }
    }

    return {
      externalId: alim.alim_code,
      name: alim.alim_nom_fr,
      categoryName: groupByCode.get(alim.alim_grp_code) ?? null,
      kcalPer100g,
      proteinPer100g,
      carbsPer100g,
      fatPer100g,
      fiberPer100g,
      expectedKcal,
      nutrients,
    }
  })

  // ------------------ Revalidation (frontière de sortie) & écriture ------------------
  const validated = z.array(parsedFoodSchema).parse(foods)

  writeFileSync('data/ciqual/parsed.json', JSON.stringify(validated, null, 2))
  console.log(`\n${validated.length} aliments -> data/ciqual/parsed.json`)
  console.log(`${realWarnings} warnings QA RÉELS (à investiguer) · ${explainedWarnings} écarts expliqués (ignorés)`)
}

main()
