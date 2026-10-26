import { Link } from 'react-router-dom';
import { Users, User, Wifi, WifiOff, Trophy, Headphones, Music2, ChevronRight } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Notice, EmptyState } from '@/components/ui/States';
import { GAMES, GAME_BY_ID } from '@/lib/games';
import { useGameHistory } from '@/store/history';
import { backendConfigured } from '@/lib/backend/client';
import { useAuth } from '@/lib/backend/auth';
import { useTtsAvailable } from '@/hooks/useTts';
import { useLyrics } from '@/store/lyrics';
import { BUILTIN_SONGS } from '@/data/lyrics/songs';
import { formatThaiDate, toISODate } from '@/lib/util/date';

export default function Games() {
  const results = useGameHistory((s) => s.results);
  const user = useAuth((s) => s.user);
  const tts = useTtsAvailable();
  const recent = [...results].reverse().slice(0, 8);
  const mySongs = useLyrics((s) => s.songs.length);

  return (
    <div>
      <PageHeader
        title="Game Center"
        subtitle="เล่นคนเดียว เล่นกับเพื่อนบนเครื่องเดียวกัน หรือแข่งออนไลน์ — ทุกเกมใช้คำถามจากคลังคำศัพท์และไวยากรณ์ของ HANEUL"
        action={
          <Link to="/games/online" className="btn-primary">
            <Wifi className="h-4 w-4" /> เล่นออนไลน์กับเพื่อน
          </Link>
        }
      />

      {!backendConfigured ? (
        <Notice tone="warning" className="mb-5">
          <WifiOff className="mr-1 inline h-4 w-4" />
          โหมดออนไลน์ต้องตั้งค่า Backend (Supabase Realtime) ก่อน — ตอนนี้เล่นได้แบบ <b>คนเดียว</b> และ <b>หลายคนบนเครื่องเดียวกัน</b> (ผลัดกันตอบ)
        </Notice>
      ) : !user ? (
        <Notice className="mb-5">
          <Link to="/account" className="font-semibold text-lavender underline">
            เข้าสู่ระบบด้วยบัญชีออนไลน์
          </Link>{' '}
          เพื่อสร้างหรือเข้าห้องเล่นออนไลน์
        </Notice>
      ) : null}

      <Link to="/games/lyrics" className="card group mb-4 flex items-center gap-4 overflow-hidden border-lavender/40 bg-gradient-to-br from-lavender-soft via-surface to-sky-soft p-4 transition hover:shadow-lift sm:p-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lavender to-sky text-white shadow-card">
          <Music2 className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">Lyrics Translation</span>
            <span lang="ko" className="ko text-sm text-muted">
              가사 번역
            </span>
            <Badge tone="lavender">ใหม่</Badge>
          </div>
          <p className="text-sm text-muted">อ่านเนื้อเพลงภาษาเกาหลี แล้วเลือกคำแปลที่ถูกจาก 4 ตัวเลือก · เพิ่มเพลงของคุณเองได้ ({BUILTIN_SONGS.length + mySongs} เพลง)</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5" />
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => {
          const blocked = g.requiresTts && !tts;
          return (
            <div key={g.id} className="card flex flex-col p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-lavender to-sky text-white shadow-card">
                  <Icon name={g.icon} className="h-5 w-5" />
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {g.coop && <Badge tone="lavender">Co-op</Badge>}
                  {g.online ? <Badge tone="sky">ออนไลน์ได้</Badge> : <Badge>ออฟไลน์</Badge>}
                </div>
              </div>
              <div className="font-semibold">{g.name}</div>
              <div lang="ko" className="ko text-xs text-muted">
                {g.nameKo}
              </div>
              <p className="mt-1 flex-1 text-sm text-muted">{g.description}</p>
              {blocked && (
                <p className="mt-2 flex items-center gap-1 text-xs text-warning">
                  <Headphones className="h-3.5 w-3.5" /> อุปกรณ์นี้ไม่มีเสียงอ่านภาษาเกาหลี จึงเล่นเกมนี้ไม่ได้
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Link to={`/games/play/${g.id}?mode=solo`} className={`btn-primary btn-sm flex-1 ${blocked ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={blocked}>
                  <User className="h-3.5 w-3.5" /> คนเดียว
                </Link>
                <Link to={`/games/play/${g.id}?mode=local`} className={`btn-secondary btn-sm flex-1 ${blocked ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={blocked}>
                  <Users className="h-3.5 w-3.5" /> หลายคน (เครื่องเดียว)
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="card-pad mt-5">
        <CardHeader title="ประวัติการเล่น" icon={<Trophy className="h-5 w-5" />} />
        {recent.length === 0 ? (
          <EmptyState title="ยังไม่มีประวัติการเล่น" message="ผลการเล่นทุกโหมดจะถูกบันทึกที่นี่" />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <div className="font-medium">
                    {GAME_BY_ID[r.gameId].name} <span className="text-xs text-muted">· {r.mode === 'solo' ? 'คนเดียว' : r.mode === 'local' ? 'เครื่องเดียว' : 'ออนไลน์'} · {r.level}</span>
                  </div>
                  <div className="text-xs text-muted">{formatThaiDate(toISODate(new Date(r.at)))}</div>
                </div>
                <div className="text-right text-xs">
                  {r.players
                    .slice()
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3)
                    .map((p) => (
                      <div key={p.name}>
                        {p.name}: <b>{p.score}</b>
                      </div>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
