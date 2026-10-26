/**
 * HANEUL Curriculum Map
 *   Level → Module → Unit → Lesson → Topic (lesson sections) → Exercise → Assessment
 *
 * Lessons reference real content (vocabulary topics, grammar ids, dialogues, readings …);
 * curriculum.test.ts verifies that every reference resolves, so the map never lists a lesson
 * that has no content behind it.
 */
import type { Level, VocabLevel } from './types';

export type LessonSource =
  | { kind: 'hangul-jamo'; set: 'basic-consonants-1' | 'basic-consonants-2' | 'double-consonants' | 'basic-vowels' | 'compound-vowels-1' | 'compound-vowels-2' }
  | { kind: 'hangul-syllable' }
  | { kind: 'hangul-decoding' }
  | { kind: 'hangul-batchim'; set: 'simple' | 'complex' }
  | { kind: 'hangul-sound'; rules: string[] }
  | { kind: 'hangul-typing' }
  | { kind: 'hangul-reading-aid' }
  | { kind: 'vocab'; topics: string[]; level: VocabLevel }
  | { kind: 'pos'; ids: string[] }
  | { kind: 'structure'; ids: string[] }
  | { kind: 'grammar'; ids: string[] }
  | { kind: 'conjugation'; formKeys: string[]; words: string[]; explain: string[] }
  | { kind: 'dialogue'; ids: string[] }
  | { kind: 'reading'; ids: string[] }
  | { kind: 'writing'; questionIds: string[] };

export interface Lesson {
  id: string;
  title: string;
  /** Estimated study minutes — used by the Student Planner */
  minutes: number;
  /** 1 easy … 3 hard — used by the planner to balance load */
  difficulty: 1 | 2 | 3;
  source: LessonSource;
  /** Lessons that should be completed first (soft gate) */
  requires?: string[];
}

export interface Unit {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
  units: Unit[];
}

export interface CurriculumLevel {
  id: Level;
  title: string;
  description: string;
  modules: Module[];
}

// ---------------------------------------------------------------------------
let seq = 0;
const L = (id: string, title: string, source: LessonSource, minutes = 20, difficulty: 1 | 2 | 3 = 1, requires?: string[]): Lesson => {
  seq++;
  return { id, title, minutes, difficulty, source, ...(requires ? { requires } : {}) };
};
const vocab = (level: VocabLevel, id: string, title: string, topics: string[], minutes = 20) => L(id, title, { kind: 'vocab', topics, level }, minutes, 1);
const gram = (id: string, title: string, ids: string[], difficulty: 1 | 2 | 3 = 2, requires?: string[], minutes = 30) =>
  L(id, title, { kind: 'grammar', ids }, minutes, difficulty, requires);

