import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Cloud, Dices, Eye, EyeOff, HardDrive, KeyRound, LogIn, LogOut, RefreshCw, ShieldCheck, Trash2, UserPlus, UserRound, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { Segmented, Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import {
  changeLocalPin,
  cloudAvailable,
  cloudLogin,
  cloudRegister,
  createLocalProfile,
  deleteLocalProfile,
  findLocalProfile,
  guestHasData,
  localHandleTaken,
  loginLocal,
  logout,
  sessionHandle,
  useAccount,
  type LocalProfile,
} from '@/lib/account/accounts';
import { cleanName, cleanTag, formatHandle, handleKey, NAME_MAX, parseHandle, suggestTag, TAG_MAX, validateName, validatePin, validateTag, weakPin } from '@/lib/account/handle';
import { syncNow, useSync } from '@/lib/backend/sync';

type Kind = 'local' | 'cloud';

export function PinInput({ value, onChange, label, id, autoComplete, autoFocus }: { value: string; onChange: (v: string) => void; label: string; id: string; autoComplete: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="input pr-11 text-center text-lg tracking-[0.5em] tabular-nums"
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={autoComplete}
          maxLength={6}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••"
        />
        <button type="button" className="absolute inset-y-0 right-1 grid w-9 place-items-center text-muted hover:text-ink" onClick={() => setShow(!show)} aria-label={show ? 'ซ่อน PIN' : 'แสดง PIN'}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function KindPicker({ kind, setKind }: { kind: Kind; setKind: (k: Kind) => void }) {
  if (!cloudAvailable) return null;
  return (
    <div>
      <div className="label">ประเภทบัญชี</div>
      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { id: 'cloud', label: 'ออนไลน์ (ทุกอุปกรณ์)' },
          { id: 'local', label: 'เฉพาะเครื่องนี้' },
        ]}
      />
    </div>
  );
}

// ------------------------------------------------------------------ sign in

function SignIn({ onDone, initialPick }: { onDone: () => void; initialPick?: string }) {
  const profiles = useAccount((s) => s.profiles);
  const [picked, setPicked] = useState<LocalProfile | null>(() => profiles.find((p) => p.id === initialPick) ?? null);
  const [kind, setKind] = useState<Kind>(cloudAvailable && !picked ? 'cloud' : 'local');
  const [handle, setHandle] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => [...profiles].sort((a, b) => (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0)), [profiles]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parsed = picked ? { name: picked.name, tag: picked.tag } : parseHandle(handle);
      if (!parsed) throw new Error('พิมพ์ชื่อตามด้วย #แท็ก เช่น สมชาย#1234');
      const pinErr = validatePin(pin);
      if (pinErr) throw new Error(pinErr);
      if (kind === 'cloud') await cloudLogin({ ...parsed, pin });
      else {
        const p = picked ?? findLocalProfile(parsed.name, parsed.tag);
        if (!p) throw new Error(`ไม่พบ ${formatHandle(parsed.name, parsed.tag)} ในเครื่องนี้`);
        await loginLocal(p.id, pin);
      }
      toast.success(`ยินดีต้อนรับ ${picked ? formatHandle(picked.name, picked.tag) : formatHandle(parsed.name, parsed.tag)}`);
      onDone();
    } catch (err) {
      setPin('');
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <KindPicker
        kind={kind}
        setKind={(k) => {
          setKind(k);
          setPicked(null);
        }}
      />

      {kind === 'local' && sorted.length > 0 && (
        <div>
          <div className="label">บัญชีในเครื่องนี้</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {sorted.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPicked(picked?.id === p.id ? null : p)}
                aria-pressed={picked?.id === p.id}
                className={cn('flex items-center gap-3 rounded-xl border p-3 text-left transition', picked?.id === p.id ? 'border-lavender bg-lavender-soft' : 'border-border hover:bg-surface-2')}
              >
                <Avatar name={p.name} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted">#{p.tag}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!picked && (
        <div>
          <label className="label" htmlFor="in-handle">
            ชื่อ#แท็ก
          </label>
          <input id="in-handle" className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="เช่น สมชาย#1234" autoComplete="username" autoCapitalize="off" spellCheck={false} />
        </div>
      )}

      <PinInput id="in-pin" label="PIN (ตัวเลข 4–6 หลัก)" value={pin} onChange={setPin} autoComplete="current-password" autoFocus={!!picked} />

      <button className="btn-primary w-full" disabled={busy || pin.length < 4 || (!picked && !handle.includes('#'))}>
        <LogIn className="h-4 w-4" /> {busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
      </button>
      {kind === 'local' && <p className="text-xs text-muted">ลืม PIN ของบัญชีในเครื่อง: ไม่มีเซิร์ฟเวอร์ให้กู้คืน — ข้อมูลยังอยู่แต่เข้าไม่ได้ จึงควรจด PIN ไว้</p>}
    </form>
  );
}

// ------------------------------------------------------------------ create account

function Register({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<Kind>(cloudAvailable ? 'cloud' : 'local');
  const [name, setName] = useState('');
  const [tag, setTag] = useState(() => suggestTag('', () => false));
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [hasGuest] = useState(guestHasData);
  const [moveGuest, setMoveGuest] = useState(true);
  const [busy, setBusy] = useState(false);

  const nameErr = name ? validateName(name) : null;
  const tagErr = validateTag(tag);
  const takenHere = !nameErr && !tagErr && name && kind === 'local' && localHandleTaken(handleKey(name, tag));
  const pinErr = pin ? validatePin(pin) : null;
  const mismatch = pin2.length >= pin.length && pin2 !== pin && pin2.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== pin2) return toast.error('PIN ทั้งสองช่องไม่ตรงกัน');
    setBusy(true);
    try {
      const input = { name, tag, pin, moveGuest: hasGuest && moveGuest };
      if (kind === 'cloud') await cloudRegister(input);
      else await createLocalProfile(input);
      toast.success(`สร้างบัญชี ${formatHandle(name, tag)} แล้ว`);
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <KindPicker kind={kind} setKind={setKind} />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div>
          <label className="label" htmlFor="reg-name">
            ชื่อ (ภาษาอะไรก็ได้ · ไม่เกิน {NAME_MAX} ตัว)
          </label>
          <input id="reg-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น 하늘, สมชาย, Mint" maxLength={40} autoComplete="nickname" />
          {nameErr && <p className="mt-1 text-xs text-danger">{nameErr}</p>}
        </div>
        <div>
          <label className="label" htmlFor="reg-tag">
            แท็กหลัง # (ไม่เกิน {TAG_MAX} ตัว)
          </label>
          <div className="flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted">#</span>
              <input id="reg-tag" className="input pl-7" value={tag} onChange={(e) => setTag(cleanTag(e.target.value))} maxLength={TAG_MAX + 2} autoCapitalize="off" spellCheck={false} />
            </div>
            <button type="button" className="btn-secondary px-3" onClick={() => setTag(suggestTag(name, (k) => kind === 'local' && localHandleTaken(k)))} title="สุ่มแท็กใหม่" aria-label="สุ่มแท็กใหม่">
              <Dices className="h-4 w-4" />
            </button>
          </div>
          {tagErr && <p className="mt-1 text-xs text-danger">{tagErr}</p>}
        </div>
      </div>

      <div className="rounded-xl bg-surface-2 px-4 py-3">
        <div className="text-xs text-muted">ชื่อที่จะแสดง</div>
        <div className="truncate text-lg font-bold">
          {cleanName(name) || 'ชื่อของคุณ'}
          <span className="text-lavender">#{cleanTag(tag) || '????'}</span>
        </div>
        {takenHere ? (
          <p className="mt-1 text-xs text-danger">มีชื่อนี้ในเครื่องแล้ว — กดสุ่มแท็กหรือเปลี่ยนแท็ก</p>
        ) : (
          <p className="mt-1 text-xs text-muted">ชื่อซ้ำกับคนอื่นได้ แท็กหลัง # ทำให้ ชื่อ#แท็ก ไม่ซ้ำกัน {kind === 'cloud' ? '(ตรวจกับเซิร์ฟเวอร์ตอนสร้าง)' : '(ในเครื่องนี้)'}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PinInput id="reg-pin" label="ตั้ง PIN (ตัวเลข 4–6 หลัก)" value={pin} onChange={setPin} autoComplete="new-password" />
        <PinInput id="reg-pin2" label="ยืนยัน PIN" value={pin2} onChange={setPin2} autoComplete="new-password" />
      </div>
      {pinErr && pin.length >= 4 && <p className="-mt-2 text-xs text-danger">{pinErr}</p>}
      {mismatch && <p className="-mt-2 text-xs text-danger">PIN ทั้งสองช่องไม่ตรงกัน</p>}
      {!pinErr && pin.length >= 4 && weakPin(pin) && <p className="-mt-2 text-xs text-warning">PIN นี้เดาง่าย (เลขเรียงหรือเลขซ้ำ) — แนะนำให้เปลี่ยน</p>}

      {hasGuest && (
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--lavender))]" checked={moveGuest} onChange={(e) => setMoveGuest(e.target.checked)} />
          <span>
            ย้ายข้อมูลที่ฝึกไว้ตอนยังไม่ได้เข้าสู่ระบบ (ความคืบหน้า การ์ด โน้ต แผนการเรียน) มาไว้ในบัญชีนี้
            <span className="block text-xs text-muted">ถ้าไม่ย้าย ข้อมูลเดิมจะยังอยู่ในโหมดผู้เยี่ยมชม</span>
          </span>
        </label>
      )}

      <button className="btn-primary w-full" disabled={busy || !name || !!nameErr || !!tagErr || !!takenHere || !!validatePin(pin) || pin !== pin2}>
        <UserPlus className="h-4 w-4" /> {busy ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี'}
      </button>
    </form>
  );
}

// ------------------------------------------------------------------ signed in

function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky to-lavender font-bold text-white', size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-9 w-9 text-sm')}>
      {[...cleanName(name)][0]?.toUpperCase() ?? '?'}
    </span>
  );
}

