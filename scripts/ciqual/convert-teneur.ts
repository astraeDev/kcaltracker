export type NutrientValueType = 'measured' | 'traces' | 'less_than' | 'not_measured'

export type ConvertedValue = {
  valueType: NutrientValueType
  value: number | null
  rawValueText: string
}

function parseDecimalComma(text: string): number {
  return Number(text.replace(',', '.'))
}

export function convertTeneur(rawValue: string): ConvertedValue {
  const rawValueText = rawValue.trim()

  if (rawValueText === '-') {
    return { valueType: 'not_measured', value: null, rawValueText }
  }

  if (rawValueText === 'traces') {
    return { valueType: 'traces', value: 0.0001, rawValueText }
  }

  if (rawValueText.startsWith('<')) {
    const bound = parseDecimalComma(rawValueText.slice(1).trim())
    return { valueType: 'less_than', value: bound / 2, rawValueText }
  }

  const value = parseDecimalComma(rawValueText)
  if (Number.isNaN(value)) {
    throw new Error(`Valeur CIQUAL non reconnue dans <teneur> : "${rawValueText}"`)
  }

  return { valueType: 'measured', value, rawValueText }
}
