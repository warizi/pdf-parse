import Tesseract, { PSM, type Worker } from 'tesseract.js'
import { createCanvas } from 'canvas'
import type { PdfjsImageData } from './types.js'
import { toRGBA, isLikelyTextImage } from './utils.js'

// worker를 모듈 레벨에서 싱글턴으로 관리
let workerInstance: Worker | null = null

async function getWorker(): Promise<Worker> {
  if (!workerInstance) {
    workerInstance = await Tesseract.createWorker('kor')
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

  if (!isLikelyTextImage(rgba)) return null

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(width, height)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)
  const buffer = canvas.toBuffer('image/png')

  const worker = await getWorker()

  // PSM 6 먼저
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD })
  const result1 = await worker.recognize(buffer)
  const text1 = result1.data.text.trim()
  if (text1) return text1

//   // PSM 10 fallback (쉼표, 단일 문자)
//   await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR })
//   const result2 = await worker.recognize(buffer)
//   const text2 = result2.data.text.trim()
//   if (text2) return text2

  return null
}