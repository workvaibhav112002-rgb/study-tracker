import React, { useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import type { DashboardStats } from '../types'
import { renderShareCard, shareDataFromStats, shareOrDownload } from '../lib/shareCard'
import { Button } from './ui/Button'
import { useToast } from './ui/Toast'

export const ShareCardButton: React.FC<{ stats: DashboardStats; appUrl: string }> = ({ stats, appUrl }) => {
  const toast = useToast()
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [busy, setBusy] = useState(false)

  const share = async () => {
    setBusy(true)
    try {
      if (!canvas.current) canvas.current = document.createElement('canvas')
      if (!renderShareCard(canvas.current, shareDataFromStats(stats, appUrl || window.location.origin))) {
        toast.error('Your browser cannot render the card.')
        return
      }
      const result = await shareOrDownload(canvas.current)
      if (result === 'downloaded') toast.success('Card saved as an image.')
      else if (result === 'failed') toast.error('Could not create the image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="secondary" size="lg" onClick={share} loading={busy} icon={<Share2 className="h-4 w-4 text-brand-400" aria-hidden="true" />}>
      Share card
    </Button>
  )
}
