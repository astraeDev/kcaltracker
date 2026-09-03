// ============================================================================
// orchestrateur 
// -> lit 4 fichiers XML, les joint, applique convertTeneur + classifyNutrient,
// -> écrit data/ciqual/parsed.json
// COMPO = fichier central / ALIM et CONST = dictionnaires
//
//   ALIM_GRP      ──┐                         CONST ──┐
//   (alim_grp_code )│                                 │
//                                                     │
//   ALIM      ──────┤                                 │ (const_code)
//   (alim_code)     │                                 │
//                   └─────────── COMPO ───────────────┘
//                    (alim_code, const_code, teneur, code_confiance)
// ============================================================================

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
  type CompoRow,
  type ParsedFood,
  type ParsedNutrient,
} from './types'

// --- Extraction de l'unité depuis le nom CIQUAL -----------------------------
// "Vitamine C (mg/100 g)" -> { name: "Vitamine C", unit: "mg" }
// Capture restreinte aux lettres + µ : un [^/]+ trop permissif traverse les
// parenthèses imbriquées ("Alcool (éthanol) (g/100 g)" -> "éthanol) (g").
const UNIT_RE = /\(([a-zA-Zµ]+)\/100\s*g\)\s*$/

function stripUnitSuffix(nameWithUnit: string): { name: string; unit: string } {
  const m = nameWithUnit.match(UNIT_RE)
  if (!m) throw new Error(`Unité introuvable dans "${nameWithUnit}"`)
  return { name: nameWithUnit.slice(0, m.index).trim(), unit: m[1] }
}

// --- code_confiance -> confidence_code --------------------------------------
// Valeurs réelles : "A" "B" "C" "D" ou "" (non renseigné). Tout le reste -> null.
const CONFIDENCE_CODES = new Set(['A', 'B', 'C', 'D'])
function parseConfidenceCode(raw: string): 'A' | 'B' | 'C' | 'D' | null {
  return CONFIDENCE_CODES.has(raw) ? (raw as 'A' | 'B' | 'C' | 'D') : null
}

// Formes de sortie (ParsedFood / ParsedNutrient) : définies dans types.ts comme
// schémas Zod, partagées avec import.ts qui revalide parsed.json avant la DB.

// const_code des 5 macros "résumé" de foods (choisis/confirmés plus tôt).
const ENERGY_KCAL = '328' // méthode réglementaire UE (pas 333)
const PROTEIN = '25003' // N x 6.25 (pas 25000, méthode Jones)
const CARBS = '31000'
const FAT = '40000'
const FIBER = '34100'

// Autres composants énergétiques, pour le contrôle qualité (option C).
const ALCOHOL = '60000'
const POLYOLS = '34000'
const ORGANIC_ACIDS = '65000'

