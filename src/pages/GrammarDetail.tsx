import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GRAMMAR_BY_ID } from '@/data/grammar';
import { GrammarArticle } from '@/components/learn/GrammarArticle';
import { QuizRunner } from '@/components/learn/QuizRunner';
import { ErrorState } from '@/components/ui/States';
import { grammarQuiz } from '@/lib/quiz/generators';
import { createRng, randomSeed } from '@/lib/util/random';
import { ALL_LESSONS } from '@/data/curriculum';

export default function GrammarDetail() {
  const { id = '' } = useParams();
  const g = GRAMMAR_BY_ID[id];
  const [seed, setSeed] = useState(randomSeed);
  const [practice, setPractice] = useState(false);
  const questions = useMemo(() => (g ? grammarQuiz(g, createRng(seed)) : []), [g, seed]);
  if (!g) return <ErrorState title="ไม่พบหัวข้อไวยากรณ์" action={<Link className="btn-primary" to="/grammar">กลับไป Grammar Studio</Link>} />;
  const lesson = ALL_LESSONS.find((l) => l.source.kind === 'grammar' && l.source.ids.includes(g.id));

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/grammar" className="btn-ghost btn-sm -ml-2 mb-3">
        <ArrowLeft className="h-4 w-4" /> Grammar Studio
      </Link>
      {!practice ? (
        <div className="card card-pad">
          <GrammarArticle g={g} />
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
            <button className="btn-primary" onClick={() => setPractice(true)}>
              ฝึก {questions.length} ข้อ
            </button>
            {lesson && (
              <Link className="btn-secondary" to={`/learn/${lesson.id}`}>
                เปิดในบทเรียน: {lesson.title}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <QuizRunner
          key={seed}
          questions={questions}
          title={`ฝึก ${g.pattern}`}
          source={`grammar:${g.id}`}
          onExit={() => {
            setSeed(randomSeed());
            setPractice(false);
          }}
        />
      )}
    </div>
  );
}
