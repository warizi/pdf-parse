import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import getPDF from './parse/getPDF.js'
import getPDFTextContent from './parse/getPDFTextContent.js'
import type { SimplePDFTextItem } from './parse/types.js'
import getPDFImage from './parse/getPDFImage.js'
import { createResult } from './parse/createResult.js'
import { assembleTextTokens } from './parse/utils.js'
import { parseTable } from './parse/parseTable.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// PDF 파일을 읽어서 buffer로 변환
const buffer = fs.readFileSync(join(__dirname, './pdf-files/2026년도+4월+16일+시행+전기요금표(종합).pdf'))

const pdf = await getPDF(buffer)

const pageNum = 1

if (pdf) {
    const textItems: SimplePDFTextItem[] = await getPDFTextContent(pdf, pageNum)
    const image = await getPDFImage(pdf, pageNum)
    const textTokens = assembleTextTokens(image)
    // console.log('이미지 테이블 텍스트 토큰:', textTokens)

    const tables = parseTable(textTokens, textItems)
    // console.log('파싱된 테이블:', tables)

    createResult({images: image, tokens: textTokens, text: textItems, table: tables, pageNum})
} else {
    console.error('PDF 파일을 불러오는 데 실패했습니다.')
}
