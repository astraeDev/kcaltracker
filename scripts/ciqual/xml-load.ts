// EXTRACT : fichier XML (texte) -> lignes (objets), validées par un schéma Zod

import { readFileSync } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'

// Un BOM UTF-8 = 3 octets invisibles (U+FEFF) au tout début du fichier à retirer
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

// 4 balises, une par fichier.
const ROW_TAGS = ['ALIM', 'ALIM_GRP', 'CONST', 'COMPO'] as const
type RowTag = (typeof ROW_TAGS)[number]

const parser = new XMLParser({
  // false = garder les valeurs telles quelles ("01" reste "01", pas 1) : les codes CIQUAL ont des zéros de tête
  parseTagValue: false,
  // par défaut une balise unique -> objet ; ici on force toujours un tableau pour ces 4 balises
  isArray: (tagName) => (ROW_TAGS as readonly string[]).includes(tagName),
  trimValues: true,
})

export function loadXmlRows<T>(filePath: string, rowTag: RowTag, rowSchema: z.ZodType<T>): T[] {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parser.parse(stripBom(raw))
  const rows = parsed?.TABLE?.[rowTag]

  // Throw si la forme du fichier n'est pas celle attendue (fichier vide, mauvaise balise…)
  if (!Array.isArray(rows)) {
    throw new Error(`Structure inattendue dans ${filePath} : TABLE.${rowTag} n'est pas un tableau`)
  }

  const result = z.array(rowSchema).safeParse(rows)
  if (!result.success) {
    throw new Error(`${filePath} : lignes ${rowTag} invalides —\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
