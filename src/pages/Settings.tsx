import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Upload, RotateCcw, Cloud, CheckCircle2, XCircle, Volume2, RefreshCw, UserRound } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { Segmented, Switch } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/States';
import { LevelBadge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { useSettings, type ThaiReadingPref, type ThemePref } from '@/store/settings';
import { STORE_KEYS as KEYS, rehydrateAllStores } from '@/store/registry';
import { sessionHandle, useAccount } from '@/lib/account/accounts';
import { syncNow, useSync } from '@/lib/backend/sync';
import { backendConfigured } from '@/lib/backend/client';
import { isRemoteAvailable } from '@/lib/translator';
import { speak } from '@/lib/tts';
import { useTtsAvailable } from '@/hooks/useTts';
import { safeStorage, STORE_PREFIX } from '@/store/persist';
import { VOCABULARY } from '@/data/vocabulary';
import { GRAMMAR } from '@/data/grammar';
import { ALL_LESSONS } from '@/data/curriculum';
import { TOPIK1_ALL } from '@/data/topik/topik1';
import { TOPIK2_ALL, TOPIK2_WRITING } from '@/data/topik/topik2';
import { TRACK3_QUESTIONS } from '@/data/topik/track3';
import type { Level } from '@/data/types';


function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted">{detail}</div>
      </div>
    </li>
  );
}

function AccountCard() {
  const session = useAccount((st) => st.session);
  const sync = useSync();
  return (
    <Card className="card-pad">
      <CardHeader title="บัญชีผู้ใช้" icon={session?.kind === 'cloud' ? <Cloud className="h-5 w-5" /> : <UserRound className="h-5 w-5" />} subtitle={session ? sessionHandle(session) : 'ผู้เยี่ยมชม (ยังไม่ได้เข้าสู่ระบบ)'} />
      <p className="text-sm text-muted">
        {session
          ? session.kind === 'cloud'
            ? 'ข้อมูลของบัญชีนี้ซิงก์ข้ามอุปกรณ์อัตโนมัติ'
            : 'ข้อมูลของบัญชีนี้เก็บแยกไว้ในเบราว์เซอร์นี้ — ใช้ Export ด้านล่างเพื่อย้ายไปเครื่องอื่น'
          : 'เข้าสู่ระบบด้วย ชื่อ#แท็ก และ PIN เพื่อให้ข้อมูลที่ฝึกถูกจำไว้ในบัญชีของคุณ และแยกจากคนอื่นที่ใช้เครื่องเดียวกัน'}
      </p>
      {session?.kind === 'cloud' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">
            ซิงก์: {sync.status === 'syncing' ? 'กำลังซิงก์…' : sync.status === 'error' ? `ผิดพลาด (${sync.error})` : sync.lastSyncedAt ? `ล่าสุด ${new Date(sync.lastSyncedAt).toLocaleTimeString('th-TH')}` : 'ยังไม่ได้ซิงก์'}
          </span>
          <button className="btn-secondary btn-sm" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
            <RefreshCw className="h-4 w-4" /> ซิงก์ตอนนี้
          </button>
        </div>
      )}
      <Link to="/account" className="btn-secondary mt-4">
        {session ? 'จัดการบัญชี / ออกจากระบบ' : 'เข้าสู่ระบบ / สร้างบัญชี'}
      </Link>
    </Card>
  );
}