function PinDialog({ open, title, confirmLabel, danger, withNew, onClose, onSubmit }: { open: boolean; title: string; confirmLabel: string; danger?: boolean; withNew?: boolean; onClose: () => void; onSubmit: (pin: string, newPin: string) => Promise<void> }) {
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => {
    setPin('');
    setNewPin('');
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title={title} size="sm">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit(pin, newPin);
            close();
          } catch (err) {
            toast.error((err as Error).message);
            setPin('');
          } finally {
            setBusy(false);
          }
        }}
      >
        <PinInput id="dlg-pin" label={withNew ? 'PIN ปัจจุบัน' : 'ยืนยันด้วย PIN'} value={pin} onChange={setPin} autoComplete="current-password" autoFocus />
        {withNew && <PinInput id="dlg-new" label="PIN ใหม่ (4–6 หลัก)" value={newPin} onChange={setNewPin} autoComplete="new-password" />}
        <button className={danger ? 'btn-danger w-full' : 'btn-primary w-full'} disabled={busy || pin.length < 4 || (withNew && newPin.length < 4)}>
          {confirmLabel}
        </button>
      </form>
    </Modal>
  );
}

function SignedIn() {
  const session = useAccount((s) => s.session)!;
  const profiles = useAccount((s) => s.profiles);
  const sync = useSync();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'pin' | 'delete' | null>(null);
  const others = profiles.filter((p) => !(session.kind === 'local' && p.id === session.id));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="card-pad lg:col-span-2">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={session.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-bold">
              {session.name}
              <span className="text-lavender">#{session.tag}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {session.kind === 'cloud' ? (
                <Badge tone="success">
                  <Cloud className="mr-1 inline h-3 w-3" /> บัญชีออนไลน์ · ซิงก์ข้ามอุปกรณ์
                </Badge>
              ) : (
                <Badge tone="sky">
                  <HardDrive className="mr-1 inline h-3 w-3" /> บัญชีในเครื่องนี้
                </Badge>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted">
          ความคืบหน้า Flashcards โน้ต แผนการเรียน ผลสอบ และเพลงในเกมแปลเนื้อเพลง ถูกบันทึกแยกไว้ในบัญชีนี้ — ออกจากระบบแล้วคนอื่นที่ใช้เครื่องเดียวกันจะไม่เห็นข้อมูลของคุณในแอป
        </p>

        {session.kind === 'cloud' && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">
              ซิงก์: {sync.status === 'syncing' ? 'กำลังซิงก์…' : sync.status === 'error' ? `ผิดพลาด (${sync.error})` : sync.lastSyncedAt ? `ล่าสุด ${new Date(sync.lastSyncedAt).toLocaleTimeString('th-TH')}` : 'ยังไม่ได้ซิงก์'}
            </span>
            <button className="btn-secondary btn-sm" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
              <RefreshCw className="h-4 w-4" /> ซิงก์ตอนนี้
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={async () => {
              await logout();
              toast.info('ออกจากระบบแล้ว');
              navigate('/account');
            }}
          >
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </button>
          {session.kind === 'local' && (
            <>
              <button className="btn-secondary" onClick={() => setDialog('pin')}>
                <KeyRound className="h-4 w-4" /> เปลี่ยน PIN
              </button>
              <button className="btn-ghost text-danger" onClick={() => setDialog('delete')}>
                <Trash2 className="h-4 w-4" /> ลบบัญชีนี้
              </button>
            </>
          )}
        </div>
      </Card>

      <Card className="card-pad">
        <CardHeader title="สลับบัญชี" icon={<Users className="h-5 w-5" />} subtitle={others.length ? 'บัญชีอื่นในเครื่องนี้' : 'ยังไม่มีบัญชีอื่นในเครื่องนี้'} />
        <div className="space-y-2">
          {others.map((p) => (
            <button
              key={p.id}
              className="flex w-full items-center gap-3 rounded-xl border border-border p-2.5 text-left hover:bg-surface-2"
              onClick={async () => {
                await logout();
                navigate('/account', { state: { pick: p.id } });
              }}
            >
              <Avatar name={p.name} />
              <span className="truncate text-sm font-medium">{formatHandle(p.name, p.tag)}</span>
            </button>
          ))}
          <button
            className="btn-secondary w-full"
            onClick={async () => {
              await logout();
              navigate('/account', { state: { tab: 'register' } });
            }}
          >
            <UserPlus className="h-4 w-4" /> เพิ่มบัญชีใหม่
          </button>
        </div>
      </Card>

      <PinDialog
        open={dialog === 'pin'}
        title="เปลี่ยน PIN"
        confirmLabel="บันทึก PIN ใหม่"
        withNew
        onClose={() => setDialog(null)}
        onSubmit={async (pin, newPin) => {
          await changeLocalPin(session.id, pin, newPin);
          toast.success('เปลี่ยน PIN แล้ว');
        }}
      />
      <PinDialog
        open={dialog === 'delete'}
        title={`ลบบัญชี ${sessionHandle(session)}?`}
        confirmLabel="ลบบัญชีและข้อมูลทั้งหมด"
        danger
        onClose={() => setDialog(null)}
        onSubmit={async (pin) => {
          await deleteLocalProfile(session.id, pin);
          toast.info('ลบบัญชีแล้ว');
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ page

export default function Account() {
  const session = useAccount((s) => s.session);
  const navigate = useNavigate();
  const location = useLocation();
  const st = location.state as { tab?: 'login' | 'register'; pick?: string } | null;

  return <AccountView key={location.key} session={!!session} initialTab={st?.tab ?? (useAccount.getState().profiles.length || cloudAvailable ? 'login' : 'register')} pick={st?.pick} onDone={() => navigate('/')} />;
}

function AccountView({ session, initialTab, pick, onDone }: { session: boolean; initialTab: 'login' | 'register'; pick?: string; onDone: () => void }) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);

  return (
    <div>
      <PageHeader title="บัญชีผู้ใช้" subtitle="เข้าสู่ระบบด้วย ชื่อ#แท็ก และ PIN เพื่อให้ข้อมูลที่ฝึกไว้ถูกจำไว้ในบัญชีของคุณ" />

      {session ? (
        <SignedIn />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="card-pad lg:col-span-2">
            <Tabs
              className="mb-5"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'login', label: 'เข้าสู่ระบบ' },
                { id: 'register', label: 'สร้างบัญชีใหม่' },
              ]}
            />
            {tab === 'login' ? <SignIn onDone={onDone} initialPick={pick} /> : <Register onDone={onDone} />}
          </Card>

          <div className="space-y-4">
            <Card className="card-pad">
              <CardHeader title="ตอนนี้: ผู้เยี่ยมชม" icon={<UserRound className="h-5 w-5" />} />
              <p className="text-sm text-muted">ใช้งานได้ทุกอย่างโดยไม่ต้องเข้าสู่ระบบ แต่ข้อมูลจะเป็นของ “ผู้เยี่ยมชม” ในเบราว์เซอร์นี้ ใครใช้เครื่องนี้ก็เห็นได้</p>
              <Link to="/" className="btn-ghost btn-sm mt-2">
                ใช้งานต่อโดยไม่เข้าสู่ระบบ
              </Link>
            </Card>
            <Card className="card-pad">
              <CardHeader title="ความปลอดภัย" icon={<ShieldCheck className="h-5 w-5" />} />
              <ul className="space-y-2 text-sm text-muted">
                <li>• PIN ไม่ถูกเก็บเป็นตัวเลขตรงๆ — เก็บเฉพาะค่าที่เข้ารหัสทางเดียว (PBKDF2)</li>
                <li>• ใส่ PIN ผิด 5 ครั้ง จะถูกพักการเข้าสู่ระบบชั่วคราว และนานขึ้นเรื่อยๆ</li>
                <li>• บัญชีในเครื่องแยกข้อมูลของแต่ละคนในแอป แต่ไม่ได้เข้ารหัสข้อมูลในเบราว์เซอร์ — อย่าใช้เก็บความลับ</li>
                {cloudAvailable ? (
                  <li>• บัญชีออนไลน์: ข้อมูลบนเซิร์ฟเวอร์อ่าน/แก้ได้เฉพาะเจ้าของบัญชี (Row Level Security)</li>
                ) : (
                  <li>• บัญชีออนไลน์ (ซิงก์ข้ามอุปกรณ์) จะเปิดใช้เมื่อผู้ดูแลตั้งค่าเซิร์ฟเวอร์ — ตอนนี้เป็นบัญชีในเครื่องนี้เท่านั้น</li>
                )}
              </ul>
            </Card>
          </div>
        </div>
      )}
      {!session && !cloudAvailable && (
        <Notice className="mt-4">
          บัญชีในเครื่องนี้ใช้ได้เฉพาะเบราว์เซอร์นี้ ถ้าจะย้ายไปเครื่องอื่น ใช้ <Link className="text-lavender underline" to="/settings">Export / Import ข้อมูล</Link> ในหน้าตั้งค่า
        </Notice>
      )}
    </div>
  );
}
