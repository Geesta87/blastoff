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

export function countSmsSegments(text: string): {
  segments: number
  charCount: number
  isUnicode: boolean
  charsPerSegment: number
} {
  const isUnicode = !isGSM7(text)

  let charCount = 0
  if (isUnicode) {
    charCount = text.length
  } else {
    for (const char of text) {
      charCount += GSM_EXTENDED.has(char) ? 2 : 1
    }
  }

  const singleLimit = isUnicode ? 70 : 160
  const multiLimit = isUnicode ? 67 : 153

  let segments: number
  if (charCount <= singleLimit) {
    segments = 1
  } else {
    segments = Math.ceil(charCount / multiLimit)
  }

  return {
    segments,
    charCount,
    isUnicode,
    charsPerSegment: charCount <= singleLimit ? singleLimit : multiLimit,
  }
}
