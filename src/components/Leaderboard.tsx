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

  const top3 = users.slice(0, 3);
  const others = users.slice(3);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-8 mt-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center bg-[var(--white)] p-6 rounded-2xl border-4 border-black shadow-[6px_6px_0_0_var(--dark)]">
        <button onClick={onBack} className="brutal-btn bg-gray-100 px-4 py-2 text-sm">
          ← Volver
        </button>
        <h2 className="text-3xl font-black uppercase text-[var(--dark)] flex items-center gap-4 relative -left-8">
          <Trophy className="text-[var(--primary)] w-10 h-10" />
          Ranking Global
        </h2>
      </div>

      <div className="brutal-box bg-[var(--white)] overflow-hidden p-6 md:p-10 flex flex-col gap-10">
        
        {loading ? (
          <div className="p-8 text-center text-gray-500 font-bold uppercase animate-pulse">Cargando ranking...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500 font-bold uppercase">Aún no hay puntuaciones registradas. ¡Sé el primero!</div>
        ) : (
          <>
            {/* Podium for Top 3 Kahoot Style */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center h-[280px] gap-2 sm:gap-4 md:gap-8 pb-4 mt-8 px-2 border-b-8 border-black">
                {/* 2nd Place */}
                {top3[1] && (
                  <div className="flex flex-col items-center w-24 sm:w-32 animate-in slide-in-from-bottom duration-700">
                    <div className="font-bold text-center text-sm md:text-md truncate w-full mb-2">{top3[1].name}</div>
                    <div className="bg-[var(--secondary)] w-full h-[120px] rounded-t-xl border-4 border-b-0 border-black flex flex-col items-center justify-start pt-4 text-white">
                      <div className="text-4xl font-black mb-1 opacity-90 drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">2</div>
                      <div className="text-sm font-bold bg-black/20 px-2 py-1 rounded-lg">{top3[1].score}</div>
                    </div>
                  </div>
                )}
                
                {/* 1st Place */}
                {top3[0] && (
                  <div className="flex flex-col items-center w-28 sm:w-36 -mt-8 animate-in slide-in-from-bottom duration-500 delay-150">
                    <div className="mb-2 text-4xl">👑</div>
                    <div className="font-black text-center text-md md:text-lg truncate w-full mb-2 text-[var(--primary)]">{top3[0].name}</div>
                    <div className="bg-[var(--primary)] w-full h-[180px] rounded-t-xl border-4 border-b-0 border-black flex flex-col items-center justify-start pt-4 text-white shadow-[0_-8px_0_0_rgba(252,250,250,0.5)]">
                      <div className="text-5xl font-black mb-2 drop-shadow-[3px_3px_0_rgba(0,0,0,1)] text-[#FFD700]">1</div>
                      <div className="font-black bg-black/20 px-3 py-1 rounded-lg border-2 border-black/30 shadow-[2px_2px_0_0_rgba(0,0,0,0.5)]">{top3[0].score} pts</div>
                    </div>
                  </div>
                )}
                
                {/* 3rd Place */}
                {top3[2] && (
                  <div className="flex flex-col items-center w-24 sm:w-32 animate-in slide-in-from-bottom duration-1000">
                    <div className="font-bold text-center text-sm md:text-md truncate w-full mb-2">{top3[2].name}</div>
                    <div className="bg-[var(--accent)] w-full h-[80px] rounded-t-xl border-4 border-b-0 border-black flex flex-col items-center justify-start pt-3 text-black">
                      <div className="text-3xl font-black mb-1 opacity-90 drop-shadow-[2px_2px_0_rgba(255,255,255,1)]">3</div>
                      <div className="text-xs font-bold bg-white/50 px-2 py-0.5 rounded-lg border-2 border-black/10">{top3[2].score}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rest of players */}
            {others.length > 0 && (
               <div className="flex flex-col gap-3 mt-4">
                 <h3 className="uppercase font-black text-gray-500 ml-2 mb-2">Resto de jugadores</h3>
                 {others.map((user, idx) => (
                  <div key={user.uid} className="flex gap-4 text-lg items-center border-[3px] border-[var(--dark)] bg-gray-50 shadow-[2px_2px_0px_var(--dark)] p-4 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="font-black text-xl text-gray-400 w-8">#{idx + 4}</div>
                    <div className="flex-1 font-bold text-lg">{user.name}</div>
                    <div className="font-black text-xl text-[var(--dark)]">
                      {user.score} pts
                    </div>
                  </div>
                 ))}
               </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
