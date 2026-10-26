# HANEUL — Korean Learning Studio (하늘)

แพลตฟอร์มเรียนภาษาเกาหลีครบวงจรสำหรับผู้เรียนชาวไทย ตั้งแต่ตัวอักษรฮันกึลจนถึงระดับสูง
— หลักสูตร คำศัพท์ ไวยากรณ์ Conjugation Lab, Flashcards (Spaced Repetition), แปลและช่วยอ่าน,
Practice Zone, TOPIK Center, Game Center (คนเดียว / เครื่องเดียว / ออนไลน์), Student Planner, Notes
และสถิติความก้าวหน้า

## เริ่มใช้งาน

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit + content-integrity tests (Vitest)
npm run build        # typecheck + production build → dist/
scripts/test-db.sh   # Supabase migration + RLS + multiplayer tests on a local PostgreSQL
```

ไม่ต้องตั้งค่าอะไรเพิ่มก็ใช้งานได้ในโหมด **Local-first** (ข้อมูลเก็บในเบราว์เซอร์)
ระบบบัญชี ซิงก์ข้ามอุปกรณ์ และเกมออนไลน์ต้องตั้งค่า Supabase — ดู [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md)

## เนื้อหา

| ส่วน | จำนวน | หมายเหตุ |
|---|---|---|
| Curriculum Map | 6 ระดับ (Level 0, A1, A2, B1, B2, Advanced) · 191 บทเรียน | Level → Module → Unit → Lesson → Topic → Exercise → Assessment |
| คำศัพท์ | ~1,060 คำ (A1–B2) | ความหมายไทย ประเภทคำ ประโยคตัวอย่างพร้อมคำแปล |
| ไวยากรณ์ | 94 หัวข้อ | วิธีสร้าง การใช้ ตัวอย่าง ข้อผิดพลาดที่พบบ่อย แบบฝึกหัดที่ตรวจได้ |
| TOPIK | ข้อสอบเขียนขึ้นใหม่รูปแบบ TOPIK I / II + TOPIK III Study Track | ไม่ใช่ข้อสอบจริงจากการสอบที่ผ่านมา |

> เรื่อง "1 แสนคำ": คนเกาหลีใช้คำในชีวิตประจำวันประมาณ 5,000–10,000 คำ คลังนี้ครอบคลุมแกนหลักระดับ A1–B2
> และออกแบบให้เพิ่มคำได้ในไฟล์ `src/data/vocabulary/*.ts` (มีชุดทดสอบตรวจความถูกต้องของข้อมูลให้อัตโนมัติ)

การเทียบระดับ A1–B2 กับ TOPIK เป็น **ค่าประมาณ** เพื่อวางแผนการเรียน ไม่ใช่การเทียบอย่างเป็นทางการ
และ **ไม่มีการสอบทางการชื่อ TOPIK III** — "TOPIK III Study Track" เป็นหมวดฝึกระดับต่อยอดภายในแอป

## สถาปัตยกรรม

React 18 + TypeScript + Vite · Tailwind CSS · React Router · Zustand (persist) · Zod · Recharts · Supabase

```
src/
  lib/hangul/        จัดการพยางค์ คำช่วย กฎการออกเสียง (연음 비음화 경음화 …) romanization คำอ่านไทย
  lib/conjugation/   Conjugation Rule Engine (classify → primitives → form catalog) + ชุดทดสอบ 250 กรณี
  lib/quiz/          สร้างคำถามจากเนื้อหา ตรวจคำตอบ ตรวจงานเขียนแบบกฎ รายงานจุดแข็ง/จุดอ่อน
  lib/srs/           Spaced repetition scheduler (SM-2 + learning steps)
  lib/planner/       สร้างตารางเรียนตามเวลาว่าง/วันพัก/ความยาก เลื่อนแผน ย้ายรายการ
  lib/translator/    Reading Assistant แบบพจนานุกรม + interface สำหรับ translation backend (ไม่บังคับ)
  lib/games/         10 เกม สร้างคำถามแบบ seed ได้ และสูตรคะแนน (ซ้ำกับฝั่งเซิร์ฟเวอร์)
  lib/backend/       Supabase client, auth, cloud sync, multiplayer service
  data/              หลักสูตร คำศัพท์ ไวยากรณ์ ฮันกึล บทสนทนา บทอ่าน คลังข้อสอบ
  store/             Local-first stores (progress, flashcards, notes, planner, history, settings)
  components/        UI (design system), layout, learn (QuizRunner, LessonContent), games
  pages/             14 หน้าหลัก + หน้าบทเรียน แบบทดสอบ เกม
supabase/
  migrations/        schema + RLS + RPC (game logic ทั้งหมดอยู่ฝั่งเซิร์ฟเวอร์)
  seed.sql           คลังคำถามเกมออนไลน์ (generate ด้วย npm run db:seed)
  tests/             integration tests สำหรับ RLS / anti-cheat / game flow
```

## การตรวจสอบคุณภาพ

- `npm test` — 370+ tests: conjugation engine (ค่าที่คาดหวังเขียนด้วยมือ), pronunciation/romanization,
  integrity ของคำศัพท์/ไวยากรณ์/หลักสูตร (ทุกบทเรียนอ้างอิงเนื้อหาที่มีอยู่จริง), คำกริยาทุกคำในคลังผันได้แบบ "ตรวจสอบแล้ว",
  quiz/SRS/planner/translator/games
- `scripts/test-db.sh` — รัน migration + seed บน PostgreSQL จริง แล้วทดสอบ RLS (ผู้ใช้อ่าน/แก้ข้อมูลคนอื่นไม่ได้),
  การซ่อนคำตอบ, จับเวลาและคิดคะแนนฝั่งเซิร์ฟเวอร์, ตอบซ้ำ/ตอบข้ามข้อ, reconnect, โอนสิทธิ์เจ้าของห้อง, เพื่อนและคำเชิญ

ดูสถานะฟีเจอร์ทั้งหมดและสิ่งที่ยังไม่ได้ทำใน [docs/STATUS.md](docs/STATUS.md)
