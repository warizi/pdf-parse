import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from 'canvas'
import type { SimplePDFImageItem } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESULT_DIR = join(__dirname, '../result')
const IMAGES_DIR = join(RESULT_DIR, 'images')

// pdfjs 이미지 kind 상수
const ImageKind = { GRAYSCALE_1BPP: 1, RGB_24BPP: 2, RGBA_32BPP: 3 } as const

type PdfjsImageData = {
    width: number
    height: number
    kind: number
    data: Uint8ClampedArray
}

function toRGBA(imgData: PdfjsImageData): Uint8ClampedArray {
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

function saveImage(item: SimplePDFImageItem) {
    const imgData = item.data as PdfjsImageData
    const { width, height } = imgData

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const rgba = toRGBA(imgData)
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(rgba)
    ctx.putImageData(imageData, 0, 0)

    const filePath = join(IMAGES_DIR, `${item.name}.png`)
    fs.writeFileSync(filePath, canvas.toBuffer('image/png'))
}

function initResult() {
    if (fs.existsSync(RESULT_DIR)) {
        fs.rmSync(RESULT_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(IMAGES_DIR, { recursive: true })
}

export function createResult(images: SimplePDFImageItem[]) {
    initResult()
    for (const image of images) {
        saveImage(image)
    }
}
