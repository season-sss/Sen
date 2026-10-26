import { ALL_LESSONS, CURRICULUM, LESSON_INDEX, lessonsOfLevel, type Lesson } from '@/data/curriculum';
import type { Level } from '@/data/types';
import { lessonStatus, type LessonProgress, type LessonStatus } from '@/store/progress';

export function levelProgress(lessons: Record<string, LessonProgress>, level: Level) {
  const ls = lessonsOfLevel(level);
  const statuses = ls.map((l) => lessonStatus(lessons, l.id));
  return {
    total: ls.length,
    completed: statuses.filter((s) => s === 'completed').length,
    learning: statuses.filter((s) => s === 'learning').length,
    review: statuses.filter((s) => s === 'needs-review').length,
  };
}

/** The next lesson to study: first unfinished lesson in curriculum order, starting at the learner's level. */
export function nextLesson(lessons: Record<string, LessonProgress>, currentLevel: Level): Lesson | undefined {
  const order = CURRICULUM.map((l) => l.id);
  const startIdx = Math.max(0, order.indexOf(currentLevel));
  const ordered = [...ALL_LESSONS].sort((a, b) => {
    const la = order.indexOf(LESSON_INDEX[a.id].level.id);
    const lb = order.indexOf(LESSON_INDEX[b.id].level.id);
    const ra = la < startIdx ? la + 100 : la;
    const rb = lb < startIdx ? lb + 100 : lb;
    return ra - rb;
  });
  const inProgress = ordered.find((l) => lessonStatus(lessons, l.id) === 'learning');
  return inProgress ?? ordered.find((l) => lessonStatus(lessons, l.id) !== 'completed');
}

export function unmetPrerequisites(lessons: Record<string, LessonProgress>, lesson: Lesson): Lesson[] {
  return (lesson.requires ?? []).map((id) => LESSON_INDEX[id].lesson).filter((l) => lessonStatus(lessons, l.id) !== 'completed');
}

export function lessonsWithStatus(lessons: Record<string, LessonProgress>, status: LessonStatus): Lesson[] {
  return ALL_LESSONS.filter((l) => lessonStatus(lessons, l.id) === status);
}
