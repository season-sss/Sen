import { lazy, Suspense, Component, type ReactNode } from 'react';
import { Route, Routes, Link } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Toaster } from './components/ui/Toast';
import { ErrorState, PageSkeleton } from './components/ui/States';
import { useApplyTheme } from './hooks/useTheme';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Curriculum = lazy(() => import('./pages/Curriculum'));
const LessonPage = lazy(() => import('./pages/LessonPage'));
const AssessmentPage = lazy(() => import('./pages/AssessmentPage'));
const Vocabulary = lazy(() => import('./pages/Vocabulary'));
const Grammar = lazy(() => import('./pages/Grammar'));
const GrammarDetail = lazy(() => import('./pages/GrammarDetail'));
const ConjugationLab = lazy(() => import('./pages/ConjugationLab'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const FlashcardStudy = lazy(() => import('./pages/FlashcardStudy'));
const Translator = lazy(() => import('./pages/Translator'));
const Practice = lazy(() => import('./pages/Practice'));
const Topik = lazy(() => import('./pages/Topik'));
const Games = lazy(() => import('./pages/Games'));
const GamePlay = lazy(() => import('./pages/GamePlay'));
const OnlineGame = lazy(() => import('./pages/OnlineGame'));
const Planner = lazy(() => import('./pages/Planner'));
const Notes = lazy(() => import('./pages/Notes'));
const Progress = lazy(() => import('./pages/Progress'));
const Settings = lazy(() => import('./pages/Settings'));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <ErrorState
          message={this.state.error.message}
          action={
            <button className="btn-primary" onClick={() => this.setState({ error: null })}>
              ลองอีกครั้ง
            </button>
          }
        />
      );
    return this.props.children;
  }
}

function NotFound() {
  return (
    <ErrorState
      title="ไม่พบหน้านี้"
      message="ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายแล้ว"
      action={
        <Link className="btn-primary" to="/">
          กลับหน้าหลัก
        </Link>
      }
    />
  );
}

export default function App() {
  useApplyTheme();
  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/learn/:lessonId" element={<LessonPage />} />
            <Route path="/assessment/:kind/:targetId" element={<AssessmentPage />} />
            <Route path="/vocabulary" element={<Vocabulary />} />
            <Route path="/grammar" element={<Grammar />} />
            <Route path="/grammar/:id" element={<GrammarDetail />} />
            <Route path="/conjugation" element={<ConjugationLab />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/flashcards/study" element={<FlashcardStudy />} />
            <Route path="/translator" element={<Translator />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/topik" element={<Topik />} />
            <Route path="/games" element={<Games />} />
            <Route path="/games/play/:gameId" element={<GamePlay />} />
            <Route path="/games/online" element={<OnlineGame />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster />
    </AppShell>
  );
}
