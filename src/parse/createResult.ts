import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from 'canvas'
import type { PdfjsImageData, SimplePDFImageItem } from './types.js'
import { toRGBA } from './utils.js'
import { terminateWorker } from './getImageText.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESULT_DIR = join(__dirname, '../result')
const IMAGES_DIR = join(RESULT_DIR, 'images')

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
    terminateWorker()
}
