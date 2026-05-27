export type GameMode = 'infantil' | 'universitario';
export type GameState = 'playing' | 'won' | 'lost' | 'completed';

export interface UserProfile {
  uid: string;
  name: string;
  score: number;
}
