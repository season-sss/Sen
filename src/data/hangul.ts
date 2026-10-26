/** Level 0 — Hangul Foundations content. Thai approximations are learning aids only. */

export interface JamoInfo {
  char: string;
  name: string;
  roman: string;
  thai: string;
  note?: string;
  examples: { word: string; th: string }[];
}

export const BASIC_CONSONANTS: JamoInfo[] = [
  { char: 'ㄱ', name: '기역', roman: 'g / k', thai: 'ค / ก', note: 'ต้นคำเสียงคล้าย ค เบาๆ ระหว่างสระคล้าย ก', examples: [{ word: '가방', th: 'กระเป๋า' }, { word: '고기', th: 'เนื้อ' }] },
  { char: 'ㄴ', name: '니은', roman: 'n', thai: 'น', examples: [{ word: '나무', th: 'ต้นไม้' }, { word: '누나', th: 'พี่สาว' }] },
  { char: 'ㄷ', name: '디귿', roman: 'd / t', thai: 'ท / ด', examples: [{ word: '다리', th: 'ขา' }, { word: '도시', th: 'เมือง' }] },
  { char: 'ㄹ', name: '리을', roman: 'r / l', thai: 'ร / ล', note: 'ต้นพยางค์คล้าย ร เบาๆ (ลิ้นแตะครั้งเดียว) ตัวสะกดคล้าย ล', examples: [{ word: '라면', th: 'รามยอน' }, { word: '물', th: 'น้ำ' }] },
  { char: 'ㅁ', name: '미음', roman: 'm', thai: 'ม', examples: [{ word: '머리', th: 'หัว' }, { word: '엄마', th: 'แม่' }] },
  { char: 'ㅂ', name: '비읍', roman: 'b / p', thai: 'พ / บ', examples: [{ word: '바다', th: 'ทะเล' }, { word: '비', th: 'ฝน' }] },
  { char: 'ㅅ', name: '시옷', roman: 's', thai: 'ซ', note: 'หน้า ㅣ ㅑ ㅕ ㅛ ㅠ ออกเสียงคล้าย "ช/ชี"', examples: [{ word: '사과', th: 'แอปเปิล' }, { word: '시계', th: 'นาฬิกา' }] },
  { char: 'ㅇ', name: '이응', roman: '— / ng', thai: 'อ / ง', note: 'ต้นพยางค์ไม่มีเสียง (เหมือน อ) ตัวสะกดออกเสียง ง', examples: [{ word: '아이', th: 'เด็ก' }, { word: '강', th: 'แม่น้ำ' }] },
  { char: 'ㅈ', name: '지읒', roman: 'j', thai: 'ช / จ', examples: [{ word: '자다', th: 'นอน' }, { word: '지도', th: 'แผนที่' }] },
  { char: 'ㅊ', name: '치읓', roman: 'ch', thai: 'ช (พ่นลม)', examples: [{ word: '차', th: 'ชา / รถ' }, { word: '친구', th: 'เพื่อน' }] },
  { char: 'ㅋ', name: '키읔', roman: 'k', thai: 'ค (พ่นลม)', examples: [{ word: '코', th: 'จมูก' }, { word: '커피', th: 'กาแฟ' }] },
  { char: 'ㅌ', name: '티읕', roman: 't', thai: 'ท (พ่นลม)', examples: [{ word: '토끼', th: 'กระต่าย' }, { word: '택시', th: 'แท็กซี่' }] },
  { char: 'ㅍ', name: '피읖', roman: 'p', thai: 'พ (พ่นลม)', examples: [{ word: '포도', th: 'องุ่น' }, { word: '피아노', th: 'เปียโน' }] },
  { char: 'ㅎ', name: '히읗', roman: 'h', thai: 'ฮ', examples: [{ word: '하나', th: 'หนึ่ง' }, { word: '학교', th: 'โรงเรียน' }] },
];

