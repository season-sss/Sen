import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  BookOpen,
  BookMarked,
  FlaskConical,
  Layers,
  Languages,
  Target,
  GraduationCap,
  Gamepad2,
  CalendarDays,
  NotebookPen,
  LineChart,
  Settings,
  MoreHorizontal,
  Flame,
  Cloud,
  HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { useProgress } from '@/store/progress';
import { computeStreak } from '@/lib/planner/planner';
import { today } from '@/lib/util/date';
import { useAuth } from '@/lib/backend/auth';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'เรียน',
    items: [
      { to: '/', label: 'แดชบอร์ด', icon: LayoutDashboard },
      { to: '/curriculum', label: 'หลักสูตร', icon: Map },
      { to: '/vocabulary', label: 'คำศัพท์', icon: BookOpen },
      { to: '/grammar', label: 'ไวยากรณ์', icon: BookMarked },
      { to: '/conjugation', label: 'Conjugation Lab', icon: FlaskConical },
    ],
  },
  {
    title: 'ฝึกฝน',
    items: [
      { to: '/flashcards', label: 'Flashcards', icon: Layers },
      { to: '/practice', label: 'Practice Zone', icon: Target },
      { to: '/topik', label: 'TOPIK Center', icon: GraduationCap },
      { to: '/games', label: 'Game Center', icon: Gamepad2 },
    ],
  },
  {
    title: 'เครื่องมือ',
    items: [
      { to: '/translator', label: 'แปลและช่วยอ่าน', icon: Languages },
      { to: '/planner', label: 'Student Planner', icon: CalendarDays },
      { to: '/notes', label: 'Notes', icon: NotebookPen },
    ],
  },
  {
    title: 'ติดตามผล',
    items: [
      { to: '/progress', label: 'ความก้าวหน้า', icon: LineChart },
      { to: '/settings', label: 'โปรไฟล์และตั้งค่า', icon: Settings },
    ],
  },
];

const BOTTOM: NavItem[] = [
  { to: '/', label: 'หน้าหลัก', icon: LayoutDashboard },
  { to: '/curriculum', label: 'หลักสูตร', icon: Map },
  { to: '/flashcards', label: 'การ์ด', icon: Layers },
  { to: '/games', label: 'เกม', icon: Gamepad2 },
];

function Logo({ compact }: { compact?: boolean }) {
  return (
    <NavLink to="/" className="flex items-center gap-2.5" aria-label="HANEUL หน้าหลัก">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky to-lavender text-lg font-bold text-white shadow-card" lang="ko">
        하
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold tracking-wide text-navy">HANEUL</span>
          <span className="block text-[11px] text-muted">Korean Learning Studio · 하늘</span>
        </span>
      )}
    </NavLink>
  );
}

function useStreak() {
  const activity = useProgress((s) => s.activity);
  const days = Object.entries(activity)
    .filter(([, a]) => a.answers > 0 || a.minutes > 0 || a.lessons > 0 || a.reviews > 0)
    .map(([d]) => d);
  return computeStreak(days, today());
}

function AccountChip() {
  const { user, configured } = useAuth();
  return (
    <NavLink to="/settings" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted hover:bg-surface-2">
      {user ? <Cloud className="h-4 w-4 text-success" /> : <HardDrive className="h-4 w-4" />}
      <span className="truncate">{user ? user.email : configured ? 'ยังไม่ได้เข้าสู่ระบบ (เก็บข้อมูลในเครื่อง)' : 'Local mode · เก็บข้อมูลในเครื่องนี้'}</span>
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const streak = useStreak();
  const location = useLocation();
  const inBottom = BOTTOM.some((b) => (b.to === '/' ? location.pathname === '/' : location.pathname.startsWith(b.to)));

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lift">
        ข้ามไปยังเนื้อหา
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/70 backdrop-blur lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="เมนูหลัก">
          {NAV_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{g.title}</div>
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === '/'}
                  className={({ isActive }) =>
                    cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-lavender-soft text-lavender' : 'text-ink/80 hover:bg-surface-2 hover:text-ink')
                  }
                >
                  <it.icon className="h-[18px] w-[18px]" aria-hidden />
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-border p-3">
          <div className="flex items-center gap-2 px-3 py-1 text-sm">
            <Flame className={cn('h-4 w-4', streak ? 'text-orange-500' : 'text-muted')} />
            <span className="font-semibold">{streak}</span>
            <span className="text-muted">วันติดต่อกัน</span>
          </div>
          <AccountChip />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/85 px-4 py-2.5 backdrop-blur lg:hidden" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        <Logo />
        <div className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm shadow-card" aria-label={`เรียนต่อเนื่อง ${streak} วัน`}>
          <Flame className={cn('h-4 w-4', streak ? 'text-orange-500' : 'text-muted')} />
          <span className="font-semibold">{streak}</span>
        </div>
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto w-full max-w-6xl animate-fade-up" key={location.pathname.split('/')[1]}>
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden safe-bottom" aria-label="เมนูด้านล่าง">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {BOTTOM.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === '/'}
              className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-lavender' : 'text-muted')}
            >
              <it.icon className="h-5 w-5" aria-hidden />
              {it.label}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)} className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', !inBottom ? 'text-lavender' : 'text-muted')}>
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            เพิ่มเติม
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="เมนูทั้งหมด">
        <div className="space-y-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mb-2 text-xs font-semibold text-muted">{g.title}</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {g.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.to === '/'}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn('flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium', isActive ? 'border-lavender bg-lavender-soft text-lavender' : 'border-border bg-surface')
                    }
                  >
                    <it.icon className="h-5 w-5" aria-hidden />
                    {it.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          <AccountChip />
        </div>
      </Modal>
    </div>
  );
}
