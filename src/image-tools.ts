export type FitMode = 'contain' | 'cover'

export type ImageInspection = {
  name: string
  mime: string
  bytes: number
  width: number
  height: number
}

export type ImageProcessOptions = {
  width?: number
  height?: number
  mode: FitMode
  maxBytes?: number
  minBytes?: number
  qualityFloor?: number
  qualityCeiling?: number
}

export type ProcessedImage = ImageInspection & {
  blob: Blob
  quality: number
  meetsTarget: boolean
  message: string
}

export type ImageRevalidation = {
  valid: boolean
  issues: string[]
  inspection: ImageInspection
}

export function validateImageFile(file: File) {
  const accepted = ['image/jpeg', 'image/png', 'image/webp']
  if (!accepted.includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.')
  if (file.size === 0) throw new Error('The selected file is empty.')
  if (file.size > 20 * 1024 * 1024) throw new Error('The selected file is over the 20 MB local safety limit.')
}

function loadImage(file: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The browser could not decode this image.'))
    }
    image.src = url
  })
}

export async function inspectImageFile(file: File): Promise<ImageInspection> {
  validateImageFile(file)
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
  const png = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47
  const webp = String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP'
  if ((file.type === 'image/jpeg' && !jpeg) || (file.type === 'image/png' && !png) || (file.type === 'image/webp' && !webp)) {
    throw new Error('The image header does not match its file format; it cannot be decoded as the declared image type.')
  }
  const image = await loadImage(file)
  return { name: file.name, mime: file.type, bytes: file.size, width: image.naturalWidth, height: image.naturalHeight }
}

export function calculateOutputSize(sourceWidth: number, sourceHeight: number, requestedWidth?: number, requestedHeight?: number) {
  for (const dimension of [sourceWidth, sourceHeight, requestedWidth, requestedHeight]) {
    if (dimension !== undefined && (!Number.isFinite(dimension) || !Number.isInteger(dimension) || dimension < 1 || dimension > 8192)) {
      throw new Error('Image dimensions must be whole numbers between 1 and 8192 pixels.')
    }
  }
  if (!requestedWidth && !requestedHeight) return { width: sourceWidth, height: sourceHeight }
  const width = Math.max(1, Math.round(requestedWidth || sourceWidth))
  const height = Math.max(1, Math.round(requestedHeight || sourceHeight))
  if (requestedWidth && requestedHeight) return { width, height }
  const ratio = requestedWidth ? width / sourceWidth : height / sourceHeight
  return { width: Math.max(1, Math.round(sourceWidth * ratio)), height: Math.max(1, Math.round(sourceHeight * ratio)) }
}

export function calculateSourceRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, mode: FitMode) {
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = targetWidth / targetHeight
  if (mode === 'contain' || sourceRatio === targetRatio) return { x: 0, y: 0, width: sourceWidth, height: sourceHeight }
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight }
  }
  const height = sourceWidth / targetRatio
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode the JPEG output.')), 'image/jpeg', quality)
  })
}

function renderCanvas(image: HTMLImageElement, options: ImageProcessOptions) {
  const size = calculateOutputSize(image.naturalWidth, image.naturalHeight, options.width, options.height)
  if (size.width * size.height > 16_000_000) throw new Error('Choose output dimensions below 16 million pixels.')
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size.width, size.height)
  const source = calculateSourceRect(image.naturalWidth, image.naturalHeight, size.width, size.height, options.mode)
  if (options.mode === 'contain') {
    const scale = Math.min(size.width / image.naturalWidth, size.height / image.naturalHeight)
    const drawWidth = image.naturalWidth * scale
    const drawHeight = image.naturalHeight * scale
    context.drawImage(image, (size.width - drawWidth) / 2, (size.height - drawHeight) / 2, drawWidth, drawHeight)
  } else {
    context.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, size.width, size.height)
  }
  return { canvas, width: size.width, height: size.height }
}

export async function processImageFile(file: File, options: ImageProcessOptions): Promise<ProcessedImage> {
  validateImageFile(file)
  const image = await loadImage(file)
  const rendered = renderCanvas(image, options)
  const ceiling = options.qualityCeiling ?? 0.94
  const floor = options.qualityFloor ?? 0.32
  const maxBytes = options.maxBytes
  const minBytes = options.minBytes
  let best = await canvasToBlob(rendered.canvas, ceiling)
  let bestQuality = ceiling

  if (maxBytes && best.size > maxBytes) {
    let low = floor
    let high = ceiling
    let smallest = best
    let smallestQuality = ceiling
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const quality = (low + high) / 2
      const blob = await canvasToBlob(rendered.canvas, quality)
      if (blob.size < smallest.size) {
        smallest = blob
        smallestQuality = quality
      }
      if (blob.size > maxBytes) high = quality
      else {
        best = blob
        bestQuality = quality
        low = quality
      }
    }
    if (best.size > maxBytes) {
      best = smallest
      bestQuality = smallestQuality
    }
  }

  const issues: string[] = []
  if (maxBytes && best.size > maxBytes) issues.push(`Could not reach the ${Math.round(maxBytes / 1024)} KB maximum at the selected dimensions.`)
  if (minBytes && best.size < minBytes) issues.push(`The output is below the ${Math.round(minBytes / 1024)} KB minimum.`)
  const meetsTarget = issues.length === 0
  return {
    name: file.name.replace(/\.[^.]+$/, '') + '-corrected.jpg',
    mime: 'image/jpeg',
    bytes: best.size,
    width: rendered.width,
    height: rendered.height,
    blob: best,
    quality: bestQuality,
    meetsTarget,
    message: meetsTarget ? 'Output rechecked against the selected target.' : issues.join(' '),
  }
}

export async function revalidateImageBlob(blob: Blob, constraints: Pick<ImageProcessOptions, 'maxBytes' | 'minBytes'>): Promise<ImageRevalidation> {
  if (blob.type !== 'image/jpeg') throw new Error('The generated output must be a real JPEG file.')
  const file = new File([blob], 'revalidated.jpg', { type: 'image/jpeg' })
  const inspection = await inspectImageFile(file)
  const issues: string[] = []
  if (constraints.maxBytes && inspection.bytes > constraints.maxBytes) issues.push(`Output is ${Math.round(inspection.bytes / 1024)} KB, above the ${Math.round(constraints.maxBytes / 1024)} KB maximum.`)
  if (constraints.minBytes && inspection.bytes < constraints.minBytes) issues.push(`Output is ${Math.round(inspection.bytes / 1024)} KB, below the ${Math.round(constraints.minBytes / 1024)} KB minimum.`)
  return { valid: issues.length === 0, issues, inspection }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function createSyntheticDemoImage() {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 800
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.')
  context.fillStyle = '#dfe9c8'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#263118'
  context.fillRect(85, 95, 1030, 610)
  context.fillStyle = '#a9bd65'
  context.fillRect(140, 150, 380, 80)
  context.fillStyle = '#f6f8ef'
  context.font = '700 52px Arial'
  context.fillText('APPLYREADY', 140, 330)
  context.font = '28px Arial'
  context.fillText('synthetic local image fixture', 140, 390)
  const blob = await canvasToBlob(canvas, 0.92)
  return new File([blob], 'applyready-synthetic-demo.jpg', { type: 'image/jpeg', lastModified: Date.now() })
}
