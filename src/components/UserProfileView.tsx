import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { getUserProfile, auth } from '../firebase';
import { Trophy, Clock, Medal, CheckCircle2, UserCircle2 } from 'lucide-react';

export const UserProfileView = ({ onBack }: { onBack: () => void }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const p = await getUserProfile(uid);
        setProfile(p);
      } catch (e) {
        console.error("Error al cargar perfil", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return <div className="text-center font-bold animate-pulse text-lg py-12 uppercase">Cargando tu perfil...</div>;
  }

  if (!profile) {
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-8 brutal-box bg-white text-center">
        <h2 className="text-2xl font-black uppercase mb-4 text-red-500">Perfil no encontrado</h2>
        <p className="font-bold opacity-70 mb-8">Debes iniciar sesión para ver tus estadísticas y logros.</p>
        <button onClick={onBack} className="brutal-btn bg-[var(--primary)] text-white px-8 py-3">Volver al Menú</button>
      </div>
    );
  }

  const s = profile.stats || {
    gamesPlayed: 0,
    gamesWon: 0,
    totalTime: 0,
    wordsGuessed: [],
    achievements: []
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pt-10">
      
      <div className="flex justify-between items-center bg-[var(--white)] p-6 rounded-2xl border-4 border-black shadow-[6px_6px_0_0_var(--dark)]">
        <button 
          onClick={onBack}
          className="brutal-btn bg-gray-100 text-[var(--dark)] flex items-center gap-2 px-4 py-2 text-sm shadow-[2px_2px_0px_rgba(27,26,25,1)] border-[3px]"
        >
          ← Volver
        </button>
        <div className="flex items-center gap-4 flex-1 justify-center relative -left-8"> {/* shift left to account for back button width */}
           <UserCircle2 className="w-10 h-10 text-[var(--primary)]" />
           <h2 className="text-3xl font-black uppercase text-[var(--dark)]">{profile.name}</h2>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Main Stats */}
        <div className="md:col-span-1 space-y-6">
          <div className="brutal-box p-6 bg-[var(--accent)] text-center flex flex-col items-center">
            <Trophy className="w-12 h-12 mb-2 text-[var(--dark)]" />
            <div className="text-sm font-black uppercase mb-1 opacity-70">Puntuación Global</div>
            <div className="text-5xl font-black">{profile.score} <span className="text-xl">pts</span></div>
          </div>
          
          <div className="brutal-box p-6 bg-[var(--white)] text-center grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 mb-2 text-green-500" />
              <div className="text-2xl font-black">{s.gamesWon} / {s.gamesPlayed}</div>
              <div className="text-xs font-bold uppercase opacity-60">Ganadas</div>
            </div>
            <div className="flex flex-col items-center">
              <Clock className="w-8 h-8 mb-2 text-blue-500" />
              <div className="text-2xl font-black">{formatTime(s.totalTime)}</div>
              <div className="text-xs font-bold uppercase opacity-60">Tiempo Jugado</div>
            </div>
          </div>
        </div>

        {/* Details area */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {/* Achievements */}
          <div className="brutal-box p-6 bg-[var(--white)]">
             <div className="flex items-center gap-3 mb-6">
               <Medal className="w-6 h-6 text-[var(--secondary)]" />
               <h3 className="text-xl font-black uppercase">Tus Logros</h3>
             </div>
             
             {s.achievements.length > 0 ? (
               <div className="grid grid-cols-2 gap-4">
                 {s.achievements.map((ach, i) => (
                   <div key={i} className="border-4 border-black p-3 bg-yellow-100 flex items-center justify-center text-center font-bold text-sm shadow-[2px_2px_0_0_var(--dark)]">
                     🏆 {ach}
                   </div>
                 ))}
               </div>
             ) : (
                <div className="p-8 text-center border-4 border-dashed border-gray-300 font-bold opacity-60 uppercase text-sm">
                  Sigue jugando para desbloquear logros
                </div>
             )}
          </div>

          {/* Guessed Words Dictionary */}
          <div className="brutal-box p-6 bg-[var(--white)]">
             <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-3">
                <span className="text-xl">🧠</span> 
                Palabras Descubiertas ({s.wordsGuessed.length})
             </h3>
             <div className="flex flex-wrap gap-2">
                {s.wordsGuessed.length > 0 ? (
                  s.wordsGuessed.map((w, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 border-2 border-black font-bold text-sm shadow-[2px_2px_0_0_var(--dark)]">
                      {w}
                    </span>
                  ))
                ) : (
                  <span className="font-bold opacity-50 uppercase text-xs p-4 w-full text-center">Todavía no has adivinado ninguna palabra.</span>
                )}
             </div>
          </div>
        </div>

      </div>

    </div>
  );
};
