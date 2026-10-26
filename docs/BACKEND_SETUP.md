# ตั้งค่า Backend (Supabase)

ใช้สำหรับ: บัญชีผู้ใช้ · ซิงก์ข้อมูลข้ามอุปกรณ์ · เกมออนไลน์หลายผู้เล่น · เพื่อนและคำเชิญ
ถ้าไม่ตั้งค่า แอปยังใช้งานได้ครบในโหมด Local-first (ยกเว้นฟีเจอร์ข้างต้น)

## 1. สร้างโปรเจกต์และรัน migration

1. สร้างโปรเจกต์ที่ https://supabase.com
2. ติดตั้ง Supabase CLI แล้วเชื่อมโปรเจกต์: `supabase link --project-ref <ref>`
3. รัน schema: `supabase db push` (ใช้ไฟล์ใน `supabase/migrations/`)
4. ใส่คลังคำถามเกมออนไลน์: `npm run db:seed` แล้วรัน `supabase/seed.sql` ใน SQL Editor
   (หรือ `psql "$DATABASE_URL" -f supabase/seed.sql`)

Migration เพิ่มตาราง `game_rooms`, `room_players`, `room_invites` เข้า publication `supabase_realtime` ให้อัตโนมัติ
ตรวจใน Dashboard › Database › Replication ว่าเปิดอยู่

## 2. ตั้งค่า Auth (บัญชี ชื่อ#แท็ก + PIN)

ผู้ใช้สมัครด้วย `ชื่อ#แท็ก` และ PIN 4–6 หลัก แอปแปลง handle เป็นอีเมลภายในแบบ hash
(`h<sha256>@users.haneul.invalid`) เพื่อใช้กับ Supabase Auth — ไม่มีการส่งอีเมลจริง

- Authentication › Providers › Email: **เปิดใช้งาน** และ **ปิด "Confirm email"** (ไม่มีอีเมลจริงให้ยืนยัน)
- Authentication › URL Configuration: ใส่ Site URL เป็นโดเมนที่ deploy แอป
- Authentication › Rate Limits: คงค่า rate limit ของการ sign-in ไว้ และแนะนำเปิด **CAPTCHA** (Attack Protection)
  เพราะ PIN 4–6 หลักเดาได้ง่ายกว่ารหัสผ่านทั่วไป
- ถ้า Supabase ไม่รับโดเมน `.invalid` ให้ตั้ง `VITE_HANDLE_EMAIL_DOMAIN` เป็นโดเมนที่คุณเป็นเจ้าของ (ไม่ต้องมีกล่องอีเมล)
- Migration `20261027000001_handles.sql` เก็บ handle ใน `profiles.handle` (ไม่ซ้ำแบบไม่สนตัวพิมพ์เล็ก/ใหญ่)
  และยกเลิกสิทธิ์แก้ `display_name` จาก client เพื่อไม่ให้ใครตั้งชื่อปลอมเป็น ชื่อ#แท็ก ของคนอื่น

## 3. ตั้งค่า environment ของ frontend

สร้าง `.env.local` (ดูตัวอย่างใน `.env.example`):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

anon key เป็นคีย์สาธารณะโดยการออกแบบ ข้อมูลถูกป้องกันด้วย Row Level Security
**ห้ามใส่ service_role key หรือ secret ใดๆ ในตัวแปร `VITE_*`** เพราะจะถูกฝังใน JavaScript ฝั่งเบราว์เซอร์

## 4. ความปลอดภัยที่มีอยู่แล้ว

| ข้อมูล | การป้องกัน |
|---|---|
| `user_data` (ซิงก์) | RLS: อ่าน/เขียนได้เฉพาะแถวของตนเอง |
| `profiles` | อ่านชื่อที่แสดงได้ (ใช้ในห้องเกม) · ชื่อ = ชื่อ#แท็ก ที่ไม่ซ้ำ และ client แก้ไม่ได้ |
| `game_questions` | ไม่มี policy ให้ client — คำตอบอ่านจากเบราว์เซอร์ไม่ได้ |
| `room_questions` | เห็นเฉพาะสมาชิกห้อง และเฉพาะข้อที่ปล่อยแล้ว |
| คะแนน | คำนวณใน `submit_answer` จากเวลาเซิร์ฟเวอร์ — client เขียนตารางคะแนนโดยตรงไม่ได้ |

ทดสอบทั้งหมดนี้ได้ในเครื่องด้วย `scripts/test-db.sh` (ต้องมี PostgreSQL 14+ และ psql)

## 5. (ไม่บังคับ) Translation backend

Translator ทำงานแบบพจนานุกรมในเครื่องเสมอ ถ้าต้องการแปลทั้งประโยคผ่านบริการภายนอก
ให้สร้าง endpoint ฝั่งเซิร์ฟเวอร์ของคุณเอง (เช่น Supabase Edge Function) ที่เก็บ API key ไว้ใน environment ของเซิร์ฟเวอร์ แล้วตั้ง

```
VITE_TRANSLATE_ENDPOINT=https://<your-backend>/translate
```

สัญญา API: `POST { text, source: 'ko'|'th', target: 'ko'|'th' }` → `{ translation: string, provider: string }`
แอปจะแสดงผลนี้แยกจากผลวิเคราะห์ และติดป้ายว่าต้องตรวจสอบความถูกต้อง

## 6. (ยังไม่ได้พัฒนา) การแจ้งเตือนทางอีเมล / Push

Planner แจ้งเตือนงานค้างภายในแอปเมื่อเปิดใช้งาน ส่วนการแจ้งเตือนนอกแอปต้องมี:
- ตัวตั้งเวลาฝั่งเซิร์ฟเวอร์ (เช่น `pg_cron` หรือ Scheduled Edge Function)
- บริการส่งอีเมล (เช่น Resend / SendGrid) หรือ Web Push (VAPID keys + Service Worker)

ยังไม่มีปุ่มสำหรับฟีเจอร์นี้ในแอป เพราะยังไม่มีระบบรองรับ
