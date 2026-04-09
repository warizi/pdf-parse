import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import getPDF from './parse/getPDF.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// PDF 파일을 읽어서 buffer로 변환
const buffer = fs.readFileSync(join(__dirname, './pdf-files/2026년도+4월+16일+시행+전기요금표(종합).pdf'))

const pdf = await getPDF(buffer)
