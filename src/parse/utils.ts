import { ImageKind } from "./consts.js";
import type { PdfjsImageData } from "./types.js";

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

export function isLikelyTextImage(rgba: Uint8ClampedArray): boolean {
  const pixelCount = rgba.length / 4
  let blackPixels = 0
  let whitePixels = 0

  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!
    const g = rgba[i + 1]!
    const b = rgba[i + 2]!
    const avg = (r + g + b) / 3

    if (avg < 80) blackPixels++        // 어두운 픽셀 (텍스트)
    else if (avg > 200) whitePixels++  // 밝은 픽셀 (배경)
  }

  const blackRatio = blackPixels / pixelCount
  const whiteRatio = whitePixels / pixelCount

  // 흑백 픽셀이 전체의 90% 이상이면 텍스트 이미지
  return (blackRatio + whiteRatio) > 0.9
}
