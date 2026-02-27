const GSM_CHARS = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
)
const GSM_EXTENDED = new Set('|^€{}[]~\\')

function isGSM7(text: string): boolean {
  for (const char of text) {
    if (!GSM_CHARS.has(char) && !GSM_EXTENDED.has(char)) return false
  }
  return true
}

export const COST_PER_SEGMENT = 0.0079

export interface SMSSegmentInfo {
  charCount: number
  segmentCount: number
  encoding: 'GSM-7' | 'UCS-2'
  maxChars: number
  charsRemaining: number
  costEstimate: number
}

export function calculateSMSSegments(text: string): SMSSegmentInfo {
  if (!text || text.length === 0) {
    return {
      charCount: 0,
      segmentCount: 0,
      encoding: 'GSM-7',
      maxChars: 160,
      charsRemaining: 160,
      costEstimate: 0,
    }
  }

  const unicode = !isGSM7(text)
  const encoding: 'GSM-7' | 'UCS-2' = unicode ? 'UCS-2' : 'GSM-7'

  let charCount = 0
  if (unicode) {
    charCount = text.length
  } else {
    for (const char of text) {
      charCount += GSM_EXTENDED.has(char) ? 2 : 1
    }
  }

  const singleLimit = unicode ? 70 : 160
  const multiLimit = unicode ? 67 : 153

  let segmentCount: number
  let maxChars: number

  if (charCount <= singleLimit) {
    segmentCount = charCount === 0 ? 0 : 1
    maxChars = singleLimit
  } else {
    segmentCount = Math.ceil(charCount / multiLimit)
    maxChars = segmentCount * multiLimit
  }

  return {
    charCount,
    segmentCount,
    encoding,
    maxChars,
    charsRemaining: maxChars - charCount,
    costEstimate: segmentCount * COST_PER_SEGMENT,
  }
}

// Legacy export for backward compat
export function countSmsSegments(text: string) {
  const info = calculateSMSSegments(text)
  return {
    segments: info.segmentCount,
    charCount: info.charCount,
    isUnicode: info.encoding === 'UCS-2',
    charsPerSegment: info.charCount <= (info.encoding === 'UCS-2' ? 70 : 160)
      ? (info.encoding === 'UCS-2' ? 70 : 160)
      : (info.encoding === 'UCS-2' ? 67 : 153),
  }
}
