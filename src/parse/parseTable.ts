import type { AssembledToken, ParsedTable, SimplePDFTextItem } from './types.js'

const Y_ROW_TOLERANCE = 3
const X_COLUMN_GAP = 20   // 같은 행 내 열 구분 간격
const X_ZONE_GAP = 100    // 컬럼 구역을 나누는 최소 x 간격

/**
 * 토큰 x값을 클러스터링해서 컬럼 구역 경계를 계산한다.
 * 경계는 "다음 컬럼 토큰 x - 1" 로 잡아서 텍스트가 잘리지 않게 한다.
 *
 * 예) 토큰 x: 306, 604, 899 →
 *   컬럼1: -∞ ~ 603
 *   컬럼2:  603 ~ 898
 *   컬럼3:  898 ~ +∞
 */
function detectColumnZones(tokens: AssembledToken[]): Array<{ xMin: number; xMax: number }> {
    const sorted = [...tokens].sort((a, b) => a.x - b.x)

    // 토큰 x값을 X_ZONE_GAP 기준으로 클러스터링
    const centers: number[] = []
    for (const t of sorted) {
        if (centers.length === 0 || t.x - centers[centers.length - 1]! >= X_ZONE_GAP) {
            centers.push(t.x)
        }
    }

    // 경계: 다음 컬럼 시작 직전
    return centers.map((_, i) => ({
        xMin: i === 0 ? -Infinity : centers[i]! - 1,
        xMax: i === centers.length - 1 ? Infinity : centers[i + 1]! - 1,
    }))
}

/**
 * 같은 행의 텍스트 아이템을 x 간격 기준으로 열 클러스터링해 string[] 반환
 */
function clusterColumns(items: SimplePDFTextItem[]): string[] {
    const sorted = [...items].sort((a, b) => a.x - b.x)
    const columns: string[] = []
    let current = ''
    let prevEnd = -Infinity

    for (const item of sorted) {
        if (current !== '' && item.x - prevEnd > X_COLUMN_GAP) {
            columns.push(current)
            current = ''
        }
        current += item.string
        prevEnd = item.x + item.width
    }
    if (current) columns.push(current)

    return columns
}

/**
 * 텍스트 아이템을 y 기준으로 행 그룹핑 (Y_ROW_TOLERANCE 허용)
 */
function groupByRow(items: SimplePDFTextItem[]): SimplePDFTextItem[][] {
    const rowMap = new Map<number, SimplePDFTextItem[]>()

    for (const item of items) {
        const existingKey = [...rowMap.keys()].find(k => Math.abs(k - item.y) <= Y_ROW_TOLERANCE)
        const key = existingKey ?? item.y
        if (!rowMap.has(key)) rowMap.set(key, [])
        rowMap.get(key)!.push(item)
    }

    return [...rowMap.entries()]
        .sort(([ya], [yb]) => ya - yb)
        .map(([, rowItems]) => rowItems)
}

export function parseTable(
    tokens: AssembledToken[],
    textItems: SimplePDFTextItem[]
): ParsedTable[] {
    // 1. 토큰 x값으로 컬럼 구역 감지
    const columnZones = detectColumnZones(tokens)
    const tables: ParsedTable[] = []

    // 2. 각 컬럼 구역별로 처리
    for (const zone of columnZones) {
        // 해당 구역의 토큰만 y 오름차순으로 정렬
        const zoneTokens = tokens
            .filter(t => t.x >= zone.xMin && t.x < zone.xMax)
            .sort((a, b) => a.y - b.y)

        // 해당 구역의 텍스트 아이템만 추출
        const zoneTextItems = textItems.filter(
            t => t.x >= zone.xMin && t.x < zone.xMax
        )

        // 3. 구역 내에서 y값으로 섹션 분리
        for (let i = 0; i < zoneTokens.length; i++) {
            const token = zoneTokens[i]!
            const nextToken = zoneTokens[i + 1]

            const yStart = token.y
            const yEnd = nextToken?.y ?? Infinity

            // 섹션 범위: 토큰 y 초과 ~ 다음 토큰 y 미만
            const sectionItems = zoneTextItems.filter(
                t => t.y > yStart && t.y < yEnd
            )

            if (sectionItems.length === 0) {
                tables.push({ title: token.text, x: token.x, y: token.y, headers: [], rows: [] })
                continue
            }

            const groupedRows = groupByRow(sectionItems)
            const columnRows = groupedRows.map(row => clusterColumns(row))
            const [headers = [], ...rows] = columnRows

            tables.push({ title: token.text, x: token.x, y: token.y, headers, rows })
        }
    }

    // 최종 결과를 y → x 순으로 정렬
    return tables.sort((a, b) => a.y - b.y || a.x - b.x)
}