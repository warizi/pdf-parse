import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import getPDF from './parse/getPDF.js'
import getPDFTextContent from './parse/getPDFTextContent.js'
import type { SimplePDFTextItem } from './parse/types.js'
import getPDFImage from './parse/getPDFImage.js'
import { createResult } from './parse/createResult.js'
import { assembleTextTokens, assembleTextHeaderTokens } from './parse/utils.js'
import { parseTable } from './parse/parseTable.js'
import { terminateWorker } from './parse/getImageText.js'
import { convert } from '@opendataloader/pdf';

const __dirname = dirname(fileURLToPath(import.meta.url))
const PDF1 = '2026년도+4월+16일+시행+전기요금표(종합).pdf';
const PDF2 = '23.05.16 시행 전기요금표_종합.pdf';
const PDF3 = '2024년도+1월+1일+시행+전기요금표(종합)_출력용.pdf'
// PDF 파일을 읽어서 buffer로 변환
const buffer = fs.readFileSync(join(__dirname, `./pdf-files/${PDF2}`))

// PDF buffer를 라이브러리로 읽어서 객체로 반환
const pdf = await getPDF(buffer)

if (pdf) {
    const pages = []

    // 페이지 수 별 반복하여 텍스트와 이미지 추출
    for (let pageNum = 1
        ; pageNum <= pdf.numPages; pageNum++) {
        // textItems는 PDF 페이지에서 추출한 텍스트 요소들의 배열입니다. 각 요소는 문자열, 위치, 크기 등의 정보를 포함합니다.
        const textItems: SimplePDFTextItem[] = await getPDFTextContent(pdf, pageNum)
        // 순수 이미지들을 text이미지 이면 text값에 string이 들어갑니다.
        const images = await getPDFImage(pdf, pageNum)
        // text 이미지들만 추려서 간은 라인의 텍스트를 붙여줍니다. (분리된 text 이미지들을 하나의 텍스트로 조합)
        const imageTokens = assembleTextTokens(images)
        // 이미지 기반 텍스트 토큰이 존재하면 그것을 사용하고, 그렇지 않으면 헤더 감지로 조합한 텍스트 토큰을 사용합니다.
        const tokens = imageTokens.length > 0 ? imageTokens : assembleTextHeaderTokens(textItems)
        // 텍스트 토큰과 원본 텍스트 아이템을 사용하여 표 구조를 파싱합니다. (표의 셀과 행을 감지하여 구조화된 데이터로 변환)
        const table = parseTable(tokens, textItems)

        pages.push({ images, tokens, text: textItems, table, pageNum })
        await terminateWorker()
    }
    // 추출된 페이지 데이터를 기반으로 최종 결과를 생성합니다. (각 페이지의 텍스트, 이미지, 표 데이터를 종합하여 최종 JSON 결과로 변환)
    createResult(pages)
} else {
    console.error('PDF 파일을 불러오는 데 실패했습니다.')
}
