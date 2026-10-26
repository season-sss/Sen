import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { romanize, thaiReading } from '@/lib/hangul';
import { speak } from '@/lib/tts';
import { useTtsAvailable } from '@/hooks/useTts';
import { useSettings } from '@/store/settings';

export function SpeakButton({ text, className, size = 'md', label }: { text: string; className?: string; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const ok = useTtsAvailable();
  const rate = useSettings((s) => s.ttsRate);
  const [playing, setPlaying] = useState(false);
  const dims = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-12 w-12' }[size];
  const icon = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-6 w-6' }[size];
  if (!ok) {
    return (
      <span className={cn('inline-grid place-items-center rounded-full text-muted/60', dims, className)} title="อุปกรณ์นี้ไม่มีเสียงอ่านภาษาเกาหลี (Text-to-Speech)">
        <VolumeX className={icon} aria-label="ไม่มีเสียงอ่านภาษาเกาหลีในอุปกรณ์นี้" />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setPlaying(true);
        if (!speak(text, { rate, onEnd: () => setPlaying(false) })) setPlaying(false);
      }}
      className={cn('inline-grid shrink-0 place-items-center rounded-full bg-sky-soft text-sky transition hover:scale-105', playing && 'ring-2 ring-sky/40', dims, className)}
      aria-label={label ?? `ฟังเสียง: ${text}`}
    >
      <Volume2 className={icon} />
    </button>
  );
}

/**
 * Korean text with optional reading aids. The Thai reading follows the learner's setting:
 * always shown, shown on tap, or hidden — supporting a gradual move away from Thai script.
 */
export function KoreanText({
  text,
  className,
  size = 'md',
  speakable = true,
  aids = true,
  pron,
}: {
  text: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  speakable?: boolean;
  aids?: boolean;
  pron?: string;
}) {
  const { thaiReading: pref, showRomanization } = useSettings();
  const [reveal, setReveal] = useState(false);
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl', xl: 'text-3xl sm:text-4xl' };
  const showThai = aids && (pref === 'always' || (pref === 'tap' && reveal));
  const source = pron ?? text;
  return (
    <span className={cn('inline-flex items-start gap-2', className)}>
      <span className="min-w-0">
        <span lang="ko" className={cn('ko font-semibold text-ink', sizes[size])}>
          {text}
        </span>
        {aids && (showRomanization || showThai || pref === 'tap') && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {showRomanization && <span className="italic">{romanize(source)}</span>}
            {showThai && <span>{thaiReading(source)}</span>}
            {pref === 'tap' && !reveal && (
              <button type="button" className="rounded px-1 text-lavender underline-offset-2 hover:underline" onClick={(e) => (e.stopPropagation(), setReveal(true))}>
                คำอ่านไทย
              </button>
            )}
          </span>
        )}
      </span>
      {speakable && <SpeakButton text={text} size={size === 'xl' ? 'lg' : size === 'lg' ? 'md' : 'sm'} />}
    </span>
  );
}