export const DOUBLE_CONSONANTS: JamoInfo[] = [
  { char: 'ㄲ', name: '쌍기역', roman: 'kk', thai: 'ก (เกร็ง)', note: 'เสียงหนัก เกร็งคอ ไม่พ่นลม', examples: [{ word: '꼬리', th: 'หาง' }, { word: '까치', th: 'นกกางเขน' }] },
  { char: 'ㄸ', name: '쌍디귿', roman: 'tt', thai: 'ต', examples: [{ word: '딸', th: 'ลูกสาว' }, { word: '떡', th: 'ต๊อก (ขนมแป้ง)' }] },
  { char: 'ㅃ', name: '쌍비읍', roman: 'pp', thai: 'ป', examples: [{ word: '빵', th: 'ขนมปัง' }, { word: '아빠', th: 'พ่อ' }] },
  { char: 'ㅆ', name: '쌍시옷', roman: 'ss', thai: 'ซ (หนัก)', examples: [{ word: '쌀', th: 'ข้าวสาร' }, { word: '비싸다', th: 'แพง' }] },
  { char: 'ㅉ', name: '쌍지읒', roman: 'jj', thai: 'จ', examples: [{ word: '짜다', th: 'เค็ม' }, { word: '찌개', th: 'จิเก (สตูว์)' }] },
];

export const BASIC_VOWELS: JamoInfo[] = [
  { char: 'ㅏ', name: '아', roman: 'a', thai: 'อา', examples: [{ word: '아이', th: 'เด็ก' }] },
  { char: 'ㅑ', name: '야', roman: 'ya', thai: 'ยา', examples: [{ word: '야구', th: 'เบสบอล' }] },
  { char: 'ㅓ', name: '어', roman: 'eo', thai: 'ออ', note: 'ปากเปิดกว้างกว่า ㅗ ไม่ห่อปาก', examples: [{ word: '어머니', th: 'แม่' }] },
  { char: 'ㅕ', name: '여', roman: 'yeo', thai: 'ยอ', examples: [{ word: '여자', th: 'ผู้หญิง' }] },
  { char: 'ㅗ', name: '오', roman: 'o', thai: 'โอ', note: 'ห่อปากกลม', examples: [{ word: '오이', th: 'แตงกวา' }] },
  { char: 'ㅛ', name: '요', roman: 'yo', thai: 'โย', examples: [{ word: '요리', th: 'การทำอาหาร' }] },
  { char: 'ㅜ', name: '우', roman: 'u', thai: 'อู', examples: [{ word: '우유', th: 'นม' }] },
  { char: 'ㅠ', name: '유', roman: 'yu', thai: 'ยู', examples: [{ word: '유리', th: 'แก้ว (กระจก)' }] },
  { char: 'ㅡ', name: '으', roman: 'eu', thai: 'อือ', note: 'ฉีกปากเล็กน้อย ไม่ห่อปาก', examples: [{ word: '그림', th: 'ภาพวาด' }] },
  { char: 'ㅣ', name: '이', roman: 'i', thai: 'อี', examples: [{ word: '이름', th: 'ชื่อ' }] },
];

export const COMPOUND_VOWELS: JamoInfo[] = [
  { char: 'ㅐ', name: '애', roman: 'ae', thai: 'แอ', note: 'ปัจจุบันออกเสียงเกือบเหมือน ㅔ', examples: [{ word: '개', th: 'สุนัข' }] },
  { char: 'ㅒ', name: '얘', roman: 'yae', thai: 'แย', examples: [{ word: '얘기', th: 'เรื่องราว' }] },
  { char: 'ㅔ', name: '에', roman: 'e', thai: 'เอ', examples: [{ word: '네', th: 'ใช่' }] },
  { char: 'ㅖ', name: '예', roman: 'ye', thai: 'เย', examples: [{ word: '예약', th: 'การจอง' }] },
  { char: 'ㅘ', name: '와', roman: 'wa', thai: 'วา', note: 'ㅗ + ㅏ', examples: [{ word: '과일', th: 'ผลไม้' }] },
  { char: 'ㅙ', name: '왜', roman: 'wae', thai: 'แว', note: 'ㅗ + ㅐ', examples: [{ word: '왜', th: 'ทำไม' }] },
  { char: 'ㅚ', name: '외', roman: 'oe', thai: 'เว', note: 'ปัจจุบันออกเสียงเหมือน ㅞ', examples: [{ word: '회사', th: 'บริษัท' }] },
  { char: 'ㅝ', name: '워', roman: 'wo', thai: 'วอ', note: 'ㅜ + ㅓ', examples: [{ word: '병원', th: 'โรงพยาบาล' }] },
  { char: 'ㅞ', name: '웨', roman: 'we', thai: 'เว', note: 'ㅜ + ㅔ', examples: [{ word: '웨이터', th: 'บริกร' }] },
  { char: 'ㅟ', name: '위', roman: 'wi', thai: 'วี', note: 'ㅜ + ㅣ', examples: [{ word: '귀', th: 'หู' }] },
  { char: 'ㅢ', name: '의', roman: 'ui', thai: 'อึย', note: 'ต้นคำออก [의] หลังพยัญชนะออก [ㅣ] คำช่วย 의 ออก [에] ได้', examples: [{ word: '의사', th: 'แพทย์' }] },
];

