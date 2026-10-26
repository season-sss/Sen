import { useEffect, useState } from 'react';
import { isKoreanTtsAvailable, onVoicesChanged } from '@/lib/tts';

export function useTtsAvailable(): boolean {
  const [ok, setOk] = useState(isKoreanTtsAvailable());
  useEffect(() => {
    setOk(isKoreanTtsAvailable());
    const t = setTimeout(() => setOk(isKoreanTtsAvailable()), 800);
    const off = onVoicesChanged(() => setOk(isKoreanTtsAvailable()));
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);
  return ok;
}
