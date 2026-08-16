import { readFileSync } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'

// Fichier ALIM et COMPO contiennent un BOM UTF-8 
// = 3 octets invisibles au début des fichiers alim et compo (EF BB BF) avant la déclaration XML 
// = empeche XML parseur de lire correctement = à retirer
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

const ROW_TAGS = ['ALIM', 'ALIM_GRP', 'CONST', 'COMPO']

const parser = new XMLParser({
  parseTagValue: false, 
  // défaul=true=détruit 0 de tête hors existance de clés de correspondance = on ne veut pas altérer un "01" en "1"
  isArray: (tagName) => ROW_TAGS.includes(tagName),
  // pour toujours retourner un tableau d'éléments même si ce n'est qu'un seul élément.
})

export function loadXmlRows<T>(filePath: string, rowTag: (typeof ROW_TAGS)[number]): T[] {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parser.parse(stripBom(raw))
  const rows = parsed?.TABLE?.[rowTag]

  if (!Array.isArray(rows)) {
    throw new Error(`Structure XML inattendue dans ${filePath} : TABLE.${rowTag} n'est pas un tableau`)
  }

  return rows as T[]
}
