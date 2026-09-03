// ============================================================================
// nutrient-classification.ts — étape 2 (TRANSFORM), brique isolée.
//
// Une seule question : le nutriment `const_code` X, quelle NutrientCategory ?
//
// C'est une table écrite À LA MAIN pour les 74 codes de const_2025_11_03.xml.
// Pas d'heuristique sur le libellé : les noms CIQUAL sont trop irréguliers
// ("Alpha-tocophérol" est une vitamine, "Acides organiques" ne l'est pas).
//
// Les cas non évidents (énergie, eau, cendres, acides organiques, sel, alcool,
// cholestérol, bêta-carotène, alpha-tocophérol) ont été tranchés en confrontant
// la pratique officielle (Règlement UE 1169/2011, ANSES) et les trackers
// (MyFitnessPal, Cronometer). Voir le tableau en commentaire plus bas.
// ============================================================================

import type { NutrientCategory } from './types'

const CLASSIFICATION: Record<string, NutrientCategory> = {
  // --- Énergie : chiffre dérivé, pas un nutriment par masse -> other ---------
  '327': 'other', // Energie, Règlement UE 1169/2011 (kJ)
  '328': 'other', // Energie, Règlement UE 1169/2011 (kcal)
  '332': 'other', // Energie, N x facteur Jones (kJ)
  '333': 'other', // Energie, N x facteur Jones (kcal)

  // --- Constituants analytiques, jamais affichés en cible -> other ----------
  '400': 'other', // Eau
  '10000': 'other', // Cendres (résidu minéral après combustion)
  '65000': 'other', // Acides organiques

  // --- Minéraux -----------------------------------------------------------
  '10004': 'mineral', // Sel chlorure de sodium (calculé : sodium x 2,5)
  '10110': 'mineral', // Sodium
  '10120': 'mineral', // Magnésium
  '10150': 'mineral', // Phosphore
  '10170': 'mineral', // Chlorure
  '10190': 'mineral', // Potassium
  '10200': 'mineral', // Calcium
  '10251': 'mineral', // Manganèse
  '10260': 'mineral', // Fer
  '10290': 'mineral', // Cuivre
  '10300': 'mineral', // Zinc
  '10340': 'mineral', // Sélénium
  '10530': 'mineral', // Iode

  // --- Macronutriments --------------------------------------------------
  '25000': 'macro', // Protéines, N x facteur de Jones
  '25003': 'macro', // Protéines, N x 6.25
  '31000': 'macro', // Glucides
  '33110': 'macro', // Amidon
  '34000': 'macro', // Polyols totaux
  '34100': 'macro', // Fibres alimentaires
  '40000': 'macro', // Lipides
  '60000': 'macro', // Alcool (éthanol) — 7 kcal/g, macroconstituant ANSES

  // --- Sucres ---------------------------------------------------------
  '32000': 'sugar', // Sucres (total)
  '32210': 'sugar', // Fructose
  '32220': 'sugar', // Galactose
  '32250': 'sugar', // Glucose
  '32410': 'sugar', // Lactose
  '32430': 'sugar', // Maltose
  '32480': 'sugar', // Saccharose

  // --- Acides gras (+ cholestérol, rangé ici faute de case "lipide") -------
  '40302': 'fatty_acid', // AG saturés
  '40303': 'fatty_acid', // AG monoinsaturés
  '40304': 'fatty_acid', // AG polyinsaturés
  '40400': 'fatty_acid', // AG 4:0 butyrique
  '40600': 'fatty_acid', // AG 6:0 caproïque
  '40800': 'fatty_acid', // AG 8:0 caprylique
  '41000': 'fatty_acid', // AG 10:0 caprique
  '41200': 'fatty_acid', // AG 12:0 laurique
  '41400': 'fatty_acid', // AG 14:0 myristique
  '41600': 'fatty_acid', // AG 16:0 palmitique
  '41800': 'fatty_acid', // AG 18:0 stéarique
  '41819': 'fatty_acid', // AG 18:1 n-9 oléique
  '41826': 'fatty_acid', // AG 18:2 n-6 linoléique
  '41833': 'fatty_acid', // AG 18:3 n-3 alpha-linolénique
  '42046': 'fatty_acid', // AG 20:4 n-6 arachidonique
  '42053': 'fatty_acid', // AG 20:5 n-3 EPA
  '42263': 'fatty_acid', // AG 22:6 n-3 DHA
  '75100': 'fatty_acid', // Cholestérol (stérol, mais section "lipides" partout)

  // --- Vitamines ------------------------------------------------------
  '51104': 'vitamin', // Activité vitaminique A, équivalents rétinol
  '51200': 'vitamin', // Rétinol
  '51330': 'vitamin', // Bêta-carotène (provitamine A)
  '52100': 'vitamin', // Vitamine D
  '52200': 'vitamin', // Vitamine D2 (ergocalciférol)
  '52300': 'vitamin', // Vitamine D3 (cholécalciférol)
  '53100': 'vitamin', // Vitamine E
  '54101': 'vitamin', // Vitamine K1
  '54104': 'vitamin', // Vitamine K2
  '55100': 'vitamin', // Vitamine C
  '56100': 'vitamin', // Vitamine B1 (thiamine)
  '56200': 'vitamin', // Vitamine B2 (riboflavine)
  '56310': 'vitamin', // Vitamine B3 (niacine)
  '56400': 'vitamin', // Vitamine B5 (acide pantothénique)
  '56500': 'vitamin', // Vitamine B6
  '56600': 'vitamin', // Vitamine B12
  '56700': 'vitamin', // Vitamine B9 (folates totaux)
  '56702': 'vitamin', // Vitamine B9 (DFE)
  '56704': 'vitamin', // Folates intrinsèques
  '56708': 'vitamin', // Acide folique (enrichissement)
  '71010': 'vitamin', // Alpha-tocophérol (= vitamine E)
}

export function classifyNutrient(constCode: string): NutrientCategory {
  const category = CLASSIFICATION[constCode]
  if (!category) {
    // Fail fast : un code inconnu (nouvelle version CIQUAL) doit forcer une
    // décision humaine, pas tomber dans un "other" par défaut qui passerait
    // inaperçu.
    throw new Error(`const_code non classé : "${constCode}" — ajouter une entrée dans CLASSIFICATION`)
  }
  return category
}
