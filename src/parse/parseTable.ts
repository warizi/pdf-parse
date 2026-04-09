import type { AssembledToken, ParsedTable, SimplePDFTextItem } from './types.js'

const Y_ROW_TOLERANCE = 3
const X_COLUMN_GAP = 20     // 같은 행 내 열 구분 간격
const X_ZONE_GAP = 100      // 컬럼 구역을 나누는 최소 x 간격

// 토큰 x값들을 클러스터링해서 컬럼 구역 경계 계산
function detectColumnZones(tokens: AssembledToken[]): Array<{ xMin: number; xMax: number }> {
    const xValues = [...new Set(tokens.map(t => t.x))].sort((a, b) => a - b)

    // x 간격이 X_ZONE_GAP 이상이면 새 컬럼
    const columnCenters: number[] = [xValues[0]!]
    for (let i = 1; i < xValues.length; i++) {
        if (xValues[i]! - xValues[i - 1]! >= X_ZONE_GAP) {
            columnCenters.push(xValues[i]!)
        }
    }

    // 컬럼 경계 = 인접 컬럼 중심 사이의 중간점
    return columnCenters.map((center, i) => {
        const prevMid = i === 0
            ? -Infinity
            : (columnCenters[i - 1]! + center) / 2
        const nextMid = i === columnCenters.length - 1
            ? Infinity
            : (center + columnCenters[i + 1]!) / 2
        return { xMin: prevMid, xMax: nextMid }
    })
}

// 같은 행의 텍스트를 x 간격 기준으로 열 클러스터링
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

// 텍스트 아이템을 y 기준으로 행 그룹핑
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
        // 해당 구역의 토큰만 추출 후 y 정렬
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