export const CURRICULUM: CurriculumLevel[] = [
  // ======================================================================= LEVEL 0
  {
    id: 'L0',
    title: 'Hangul Foundations',
    description: 'อ่าน เขียน และออกเสียงตัวอักษรเกาหลีได้อย่างมั่นใจ ก่อนเริ่มเรียนคำศัพท์และไวยากรณ์',
    modules: [
      {
        id: 'L0-M1',
        title: 'ตัวอักษรฮันกึล',
        description: 'พยัญชนะ 19 ตัว และสระ 21 ตัว',
        units: [
          {
            id: 'L0-U1',
            title: 'พยัญชนะ (자음)',
            lessons: [
              L('L0-consonants-1', 'พยัญชนะพื้นฐาน 1: ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ', { kind: 'hangul-jamo', set: 'basic-consonants-1' }, 20),
              L('L0-consonants-2', 'พยัญชนะพื้นฐาน 2: ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ', { kind: 'hangul-jamo', set: 'basic-consonants-2' }, 20, 1, ['L0-consonants-1']),
              L('L0-double', 'พยัญชนะเสียงหนัก (겹자음): ㄲ ㄸ ㅃ ㅆ ㅉ', { kind: 'hangul-jamo', set: 'double-consonants' }, 20, 2, ['L0-consonants-2']),
            ],
          },
          {
            id: 'L0-U2',
            title: 'สระ (모음)',
            lessons: [
              L('L0-vowels', 'สระเดี่ยว 10 ตัว', { kind: 'hangul-jamo', set: 'basic-vowels' }, 20),
              L('L0-compound-1', 'สระผสม 1: ㅐ ㅒ ㅔ ㅖ', { kind: 'hangul-jamo', set: 'compound-vowels-1' }, 15, 1, ['L0-vowels']),
              L('L0-compound-2', 'สระผสม 2: ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ', { kind: 'hangul-jamo', set: 'compound-vowels-2' }, 20, 2, ['L0-compound-1']),
            ],
          },
        ],
      },
      {
        id: 'L0-M2',
        title: 'พยางค์และตัวสะกด',
        description: 'ประกอบพยางค์ อ่านคำใหม่ และตัวสะกด 받침',
        units: [
          {
            id: 'L0-U3',
            title: 'การประกอบพยางค์',
            lessons: [
              L('L0-syllable', 'การประกอบพยางค์ (초성 + 중성 + 종성)', { kind: 'hangul-syllable' }, 20, 1, ['L0-consonants-2', 'L0-vowels']),
              L('L0-decoding', 'อ่านคำที่ไม่เคยเห็น', { kind: 'hangul-decoding' }, 15, 1, ['L0-syllable']),
            ],
          },
          {
            id: 'L0-U4',
            title: 'ตัวสะกด (받침)',
            lessons: [
              L('L0-batchim', 'ตัวสะกด 7 เสียง', { kind: 'hangul-batchim', set: 'simple' }, 25, 2, ['L0-syllable']),
              L('L0-batchim-complex', 'ตัวสะกดซ้อน (겹받침)', { kind: 'hangul-batchim', set: 'complex' }, 20, 3, ['L0-batchim']),
            ],
          },
        ],
      },
      {
        id: 'L0-M3',
        title: 'การออกเสียง',
        description: 'กฎการเปลี่ยนเสียงที่พบบ่อย และความต่างระหว่างการสะกดกับการออกเสียง',
        units: [
          {
            id: 'L0-U5',
            title: 'กฎเสียง (음운 규칙)',
            lessons: [
              L('L0-liaison', 'การเชื่อมเสียง (연음) และ ㅎ หายไป', { kind: 'hangul-sound', rules: ['liaison', 'h-drop'] }, 20, 2, ['L0-batchim']),
              L('L0-nasal', 'เสียงนาสิกและ ㄹ (비음화 · 유음화)', { kind: 'hangul-sound', rules: ['nasalization', 'r-nasalization', 'lateralization'] }, 25, 3, ['L0-liaison']),
              L('L0-tense', 'เสียงหนัก พ่นลม และ 구개음화', { kind: 'hangul-sound', rules: ['tensification', 'aspiration', 'palatalization'] }, 25, 3, ['L0-liaison']),
            ],
          },
        ],
      },
      {
        id: 'L0-M4',
        title: 'เขียน พิมพ์ และอ่านโดยไม่พึ่งคำอ่านไทย',
        description: 'ฝึกพิมพ์แป้นเกาหลี และค่อยๆ ลดการพึ่งคำอ่านภาษาไทย',
        units: [
          {
            id: 'L0-U6',
            title: 'ฝึกเขียนและพิมพ์',
            lessons: [
              L('L0-typing', 'แป้นพิมพ์เกาหลี (두벌식) และฝึกพิมพ์', { kind: 'hangul-typing' }, 20, 1, ['L0-syllable']),
              L('L0-reading-aid', 'ใช้คำอ่านไทยอย่างเหมาะสม และการเลิกพึ่ง', { kind: 'hangul-reading-aid' }, 10, 1, ['L0-batchim']),
            ],
          },
        ],
      },
    ],
  },

  // ======================================================================= A1
  {
    id: 'A1',
    title: 'Beginner',
    description: 'สื่อสารเรื่องพื้นฐานในชีวิตประจำวัน แนะนำตัว ซื้อของ สั่งอาหาร ถามทาง',
    modules: [
      {
        id: 'A1-M-vocab',
        title: 'A. คำศัพท์',
        description: 'คำศัพท์พื้นฐานจัดตามหัวข้อ',
        units: [
          {
            id: 'A1-U-vocab-1',
            title: 'ตัวเลข เวลา และคำทักทาย',
            lessons: [
              vocab('A1', 'A1-v-greetings', 'คำทักทายและคำสุภาพ', ['greetings']),
              vocab('A1', 'A1-v-numbers', 'ตัวเลขเกาหลีแท้และจีน-เกาหลี', ['numbers'], 30),
              vocab('A1', 'A1-v-time', 'เวลา วัน เดือน ปี', ['time'], 30),
            ],
          },
          {
            id: 'A1-U-vocab-2',
            title: 'คน สถานที่ และบ้าน',
            lessons: [
              vocab('A1', 'A1-v-people', 'คน ครอบครัว ความสัมพันธ์', ['people'], 30),
              vocab('A1', 'A1-v-school', 'โรงเรียนและสิ่งของ', ['school']),
              vocab('A1', 'A1-v-home', 'บ้าน ห้อง ตำแหน่ง', ['home']),
              vocab('A1', 'A1-v-places', 'สถานที่และการเดินทาง', ['places'], 30),
            ],
          },
          {
            id: 'A1-U-vocab-3',
            title: 'ชีวิตประจำวัน',
            lessons: [
              vocab('A1', 'A1-v-food', 'อาหาร เครื่องดื่ม การสั่งอาหาร', ['food'], 30),
              vocab('A1', 'A1-v-routine', 'กิจวัตรประจำวัน', ['routine']),
              vocab('A1', 'A1-v-hobbies', 'งานอดิเรก เพลง เกม กีฬา', ['hobbies']),
              vocab('A1', 'A1-v-clothes', 'เสื้อผ้า สี และรูปร่าง', ['clothes'], 25),
              vocab('A1', 'A1-v-weather', 'อากาศและฤดูกาล', ['weather']),
              vocab('A1', 'A1-v-shopping', 'ราคา เงิน การซื้อของ', ['shopping']),
            ],
          },
          {
            id: 'A1-U-vocab-4',
            title: 'คำพื้นฐานที่ใช้บ่อย',
            lessons: [
              vocab('A1', 'A1-v-questions', 'คำถามพื้นฐาน', ['questions'], 15),
              vocab('A1', 'A1-v-quantity', 'ปริมาณและความถี่', ['quantity'], 25),
              vocab('A1', 'A1-v-verbs', 'คำกริยาพื้นฐาน', ['core-verbs'], 35),
              vocab('A1', 'A1-v-adjectives', 'คำคุณศัพท์พื้นฐาน', ['core-adjectives'], 30),
              vocab('A1', 'A1-v-function', 'สรรพนาม คำขยาย คำอุทาน คำเชื่อม', ['function'], 25),
            ],
          },
        ],
      },
      {
        id: 'A1-M-pos',
        title: 'B. ประเภทของคำ (품사)',
        description: 'คำแต่ละประเภททำหน้าที่ต่างกันอย่างไรในประโยค',
        units: [
          {
            id: 'A1-U-pos',
            title: 'ประเภทของคำ',
            lessons: [
              L('A1-pos-noun', '명사 · 대명사 · 수사', { kind: 'pos', ids: ['pos-noun'] }, 15),
              L('A1-pos-predicate', '동사 · 형용사', { kind: 'pos', ids: ['pos-predicate'] }, 20),
              L('A1-pos-modifiers', '부사 · 관형사', { kind: 'pos', ids: ['pos-modifiers'] }, 15),
              L('A1-pos-particles', '조사 คำช่วย', { kind: 'pos', ids: ['pos-particles'] }, 15),
              L('A1-pos-others', '감탄사 · คำเชื่อม', { kind: 'pos', ids: ['pos-others'] }, 15),
            ],
          },
        ],
      },
      {
        id: 'A1-M-structure',
        title: 'C. โครงสร้างประโยค',
        description: 'ลำดับคำและรูปแบบประโยคพื้นฐาน',
        units: [
          {
            id: 'A1-U-structure',
            title: 'รูปแบบประโยค',
            lessons: [
              L('A1-st-sov', 'ประธาน + กรรม + กริยา', { kind: 'structure', ids: ['st-sov'] }, 15),
              L('A1-st-sv', 'ประธาน + กริยา / คุณศัพท์', { kind: 'structure', ids: ['st-sv-sa'] }, 15),
              L('A1-st-place', 'ประธาน + สถานที่ + กริยา', { kind: 'structure', ids: ['st-place'] }, 15),
              L('A1-st-types', 'บอกเล่า ปฏิเสธ คำถาม ขอร้อง', { kind: 'structure', ids: ['st-types'] }, 20),
              L('A1-st-omission', 'การละประธาน และสร้างประโยคจากคำที่กำหนด', { kind: 'structure', ids: ['st-omission'] }, 15),
            ],
          },
        ],
      },
      {
        id: 'A1-M-particles',
        title: 'D. คำช่วย (조사)',
        description: 'ความหมาย วิธีเลือกใช้ และคู่ที่สับสนบ่อย',
        units: [
          {
            id: 'A1-U-particles-1',
            title: 'หัวข้อ ประธาน กรรม',
            lessons: [
              gram('A1-p-topic', '은/는', ['g-topic'], 1),
              gram('A1-p-subject', '이/가', ['g-subject'], 1),
              gram('A1-p-compare', '은/는 vs 이/가', ['g-topic-vs-subject'], 2, ['A1-p-topic', 'A1-p-subject']),
              gram('A1-p-object', '을/를', ['g-object'], 1),
            ],
          },
          {
            id: 'A1-U-particles-2',
            title: 'สถานที่ เวลา และความสัมพันธ์',
            lessons: [
              gram('A1-p-e', '에 (สถานที่ / เวลา)', ['g-e-place'], 1),
              gram('A1-p-eseo', '에서 และความต่างกับ 에', ['g-eseo'], 2, ['A1-p-e']),
              gram('A1-p-ui', '의', ['g-ui'], 1, undefined, 15),
              gram('A1-p-and', '와/과 · 하고 · (이)랑', ['g-and-noun'], 1, undefined, 20),
              gram('A1-p-do-man', '도 และ 만', ['g-do', 'g-man'], 1, undefined, 20),
              gram('A1-p-range', '부터/까지 · 에서/까지', ['g-buteo-kkaji'], 1, undefined, 20),
              gram('A1-p-ege', '에게/한테/께', ['g-ege'], 2, undefined, 20),
            ],
          },
        ],
      },
      {
        id: 'A1-M-grammar',
        title: 'E. ไวยากรณ์',
        description: 'เรียงจากง่ายไปยาก — ต้องเข้าใจพื้นฐานก่อนไปหัวข้อถัดไป',
        units: [
          {
            id: 'A1-U-grammar-1',
            title: 'เป็น / มี / ปัจจุบัน',
            lessons: [
              gram('A1-g-copula', '이에요/예요 · 입니다', ['g-copula', 'g-copula-formal'], 1),
              gram('A1-g-copula-neg', '이/가 아니에요', ['g-copula-neg'], 1, ['A1-g-copula']),
              gram('A1-g-isseo', '있어요/없어요', ['g-isseo'], 1),
              gram('A1-g-demonstratives', '이/그/저 และการนับ', ['g-demonstratives', 'g-counting'], 2),
              gram('A1-g-present', '아요/어요/해요', ['g-present'], 2, ['A1-g-copula']),
            ],
          },
          {
            id: 'A1-U-grammar-2',
            title: 'กาลและการปฏิเสธ',
            lessons: [
              gram('A1-g-past', 'อดีต 았/었어요', ['g-past'], 2, ['A1-g-present']),
              gram('A1-g-future', 'อนาคต (으)ㄹ 거예요', ['g-future'], 2, ['A1-g-present']),
              gram('A1-g-neg', '안 และ 못', ['g-neg-an', 'g-neg-mot'], 2, ['A1-g-present']),
            ],
          },
          {
            id: 'A1-U-grammar-3',
            title: 'เชื่อมประโยค และความต้องการ',
            lessons: [
              gram('A1-g-go', '-고', ['g-go'], 2, ['A1-g-present']),
              gram('A1-g-aseo', '-아/어서', ['g-aseo'], 2, ['A1-g-go']),
              gram('A1-g-jiman', '-지만', ['g-jiman'], 1, ['A1-g-present']),
              gram('A1-g-nikka', '-(으)니까', ['g-nikka'], 3, ['A1-g-aseo']),
              gram('A1-g-want', '-고 싶어요', ['g-want'], 1, ['A1-g-present']),
            ],
          },
          {
            id: 'A1-U-grammar-4',
            title: 'ความสามารถ ประสบการณ์ การขอร้อง',
            lessons: [
              gram('A1-g-can', '-(으)ㄹ 수 있어요/없어요', ['g-can'], 2, ['A1-g-future']),
              gram('A1-g-know-how', '-(으)ㄹ 줄 알아요/몰라요', ['g-know-how'], 2, ['A1-g-can']),
              gram('A1-g-try', '-아/어 봤어요', ['g-try'], 2, ['A1-g-past']),
              gram('A1-g-seyo', '-(으)세요', ['g-seyo'], 2, ['A1-g-present']),
              gram('A1-g-please', '-아/어 주세요', ['g-please-do'], 2, ['A1-g-seyo']),
              gram('A1-g-shall-we', '-(으)ㄹ까요?', ['g-shall-we'], 2, ['A1-g-future']),
              gram('A1-g-must-bridge', 'ต่อยอด: -아/어야 해요', ['g-must'], 2, ['A1-g-present']),
            ],
          },
        ],
      },
      {
        id: 'A1-M-conjugation',
        title: 'F. การผันคำกริยาและคำคุณศัพท์',
        description: 'ผันคำด้วยกฎจริงผ่าน Conjugation Engine',
        units: [
          {
            id: 'A1-U-conj',
            title: 'การผันพื้นฐาน',
            lessons: [
              L('A1-c-stem', 'รูปพจนานุกรม -다 และรากคำ', { kind: 'conjugation', formKeys: ['present'], words: ['가다', '먹다', '하다', '읽다', '보다'], explain: ['ทุกคำกริยา/คำคุณศัพท์ในพจนานุกรมลงท้ายด้วย 다', 'ตัด 다 ออกจะได้รากคำ (어간): 가다 → 가, 먹다 → 먹', 'ดูว่ารากคำมีตัวสะกด (받침) หรือไม่ เพราะเป็นตัวกำหนดรูปผัน'] }, 15),
              L('A1-c-present', 'รูปสุภาพปัจจุบัน และ 하다', { kind: 'conjugation', formKeys: ['present'], words: ['가다', '오다', '먹다', '마시다', '배우다', '공부하다', '좋다', '읽다'], explain: ['ㅏ/ㅗ → 아요, อื่นๆ → 어요, 하다 → 해요', 'ไม่มีตัวสะกดจะหดเสียง: 오+아 → 와, 마시+어 → 마셔, 배우+어 → 배워'] }, 30, 2, ['A1-c-stem']),
              L('A1-c-past-future', 'รูปอดีตและอนาคต', { kind: 'conjugation', formKeys: ['past', 'future'], words: ['가다', '먹다', '하다', '보다', '만들다', '마시다'], explain: ['อดีต: 아/어 + ㅆ어요', 'อนาคต: (으)ㄹ 거예요 — ตัวสะกด ㄹ ไม่เติม 으'] }, 30, 2, ['A1-c-present']),
              L('A1-c-negative', 'รูปปฏิเสธ', { kind: 'conjugation', formKeys: ['negAn', 'negLong', 'negMot'], words: ['가다', '먹다', '공부하다', '바쁘다', '알다'], explain: ['안 + V/A, V/A + 지 않아요, 못 + V', 'คำนาม+하다: 공부 안 해요', '알다 → 몰라요'] }, 25, 2, ['A1-c-present']),
              L('A1-c-connect', 'รูปเชื่อมประโยค', { kind: 'conjugation', formKeys: ['and', 'so', 'but', 'because'], words: ['먹다', '가다', '바쁘다', '춥다', '살다'], explain: ['-고 / -지만: ต่อรากคำโดยตรง', '-아/어서: ผันแบบ 아요/어요', '-(으)니까: มีตัวสะกดเติม 으'] }, 30, 2, ['A1-c-present']),
              L('A1-c-desire-request', 'ความต้องการ ขอร้อง ความสามารถ ประสบการณ์', { kind: 'conjugation', formKeys: ['want', 'request', 'can', 'tried'], words: ['가다', '먹다', '듣다', '만들다', '쓰다'], explain: ['-고 싶어요 / -(으)세요 / -(으)ㄹ 수 있어요 / -아/어 봤어요'] }, 30, 2, ['A1-c-present']),
              L('A1-c-irregular', 'คำผันไม่ปกติที่พบบ่อย', { kind: 'conjugation', formKeys: ['present', 'past', 'request'], words: ['듣다', '걷다', '돕다', '춥다', '모르다', '부르다', '쓰다', '바쁘다', '만들다', '살다'], explain: ['ㄷ → ㄹ (듣다 → 들어요)', 'ㅂ → 우 (춥다 → 추워요)', '르 → ㄹ라/ㄹ러 (모르다 → 몰라요)', 'ㅡ หาย (쓰다 → 써요)', 'ㄹ หายก่อน ㄴ ㅂ ㅅ (만들다 → 만드세요)'] }, 35, 3, ['A1-c-past-future']),
              L('A1-c-verb-adj', 'ความต่างของ 동사 กับ 형용사 ในการผัน', { kind: 'conjugation', formKeys: ['modPresent', 'want', 'progressive'], words: ['먹다', '예쁘다', '크다', '읽다'], explain: ['คำกริยา: 먹는 (ขยายนาม), 먹고 싶어요, 먹고 있어요', 'คำคุณศัพท์: 예쁜, ใช้ -고 싶어요/-고 있어요 ไม่ได้'] }, 20, 2, ['A1-c-present']),
            ],
          },
        ],
      },
      {
        id: 'A1-M-communication',
        title: 'G. การสื่อสาร',
        description: 'บทสนทนาจากสถานการณ์จริง',
        units: [
          {
            id: 'A1-U-comm-1',
            title: 'ตัวเองและคนรอบตัว',
            lessons: [
              L('A1-d-intro', 'แนะนำตัว', { kind: 'dialogue', ids: ['d-intro'] }, 15),
              L('A1-d-name', 'ถามชื่อ อายุ และประเทศ', { kind: 'dialogue', ids: ['d-age-name'] }, 15),
              L('A1-d-likes', 'บอกสิ่งที่ชอบ', { kind: 'dialogue', ids: ['d-likes'] }, 15),
              L('A1-d-school', 'พูดเกี่ยวกับโรงเรียน', { kind: 'dialogue', ids: ['d-school'] }, 15),
              L('A1-d-routine', 'บอกกิจวัตร', { kind: 'dialogue', ids: ['d-routine'] }, 15),
            ],
          },
          {
            id: 'A1-U-comm-2',
            title: 'ออกไปข้างนอก',
            lessons: [
              L('A1-d-restaurant', 'ถามราคาและสั่งอาหาร', { kind: 'dialogue', ids: ['d-restaurant'] }, 15),
              L('A1-d-directions', 'ถามสถานที่และทางไป', { kind: 'dialogue', ids: ['d-directions'] }, 15),
              L('A1-d-appointment', 'นัดหมาย', { kind: 'dialogue', ids: ['d-appointment'] }, 15),
              L('A1-d-hobby', 'คุยเรื่องงานอดิเรก', { kind: 'dialogue', ids: ['d-hobby'] }, 15),
              L('A1-d-friends', 'บทสนทนาสั้นๆ กับเพื่อน', { kind: 'dialogue', ids: ['d-friends'] }, 15),
            ],
          },
        ],
      },
    ],
  },

  // ======================================================================= A2
  {
    id: 'A2',
    title: 'Elementary',
    description: 'เล่าประสบการณ์ วางแผน ให้เหตุผลและคำแนะนำ อ่านประกาศและข้อความสั้น',
    modules: [
      {
        id: 'A2-M-vocab',
        title: 'คำศัพท์',
        description: 'ขยายคำศัพท์สู่หัวข้อชีวิตจริง',
        units: [
          {
            id: 'A2-U-vocab-1',
            title: 'สุขภาพ การเดินทาง ความรู้สึก',
            lessons: [
              vocab('A2', 'A2-v-health', 'ร่างกายและสุขภาพ', ['body-health'], 30),
              vocab('A2', 'A2-v-travel', 'การเดินทางและท่องเที่ยว', ['travel'], 30),
              vocab('A2', 'A2-v-feelings', 'ความรู้สึกและนิสัย', ['feelings'], 30),
            ],
          },
          {
            id: 'A2-U-vocab-2',
            title: 'งาน ธรรมชาติ และการซื้อของ',
            lessons: [
              vocab('A2', 'A2-v-work', 'การงานและการศึกษา', ['work'], 30),
              vocab('A2', 'A2-v-nature', 'ธรรมชาติและสัตว์', ['nature'], 25),
              vocab('A2', 'A2-v-shopping', 'การซื้อของและเปรียบเทียบ', ['shopping'], 25),
              vocab('A2', 'A2-v-routine', 'กิจวัตรที่ซับซ้อนขึ้น', ['routine'], 25),
            ],
          },
          {
            id: 'A2-U-vocab-3',
            title: 'คำกริยา คำคุณศัพท์ คำเชื่อม',
            lessons: [
              vocab('A2', 'A2-v-verbs', 'คำกริยาระดับ A2', ['core-verbs'], 35),
              vocab('A2', 'A2-v-adjectives', 'คำคุณศัพท์ระดับ A2', ['core-adjectives'], 30),
              vocab('A2', 'A2-v-function', 'คำวิเศษณ์และคำเชื่อม', ['function'], 25),
            ],
          },
        ],
      },
      {
        id: 'A2-M-grammar',
        title: 'ไวยากรณ์',
        description: 'เจตนา เงื่อนไข อนุญาต หน้าที่ เวลา และการเปรียบเทียบ',
        units: [
          {
            id: 'A2-U-grammar-1',
            title: 'จุดประสงค์ เงื่อนไข อนุญาต',
            lessons: [
              gram('A2-g-purpose', '-(으)려고 · -(으)러 가다', ['g-ryeogo', 'g-reo-gada'], 2, ['A1-g-present']),
              gram('A2-g-if', '-(으)면', ['g-myeon'], 2),
              gram('A2-g-permission', '-아/어도 되다 · -(으)면 안 되다', ['g-may', 'g-must-not'], 2, ['A2-g-if']),
              gram('A2-g-must', '-아/어야 하다', ['g-must'], 2),
              gram('A2-g-favor', '-아/어 주다/드리다', ['g-give-favor'], 2),
            ],
          },
          {
            id: 'A2-U-grammar-2',
            title: 'เวลา ลำดับ การเปรียบเทียบ',
            lessons: [
              gram('A2-g-when', '-(으)ㄹ 때', ['g-ttae'], 2),
              gram('A2-g-before-after', '-기 전에 · -(으)ㄴ 후에', ['g-before', 'g-after'], 2),
              gram('A2-g-compare', 'N보다 (더) · 제일', ['g-comparison'], 1),
              gram('A2-g-progressive', '-고 있다', ['g-progressive'], 1),
              gram('A2-g-or', '-거나 · (이)나', ['g-or'], 1),
            ],
          },
          {
            id: 'A2-U-grammar-3',
            title: 'ประสบการณ์ ความตั้งใจ และการขยายคำนาม',
            lessons: [
              gram('A2-g-nominal', '-는 것 · -기', ['g-nominal'], 2),
              gram('A2-g-experience', '-(으)ㄴ 적이 있다 · -아/어 본 적이 있다', ['g-experience'], 2, ['A1-g-try']),
              gram('A2-g-modifiers', 'รูปขยายคำนาม (관형형)', ['g-modifiers'], 3, ['A2-g-nominal']),
              gram('A2-g-direction', '(으)로', ['g-direction-means'], 1),
              gram('A2-g-promise', '-(으)ㄹ게요 · -지 마세요', ['g-promise', 'g-dont'], 2),
              gram('A2-g-will', '-겠어요', ['g-will'], 2),
            ],
          },
          {
            id: 'A2-U-grammar-4',
            title: 'ระดับภาษาและความสุภาพ',
            lessons: [
              gram('A2-g-honorific', 'รูปยกย่อง -(으)시-', ['g-honorific-si'], 3, ['A1-g-seyo']),
              gram('A2-g-casual', '반말 ภาษากันเอง', ['g-casual'], 2),
              gram('A2-g-irregulars', 'สรุปการผันไม่ปกติ', ['g-irregulars-overview'], 3, ['A1-c-irregular']),
            ],
          },
        ],
      },
      {
        id: 'A2-M-conjugation',
        title: 'การผันคำ',
        description: 'คำกริยาประกอบ รูปขยาย และการผันไม่ปกติ',
        units: [
          {
            id: 'A2-U-conj',
            title: 'ฝึกผันระดับ A2',
            lessons: [
              L('A2-c-modifiers', 'ผันรูปขยายคำนาม', { kind: 'conjugation', formKeys: ['modPresent', 'modPast', 'modFuture'], words: ['먹다', '가다', '살다', '듣다', '춥다', '예쁘다', '맛있다'], explain: ['V: 는 / (으)ㄴ / (으)ㄹ', 'A: (으)ㄴ', '있다/없다: 는'] }, 30, 3, ['A2-g-modifiers']),
              L('A2-c-conditions', 'เงื่อนไข อนุญาต หน้าที่', { kind: 'conjugation', formKeys: ['if', 'mayDo', 'mustNot', 'mustDo'], words: ['가다', '먹다', '듣다', '쓰다', '돕다'], explain: ['-(으)면 / -아/어도 돼요 / -(으)면 안 돼요 / -아/어야 해요'] }, 30, 2),
              L('A2-c-time', 'รูปบอกเวลาและลำดับ', { kind: 'conjugation', formKeys: ['when', 'before', 'after', 'progressive'], words: ['자다', '먹다', '만들다', '걷다'], explain: ['-(으)ㄹ 때 / -기 전에 / -(으)ㄴ 후에 / -고 있어요'] }, 25, 2),
              L('A2-c-honorific', 'รูปยกย่องและภาษากันเอง', { kind: 'conjugation', formKeys: ['honPresent', 'honPast', 'casual', 'casualPast'], words: ['가다', '읽다', '오다', '만들다', '하다'], explain: ['-(으)세요 / -(으)셨어요 / 반말 -아/어'] }, 25, 2, ['A2-g-honorific']),
              L('A2-c-irregular', 'การผันไม่ปกติ (ทุกกลุ่ม)', { kind: 'conjugation', formKeys: ['present', 'past', 'if', 'modPresent'], words: ['듣다', '걷다', '돕다', '덥다', '모르다', '빠르다', '짓다', '낫다', '빨갛다', '그렇다', '쓰다', '아프다', '길다'], explain: ['ㄷ · ㅂ · 르 · ㅅ · ㅎ · ㅡ · ㄹ'] }, 40, 3, ['A2-g-irregulars']),
            ],
          },
        ],
      },
      {
        id: 'A2-M-communication',
        title: 'การสื่อสาร',
        description: 'สุขภาพ ซื้อของ วางแผนท่องเที่ยว',
        units: [
          {
            id: 'A2-U-comm',
            title: 'บทสนทนา A2',
            lessons: [
              L('A2-d-hospital', 'ที่โรงพยาบาล', { kind: 'dialogue', ids: ['d-hospital'] }, 20),
              L('A2-d-shopping', 'ซื้อของและเปรียบเทียบ', { kind: 'dialogue', ids: ['d-shopping'] }, 20),
              L('A2-d-travel', 'วางแผนท่องเที่ยว', { kind: 'dialogue', ids: ['d-travel-plan'] }, 20),
            ],
          },
        ],
      },
      {
        id: 'A2-M-reading',
        title: 'การอ่านและการเขียน',
        description: 'ประกาศ ข้อความ และไดอารี่',
        units: [
          {
            id: 'A2-U-reading',
            title: 'อ่านข้อความสั้น',
            lessons: [
              L('A2-r-notice', 'อ่านประกาศ', { kind: 'reading', ids: ['r-notice-library'] }, 15, 2),
              L('A2-r-message', 'อ่านข้อความ', { kind: 'reading', ids: ['r-message'] }, 15, 2),
              L('A2-r-diary', 'อ่านไดอารี่', { kind: 'reading', ids: ['r-diary'] }, 20, 2),
              L('A2-w-message', 'เขียนข้อความและย่อหน้าสั้น', { kind: 'writing', questionIds: ['w-a2-message', 'w-a2-diary'] }, 30, 2),
            ],
          },
        ],
      },
    ],
  },

  // ======================================================================= B1
  {
    id: 'B1',
    title: 'Intermediate',
    description: 'เล่าเรื่องต่อเนื่อง แสดงความคิดเห็น อ้างคำพูด อ่านบทความทั่วไป',
    modules: [
      {
        id: 'B1-M-vocab',
        title: 'คำศัพท์',
        description: 'สังคม งาน อารมณ์ สื่อ วัฒนธรรม',
        units: [
          {
            id: 'B1-U-vocab',
            title: 'คำศัพท์ระดับกลาง',
            lessons: [
              vocab('B1', 'B1-v-society', 'สังคมและชีวิต', ['society'], 35),
              vocab('B1', 'B1-v-work', 'การงานและการศึกษา', ['work'], 35),
              vocab('B1', 'B1-v-feelings', 'อารมณ์และนิสัย', ['feelings'], 30),
              vocab('B1', 'B1-v-media', 'สื่อและเทคโนโลยี', ['media-tech'], 30),
              vocab('B1', 'B1-v-culture', 'วัฒนธรรมและประเพณี', ['culture'], 30),
              vocab('B1', 'B1-v-daily', 'ชีวิตประจำวันและคำวิเศษณ์', ['routine'], 35),
              vocab('B1', 'B1-v-environment', 'สิ่งแวดล้อมและธรรมชาติ', ['nature'], 25),
            ],
          },
        ],
      },
      {
        id: 'B1-M-grammar',
        title: 'ไวยากรณ์',
        description: 'คาดเดา เชื่อมประโยค อ้างคำพูด passive/causative',
        units: [
          {
            id: 'B1-U-grammar-1',
            title: 'คาดเดาและความรู้สึก',
            lessons: [
              gram('B1-g-seems', '-(으)ㄴ/는 것 같다', ['g-seems'], 2, ['A2-g-modifiers']),
              gram('B1-g-maybe', '-(으)ㄹ지도 모르다 · -나 보다', ['g-maybe', 'g-na-boda'], 3, ['B1-g-seems']),
              gram('B1-g-janayo', '-잖아요', ['g-janayo'], 2),
            ],
          },
          {
            id: 'B1-U-grammar-2',
            title: 'เชื่อมประโยคระดับกลาง',
            lessons: [
              gram('B1-g-background', '-는데 / -(으)ㄴ데', ['g-background'], 2),
              gram('B1-g-while', '-(으)면서', ['g-while'], 2),
              gram('B1-g-because', '-기 때문에', ['g-because-gi'], 2),
              gram('B1-g-daga', '-다가', ['g-daga'], 3),
              gram('B1-g-intend', '-(으)려고 하다', ['g-intend'], 2, ['A2-g-purpose']),
            ],
          },
          {
            id: 'B1-U-grammar-3',
            title: 'การเปลี่ยนแปลง passive และ causative',
            lessons: [
              gram('B1-g-change', '-게 되다 · -아/어지다', ['g-become-ge', 'g-ajida'], 2),
              gram('B1-g-state', '-아/어 있다', ['g-state'], 2, ['A2-g-progressive']),
              gram('B1-g-passive', 'Passive (피동)', ['g-passive'], 3),
              gram('B1-g-causative', 'Causative (사동)', ['g-causative'], 3, ['B1-g-passive']),
            ],
          },
          {
            id: 'B1-U-grammar-4',
            title: 'อ้างคำพูดและภาษาเขียน',
            lessons: [
              gram('B1-g-quote', 'Indirect / Quoted Speech', ['g-quote'], 3, ['B1-g-plain']),
              gram('B1-g-plain', '한다체 ภาษาเขียน', ['g-plain'], 2),
              gram('B1-g-opinion', 'แสดงความเห็น เห็นด้วย/ไม่เห็นด้วย', ['g-opinion'], 2, ['B1-g-plain']),
            ],
          },
        ],
      },
      {
        id: 'B1-M-conjugation',
        title: 'การผันคำ',
        description: 'รูปคาดเดา อ้างคำพูด และภาษาเขียน',
        units: [
          {
            id: 'B1-U-conj',
            title: 'ฝึกผันระดับ B1',
            lessons: [
              L('B1-c-conjecture', 'ผันรูปคาดเดา', { kind: 'conjugation', formKeys: ['seems', 'seemsPast', 'seemsFuture', 'background'], words: ['오다', '바쁘다', '먹다', '맛있다', '춥다'], explain: ['V-는/(으)ㄴ/(으)ㄹ 것 같다 · A-(으)ㄴ 것 같다'] }, 30, 3, ['B1-g-seems']),
              L('B1-c-quote', 'ผันรูปอ้างคำพูด', { kind: 'conjugation', formKeys: ['quoteStatement', 'quotePast', 'quoteQuestion', 'quoteSuggest', 'quoteCommand'], words: ['가다', '먹다', '바쁘다', '만들다', '듣다'], explain: ['-(느)ㄴ다고 / -다고 / -냐고 / -자고 / -(으)라고'] }, 35, 3, ['B1-g-quote']),
              L('B1-c-plain', 'ผัน 한다체', { kind: 'conjugation', formKeys: ['plain', 'plainPast'], words: ['가다', '먹다', '살다', '듣다', '예쁘다', '좋다'], explain: ['V: ㄴ다/는다 · A: -다'] }, 25, 2, ['B1-g-plain']),
            ],
          },
        ],
      },
      {
        id: 'B1-M-reading',
        title: 'การอ่าน การสื่อสาร และการเขียน',
        description: 'บทความทั่วไป การแสดงความเห็น และย่อหน้าที่มีเหตุผล',
        units: [
          {
            id: 'B1-U-reading',
            title: 'อ่านบทความ',
            lessons: [
              L('B1-r-household', 'ครัวเรือนคนเดียว', { kind: 'reading', ids: ['r-single-household'] }, 25, 2),
              L('B1-r-walking', 'ประโยชน์ของการเดิน', { kind: 'reading', ids: ['r-walking'] }, 20, 2),
              L('B1-r-hallyu', 'กระแสเกาหลีกับการเรียนภาษา', { kind: 'reading', ids: ['r-hallyu'] }, 20, 2),
            ],
          },
          {
            id: 'B1-U-comm',
            title: 'สื่อสารและเขียน',
            lessons: [
              L('B1-d-opinion', 'แสดงความคิดเห็นและโต้แย้ง', { kind: 'dialogue', ids: ['d-opinion'] }, 20, 2),
              L('B1-d-job', 'สัมภาษณ์งาน', { kind: 'dialogue', ids: ['d-job'] }, 25, 2),
              L('B1-w-paragraph', 'เขียนย่อหน้าแสดงเหตุผล', { kind: 'writing', questionIds: ['w-b1-opinion', 't2-w51a', 't2-w52a'] }, 40, 3, ['B1-g-plain']),
            ],
          },
        ],
      },
    ],
  },

  // ======================================================================= B2
  {
    id: 'B2',
    title: 'Upper Intermediate',
    description: 'อภิปรายหัวข้อซับซ้อน อ่านบทความยาว เขียนเรียงความที่มีโครงสร้าง',
    modules: [
      {
        id: 'B2-M-vocab',
        title: 'คำศัพท์',
        description: 'คำนามธรรม เศรษฐกิจ สังคม สื่อ วัฒนธรรม',
        units: [
          {
            id: 'B2-U-vocab',
            title: 'คำศัพท์ระดับกลางค่อนสูง',
            lessons: [
              vocab('B2', 'B2-v-abstract', 'คำนามธรรมและคำเชื่อมภาษาเขียน', ['abstract'], 40),
              vocab('B2', 'B2-v-economy', 'เศรษฐกิจและสิ่งแวดล้อม', ['economy-env'], 35),
              vocab('B2', 'B2-v-media', 'สื่อและเทคโนโลยี', ['media-tech'], 25),
              vocab('B2', 'B2-v-society', 'สังคมและนโยบาย', ['society'], 30),
              vocab('B2', 'B2-v-culture', 'วัฒนธรรมและมรดก', ['culture'], 20),
            ],
          },
        ],
      },
      {
        id: 'B2-M-grammar',
        title: 'ไวยากรณ์',
        description: 'สมมติ เปรียบเทียบ โต้แย้ง และภาษาเขียน',
        units: [
          {
            id: 'B2-U-grammar-1',
            title: 'สมมติและข้อแม้',
            lessons: [
              gram('B2-g-deorado', '-더라도', ['g-deorado'], 2),
              gram('B2-g-deoramyeon', '-았/었더라면', ['g-deoramyeon'], 3),
              gram('B2-g-han', '-는 한', ['g-neun-han'], 2),
            ],
          },
          {
            id: 'B2-U-grammar-2',
            title: 'เปรียบเทียบและเน้นความหมาย',
            lessons: [
              gram('B2-g-notonly', '-(으)ㄹ 뿐만 아니라', ['g-ppunmanaanira'], 2),
              gram('B2-g-whereas', '-(으)ㄴ/는 반면에', ['g-banmyeone'], 2),
              gram('B2-g-admit', '-기는 하지만', ['g-gineun'], 2),
              gram('B2-g-surok', '-(으)ㄹ수록', ['g-surok'], 2),
            ],
          },
          {
            id: 'B2-U-grammar-3',
            title: 'ความทรงจำ ความจริงทั่วไป และน้ำเสียง',
            lessons: [
              gram('B2-g-deon', '-던 · -았/었던', ['g-deon'], 3),
              gram('B2-g-maryeon', '-기/게 마련이다 · -(으)ㄹ 만하다 · -(으)ㄴ/는 셈이다', ['g-maryeon', 'g-manhada', 'g-sem'], 3),
              gram('B2-g-beorida', '-아/어 버리다 · -고 말다', ['g-beorida'], 2),
              gram('B2-g-barame', '-는 바람에 · -느라고', ['g-baramee'], 3),
              gram('B2-g-formal', 'คำเชื่อมภาษาเขียนทางการ', ['g-formal-writing'], 3, ['B1-g-plain']),
            ],
          },
        ],
      },
      {
        id: 'B2-M-reading',
        title: 'การอ่านและการเขียน',
        description: 'บทความยาว การสรุป และการเขียนเรียงความ',
        units: [
          {
            id: 'B2-U-reading',
            title: 'อ่านบทความยาวและเขียน',
            lessons: [
              L('B2-r-ai', 'ปัญญาประดิษฐ์กับตลาดแรงงาน', { kind: 'reading', ids: ['r-ai-jobs'] }, 30, 3),
              L('B2-r-climate', 'การเปลี่ยนแปลงสภาพภูมิอากาศ', { kind: 'reading', ids: ['r-climate'] }, 30, 3),
              L('B2-w-graph', 'เขียนบรรยายข้อมูล (TOPIK 53)', { kind: 'writing', questionIds: ['t2-w53a'] }, 45, 3, ['B2-g-formal']),
              L('B2-w-essay', 'เขียนเรียงความ (TOPIK 54)', { kind: 'writing', questionIds: ['t2-w54a'] }, 60, 3, ['B2-w-graph']),
            ],
          },
        ],
      },
    ],
  },

  // ======================================================================= ADVANCED
  {
    id: 'ADV',
    title: 'Advanced Track',
    description: 'หัวข้อต่อยอดหลัง B2 — ไม่ใช่ข้อกำหนดของระดับ A1–B2',
    modules: [
      {
        id: 'ADV-M-language',
        title: 'ภาษาขั้นสูง',
        description: 'ระบบยกย่อง ภาษาเขียนทางการ สำนวน และน้ำเสียง',
        units: [
          {
            id: 'ADV-U-register',
            title: 'ระดับภาษาและการยกย่อง',
            lessons: [
              gram('ADV-honorific', 'ระบบ 높임법 ทั้งสามชั้น', ['g-adv-honorific-system'], 3, ['A2-g-honorific'], 35),
              gram('ADV-written', 'ภาษาเขียนทางการ รายงาน และบทความ', ['g-adv-written'], 3, ['B2-g-formal'], 35),
              gram('ADV-nuance', 'น้ำเสียงและ discourse markers', ['g-adv-nuance'], 3, undefined, 30),
            ],
          },
          {
            id: 'ADV-U-expressions',
            title: 'สำนวนและการสร้างคำ',
            lessons: [
              gram('ADV-idioms', '관용 표현', ['g-adv-idioms'], 3, undefined, 30),
              gram('ADV-sajaseongeo', '사자성어', ['g-adv-sajaseongeo'], 3, undefined, 25),
              gram('ADV-sino', 'การสร้างคำจีน-เกาหลี (한자어)', ['g-adv-sino'], 3, undefined, 30),
            ],
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
export interface LessonLocation {
  lesson: Lesson;
  unit: Unit;
  module: Module;
  level: CurriculumLevel;
}

export const LESSON_INDEX: Record<string, LessonLocation> = {};
export const ALL_LESSONS: Lesson[] = [];
for (const level of CURRICULUM)
  for (const module of level.modules)
    for (const unit of module.units)
      for (const lesson of unit.lessons) {
        LESSON_INDEX[lesson.id] = { lesson, unit, module, level };
        ALL_LESSONS.push(lesson);
      }

export function lessonsOfLevel(level: Level): Lesson[] {
  return ALL_LESSONS.filter((l) => LESSON_INDEX[l.id].level.id === level);
}

export function lessonsOfUnit(unitId: string): Lesson[] {
  return ALL_LESSONS.filter((l) => LESSON_INDEX[l.id].unit.id === unitId);
}

export const LESSON_COUNT = seq;
