// EXTRACT fichier XML (text) -> (objet)

import { readFileSync } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'

// Un BOM UTF-8 = 3 octets invisibles (U+FEFF) au tout début du fichier à retirer
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

// 4 balises, une par fichier.
const ROW_TAGS = ['ALIM', 'ALIM_GRP', 'CONST', 'COMPO'] as const
type RowTag = (typeof ROW_TAGS)[number]

const parser = new XMLParser({
  // Default = true : "01" -> 1 = on veut gardervaleurs telles quelles sans détruire le 0 de tête
  parseTagValue: false,
  // Default si balise ligne unique = objet -> toujours retourner un tableau d'éléments
  isArray: (tagName) => (ROW_TAGS as readonly string[]).includes(tagName),
  // 
  trimValues: true,
})

export function loadXmlRows<T>(filePath: string, rowTag: RowTag): T[] {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parser.parse(stripBom(raw))
  const rows = parsed?.TABLE?.[rowTag]

  // Throw si forme non attendue (fichier, balise...) 
  if (!Array.isArray(rows)) {
    throw new Error(`Structure inattendue dans ${filePath} : TABLE.${rowTag} n'est pas un tableau`)
  }

  return rows as T[]
}
