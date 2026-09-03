import { z } from 'zod'

// const — 74 nutriments
export const constRowSchema = z.object({
  const_code: z.string(),
  const_nom_fr: z.string(),
})
export type ConstRow = z.infer<typeof constRowSchema>

// alim_grp — catégories d'aliments
export const alimGrpRowSchema = z.object({
  alim_grp_code: z.string(),
  alim_grp_nom_fr: z.string(),
})
export type AlimGrpRow = z.infer<typeof alimGrpRowSchema>

// alim — 3484 aliments
export const alimRowSchema = z.object({
  alim_code: z.string(),
  alim_nom_fr: z.string(),
  alim_grp_code: z.string(),
})
export type AlimRow = z.infer<typeof alimRowSchema>

// compo — 257 816 valeurs (aliment × nutriment)
export const compoRowSchema = z.object({
  alim_code: z.string(),
  const_code: z.string(),
  teneur: z.string(),
  code_confiance: z.string(),
})
export type CompoRow = z.infer<typeof compoRowSchema>

// --- Copies des enums SQL (à garder synchronisées avec la migration) -------
export const nutrientCategorySchema = z.enum(['macro', 'fatty_acid', 'sugar', 'vitamin', 'mineral', 'other'])
export type NutrientCategory = z.infer<typeof nutrientCategorySchema>

export const nutrientValueTypeSchema = z.enum(['measured', 'traces', 'less_than', 'not_measured'])
export type NutrientValueType = z.infer<typeof nutrientValueTypeSchema>

export const confidenceCodeSchema = z.enum(['A', 'B', 'C', 'D'])
export type ConfidenceCode = z.infer<typeof confidenceCodeSchema>

// --- Formes de sortie de parse.ts (partagées avec import.ts) --------------
export const parsedNutrientSchema = z.object({
  externalId: z.string(), // const_code
  nameFr: z.string(),
  unit: z.string(),
  category: nutrientCategorySchema,
  valueType: nutrientValueTypeSchema,
  value: z.number().nullable(),
  rawValueText: z.string(),
  confidenceCode: confidenceCodeSchema.nullable(),
})
export type ParsedNutrient = z.infer<typeof parsedNutrientSchema>

export const parsedFoodSchema = z.object({
  externalId: z.string(), // alim_code
  name: z.string(),
  categoryName: z.string().nullable(),
  kcalPer100g: z.number().nullable(),
  proteinPer100g: z.number().nullable(),
  carbsPer100g: z.number().nullable(),
  fatPer100g: z.number().nullable(),
  fiberPer100g: z.number().nullable(),
  expectedKcal: z.number().nullable(),
  nutrients: z.array(parsedNutrientSchema),
})
export type ParsedFood = z.infer<typeof parsedFoodSchema>
