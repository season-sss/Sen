import type { Song } from '@/lib/lyrics/types';

/**
 * Songs shipped with the site. Lyrics are added only when the site owner supplies them
 * (with the right to use them). The demo below was written for HANEUL so the game can be
 * tried before any song is added — it is not from a real song.
 */
export const DEMO_SONG: Song = {
  id: 'builtin-demo',
  title: '하늘 아래 (เพลงตัวอย่าง)',
  artist: 'HANEUL',
  source: 'builtin',
  note: 'เนื้อร้องที่ HANEUL แต่งขึ้นเพื่อทดลองเกม ไม่ใช่เพลงจริง',
  createdAt: 0,
  updatedAt: 0,
  lines: [
    { ko: '아침 햇살이 창문을 두드려요', th: 'แสงแดดยามเช้ามาเคาะหน้าต่าง' },
    { ko: '오늘도 한 걸음씩 걸어가요', th: 'วันนี้ก็ค่อยๆ ก้าวเดินไปทีละก้าว' },
    { ko: '모르는 단어가 많아도 괜찮아요', th: 'ถึงจะมีคำที่ไม่รู้เยอะก็ไม่เป็นไร' },
    { ko: '천천히 읽으면 다 보여요', th: 'ถ้าอ่านช้าๆ ก็จะเข้าใจทั้งหมด' },
    { ko: '친구와 함께 노래를 불러요', th: 'ร้องเพลงไปพร้อมกับเพื่อน' },
    { ko: '내일은 더 잘할 수 있어요', th: 'พรุ่งนี้จะทำได้ดีขึ้นกว่าเดิม' },
    { ko: '하늘처럼 넓은 꿈을 꿔요', th: 'ฝันถึงความฝันที่กว้างใหญ่เหมือนท้องฟ้า' },
    { ko: '우리의 이야기는 이제 시작이에요', th: 'เรื่องราวของเราเพิ่งจะเริ่มต้น' },
  ],
};

export const BUILTIN_SONGS: Song[] = [DEMO_SONG];
