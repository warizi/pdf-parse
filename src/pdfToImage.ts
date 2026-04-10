import fs from 'node:fs'
import path from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PDF_DIR = join(__dirname, 'pdf-files')
const OUTPUT_DIR = join(__dirname, 'pdfToImage')
const STANDARD_FONTS = join(__dirname, '../node_modules/pdfjs-dist/standard_fonts/')

const SCALE = 2.0 // 해상도 배율 (2x ≈ 144dpi)

async function pdfToImages(pdfPath: string) {
    const pdfName = path.basename(pdfPath, '.pdf')
    const outDir = join(OUTPUT_DIR, pdfName)
    fs.mkdirSync(outDir, { recursive: true })

    const buffer = fs.readFileSync(pdfPath)
    const uint8Array = new Uint8Array(buffer)

    const pdf = await getDocument({
        data: uint8Array,
        standardFontDataUrl: STANDARD_FONTS,
    } as Parameters<typeof getDocument>[0]).promise

    console.log(`[${pdfName}] ${pdf.numPages}페이지`)

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: SCALE })

        const canvas = createCanvas(viewport.width, viewport.height)
        const ctx = canvas.getContext('2d')

        await page.render({
            canvasContext: ctx as unknown as CanvasRenderingContext2D,
            canvas: canvas as unknown as HTMLCanvasElement,
            viewport,
        }).promise

        const outPath = join(outDir, `page_${String(pageNum).padStart(2, '0')}.png`)
        const pngBuffer = canvas.toBuffer('image/png')
        fs.writeFileSync(outPath, pngBuffer)
        console.log(`  저장: ${pdfName}/page_${String(pageNum).padStart(2, '0')}.png`)
    }
}

const pdfFiles = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'))

for (const file of pdfFiles) {
    await pdfToImages(join(PDF_DIR, file))
}

console.log('완료')