export const BATCHIM_GROUPS: { sound: string; thai: string; letters: string[]; examples: { word: string; th: string }[] }[] = [
  { sound: 'ㄱ [k]', thai: 'ก', letters: ['ㄱ', 'ㄲ', 'ㅋ'], examples: [{ word: '책', th: 'หนังสือ' }, { word: '밖', th: 'ข้างนอก' }, { word: '부엌', th: 'ห้องครัว' }] },
  { sound: 'ㄴ [n]', thai: 'น', letters: ['ㄴ'], examples: [{ word: '산', th: 'ภูเขา' }, { word: '눈', th: 'ตา / หิมะ' }] },
  { sound: 'ㄷ [t]', thai: 'ด', letters: ['ㄷ', 'ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㅎ'], examples: [{ word: '옷', th: 'เสื้อผ้า' }, { word: '꽃', th: 'ดอกไม้' }, { word: '밭', th: 'ไร่' }] },
  { sound: 'ㄹ [l]', thai: 'ล', letters: ['ㄹ'], examples: [{ word: '물', th: 'น้ำ' }, { word: '말', th: 'ม้า / คำพูด' }] },
  { sound: 'ㅁ [m]', thai: 'ม', letters: ['ㅁ'], examples: [{ word: '밤', th: 'กลางคืน' }, { word: '봄', th: 'ฤดูใบไม้ผลิ' }] },
  { sound: 'ㅂ [p]', thai: 'บ', letters: ['ㅂ', 'ㅍ'], examples: [{ word: '밥', th: 'ข้าว' }, { word: '앞', th: 'ข้างหน้า' }] },
  { sound: 'ㅇ [ng]', thai: 'ง', letters: ['ㅇ'], examples: [{ word: '강', th: 'แม่น้ำ' }, { word: '방', th: 'ห้อง' }] },
];

export const COMPLEX_BATCHIM: { pair: string; reads: string; examples: { word: string; th: string }[]; note: string }[] = [
  { pair: 'ㄳ', reads: 'ㄱ', examples: [{ word: '넋', th: 'วิญญาณ' }], note: 'อ่านตัวหน้า' },
  { pair: 'ㄵ', reads: 'ㄴ', examples: [{ word: '앉다', th: 'นั่ง' }], note: 'อ่านตัวหน้า' },
  { pair: 'ㄶ', reads: 'ㄴ', examples: [{ word: '많다', th: 'มาก' }], note: 'อ่านตัวหน้า ㅎ ทำให้เสียงถัดไปพ่นลม: [만타]' },
  { pair: 'ㄺ', reads: 'ㄱ', examples: [{ word: '닭', th: 'ไก่' }, { word: '읽다', th: 'อ่าน' }], note: 'มักอ่านตัวหลัง (ㄱ) แต่ก่อน ㄱ อ่าน ㄹ: 읽고 [일꼬]' },
  { pair: 'ㄻ', reads: 'ㅁ', examples: [{ word: '삶', th: 'ชีวิต' }], note: 'อ่านตัวหลัง' },
  { pair: 'ㄼ', reads: 'ㄹ', examples: [{ word: '여덟', th: 'แปด' }, { word: '넓다', th: 'กว้าง' }], note: 'มักอ่านตัวหน้า ยกเว้น 밟다 [밥따]' },
  { pair: 'ㄾ', reads: 'ㄹ', examples: [{ word: '핥다', th: 'เลีย' }], note: 'อ่านตัวหน้า' },
  { pair: 'ㄿ', reads: 'ㅂ', examples: [{ word: '읊다', th: 'ท่อง (กลอน)' }], note: 'อ่านตัวหลัง' },
  { pair: 'ㅀ', reads: 'ㄹ', examples: [{ word: '싫다', th: 'ไม่ชอบ' }], note: 'อ่านตัวหน้า ㅎ ทำให้เสียงถัดไปพ่นลม: [실타]' },
  { pair: 'ㅄ', reads: 'ㅂ', examples: [{ word: '없다', th: 'ไม่มี' }, { word: '값', th: 'ราคา' }], note: 'อ่านตัวหน้า' },
];

