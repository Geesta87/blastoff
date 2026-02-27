'use client'

import { useMemo } from 'react'
import { calculateSMSSegments, type SMSSegmentInfo } from '@/lib/utils/sms-segments'

export function useSMSCounter(text: string): SMSSegmentInfo & {
  warningLevel: 'none' | 'yellow' | 'red'
  statusText: string
} {
  return useMemo(() => {
    const info = calculateSMSSegments(text)

    let warningLevel: 'none' | 'yellow' | 'red' = 'none'
    if (info.segmentCount >= 3) warningLevel = 'yellow'
    // Red warning if URL detected (URLs eat into segment count significantly)
    if (/https?:\/\//.test(text)) warningLevel = 'red'

    const statusText =
      info.charCount === 0
        ? '0/160 characters · 0 segments · GSM-7 · ~$0.000/msg'
        : `${info.charCount}/${info.maxChars} characters · ${info.segmentCount} segment${info.segmentCount !== 1 ? 's' : ''} · ${info.encoding} · ~$${info.costEstimate.toFixed(4)}/msg`

    return { ...info, warningLevel, statusText }
  }, [text])
}
