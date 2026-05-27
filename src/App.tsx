import React, { useState, useEffect } from 'react';
import { GameMode } from './types';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import { CustomSetup } from './components/CustomSetup';
import { auth, loginWithGoogle, logout, onAuthStateChanged, isFallbackMode, loginWithNickname } from './firebase';
import { cn } from './lib/utils';
import { Trophy, LogIn, LogOut, Play, GraduationCap, BookOpen, AlertCircle, Sparkles } from 'lucide-react';

type Screen = 'menu' | 'game' | 'leaderboard' | 'setup';

export default function App() {
  const [curScreen, setCurScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<GameMode>('infantil');
  const [user, setUser] = useState<any | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [customWords, setCustomWords] = useState<{word: string, hint: string}[] | undefined>();

  // Nickname registration state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  const startGame = (m: GameMode, words?: {word: string, hint: string}[]) => {
    setMode(m);
    setCustomWords(words);
    setCurScreen('game');
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 font-bold text-gray-600">Cargando partida...</div>;
  }

  return (
    <div className="min-h-screen w-full flex flex-col p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Navbar */}
      <header className="w-full flex items-center justify-between mb-4 bg-[var(--white)] px-8 py-4 rounded-[24px] border-[4px] border-[var(--dark)] shadow-[var(--shadow)]">
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-[var(--primary)] cursor-pointer flex items-center gap-1" onClick={() => setCurScreen('menu')}>
          Ahorcado Pro
        </h1>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block stat-badge text-sm">Jugador: {user.displayName} ✨</span>
              <button 
                onClick={logout} 
                className="p-2 rounded-full hover:bg-gray-100 transition-colors tooltip border-2 border-transparent cursor-pointer" 
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5 text-[var(--dark)]" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)} 
              className="flex items-center gap-2 bg-[var(--accent)] border-[2px] border-[var(--dark)] px-4 py-2 rounded-[12px] font-bold hover:brightness-95 cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Ingresar</span>
            </button>
          )}
        </div>
      </header>

      {/* Fallback indicator */}
      {isFallbackMode && (
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[50px] border-2 border-[var(--dark)] bg-[var(--accent)] text-xs font-black uppercase text-[var(--dark)] shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary)] animate-pulse" />
            Modo Local Activo (Offline)
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="w-full flex-grow flex flex-col items-center">
        {curScreen === 'menu' && (
          <div className="max-w-4xl mx-auto flex flex-col items-center p-4 space-y-12 w-full">
            
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{textTransform: 'uppercase'}}>
                Aprende Jugando
              </h2>
              <p className="text-lg font-bold opacity-80 max-w-lg mx-auto">
                Elige tu nivel, adivina la palabra generada por IA, y acumula puntos. 
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 w-full">
              {/* Infantil Mode Card */}
              <button 
                onClick={() => startGame('infantil')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(0,0,0,0.15)] text-left relative overflow-hidden cursor-pointer"
              >
                <div className="w-16 h-16 bg-[var(--accent)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6">
                  <Play className="w-8 h-8 text-[var(--dark)]" />
                </div>
                <h3 className="text-2xl font-black mb-2" style={{color: 'var(--primary)'}}>Modo Infantil</h3>
                <p className="font-bold opacity-70">Para niños de 7 a 10 años. Palabras fáciles y divertidas.</p>
              </button>

              {/* Universitario Mode Card */}
              <button 
                onClick={() => startGame('universitario')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(0,0,0,0.15)] text-left relative overflow-hidden cursor-pointer"
              >
                <div className="w-16 h-16 bg-[var(--secondary)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6 text-white">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-2">Modo Universitario</h3>
                <p className="font-bold opacity-70">Conceptos científicos, académicos y complejos con IA.</p>
              </button>

              {/* Custom Lesson Card */}
              <button 
                onClick={() => setCurScreen('setup')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(0,0,0,0.15)] text-left relative overflow-hidden cursor-pointer"
              >
                <div className="w-16 h-16 bg-[var(--primary)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6 text-white">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-2">Lección Propia</h3>
                <p className="font-bold opacity-70">Pega un texto científico o de estudio y la IA creará tu lección.</p>
              </button>
            </div>

            <div className="w-full flex justify-center pt-8 flex-col items-center">
              <button 
                onClick={() => {
                  setCurScreen('leaderboard');
                }}
                className="flex items-center gap-3 brutal-btn bg-[var(--white)] cursor-pointer hover:bg-gray-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform active:translate-y-0.5"
              >
                <Trophy className="w-6 h-6 text-[var(--secondary)]" />
                Reglas y Ranking
              </button>
              {!user && (
                 <p className="text-sm font-bold opacity-60 mt-4 text-center">Registra un apodo para guardar tu avance en la clasificación.</p>
              )}
            </div>
          </div>
        )}

        {curScreen === 'setup' && (
          <CustomSetup onStart={(words, m) => startGame(m as GameMode, words)} onBack={() => setCurScreen('menu')} />
        )}

        {curScreen === 'game' && (
          <Game mode={mode} customWords={customWords} onBack={() => setCurScreen('menu')} />
        )}

        {curScreen === 'leaderboard' && (
          <Leaderboard onBack={() => setCurScreen('menu')} />
        )}

      </main>

      {/* Login / Nickname Modal Overlay */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="brutal-box p-8 max-w-md w-full bg-[var(--white)] animate-in zoom-in-95">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-black uppercase tracking-tight text-[var(--dark)]">
                {isFallbackMode ? 'Elige tu Apodo' : 'Iniciar Sesión'}
              </h3>
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginError('');
                }}
                className="font-black text-xl hover:text-red-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-sm font-bold opacity-75 mb-6">
              {isFallbackMode 
                ? 'Introduce un nombre de jugador para que tus puntos queden registrados en el ranking local de tu navegador.' 
                : 'Conéctate para competir en la cartelera o crea un apodo local de inmediato.'}
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!nicknameInput.trim()) {
                setLoginError('Por favor redacta un apodo válido.');
                return;
              }
              loginWithNickname(nicknameInput.trim());
              setShowLoginModal(false);
              setNicknameInput('');
              setLoginError('');
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-black uppercase text-[var(--dark)] mb-1">
                  Nombre del Jugador
                </label>
                <input 
                  type="text"
                  maxLength={15}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="Ej: AhorcadorPro" 
                  className="w-full p-3 brutal-box text-lg font-bold outline-none border-[3px] border-[var(--dark)] focus:border-[var(--primary)] placeholder:opacity-50 bg-white"
                />
              </div>

              {loginError && (
                <div className="text-xs font-bold text-red-500 flex items-center gap-1 bg-red-50 border border-red-200 p-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {loginError}
                </div>
              )}

              <button 
                type="submit"
                className="w-full brutal-btn bg-[var(--secondary)] text-white hover:brightness-105 active:scale-95 transition-all text-sm py-3 cursor-pointer shadow-[3px_3px_0px_rgba(0,0,0,1)] font-black uppercase"
              >
                ¡Registrar Apodo y Jugar!
              </button>
            </form>

            {!isFallbackMode && (
              <div className="mt-6 pt-6 border-t-[3px] border-dashed border-gray-200 flex flex-col gap-3">
                <span className="text-xs font-black text-center uppercase opacity-50">O bien</span>
                <button 
                  onClick={async () => {
                    await loginWithGoogle();
                    setShowLoginModal(false);
                  }}
                  className="w-full brutal-btn bg-[var(--accent)] text-[var(--dark)] flex items-center justify-center gap-2 hover:brightness-95 py-3 text-sm cursor-pointer shadow-[3px_3px_0px_rgba(0,0,0,1)] font-bold uppercase border-[3px]"
                >
                  Unirse con Google
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
