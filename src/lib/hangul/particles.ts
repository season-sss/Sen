import { finalOf, hasBatchim } from './jamo';

export type ParticleKey =
  | 'topic' // 은/는
  | 'subject' // 이/가
  | 'object' // 을/를
  | 'and' // 와/과
  | 'andColloquial' // 이랑/랑
  | 'direction' // (으)로
  | 'or' // (이)나
  | 'vocative'; // 아/야

export interface ParticleInfo {
  key: ParticleKey;
  label: string;
  afterConsonant: string;
  afterVowel: string;
  thai: string;
}

export const PARTICLES: Record<ParticleKey, ParticleInfo> = {
  topic: { key: 'topic', label: '은/는', afterConsonant: '은', afterVowel: '는', thai: 'คำช่วยบอกหัวข้อ / เปรียบเทียบ' },
  subject: { key: 'subject', label: '이/가', afterConsonant: '이', afterVowel: '가', thai: 'คำช่วยบอกประธาน' },
  object: { key: 'object', label: '을/를', afterConsonant: '을', afterVowel: '를', thai: 'คำช่วยบอกกรรม' },
  and: { key: 'and', label: '와/과', afterConsonant: '과', afterVowel: '와', thai: 'และ / กับ (ภาษาเขียน)' },
  andColloquial: { key: 'andColloquial', label: '이랑/랑', afterConsonant: '이랑', afterVowel: '랑', thai: 'และ / กับ (ภาษาพูด)' },
  direction: { key: 'direction', label: '(으)로', afterConsonant: '으로', afterVowel: '로', thai: 'ไปทาง / ด้วย (วิธีการ)' },
  or: { key: 'or', label: '(이)나', afterConsonant: '이나', afterVowel: '나', thai: 'หรือ' },
  vocative: { key: 'vocative', label: '아/야', afterConsonant: '아', afterVowel: '야', thai: 'คำเรียกชื่อ (กันเอง)' },
};

/** Pick the correct particle form for a noun. Handles the ㄹ-exception of (으)로. */
export function particleFor(noun: string, key: ParticleKey): string {
  const p = PARTICLES[key];
  if (key === 'direction' && finalOf(noun) === 'ㄹ') return p.afterVowel; // 서울로, 연필로
  return hasBatchim(noun) ? p.afterConsonant : p.afterVowel;
}

export function attachParticle(noun: string, key: ParticleKey): string {
  return noun + particleFor(noun, key);
}

/** Copula polite form: 학생이에요 / 의사예요 */
export function copulaPolite(noun: string): string {
  return noun + (hasBatchim(noun) ? '이에요' : '예요');
}