/** Words used to practise each sound rule; expected pronunciations are produced by the pronunciation engine. */
export const SOUND_RULE_PRACTICE: { rule: string; words: string[] }[] = [
  { rule: 'liaison', words: ['한국어', '음악', '먹어요', '맛있어요', '앉아요', '읽어요'] },
  { rule: 'h-drop', words: ['좋아요', '많아요', '괜찮아요', '싫어요'] },
  { rule: 'aspiration', words: ['좋다', '축하해요', '입학', '못해요', '많다'] },
  { rule: 'nasalization', words: ['감사합니다', '먹는', '십만', '학년', '거짓말'] },
  { rule: 'r-nasalization', words: ['음료', '정류장', '국립', '대통령'] },
  { rule: 'lateralization', words: ['신라', '설날', '연락', '편리'] },
  { rule: 'tensification', words: ['학교', '먹다', '식당', '숙제', '잡지'] },
  { rule: 'palatalization', words: ['같이', '굳이', '해돋이'] },
];

/** Typing practice: keyboard layout (2-set / 두벌식). */
export const KEYBOARD_ROWS: { key: string; jamo: string; shift?: string }[][] = [
  [
    { key: 'Q', jamo: 'ㅂ', shift: 'ㅃ' }, { key: 'W', jamo: 'ㅈ', shift: 'ㅉ' }, { key: 'E', jamo: 'ㄷ', shift: 'ㄸ' }, { key: 'R', jamo: 'ㄱ', shift: 'ㄲ' },
    { key: 'T', jamo: 'ㅅ', shift: 'ㅆ' }, { key: 'Y', jamo: 'ㅛ' }, { key: 'U', jamo: 'ㅕ' }, { key: 'I', jamo: 'ㅑ' }, { key: 'O', jamo: 'ㅐ', shift: 'ㅒ' }, { key: 'P', jamo: 'ㅔ', shift: 'ㅖ' },
  ],
  [
    { key: 'A', jamo: 'ㅁ' }, { key: 'S', jamo: 'ㄴ' }, { key: 'D', jamo: 'ㅇ' }, { key: 'F', jamo: 'ㄹ' }, { key: 'G', jamo: 'ㅎ' },
    { key: 'H', jamo: 'ㅗ' }, { key: 'J', jamo: 'ㅓ' }, { key: 'K', jamo: 'ㅏ' }, { key: 'L', jamo: 'ㅣ' },
  ],
  [
    { key: 'Z', jamo: 'ㅋ' }, { key: 'X', jamo: 'ㅌ' }, { key: 'C', jamo: 'ㅊ' }, { key: 'V', jamo: 'ㅍ' }, { key: 'B', jamo: 'ㅠ' }, { key: 'N', jamo: 'ㅜ' }, { key: 'M', jamo: 'ㅡ' },
  ],
];

/** Words with no example in the vocabulary data, chosen for decoding practice of unseen words. */
export const DECODING_WORDS: { word: string; th: string }[] = [
  { word: '바나나', th: 'กล้วย' }, { word: '카메라', th: 'กล้อง' }, { word: '아이스크림', th: 'ไอศกรีม' }, { word: '컴퓨터', th: 'คอมพิวเตอร์' },
  { word: '토마토', th: 'มะเขือเทศ' }, { word: '버스', th: 'รถเมล์' }, { word: '호텔', th: 'โรงแรม' }, { word: '라디오', th: 'วิทยุ' },
  { word: '피자', th: 'พิซซ่า' }, { word: '햄버거', th: 'แฮมเบอร์เกอร์' }, { word: '초콜릿', th: 'ช็อกโกแลต' }, { word: '스마트폰', th: 'สมาร์ตโฟน' },
  { word: '방콕', th: 'กรุงเทพฯ' }, { word: '치앙마이', th: 'เชียงใหม่' }, { word: '푸껫', th: 'ภูเก็ต' }, { word: '똠얌꿍', th: 'ต้มยำกุ้ง' },
];
