import React, { useState, useEffect } from 'react';
import { GameMode } from './types';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import { CustomSetup } from './components/CustomSetup';
import { ClassStatsView } from './components/ClassStatsView';
import { auth, loginWithGoogle, logout, onAuthStateChanged, isFallbackMode, loginWithNickname } from './firebase';
import { cn } from './lib/utils';
import { Trophy, LogIn, LogOut, Play, GraduationCap, BookOpen, AlertCircle, Sparkles, User, Settings, BarChart } from 'lucide-react';

type Screen = 'menu' | 'game' | 'leaderboard' | 'setup' | 'stats';
type AppRole = 'student' | 'teacher' | null;

export default function App() {
  const [curScreen, setCurScreen] = useState<Screen>('menu');
  const [role, setRole] = useState<AppRole>(null);
  const [globalState, setGlobalState] = useState<{isActive: boolean, mode: string, customWords: any}>({isActive: false, mode: 'infantil', customWords: null});

  const [mode, setMode] = useState<GameMode>('infantil');
  const [user, setUser] = useState<any | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [customWords, setCustomWords] = useState<{word: string, hint: string}[] | undefined>();

  // Nickname registration state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Professor PIN & Feedback state
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherPinInput, setTeacherPinInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{text: string, isError: boolean} | null>(null);

  const showToast = (text: string, isError: boolean = false) => {
    setFeedbackMsg({ text, isError });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Poll global state every 3 seconds
    const fetchState = async () => {
      try {
        const res = await fetch('/api/game-state');
        if (res.ok) {
          const data = await res.json();
          setGlobalState(data);
        }
      } catch (e) {}
    };
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  const startGame = (m: GameMode, words?: {word: string, hint: string}[]) => {
    setMode(m);
    setCustomWords(words);
    setCurScreen('game');
  };

  const publishGame = async (m: GameMode, words?: {word: string, hint: string}[]) => {
    const pin = localStorage.getItem('teacher_pin') || '';
    try {
      const res = await fetch('/api/game-state', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          pin,
          mode: m,
          customWords: words || null,
          isActive: true
        })
      });
      if (res.ok) {
        showToast("¡Juego publicado para los estudiantes!");
      } else {
        showToast("Error al publicar el juego. PIN incorrecto.", true);
      }
    } catch(e) {}
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
            role && <button 
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
        {role === null && (
          <div className="max-w-md mx-auto flex flex-col items-center justify-center pt-10 space-y-8 w-full animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-2 mb-4">
              <h2 className="text-4xl font-black uppercase tracking-tight">¿Quién eres?</h2>
              <p className="font-bold opacity-60">Selecciona tu rol para entrar al salón.</p>
            </div>
            
            <button 
              onClick={() => {
                setRole('student');
                if (!user) setShowLoginModal(true);
              }}
              className="w-full brutal-btn bg-[var(--accent)] text-xl py-6 hover:brightness-95 flex flex-col items-center gap-2 group cursor-pointer"
            >
              <User className="w-8 h-8 group-hover:scale-110 transition-transform" />
              Soy Estudiante
            </button>

            <button 
              onClick={() => {
                setShowTeacherModal(true);
              }}
              className="w-full brutal-btn bg-[var(--white)] text-xl py-6 hover:bg-gray-50 flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Settings className="w-8 h-8 group-hover:rotate-45 transition-transform" />
              Soy Profesor
            </button>
          </div>
        )}

        {curScreen === 'menu' && role === 'student' && (
          <div className="max-w-2xl mx-auto text-center space-y-8 pt-10 animate-in fade-in">
            {globalState.isActive ? (
              <div className="brutal-box p-12 bg-white flex flex-col items-center">
                <h2 className="text-4xl font-black uppercase text-[var(--primary)] mb-4">¡El profesor ha iniciado!</h2>
                <p className="font-bold opacity-70 mb-8 text-xl">
                  Modalidad: <span className="uppercase badge bg-[var(--accent)] px-3 py-1 rounded-full border-2 border-black ml-2 shadow-[2px_2px_0_0_#000]">{globalState.mode === 'infantil' ? 'Infantil' : globalState.mode === 'universitario' ? 'Universitario' : 'Lección Propia'}</span>
                </p>
                <button 
                   onClick={() => startGame(globalState.mode as GameMode, globalState.customWords)}
                   className="brutal-btn bg-[var(--secondary)] text-white text-2xl py-6 px-12 animate-pulse hover:animate-none cursor-pointer"
                >
                  🚀 ¡Entrar a Jugar!
                </button>
              </div>
            ) : (
              <div className="brutal-box p-12 bg-gray-50 border-dashed border-gray-300 border-[4px] shadow-none">
                <div className="w-16 h-16 border-8 border-gray-200 border-t-[var(--primary)] rounded-full animate-spin mx-auto mb-8"></div>
                <h2 className="text-3xl font-black uppercase mb-2">Esperando al profesor...</h2>
                <p className="font-bold opacity-60">No hay ninguna lección activa. El juego arrancará aquí solíto.</p>
              </div>
            )}
            
            <div className="mt-8 flex justify-center">
              <button 
                onClick={() => setCurScreen('leaderboard')}
                className="flex items-center gap-3 brutal-btn bg-[var(--white)] cursor-pointer hover:bg-gray-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] text-sm py-3"
              >
                <Trophy className="w-5 h-5 text-[var(--secondary)]" />
                Ver Cartelera de Puntajes
              </button>
            </div>
          </div>
        )}

        {curScreen === 'menu' && role === 'teacher' && (
          <div className="max-w-4xl mx-auto flex flex-col items-center p-4 space-y-8 w-full animate-in fade-in">
            
            <div className="w-full bg-[var(--accent)] p-6 rounded-2xl border-4 border-black text-center shadow-[6px_6px_0_0_#000] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20"><Settings className="w-24 h-24 rotate-12" /></div>
              <h2 className="text-2xl font-black uppercase text-[var(--dark)] relative z-10">Panel del Profesor</h2>
              <div className="font-bold mt-3 text-lg bg-white/50 inline-block px-6 py-2 rounded-full border-2 border-black relative z-10">
                Estado de la clase: {globalState.isActive ? <span className="text-green-700 font-black">Activo (MODO: {globalState.mode.toUpperCase()})</span> : <span className="text-red-600 font-black">Inactivo (Sala de espera)</span>}
              </div>
              
              {globalState.isActive && (
                <div className="mt-6 relative z-10">
                  <button 
                    onClick={async () => {
                       await fetch('/api/game-state', {
                         method: 'POST',
                         headers: {'Content-Type': 'application/json'},
                         body: JSON.stringify({ pin: localStorage.getItem('teacher_pin'), isActive: false })
                       });
                    }}
                    className="brutal-btn bg-[#ff4d4d] text-white text-sm px-6 py-3 cursor-pointer"
                  >
                    Detener Juego (Vuelve a sala de espera)
                  </button>
                </div>
              )}
            </div>

            <div className="text-center space-y-2 pt-4">
              <h2 className="text-3xl font-black tracking-tight uppercase">
                {globalState.isActive ? 'Cambiar Lección' : 'Elige qué van a jugar'}
              </h2>
              <p className="font-bold opacity-80">
                Al seleccionar un modo u configurar una lección, esta será enviada directamente a las pantallas de tus estudiantes.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 w-full">
              {/* Infantil Mode Card */}
              <button 
                onClick={() => publishGame('infantil')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(0,0,0,0.15)] text-left relative overflow-hidden cursor-pointer"
              >
                <div className="w-16 h-16 bg-[var(--accent)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6">
                  <Play className="w-8 h-8 text-[var(--dark)]" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-[var(--primary)] text-center w-full">Publicar Modo Infantil</h3>
                <p className="font-bold opacity-70">Para niños de 7 a 10 años.</p>
              </button>

              {/* Universitario Mode Card */}
              <button 
                onClick={() => publishGame('universitario')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(0,0,0,0.15)] text-left relative overflow-hidden cursor-pointer"
              >
                <div className="w-16 h-16 bg-[var(--secondary)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6 text-white">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-center w-full">Publicar Universitario</h3>
                <p className="font-bold opacity-70">Conceptos científicos complejos con IA.</p>
              </button>

              {/* Custom Lesson Card */}
              <button 
                onClick={() => setCurScreen('setup')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(0,0,0,0.15)] text-left relative overflow-hidden cursor-pointer"
              >
                <div className="w-16 h-16 bg-[var(--primary)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6 text-white">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-center w-full">Configurar Lección Propia</h3>
                <p className="font-bold opacity-70">Pega un texto y la IA creará la lección.</p>
              </button>
            </div>

            <div className="mt-8 flex flex-col md:flex-row justify-center w-full pb-8 gap-4">
              <button 
                onClick={() => setCurScreen('stats')}
                className="flex items-center justify-center gap-3 brutal-btn bg-[var(--accent)] cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] text-sm py-3"
              >
                <BarChart className="w-5 h-5 text-[var(--dark)]" />
                Estadísticas del Aula
              </button>
              <button 
                onClick={() => setCurScreen('leaderboard')}
                className="flex items-center justify-center gap-3 brutal-btn bg-[var(--white)] cursor-pointer hover:bg-gray-50 shadow-[4px_4px_0px_rgba(0,0,0,1)] text-sm py-3"
              >
                <Trophy className="w-5 h-5 text-[var(--secondary)]" />
                Ver Ranking de la Clase
              </button>
            </div>
          </div>
        )}

        {curScreen === 'stats' && role === 'teacher' && (
          <ClassStatsView onBack={() => setCurScreen('menu')} />
        )}

        {curScreen === 'setup' && (
          <CustomSetup 
             onStart={(words, m) => {
               if (role === 'teacher') publishGame(m as GameMode, words);
               setCurScreen('menu'); // returns teacher to panel
             }} 
             onBack={() => setCurScreen('menu')} 
          />
        )}

        {curScreen === 'game' && (
          <Game mode={mode} customWords={customWords} onBack={() => {
             // For student, returning from game goes back to wait room.
             setCurScreen('menu');
          }} />
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
                Elige tu Apodo
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
              Identifícate para que el profesor pueda ver tus puntos en la clase.
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
                  Nombre o Apodo
                </label>
                <input 
                  type="text"
                  maxLength={15}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="Ej: Sofía.G" 
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
                ¡Listo!
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

      {/* Teacher PIN Modal Overlay */}
      {showTeacherModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="brutal-box p-8 max-w-md w-full bg-[var(--white)] animate-in zoom-in-95">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-black uppercase tracking-tight text-[var(--dark)]">
                Acceso Profesor
              </h3>
              <button 
                onClick={() => {
                  setShowTeacherModal(false);
                  setTeacherPinInput('');
                }}
                className="font-black text-xl hover:text-red-500 cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <p className="text-sm font-bold opacity-75 mb-6">
              Introduce el PIN para administrar la sesión.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (teacherPinInput.trim()) {
                localStorage.setItem('teacher_pin', teacherPinInput.trim());
                setRole('teacher');
                setShowTeacherModal(false);
                setTeacherPinInput('');
              }
            }} className="space-y-4">
              <div>
                <input 
                  type="password"
                  value={teacherPinInput}
                  onChange={(e) => setTeacherPinInput(e.target.value)}
                  placeholder="PIN del Profesor" 
                  className="w-full p-3 brutal-box text-lg font-bold outline-none border-[3px] border-[var(--dark)] focus:border-[var(--primary)] placeholder:opacity-50 bg-white"
                />
              </div>

              <button 
                type="submit"
                className="w-full brutal-btn bg-[var(--primary)] text-white hover:brightness-105 active:scale-95 transition-all text-sm py-3 cursor-pointer shadow-[3px_3px_0px_rgba(0,0,0,1)] font-black uppercase"
              >
                Entrar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <div className={cn(
            "px-6 py-3 font-black uppercase shadow-[4px_4px_0_0_#000] border-[3px] border-black text-sm",
            feedbackMsg.isError ? "bg-red-400 text-white" : "bg-green-400 text-black"
          )}>
            {feedbackMsg.text}
          </div>
        </div>
      )}
    </div>
  );
}
