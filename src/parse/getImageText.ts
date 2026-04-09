import Tesseract, { PSM, type Worker } from 'tesseract.js'
import { createCanvas } from 'canvas'
import type { PdfjsImageData } from './types.js'
import { toRGBA, isLikelyTextImage } from './utils.js'

// worker를 모듈 레벨에서 싱글턴으로 관리
let workerInstance: Worker | null = null

async function getWorker(): Promise<Worker> {
  if (!workerInstance) {
    workerInstance = await Tesseract.createWorker('kor')
    await workerInstance.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_WORD,
      debug_file: '/dev/null',
    })
  }
  return workerInstance
}

export async function terminateWorker() {
  if (workerInstance) {
    await workerInstance.terminate()
    workerInstance = null
  }
}

export async function getImageText(imgData: PdfjsImageData): Promise<string | null> {
  const { width, height } = imgData
  const rgba = toRGBA(imgData)

  if (!isLikelyTextImage(rgba, width, height)) return null

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(width, height)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)
  const buffer = canvas.toBuffer('image/png')

  const worker = await getWorker()

  const timeout = (ms: number) => new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('OCR timeout')), ms)
  )

  try {
    const result = await Promise.race([worker.recognize(buffer), timeout(5000)])
    const text = result.data.text.trim()
    return text || null
  } catch {
    return null
  }
}