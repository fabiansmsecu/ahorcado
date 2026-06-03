export type GameMode = string;
export type GameState = 'playing' | 'won' | 'lost' | 'completed';

export interface CustomWord {
  word: string;
  hint: string;
}

export interface Lesson {
  id: string;
  subject: string;
  title: string;
  words: CustomWord[];
  mode: string;
  createdAt: number;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalTime: number; // in seconds
  wordsGuessed: string[];
  achievements: string[];
}

export interface UserProfile {
  uid: string;
  name: string;
  score: number;
  stats?: UserStats;
}
