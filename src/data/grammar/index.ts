import type { GrammarPoint } from '../types';
import { GRAMMAR_A1 } from './a1';
import { GRAMMAR_A2 } from './a2';
import { GRAMMAR_B1 } from './b1';
import { GRAMMAR_B2 } from './b2';
import { GRAMMAR_ADV } from './adv';

export const GRAMMAR: GrammarPoint[] = [...GRAMMAR_A1, ...GRAMMAR_A2, ...GRAMMAR_B1, ...GRAMMAR_B2, ...GRAMMAR_ADV];

export const GRAMMAR_BY_ID: Record<string, GrammarPoint> = Object.fromEntries(GRAMMAR.map((g) => [g.id, g]));

export const GRAMMAR_CATEGORY_LABEL: Record<GrammarPoint['category'], string> = {
  copula: '이다 / 있다',
  particle: 'คำช่วย (조사)',
  tense: 'กาล',
  negation: 'ปฏิเสธ',
  connective: 'เชื่อมประโยค',
  desire: 'ความต้องการ / จุดประสงค์',
  request: 'ขอร้อง / ชักชวน',
  ability: 'ความสามารถ / อนุญาต / หน้าที่',
  experience: 'ประสบการณ์',
  modifier: 'ขยายคำนาม',
  honorific: 'ยกย่อง',
  aspect: 'การณ์ลักษณะ',
  comparison: 'เปรียบเทียบ',
  quotation: 'อ้างคำพูด',
  conjecture: 'คาดเดา',
  'passive-causative': 'Passive / Causative',
  advanced: 'ระดับสูง',
  register: 'ระดับภาษา / พื้นฐาน',
};
