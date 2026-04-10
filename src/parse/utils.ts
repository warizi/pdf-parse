import { ImageKind } from "./consts.js";
import type { AssembledToken, PdfjsImageData, SimplePDFImageItem, SimplePDFTextItem } from "./types.js";

export function transformTopDownY(viewportHeight: number, y: number): number{
    return viewportHeight - y;
}

export function toRGBA(imgData: PdfjsImageData): Uint8ClampedArray {
    const { width, height, kind, data } = imgData
    const size = width * height

    if (kind === ImageKind.RGBA_32BPP) {
        return data
    }

    const rgba = new Uint8ClampedArray(size * 4)

    if (kind === ImageKind.RGB_24BPP) {
        for (let i = 0, j = 0; i < size; i++, j += 3) {
            rgba[i * 4]     = data[j]!
            rgba[i * 4 + 1] = data[j + 1]!
            rgba[i * 4 + 2] = data[j + 2]!
            rgba[i * 4 + 3] = 255
        }
    } else {
        // GRAYSCALE_1BPP: 1비트 팩킹 → 바이트 확장
        for (let i = 0; i < size; i++) {
            const byte = data[i >> 3]!
            const bit = (byte >> (7 - (i & 7))) & 1
            const v = bit ? 255 : 0
            rgba[i * 4]     = v
            rgba[i * 4 + 1] = v
            rgba[i * 4 + 2] = v
            rgba[i * 4 + 3] = 255
        }
    }

    return rgba
}

export function isLikelyTextImage(rgba: Uint8ClampedArray, width: number, height: number): boolean {
  // 최소 크기 미달 이미지는 텍스트를 담을 수 없음
  if (width < 60 || height < 30) return false

  const pixelCount = rgba.length / 4
  let blackPixels = 0
  let whitePixels = 0

  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!
    const g = rgba[i + 1]!
    const b = rgba[i + 2]!
    const avg = (r + g + b) / 3

    if (avg < 80) blackPixels++
    else if (avg > 200) whitePixels++
  }

  const blackRatio = blackPixels / pixelCount
  const whiteRatio = whitePixels / pixelCount

  // 흑백 비율 90% 미만이면 컬러 이미지(그래프, 사진 등)
  return (blackRatio + whiteRatio) > 0.9
}

export function assembleTextTokens(items: SimplePDFImageItem[]): AssembledToken[] {
    const Y_TOLERANCE = 2     // 같은 줄로 간주할 y 오차 범위 (pt)
    const X_GAP_THRESHOLD = 5 // 이 이상 떨어지면 별도 토큰

    // text가 있는 아이템만 추출
    const textItems = items.filter(item => item.text)

    // y 기준으로 줄 그룹핑
    const lines: SimplePDFImageItem[][] = []
    for (const item of textItems) {
        const existingLine = lines.find(
            line => line[0] !== undefined && Math.abs(line[0].y - item.y) <= Y_TOLERANCE
        )
        if (existingLine) {
            existingLine.push(item)
        } else {
            lines.push([item])
        }
    }

    const tokens: AssembledToken[] = []

    for (const line of lines) {
        const sorted = [...line].sort((a, b) => a.x - b.x)

        let currentText = sorted[0]!.text!
        let startX = sorted[0]!.x
        const lineY = sorted[0]!.y
        let endX = sorted[0]!.x + sorted[0]!.width

        for (let i = 1; i < sorted.length; i++) {
            const cur = sorted[i]!
            const gap = cur.x - endX

            if (gap >= X_GAP_THRESHOLD) {
                // 간격이 크면 이전 토큰 저장 후 새 토큰 시작
                tokens.push({ text: currentText, x: startX, y: lineY, width: endX - startX })
                currentText = cur.text!
                startX = cur.x
            } else {
                currentText += cur.text
            }
            endX = cur.x + cur.width
        }

        tokens.push({ text: currentText, x: startX, y: lineY, width: endX - startX })
    }

    return tokens.sort((a, b) => a.y - b.y || a.x - b.x)
}

/**
 * 텍스트 아이템에서 헤더를 감지해 AssembledToken으로 변환.
 * 이미지 기반 토큰이 없는 PDF(헤더가 텍스트인 경우)에서 폴백으로 사용.
 *
 * 전략: 본문 텍스트의 최빈 높이보다 큰 텍스트 아이템을 헤더로 간주.
 */
export function assembleTextHeaderTokens(textItems: SimplePDFTextItem[]): AssembledToken[] {
    if (textItems.length === 0) return []

    // 최빈 높이 계산 (= 본문 텍스트 높이)
    const heightCounts = new Map<number, number>()
    for (const item of textItems) {
        const h = Math.round(item.height * 10) / 10
        heightCounts.set(h, (heightCounts.get(h) ?? 0) + 1)
    }
    let modeHeight = 0, maxCount = 0
    for (const [h, cnt] of heightCounts) {
        if (cnt > maxCount) { maxCount = cnt; modeHeight = h }
    }

    // 시행일 패턴 (예: "2023년 5월 16일 시행") — 섹션 헤더 아님
    const datePattern = /\d{4}년.+시행/

    // 본문보다 10% 이상 크고, 지나치게 크지 않은 항목 = 헤더 후보
    const headerItems = textItems.filter(item =>
        item.height > modeHeight * 1.1 &&
        item.height < modeHeight * 4 &&
        item.string.trim().length > 0 &&
        !datePattern.test(item.string)
    )

    if (headerItems.length === 0) return []

    const Y_TOLERANCE = 2
    const lines: SimplePDFTextItem[][] = []
    for (const item of headerItems) {
        const existing = lines.find(line => Math.abs(line[0]!.y - item.y) <= Y_TOLERANCE)
        if (existing) {
            existing.push(item)
        } else {
            lines.push([item])
        }
    }

    const X_GAP_THRESHOLD = 20  // 헤더 간 최소 구분 간격 (pt)

    const tokens: AssembledToken[] = []
    for (const line of lines) {
        const sorted = [...line].sort((a, b) => a.x - b.x)

        let currentText = sorted[0]!.string
        let startX = sorted[0]!.x
        const lineY = sorted[0]!.y
        let endX = sorted[0]!.x + sorted[0]!.width

        for (let i = 1; i < sorted.length; i++) {
            const cur = sorted[i]!
            const gap = cur.x - endX

            if (gap >= X_GAP_THRESHOLD) {
                if (currentText.trim()) {
                    tokens.push({ text: currentText.trim(), x: startX, y: lineY, width: endX - startX })
                }
                currentText = cur.string
                startX = cur.x
            } else {
                currentText += cur.string
            }
            endX = cur.x + cur.width
        }

        if (currentText.trim()) {
            tokens.push({ text: currentText.trim(), x: startX, y: lineY, width: endX - startX })
        }
    }

    const sorted = tokens.sort((a, b) => a.y - b.y || a.x - b.x)

    // 노이즈 필터: | text | 형식, 전화번호 패턴 제거
    const noisePattern = /^\|.*\|$|^국번없이/
    const filtered = sorted.filter(t => !noisePattern.test(t.text))

    // 중복 제거: 동일 텍스트는 첫 번째 등장만 유지
    // 포함 관계: 짧은 것이 긴 것의 부분 문자열이면 짧은 것 제거
    const deduped: AssembledToken[] = []
    for (const token of filtered) {
        const isDuplicate = deduped.some(e => e.text === token.text)
        const isSubstring = deduped.some(e => e.text.includes(token.text))
        if (!isDuplicate && !isSubstring) {
            deduped.push(token)
        }
    }

    return deduped
}