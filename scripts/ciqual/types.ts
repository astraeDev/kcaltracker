
// const — 74 nutriments
export type ConstRow = {
  const_code: string   // identifiant du nutriment, ex. "328"
  const_nom_fr: string  // nom + unité collée, ex. "Energie ... (kcal/100 g)"
}

// alim_grp — catégories d'aliments
export type AlimGrpRow = {
  alim_grp_code: string   // ex. "01"
  alim_grp_nom_fr: string  // ex. "entrées et plats composés"
}

// alim — 3484 aliments
export type AlimRow = {
  alim_code: string      // identifiant de l'aliment, ex. "1000"
  alim_nom_fr: string     // ex. "Pastis"
  alim_grp_code: string   // vers quel groupe il appartient, ex. "06"
}

// compo — 257 816 valeurs (aliment × nutriment)
export type CompoRow = {
  alim_code: string        // aliment
  const_code: string       // nutriment
  teneur: string           // valeur brute : "59,7" | "-" | "traces" | "< 2,2"
  code_confiance: string   // fiabilité : "A" | "B" | "C" | "D" | "" (vide si non renseigné)
}

// Copies des enums SQL — à garder synchronisées manuellement avec la migration.
export type NutrientCategory = 'macro' | 'fatty_acid' | 'sugar' | 'vitamin' | 'mineral' | 'other'
export type NutrientValueType = 'measured' | 'traces' | 'less_than' | 'not_measured'
