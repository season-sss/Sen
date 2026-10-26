export interface LyricLine {
  /** Korean lyric line (Korean only) */
  ko: string;
  /** Thai translation */
  th: string;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  lines: LyricLine[];
  /** user = added by this learner in the app · builtin = shipped with the site */
  source: 'user' | 'builtin';
  note?: string;
  createdAt: number;
  updatedAt: number;
}
