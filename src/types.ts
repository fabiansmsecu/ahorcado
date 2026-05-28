export type GameMode = string;
export type GameState = 'playing' | 'won' | 'lost' | 'completed';

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
