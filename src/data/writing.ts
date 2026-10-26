import type { WritingQuestion } from '@/lib/quiz/types';
import { TOPIK2_WRITING } from './topik/topik2';

/** Free writing tasks used in lessons (self-check with automatic hints; no AI grading). */
export const WRITING_TASKS: WritingQuestion[] = [
  {
    id: 'w-a2-message',
    kind: 'writing',
    section: 'writing',
    level: 'A2',
    task: 'free',
    prompt: '친구에게 약속을 바꾸는 문자 메시지를 쓰십시오. (3~4문장)',
    promptTh: 'เขียนข้อความถึงเพื่อนเพื่อขอเลื่อนนัด 3–4 ประโยค: บอกเหตุผล (-아/어서) เสนอเวลาใหม่ (-(으)ㄹ까요?) และขอโทษ',
    keywords: ['약속', '미안해요', '-아서/어서', '까요'],
    modelAnswer: '수진 씨, 내일 약속 말이에요. 갑자기 아르바이트가 생겨서 오후 3시에 못 만날 것 같아요. 저녁 6시에 만날까요? 정말 미안해요.',
    minChars: 40,
    maxChars: 200,
  },
  {
    id: 'w-a2-diary',
    kind: 'writing',
    section: 'writing',
    level: 'A2',
    task: 'free',
    prompt: '지난 주말에 한 일을 일기로 쓰십시오. (5문장 이상)',
    promptTh: 'เขียนไดอารี่เรื่องสุดสัปดาห์ที่ผ่านมา อย่างน้อย 5 ประโยค ใช้รูปอดีต และคำเชื่อม -고, -아/어서',
    keywords: ['주말', '았', '었', '고'],
    modelAnswer: '지난 주말에 친구와 같이 명동에 갔다. 명동에는 사람이 정말 많았다. 우리는 옷을 구경하고 떡볶이를 먹었다. 떡볶이가 매웠지만 맛있었다. 다음 주말에도 친구를 만나고 싶다.',
    minChars: 60,
    maxChars: 400,
  },
  {
    id: 'w-b1-opinion',
    kind: 'writing',
    section: 'writing',
    level: 'B1',
    task: 'free',
    prompt: '"대학생이 아르바이트를 하는 것"에 대한 자신의 생각을 쓰십시오. (200자 내외)',
    promptTh: 'เขียนความคิดเห็นเรื่อง "นักศึกษาทำงานพาร์ตไทม์" ประมาณ 200 ตัวอักษร ใช้ 한다체 บอกจุดยืน เหตุผล 2 ข้อ และสรุป',
    keywords: ['생각한다', '왜냐하면', '때문이다', '따라서', '첫째'],
    modelAnswer:
      '나는 대학생이 아르바이트를 하는 것이 좋다고 생각한다. 첫째, 직접 돈을 벌면서 경제적인 책임감을 배울 수 있다. 둘째, 다양한 사람을 만나 사회 경험을 쌓을 수 있다. 하지만 아르바이트 때문에 공부를 소홀히 하면 안 된다. 따라서 학업에 방해가 되지 않는 범위에서 아르바이트를 하는 것이 바람직하다.',
    requirePlain: true,
    minChars: 150,
    maxChars: 300,
  },
];

export const ALL_WRITING: WritingQuestion[] = [...WRITING_TASKS, ...TOPIK2_WRITING];
export const WRITING_BY_ID: Record<string, WritingQuestion> = Object.fromEntries(ALL_WRITING.map((w) => [w.id, w]));
