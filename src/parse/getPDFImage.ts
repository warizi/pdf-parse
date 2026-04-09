import { OPS, type PDFDocumentProxy } from "pdfjs-dist";
import type { PdfjsImageData, SimplePDFImageItem } from "./types.js";
import { transformTopDownY } from "./utils.js";
import Tesseract from 'tesseract.js'
import { getImageText } from "./getImageText.js";

type Matrix = [number, number, number, number, number, number];

// PDF CTM 행렬 곱셈: current × next
// [a,b,c,d,e,f] 표기: x' = ax + cy + e, y' = bx + dy + f
function multiplyMatrix(m1: Matrix, m2: Matrix): Matrix {
    return [
        m1[0] * m2[0] + m1[1] * m2[2],
        m1[0] * m2[1] + m1[1] * m2[3],
        m1[2] * m2[0] + m1[3] * m2[2],
        m1[2] * m2[1] + m1[3] * m2[3],
        m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
        m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
    ];
}

function getObjAsync(page: Awaited<ReturnType<PDFDocumentProxy['getPage']>>, name: string): Promise<unknown> {
    return new Promise((resolve) => {
        const objStore = name.startsWith('g_') ? page.commonObjs : page.objs;
        objStore.get(name, resolve);
    });
}

export default async function getPDFImage(pdf: PDFDocumentProxy, pageNum: number): Promise<SimplePDFImageItem[]> {
    const page = await pdf.getPage(pageNum);
    const operatorList = await page.getOperatorList();
    const viewportHeight = page.getViewport({ scale: 1 }).height;

    const results: SimplePDFImageItem[] = [];

    // 그래픽 상태 스택 (transform 누적)
    const transformStack: Matrix[] = [];
    let currentTransform: Matrix = [1, 0, 0, 1, 0, 0]; // identity matrix

    console.log('이미지 아이템 추출 시작...');

    for (let i = 0; i < operatorList.fnArray.length; i++) {
        const fn = operatorList.fnArray[i];
        const args = operatorList.argsArray[i];

        if (fn === OPS.save) {
            transformStack.push([...currentTransform]);
        } else if (fn === OPS.restore) {
            currentTransform = transformStack.pop() ?? [1, 0, 0, 1, 0, 0];
        } else if (fn === OPS.transform) {
            // cm 연산자: CTM에 누적 곱셈
            currentTransform = multiplyMatrix(currentTransform, args as Matrix);
        } else if (fn === OPS.paintImageXObject) {
            const imageName = args?.[0] as string;
            const data = await getObjAsync(page, imageName) as PdfjsImageData;

            const imageText = await getImageText(data);
            // console.log(`이미지 ${imageName} 텍스트:`, imageText);

            // PDF transform 행렬: [a, b, c, d, e, f]
            // 이미지의 경우 보통 [width, 0, 0, height, x, y]
            const [a, , , d, e, f] = currentTransform;
            const pdfY = d < 0 ? f + d : f  // d 음수면 f가 이미지 상단

            results.push({
                name: imageName,
                x: e,
                y: transformTopDownY(viewportHeight, pdfY),
                width: Math.abs(a),
                height: Math.abs(d),
                data,
                text: imageText,
            });
        }
    }

    console.log('이미지 아이템 추출 완료.');
                                                                                                                                                                                      
    console.log(`페이지 ${pageNum}의 이미지 아이템:`, results);
    console.log(`페이지 ${pageNum}의 이미지 아이템 수: ${results.length}`);

    return results;
}
