
export interface SimplePDFTextItem {
    string: string; // 텍스트 내용
    dir: number; // 텍스트 방향 (0: 수평, 1: 수직)
    width: number; // 텍스트 아이템의 너비
    height: number; // 텍스트 아이템의 높이
    x: number; // 텍스트 아이템의 x 좌표
    y: number; // 텍스트 아이템의 y 좌표
}

export interface SimplePDFImageItem {
    name: string;   // 이미지 객체 이름 (img_p0_1 등)
    text?: string | null;   // 이미지 주변 텍스트 (선택적)
    data: unknown;  // pdfjs 이미지 객체
    width: number;  // 이미지 너비
    height: number; // 이미지 높이
    x: number;      // 이미지 x 좌표
    y: number;      // 이미지 y 좌표
}

export type PdfjsImageData = {
    width: number
    height: number
    kind: number
    data: Uint8ClampedArray
}

export type AssembledToken = {
    text: string   // 조합된 텍스트
    x: number      // 시작 x
    y: number      // y (top-down 기준)
    width: number  // 전체 너비
}

export type ParsedTable = {
    title: string     // 이미지 토큰 텍스트 (섹션 헤더)
    x: number
    y: number
    headers: string[] // 첫 번째 행
    rows: string[][]  // 나머지 데이터 행
}