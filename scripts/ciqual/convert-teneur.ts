// ============================================================================
// Règles de conversion de la valeur brute <teneur> en { valueType, value, rawValueText }.
//   "59,7"    measured
//   "-"       not measured
//   "traces"  traces
//   "< 2,2"   less than
//   Tout autre format → throw
// ============================================================================

import type { NutrientValueType } from './types'

export type ConvertedTeneur = {
  valueType: NutrientValueType
  value: number | null
  rawValueText: string
}

// "59,7" -> 59.7
function parseDecimalComma(text: string): number {
  return Number(text.replace(',', '.'))
}

export function convertTeneur(raw: string): ConvertedTeneur {
  const rawValueText = raw.trim()

  // "-" : not_measured -> value = null, surtout pas 0 (règle ANSES)
  if (rawValueText === '-') {
    return { valueType: 'not_measured', value: null, rawValueText }
  }

  // "traces" : quantité négligeable = 0.0001 (convention ANSES)
  if (rawValueText === 'traces') {
    return { valueType: 'traces', value: 0.0001, rawValueText }
  }

  // "< X" : less_than = moitié de la borne pour minimiser l'erreur d'approximation
  if (rawValueText.startsWith('<')) {
    const bound = parseDecimalComma(rawValueText.slice(1).trim())
    if (Number.isNaN(bound)) {
      throw new Error(`Borne "< X" illisible dans <teneur> : "${rawValueText}"`)
    }
    return { valueType: 'less_than', value: bound / 2, rawValueText }
  }

  // measured
  const value = parseDecimalComma(rawValueText)
  if (Number.isNaN(value)) {
    throw new Error(`Format <teneur> non reconnu : "${rawValueText}"`)
  }
  return { valueType: 'measured', value, rawValueText }
}
