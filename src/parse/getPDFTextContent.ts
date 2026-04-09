import type { PDFDocumentProxy } from 'pdfjs-dist';
import { type SimplePDFTextItem } from './types.js'
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import { HORIZONTAL, VERTICAL } from './consts.js';
import { transformTopDownY } from './utils.js';

function transformTextDirection(dir: string): number {
    if (dir === 'ltr') {
        return HORIZONTAL; // 수평
    } else if (dir === 'ttb') {
        return VERTICAL; // 수직
    } else {
        return HORIZONTAL; // 기본값은 수평
    }
}

export default async function getPDFTextContent(pdf: PDFDocumentProxy, pageNum: number): Promise<SimplePDFTextItem[]> {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const textItems = textContent.items
    const viewportHeight = page.getViewport({ scale: 1 }).height

    const simpleTextItems: SimplePDFTextItem[] = []

    for (const item of textItems) {
        const { str, transform, dir } = item as TextItem

        if (str) {
            const [scaleX, skewX, skewY, scaleY, x, y] = transform
            const transformedY = transformTopDownY(viewportHeight, y)
            const textDirection = transformTextDirection(dir)

            simpleTextItems.push({
                string: str,
                dir: textDirection,
                width: scaleX,
                height: scaleY,
                x: x,
                y: transformedY
            })
        }
    }

    // console.log(`text items:`, simpleTextItems)
    console.log(`페이지 ${pageNum}의 텍스트 아이템 수: ${simpleTextItems.length}`)

    return simpleTextItems
}
