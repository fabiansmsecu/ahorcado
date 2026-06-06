import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { getUserProfile, auth, deleteUserAccount } from '../firebase';
import { Trophy, Clock, Medal, CheckCircle2, UserCircle2, AlertTriangle } from 'lucide-react';

export const UserProfileView = ({ onBack }: { onBack: () => void }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const uid = auth.currentUser?.uid;
      const isLocal = localStorage.getItem('local_user');
      const uidToUse = uid || (isLocal ? JSON.parse(isLocal).uid : null);
      
      if (!uidToUse) {
        setLoading(false);
        return;
      }
      try {
        const p = await getUserProfile(uidToUse);
        setProfile(p);
      } catch (e) {
        console.error("Error al cargar perfil", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleResetAccount = async () => {
    await deleteUserAccount();
    onBack();
  };

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
        <div className="flex items-center gap-4 flex-1 justify-center relative">
           <UserCircle2 className="w-10 h-10 text-[var(--primary)]" />
           <h2 className="text-3xl font-black uppercase text-[var(--dark)]">{profile.name}</h2>
        </div>
        <button
          onClick={() => setShowConfirmReset(true)}
          className="flex items-center gap-2 bg-red-100 text-red-600 border-[3px] border-black px-4 py-2 rounded-xl font-black uppercase text-sm shadow-[3px_3px_0px_rgba(27,26,25,1)] hover:translate-y-1 hover:shadow-[0px_0px_0px_rgba(27,26,25,1)] transition-all cursor-pointer"
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="hidden sm:inline">Resetear Cuenta</span>
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Main Stats */}
        <div className="md:col-span-1 space-y-6">
          <div className="brutal-box p-6 bg-[var(--accent)] text-center flex flex-col items-center">
            <Trophy className="w-12 h-12 mb-2 text-[var(--dark)]" />
            <div className="text-sm font-black uppercase mb-1 opacity-70">Puntuación Global</div>
            <div className="text-5xl font-black">{profile.score} <span className="text-xl">pts</span></div>
          </div>
          
          <div className="brutal-box p-6 bg-[var(--white)] text-center flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
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
            
            <div className="bg-gray-100 p-4 border-[3px] border-black rounded-lg grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center">
                    <div className="text-3xl font-black text-orange-500 tracking-tight">🔥 {s.maxStreak || 0}</div>
                    <div className="text-[10px] font-black uppercase opacity-60">Racha Máxima</div>
                </div>
                <div className="flex flex-col items-center border-l-[3px] border-black pl-4">
                    <div className="text-3xl font-black text-purple-500 tracking-tight">✨ {s.flawlessVictories || 0}</div>
                    <div className="text-[10px] font-black uppercase opacity-60">Victorias Perfectas</div>
                </div>
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

      {showConfirmReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="brutal-box p-8 max-w-md w-full bg-white text-center animate-in zoom-in-95">
            <div className="bg-red-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-500">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-black uppercase text-[var(--dark)] mb-4">¿Borrar tu registro?</h2>
            <p className="font-bold opacity-70 mb-8 border-2 border-dashed p-4">
              Esta acción borrará todas tus palabras descubiertas, puntuación, logros y liberará tu nombre de usuario para que puedas crear uno nuevo sin problemas. No podrás recuperarlo.
            </p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 brutal-btn bg-gray-200 text-gray-800"
              >
                Cerrar
              </button>
              <button 
                onClick={handleResetAccount}
                className="flex-1 brutal-btn bg-red-500 text-white"
              >
                Sí, Borrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
