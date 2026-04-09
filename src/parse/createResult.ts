import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from 'canvas'
import type { AssembledToken, ParsedTable, PdfjsImageData, SimplePDFImageItem, SimplePDFTextItem } from './types.js'
import { toRGBA } from './utils.js'
import { terminateWorker } from './getImageText.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESULT_DIR = join(__dirname, '../result')
const TOKEN_DIR = join(RESULT_DIR, 'tokens')
const TEXT_DIR = join(RESULT_DIR, 'text')
const IMAGES_DIR = join(RESULT_DIR, 'images')
const TABLE_DIR = join(RESULT_DIR, 'tables')

function saveImage(item: SimplePDFImageItem, pageNum: number) {
    const imgData = item.data as PdfjsImageData
    const { width, height } = imgData

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const rgba = toRGBA(imgData)
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(rgba)
    ctx.putImageData(imageData, 0, 0)

    const filePath = join(IMAGES_DIR, `page_${pageNum}`, `${item.name}.png`)
    fs.writeFileSync(filePath, canvas.toBuffer('image/png'))
}

function saveAssembledTokenToJSON(tokens: AssembledToken[], pageNum: number) {
    const filePath = join(TOKEN_DIR, `page_${pageNum}`, 'tokens.json')
    fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2))
}

function saveTextItemsToJSON(textItems: SimplePDFTextItem[], pageNum: number) {
    const filePath = join(TEXT_DIR, `page_${pageNum}`, 'text_items.json')
    fs.writeFileSync(filePath, JSON.stringify(textItems, null, 2))
}

function saveParsedTablesToJSON(tables: ParsedTable[], pageNum: number) {
    const filePath = join(TABLE_DIR, `page_${pageNum}`, 'tables.json')
    fs.writeFileSync(filePath, JSON.stringify(tables, null, 2))
}

function initResult(pageNum: number) {
    if (fs.existsSync(RESULT_DIR)) {
        fs.rmSync(RESULT_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(IMAGES_DIR, { recursive: true })
    fs.mkdirSync(TOKEN_DIR, { recursive: true })
    fs.mkdirSync(TEXT_DIR, { recursive: true })
    fs.mkdirSync(TABLE_DIR, { recursive: true })
    fs.mkdirSync(join(IMAGES_DIR, `page_${pageNum}`), { recursive: true }) 
    fs.mkdirSync(join(TOKEN_DIR, `page_${pageNum}`), { recursive: true })
    fs.mkdirSync(join(TEXT_DIR, `page_${pageNum}`), { recursive: true })
    fs.mkdirSync(join(TABLE_DIR, `page_${pageNum}`), { recursive: true })
}

export function createResult({ 
    images, 
    tokens, 
    text, 
    table, 
    pageNum 
}: {
    images: SimplePDFImageItem[], 
    tokens: AssembledToken[], 
    text: SimplePDFTextItem[],
    table: ParsedTable[], 
    pageNum: number
}) {
    initResult(pageNum);
    for (const image of images) {
        saveImage(image, pageNum);
    }
    saveAssembledTokenToJSON(tokens, pageNum);
    saveTextItemsToJSON(text, pageNum);
    saveParsedTablesToJSON(table, pageNum);
    terminateWorker();
}
