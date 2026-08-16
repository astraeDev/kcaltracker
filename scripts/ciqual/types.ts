export type AlimRow = {
  alim_code: string
  alim_nom_fr: string
  alim_grp_code: string
}

export type AlimGrpRow = {
  alim_grp_code: string
  alim_grp_nom_fr: string
}

export type ConstRow = {
  const_code: string
  const_nom_fr: string
}

export type CompoRow = {
  alim_code: string
  const_code: string
  teneur: string
  code_confiance: string
}

// Doit rester synchronisé avec nutrient_category_enum dans la migration DB.
export type NutrientCategory = 'macro' | 'fatty_acid' | 'sugar' | 'vitamin' | 'mineral' | 'other'
