import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { backendConfigured, supabase } from './client';

interface AuthState {
  configured: boolean;
  ready: boolean;
  user: User | null;
  session: Session | null;
  displayName: string | null;
}

export const useAuth = create<AuthState>(() => ({
  configured: backendConfigured,
  ready: !backendConfigured,
  user: null,
  session: null,
  displayName: null,
}));

let started = false;
export function initAuth() {
  if (started || !supabase) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => {
    useAuth.setState({ session: data.session, user: data.session?.user ?? null, ready: true });
    if (data.session) void loadProfile(data.session.user.id);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ session, user: session?.user ?? null, ready: true });
    if (session) void loadProfile(session.user.id);
    else useAuth.setState({ displayName: null });
  });
}

async function loadProfile(userId: string) {
  if (!supabase) return;
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  useAuth.setState({ displayName: (data?.display_name as string | undefined) ?? null });
}

function requireClient() {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า Backend (Supabase) — ดูวิธีตั้งค่าใน docs/BACKEND_SETUP.md');
  return supabase;
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await requireClient().auth.signUp({ email, password, options: { data: { display_name: displayName } } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string) {
  const { error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await requireClient().auth.signOut();
}

export async function updateDisplayName(name: string) {
  const c = requireClient();
  const user = useAuth.getState().user;
  if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const { error } = await c.from('profiles').update({ display_name: name }).eq('id', user.id);
  if (error) throw error;
  useAuth.setState({ displayName: name });
}