function main() {
  // -- 1. Chargement --
  const alims = loadXmlRows('data/ciqual/alim_2025_11_03.xml', 'ALIM', alimRowSchema)
  const groups = loadXmlRows('data/ciqual/alim_grp_2025_11_03.xml', 'ALIM_GRP', alimGrpRowSchema)
  const consts = loadXmlRows('data/ciqual/const_2025_11_03.xml', 'CONST', constRowSchema)
  const compos = loadXmlRows('data/ciqual/compo_2025_11_03.xml', 'COMPO', compoRowSchema)

  // -- 2. Dictionnaires (Map = clé -> valeur en accès instantané) --
  // alim_grp_code -> libellé français du groupe.
  const groupNameByCode = new Map(groups.map((g) => [g.alim_grp_code, g.alim_grp_nom_fr]))

  // const_code -> { nom nettoyé, unité }. stripUnitSuffix appelé 74 fois ici,
  // pas 257 816 fois plus bas.
  const constByCode = new Map(consts.map((c) => [c.const_code, stripUnitSuffix(c.const_nom_fr)]))

  // COMPO regroupé par alim_code : pour un aliment, toutes ses lignes d'un coup.
  // Sans ce regroupement (fait une fois), il faudrait reparcourir 257 816 lignes
  // pour chacun des 3484 aliments (~900 M d'opérations).
  const compoByAlimCode = new Map<string, CompoRow[]>()
  for (const compo of compos) {
    const list = compoByAlimCode.get(compo.alim_code)
    if (list) list.push(compo)
    else compoByAlimCode.set(compo.alim_code, [compo])
  }

  let realWarnings = 0
  let explainedWarnings = 0

  // -- 3. Un ParsedFood par aliment --
  const foods: ParsedFood[] = alims.map((alim) => {
    const rows = compoByAlimCode.get(alim.alim_code) ?? []

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

    // Valeur d'un nutriment de CET aliment par const_code (<= 74 éléments, find OK).
    const valueOf = (code: string) => nutrients.find((n) => n.externalId === code)?.value ?? null

    const kcalPer100g = valueOf(ENERGY_KCAL)
    const proteinPer100g = valueOf(PROTEIN)
    const carbsPer100g = valueOf(CARBS)
    const fatPer100g = valueOf(FAT)
    const fiberPer100g = valueOf(FIBER)

    // -- Contrôle qualité (option C) --
    // expectedKcal stocké = 4/4/9 simple. On signale un écart > 15 % SAUF si
    // l'aliment contient un composant énergétique que le 4/4/9 ignore (alcool,
    // polyols, beaucoup de fibres, acides organiques) : dans ce cas l'écart est
    // structurel, pas un bug. Ne reste "RÉEL" que ce qui pourrait être notre bug.
    let expectedKcal: number | null = null
    if (kcalPer100g !== null && proteinPer100g !== null && carbsPer100g !== null && fatPer100g !== null) {
      expectedKcal = proteinPer100g * 4 + carbsPer100g * 4 + fatPer100g * 9

      // Un vrai bug (unité ratée, mauvais const_code) décale de dizaines de kcal.
      // On exige un écart significatif EN RELATIF (> 15 %) ET EN ABSOLU (> 20 kcal) :
      // ça élimine le bruit des aliments à ~15 kcal (2-3 kcal d'écart = 20 % pour rien).
      const gap = Math.abs(expectedKcal - kcalPer100g) / kcalPer100g
      const gapAbs = Math.abs(expectedKcal - kcalPer100g)
      if (gap > 0.15 && gapAbs > 20) {
        const alcohol = valueOf(ALCOHOL) ?? 0
        const polyols = valueOf(POLYOLS) ?? 0
        const organicAcids = valueOf(ORGANIC_ACIDS) ?? 0
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
            `QA ignoré  ${alim.alim_code} (${alim.alim_nom_fr}) — écart ${(gap * 100).toFixed(0)}% expliqué par ${extras.join(', ')}`
          )
        } else {
          realWarnings++
          console.warn(
            `QA RÉEL    ${alim.alim_code} (${alim.alim_nom_fr}) — déclaré ${kcalPer100g} kcal, 4/4/9 ~${expectedKcal.toFixed(0)} (écart ${(gap * 100).toFixed(0)}%)`
          )
        }
      }
    }

    return {
      externalId: alim.alim_code,
      name: alim.alim_nom_fr,
      categoryName: groupNameByCode.get(alim.alim_grp_code) ?? null,
      kcalPer100g,
      proteinPer100g,
      carbsPer100g,
      fatPer100g,
      fiberPer100g,
      expectedKcal,
      nutrients,
    }
  })

  // -- 4. Auto-contrôle puis écriture --
  // On revalide ce qu'on a construit contre le schéma partagé : si parse.ts et
  // types.ts divergent un jour, on le voit ici, pas dans import.ts face à la DB.
  const validated = z.array(parsedFoodSchema).parse(foods)

  writeFileSync('data/ciqual/parsed.json', JSON.stringify(validated, null, 2))
  console.log(`\n${validated.length} aliments -> data/ciqual/parsed.json`)
  console.log(`${realWarnings} warnings QA RÉELS (à investiguer) · ${explainedWarnings} écarts expliqués (ignorés)`)
}

main()
