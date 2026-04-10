import type { AssembledToken, ParsedTable, SimplePDFTextItem } from './types.js'

const X_ZONE_GAP = 100  // 이 이상 x 간격이면 다른 컬럼

/**
 * 토큰 x 좌표를 클러스터링해서 컬럼 구역 경계를 계산.
 * 각 구역은 이전 컬럼 중심 ~ 다음 컬럼 중심 사이 범위.
 */
function detectColumnZones(tokens: AssembledToken[]): Array<{ center: number; xMin: number; xMax: number }> {
    const sorted = [...tokens].sort((a, b) => a.x - b.x)

    const centers: number[] = []
    for (const t of sorted) {
        if (centers.length === 0 || t.x - centers[centers.length - 1]! >= X_ZONE_GAP) {
            centers.push(t.x)
        }
    }

    return centers.map((c, i) => ({
        center: c,
        xMin: i === 0 ? -Infinity : (centers[i - 1]! + c) / 2,
        xMax: i === centers.length - 1 ? Infinity : (c + centers[i + 1]!) / 2,
    }))
}

export function parseTable(
    tokens: AssembledToken[],
    textItems: SimplePDFTextItem[]
): ParsedTable[] {
    if (tokens.length === 0) return []

    const zones = detectColumnZones(tokens)
    const tables: ParsedTable[] = []

    for (const zone of zones) {
        const zoneTokens = tokens
            .filter(t => t.x >= zone.xMin && t.x < zone.xMax)
            .sort((a, b) => a.y - b.y)

        const zoneTextItems = textItems.filter(
            t => t.x >= zone.xMin && t.x < zone.xMax
        )

        for (let i = 0; i < zoneTokens.length; i++) {
            const token = zoneTokens[i]!
            const nextToken = zoneTokens[i + 1]

            const yStart = token.y
            const yEnd = nextToken?.y ?? Infinity

            const sectionItems = zoneTextItems.filter(
                t => t.y > yStart && t.y < yEnd
            )

            tables.push({
                title: token.text,
                x: token.x,
                y: token.y,
                textItems: sectionItems,
            })
        }
    }

    return tables.sort((a, b) => a.y - b.y || a.x - b.x)
}