export default function Settings() {
  const s = useSettings();
  const handle = useAccount((st) => sessionHandle(st.session));
  const tts = useTtsAvailable();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportAll = () => {
    const data = Object.fromEntries(KEYS.map((k) => [k, JSON.parse((safeStorage.getItem(k) as string | null) ?? 'null')]));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: 'haneul-backup', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' }));
    a.download = `haneul-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <PageHeader title="ตั้งค่า" subtitle="บัญชี การแสดงผล การเรียน และข้อมูลของคุณ" />
      <div className="grid gap-4 lg:grid-cols-2">
        <AccountCard />

        <Card className="card-pad">
          <CardHeader title="การเรียน" />
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="st-name">
                ชื่อเล่น (แสดงบนแดชบอร์ด)
              </label>
              <input id="st-name" className="input" value={s.displayName} onChange={(e) => s.set({ displayName: e.target.value })} maxLength={30} />
            </div>
            <div>
              <div className="label">ระดับปัจจุบัน (ใช้แนะนำบทเรียนถัดไป)</div>
              <div className="flex flex-wrap gap-1.5">
                {(['L0', 'A1', 'A2', 'B1', 'B2', 'ADV'] as Level[]).map((l) => (
                  <button key={l} className={`chip ${s.currentLevel === l ? 'chip-active' : ''}`} onClick={() => s.set({ currentLevel: l })} aria-pressed={s.currentLevel === l}>
                    <LevelBadge level={l} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="st-goal">
                เป้าหมายรายวัน: {s.dailyGoalMinutes} นาที
              </label>
              <input id="st-goal" type="range" min={5} max={180} step={5} value={s.dailyGoalMinutes} onChange={(e) => s.set({ dailyGoalMinutes: Number(e.target.value) })} className="w-full accent-[rgb(var(--lavender))]" />
            </div>
            <div>
              <label className="label" htmlFor="st-new">
                การ์ดใหม่ต่อวัน: {s.newCardsPerDay} ใบ
              </label>
              <input id="st-new" type="range" min={0} max={100} step={5} value={s.newCardsPerDay} onChange={(e) => s.set({ newCardsPerDay: Number(e.target.value) })} className="w-full accent-[rgb(var(--lavender))]" />
            </div>
          </div>
        </Card>

        <Card className="card-pad">
          <CardHeader title="การแสดงผล" />
          <div className="space-y-4">
            <div>
              <div className="label">ธีม</div>
              <Segmented<ThemePref>
                value={s.theme}
                onChange={(v) => s.set({ theme: v })}
                options={[
                  { id: 'system', label: 'ตามระบบ' },
                  { id: 'light', label: 'สว่าง' },
                  { id: 'dark', label: 'มืด' },
                ]}
              />
            </div>
            <div>
              <div className="label">คำอ่านภาษาไทย</div>
              <Segmented<ThaiReadingPref>
                value={s.thaiReading}
                onChange={(v) => s.set({ thaiReading: v })}
                options={[
                  { id: 'always', label: 'แสดงเสมอ' },
                  { id: 'tap', label: 'แตะเพื่อดู' },
                  { id: 'never', label: 'ไม่แสดง' },
                ]}
              />
              <p className="mt-1 text-xs text-muted">คำอ่านไทยเป็นการประมาณเสียง แนะนำให้ค่อยๆ ลดการใช้เมื่ออ่านฮันกึลคล่อง</p>
            </div>
            <Switch checked={s.showRomanization} onChange={(v) => s.set({ showRomanization: v })} label="แสดง Romanization" />
            <div>
              <label className="label" htmlFor="st-rate">
                ความเร็วเสียงอ่าน: {s.ttsRate.toFixed(1)}×
              </label>
              <div className="flex items-center gap-2">
                <input id="st-rate" type="range" min={0.5} max={1.3} step={0.1} value={s.ttsRate} onChange={(e) => s.set({ ttsRate: Number(e.target.value) })} className="flex-1 accent-[rgb(var(--lavender))]" />
                <button className="btn-secondary btn-sm" disabled={!tts} onClick={() => speak('안녕하세요. 만나서 반가워요.', { rate: s.ttsRate })}>
                  <Volume2 className="h-4 w-4" /> ทดสอบ
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="card-pad">
          <CardHeader title="สถานะระบบ" subtitle="แสดงตามความสามารถที่ใช้งานได้จริงบนอุปกรณ์และการตั้งค่านี้" />
          <ul className="divide-y divide-border">
            <Status ok label="บันทึกข้อมูลในเครื่อง (Local-first)" detail="ความคืบหน้า Flashcards Notes Planner และประวัติ บันทึกในเบราว์เซอร์นี้" />
            <Status ok label="บัญชีในเครื่อง (ชื่อ#แท็ก + PIN)" detail="หลายคนใช้เครื่องเดียวกันได้ ข้อมูลแยกตามบัญชี" />
            <Status ok={backendConfigured} label="บัญชีออนไลน์ / ซิงก์ข้ามอุปกรณ์ (Supabase)" detail={backendConfigured ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้งค่า — ต้องกำหนด VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY'} />
            <Status ok={backendConfigured} label="เกมออนไลน์หลายผู้เล่น (Realtime)" detail={backendConfigured ? 'พร้อมใช้งานเมื่อเข้าสู่ระบบ' : 'ต้องตั้งค่า Backend ก่อน · โหมดคนเดียวและเครื่องเดียวใช้ได้เสมอ'} />
            <Status ok={tts} label="เสียงอ่านภาษาเกาหลี (Text-to-Speech)" detail={tts ? 'พบเสียงภาษาเกาหลีในอุปกรณ์' : 'ไม่พบเสียงภาษาเกาหลี — ติดตั้งภาษาเกาหลีในระบบปฏิบัติการเพื่อใช้ฟีเจอร์ฟัง'} />
            <Status ok={isRemoteAvailable()} label="แปลทั้งประโยคผ่าน Translation backend" detail={isRemoteAvailable() ? 'ตั้งค่าแล้ว' : 'ไม่ได้ตั้งค่า — ใช้ Reading Assistant แบบพจนานุกรมของ HANEUL'} />
            <Status ok={false} label="แจ้งเตือนทางอีเมล / Push" detail="ยังไม่ได้พัฒนา — ต้องใช้บริการส่งอีเมลหรือ Web Push + ตัวตั้งเวลาฝั่งเซิร์ฟเวอร์ (ดู docs) · ตอนนี้แจ้งเตือนงานค้างภายในแอป" />
          </ul>
        </Card>

        <Card className="card-pad">
          <CardHeader title="ข้อมูลของคุณ" subtitle="สำรอง กู้คืน หรือล้างข้อมูลในเครื่อง" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={exportAll}>
              <Download className="h-4 w-4" /> Export ข้อมูลทั้งหมด
            </button>
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import ข้อมูลสำรอง
            </button>
            <button className="btn-ghost text-danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-4 w-4" /> ล้างข้อมูลทั้งหมด
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const json = JSON.parse(await f.text());
                if (json.format !== 'haneul-backup' || typeof json.data !== 'object') throw new Error('ไม่ใช่ไฟล์สำรองของ HANEUL');
                for (const k of KEYS) if (json.data[k]) safeStorage.setItem(k, JSON.stringify(json.data[k]));
                await rehydrateAllStores();
                toast.success('กู้คืนข้อมูลแล้ว');
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                e.target.value = '';
              }
            }}
          />
          <Notice className="mt-3">Export / Import / ล้างข้อมูล ทำกับ{handle ? `บัญชี ${handle}` : 'ข้อมูลผู้เยี่ยมชม'}เท่านั้น · ข้อมูลเก็บภายใต้คีย์ <code>{STORE_PREFIX}*</code> ในเบราว์เซอร์นี้ การล้างข้อมูลเบราว์เซอร์จะทำให้ข้อมูลหาย หากไม่ได้ Export หรือซิงก์ไว้</Notice>
        </Card>

        <Card className="card-pad lg:col-span-2">
          <CardHeader title="เกี่ยวกับเนื้อหา" />
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <li className="rounded-xl bg-surface-2 p-3">
              <b>{VOCABULARY.length.toLocaleString()}</b> คำศัพท์ (A1–B2) พร้อมประโยคตัวอย่าง
            </li>
            <li className="rounded-xl bg-surface-2 p-3">
              <b>{GRAMMAR.length}</b> หัวข้อไวยากรณ์ พร้อมแบบฝึกหัด
            </li>
            <li className="rounded-xl bg-surface-2 p-3">
              <b>{ALL_LESSONS.length}</b> บทเรียนใน Curriculum Map
            </li>
            <li className="rounded-xl bg-surface-2 p-3">
              <b>{TOPIK1_ALL.length + TOPIK2_ALL.length + TOPIK2_WRITING.length + TRACK3_QUESTIONS.length}</b> ข้อสอบรูปแบบ TOPIK ที่เขียนขึ้นใหม่
            </li>
            <li className="rounded-xl bg-surface-2 p-3">Conjugation Engine แบบกฎ ทดสอบด้วยชุดทดสอบอัตโนมัติ</li>
            <li className="rounded-xl bg-surface-2 p-3">คำแปลและประโยคเขียนเพื่อการเรียน อาจมีข้อผิดพลาดได้ — แจ้งปรับปรุงผ่านผู้ดูแลระบบ</li>
          </ul>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={`ล้างข้อมูลของ${handle ? ` ${handle}` : 'ผู้เยี่ยมชม'}?`}
        message="ความคืบหน้า Flashcards Notes แผนการเรียน เพลง และประวัติทั้งหมดของบัญชีนี้ในเบราว์เซอร์นี้จะถูกลบ (บัญชีอื่นและข้อมูลบนคลาวด์ไม่ถูกลบ)"
        danger
        confirmLabel="ล้างข้อมูล"
        onConfirm={() => {
          for (const k of KEYS) safeStorage.removeItem(k);
          location.reload();
        }}
      />
    </div>
  );
}
