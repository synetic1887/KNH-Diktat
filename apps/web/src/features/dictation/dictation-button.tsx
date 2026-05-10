import { Mic, MicOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export interface DictationButtonProps {
  readonly isRecording: boolean
  readonly isAvailable: boolean
  readonly disabled?: boolean
  readonly onToggle: () => void
}

export function DictationButton({
  isRecording,
  isAvailable,
  disabled,
  onToggle,
}: DictationButtonProps) {
  const label = !isAvailable
    ? 'Browser unterstützt kein Diktat'
    : isRecording
      ? 'Diktat läuft — Stopp'
      : 'Diktat starten'
  return (
    <Button
      type="button"
      onClick={onToggle}
      disabled={disabled || !isAvailable}
      className={cn(
        'gap-2',
        isRecording &&
          'bg-bordeaux text-primary-foreground hover:bg-bordeaux-deep shadow-[0_0_0_4px_rgba(122,31,31,0.18)]',
      )}
      aria-pressed={isRecording}
      aria-label={label}
    >
      <span className="relative inline-flex h-3 w-3 items-center justify-center" aria-hidden>
        {isRecording ? (
          <>
            <span className="absolute inline-block h-3 w-3 animate-pulse-record rounded-full bg-white/90" />
            <span className="inline-block h-2 w-2 rounded-full bg-white" />
          </>
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-current/70" />
        )}
      </span>
      {isRecording ? (
        <MicOff className="h-4 w-4" aria-hidden />
      ) : (
        <Mic className="h-4 w-4" aria-hidden />
      )}
      <span>{label}</span>
    </Button>
  )
}
