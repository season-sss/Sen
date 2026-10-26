import type { VocabTopic } from '../types';

export const TOPICS: VocabTopic[] = [
  { id: 'greetings', th: 'คำทักทายและคำสุภาพ', ko: '인사', icon: 'Hand' },
  { id: 'numbers', th: 'ตัวเลข', ko: '숫자', icon: 'Hash' },
  { id: 'time', th: 'เวลา วัน เดือน ปี', ko: '시간과 날짜', icon: 'Clock' },
  { id: 'people', th: 'คน ครอบครัว ความสัมพันธ์', ko: '사람과 가족', icon: 'Users' },
  { id: 'school', th: 'โรงเรียนและห้องเรียน', ko: '학교', icon: 'School' },
  { id: 'food', th: 'อาหารและเครื่องดื่ม', ko: '음식', icon: 'UtensilsCrossed' },
  { id: 'home', th: 'บ้าน ห้อง เฟอร์นิเจอร์', ko: '집', icon: 'Home' },
  { id: 'places', th: 'สถานที่และการเดินทาง', ko: '장소와 교통', icon: 'MapPin' },
  { id: 'hobbies', th: 'งานอดิเรก เพลง เกม กีฬา', ko: '취미', icon: 'Gamepad2' },
  { id: 'routine', th: 'กิจวัตรประจำวัน', ko: '일상생활', icon: 'Sun' },
  { id: 'clothes', th: 'เสื้อผ้า สี รูปร่าง', ko: '옷과 색깔', icon: 'Shirt' },
  { id: 'weather', th: 'อากาศและฤดูกาล', ko: '날씨와 계절', icon: 'CloudSun' },
  { id: 'shopping', th: 'ราคา เงิน การซื้อของ', ko: '쇼핑', icon: 'ShoppingBag' },
  { id: 'questions', th: 'คำถามพื้นฐาน', ko: '의문사', icon: 'CircleHelp' },
  { id: 'quantity', th: 'ปริมาณและความถี่', ko: '수량과 빈도', icon: 'BarChart3' },
  { id: 'core-verbs', th: 'คำกริยาพื้นฐาน', ko: '기본 동사', icon: 'Zap' },
  { id: 'core-adjectives', th: 'คำคุณศัพท์พื้นฐาน', ko: '기본 형용사', icon: 'Sparkles' },
  { id: 'function', th: 'สรรพนาม คำขยาย คำอุทาน คำเชื่อม', ko: '기능어', icon: 'Puzzle' },
  { id: 'body-health', th: 'ร่างกายและสุขภาพ', ko: '몸과 건강', icon: 'HeartPulse' },
  { id: 'travel', th: 'การท่องเที่ยว', ko: '여행', icon: 'Plane' },
  { id: 'feelings', th: 'ความรู้สึกและนิสัย', ko: '감정과 성격', icon: 'Smile' },
  { id: 'work', th: 'การงานและการศึกษา', ko: '일과 공부', icon: 'Briefcase' },
  { id: 'nature', th: 'ธรรมชาติและสัตว์', ko: '자연', icon: 'Trees' },
  { id: 'society', th: 'สังคมและชีวิต', ko: '사회', icon: 'Building2' },
  { id: 'media-tech', th: 'สื่อและเทคโนโลยี', ko: '미디어와 기술', icon: 'Cpu' },
  { id: 'culture', th: 'วัฒนธรรมและประเพณี', ko: '문화', icon: 'Landmark' },
  { id: 'abstract', th: 'คำนามธรรมและวิชาการ', ko: '추상어', icon: 'Brain' },
  { id: 'economy-env', th: 'เศรษฐกิจและสิ่งแวดล้อม', ko: '경제와 환경', icon: 'Leaf' },
];

export const TOPIC_BY_ID: Record<string, VocabTopic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
