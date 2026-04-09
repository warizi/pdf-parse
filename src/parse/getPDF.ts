import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDF_SIGNATURE } from './consts.js'

export default async function getPDF(buffer: Buffer): Promise<PDFDocumentProxy | null> {
    
    // PDF 파일의 시그니처를 확인하여 유효한 PDF 파일인지 검사
    const signature = buffer.subarray(0, 4).toString('utf-8')

    if (signature === PDF_SIGNATURE) {
        console.log(`PDF 크기: ${buffer.length} bytes`)
    } else {
        console.log('PDF 파일이 아닙니다.')
        return null
    }

    const uint8Array = new Uint8Array(buffer)

    const loadingTask = getDocument(uint8Array)
    const pdf = await loadingTask.promise

    console.log(`PDF 페이지 수: ${pdf.numPages}`)

    return pdf
}
