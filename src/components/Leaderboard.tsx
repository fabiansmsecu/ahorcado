import React, { useEffect, useState } from 'react';
import { subscribeLeaderboard } from '../firebase';
import { UserProfile } from '../types';
import { Trophy } from 'lucide-react';

interface LeaderboardProps {
  onBack: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onBack }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeLeaderboard(
      (data) => {
        setUsers(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error drawing leaderboard:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-8 mt-10">
      <div className="flex items-center space-x-4">
        <button onClick={onBack} className="brutal-btn bg-white px-4 py-2">
          ← Volver
        </button>
        <h2 className="text-3xl font-black uppercase text-[var(--dark)] flex items-center gap-2">
          <Trophy className="text-[var(--secondary)] w-8 h-8" />
          Ranking Global
        </h2>
      </div>

      <div className="brutal-box bg-[var(--dark)] text-white overflow-hidden p-6 md:p-10 flex flex-col gap-6">
        <div style={{fontWeight: 'bold', fontSize: '18px', color: 'var(--white)'}}>TOP JUGADORES:</div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-400 font-bold">Cargando ranking...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 font-bold">Aún no hay puntuaciones registradas. ¡Sé el primero!</div>
        ) : (
          <div className="flex flex-col gap-4">
             {users.map((user, idx) => (
                <div key={user.uid} className="flex gap-4 text-lg items-center bg-white/5 border border-white/10 p-4 rounded-xl">
                  <div className="w-8 font-black opacity-60">#{idx + 1}</div>
                  <div className="flex-1 font-bold">{user.name}</div>
                  <div className="text-[var(--accent)] font-black text-xl">
                    {user.score} pts
                  </div>
                </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};
