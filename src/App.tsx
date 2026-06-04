import React, { useState, useEffect } from 'react';
import { GameMode } from './types';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import { CustomSetup } from './components/CustomSetup';
import { SavedLessonsView } from './components/SavedLessonsView';
import { ClassStatsView } from './components/ClassStatsView';
import { UserProfileView } from './components/UserProfileView';
import { LiveClassStats } from './components/LiveClassStats';
import { auth, loginWithGoogle, logout, onAuthStateChanged, isFallbackMode, loginWithNickname, saveLesson } from './firebase';
import { cn } from './lib/utils';
import { Trophy, LogIn, LogOut, Play, GraduationCap, BookOpen, AlertCircle, Sparkles, User, Settings, BarChart, UserCircle, Library } from 'lucide-react';

type Screen = 'menu' | 'game' | 'leaderboard' | 'setup' | 'stats' | 'profile' | 'saved_lessons';
type AppRole = 'student' | 'teacher' | null;

export default function App() {
  const [curScreen, setCurScreen] = useState<Screen>('menu');
  const [role, setRole] = useState<AppRole>(null);
  const [globalState, setGlobalState] = useState<{isActive: boolean, isPlaying: boolean, roomPin: string, mode: string, customWords: any, sessionId: string, joinedStudents: string[], gameEndTime: number | null}>({isActive: false, isPlaying: false, roomPin: '', mode: 'infantil', customWords: null, sessionId: '', joinedStudents: [], gameEndTime: null});
  const [currentSession, setCurrentSession] = useState('');

  const [mode, setMode] = useState<GameMode>('infantil');
  const [user, setUser] = useState<any | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [customWords, setCustomWords] = useState<{word: string, hint: string}[] | undefined>();

  // Nickname registration state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [studentPinInput, setStudentPinInput] = useState('');
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

  // Poll global state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/game-state');
        if (res.ok) {
          const data = await res.json();
          setGlobalState(data);
          
          if (data.sessionId && currentSession && data.sessionId !== currentSession && curScreen === 'game' && role === 'student') {
             setCurScreen('menu');
             showToast("¡El profesor ha iniciado una nueva lección!");
          }
          if (data.sessionId) {
             setCurrentSession(data.sessionId);
          }
          
          // Auto-start student if game transitions from lobby to playing
          if (role === 'student' && user && curScreen === 'menu' && data.isActive && data.isPlaying && data.roomPin === localStorage.getItem('last_room_pin')) {
             startGame(data.mode as GameMode, data.customWords);
          }
        }
      } catch (e) {}
    };
    fetchState();
    const interval = setInterval(fetchState, 1500); // 1.5s update for clocks
    return () => clearInterval(interval);
  }, [curScreen, currentSession, role, user]);

  const startGame = (m: GameMode, words?: {word: string, hint: string}[]) => {
    setMode(m);
    setCustomWords(words);
    setCurScreen('game');
  };

  const publishGame = async (m: GameMode, words?: {word: string, hint: string}[]) => {
    const pin = localStorage.getItem('teacher_pin') || '';
    const roomPinCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit PIN
    try {
      const res = await fetch('/api/game-state', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          pin,
          mode: m,
          customWords: words || null,
          isActive: true,
          isPlaying: false, // starts in lobby
          roomPin: roomPinCode,
          forceRestart: true,
          gameEndTime: null
        })
      });
      if (res.ok) {
        showToast("¡Sala creada! Esperando estudiantes.");
      } else {
        showToast("Error al publicar la sala. PIN incorrecto.", true);
      }
    } catch(e) {}
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 font-bold text-gray-600">Cargando partida...</div>;
  }

  const launchClassGame = async () => {
    const pin = localStorage.getItem('teacher_pin') || '';
    let endTime = Date.now() + 300 * 1000; // 5 min for multiple words, let's just make it 3 mins overall globally.
    try {
      await fetch('/api/game-state', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ pin, isPlaying: true, gameEndTime: Date.now() + 180 * 1000 })
      });
      showToast("¡Juego iniciado en la clase!");
    } catch (e) {}
  };

  const joinLobby = async () => {
    if (!studentPinInput) return;
    try {
      const res = await fetch('/api/join-lobby', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name: user?.displayName || 'Jugador', roomPin: studentPinInput })
      });
      if (res.ok) {
         localStorage.setItem('last_room_pin', studentPinInput);
         showToast("¡Estás dentro de la sala! Esperando que inicie...");
         // To re-trigger effect maybe? We just set it in local storage. 
         // Poll will pick it up and trigger startGame once `isPlaying` changes!
         setGlobalState(prev => ({...prev, joinedStudents: [...prev.joinedStudents, user?.displayName || 'Jugador']})); // optimistic ui if we wanted
      } else {
         const d = await res.json();
         showToast(d.error || "Error al unirse", true);
      }
    } catch (e) {}
  };

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
              className="flex items-center gap-2 bg-[var(--accent)] border-[2px] border-[var(--dark)] px-4 py-2 rounded-[12px] font-bold hover:brightness-95 cursor-pointer shadow-[2px_2px_0px_rgba(27,26,25,1)] hover:translate-y-[-1px] transition-all"
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[50px] border-2 border-[var(--dark)] bg-[var(--accent)] text-xs font-black uppercase text-[var(--dark)] shadow-[2px_2px_0px_rgba(27,26,25,1)]">
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
            {globalState.isActive && !globalState.isPlaying && globalState.roomPin !== localStorage.getItem('last_room_pin') ? (
              <div className="brutal-box p-12 bg-white flex flex-col items-center">
                <h2 className="text-4xl font-black uppercase text-[var(--primary)] mb-4">¡Sala Abierta!</h2>
                <p className="font-bold mb-8">El profesor ha abierto una sala. Ingresa el PIN para entrar.</p>
                <input 
                  type="text" 
                  value={studentPinInput}
                  onChange={e => setStudentPinInput(e.target.value)}
                  placeholder="PIN DE JUEGO"
                  className="w-full max-w-sm text-center font-black text-3xl uppercase tracking-widest p-4 brutal-box mb-6 border-[4px]"
                />
                <button 
                  onClick={joinLobby}
                  className="brutal-btn w-full max-w-sm bg-[var(--dark)] text-white text-2xl py-4 cursor-pointer"
                >
                  Entrar
                </button>
              </div>
            ) : globalState.isActive && !globalState.isPlaying && globalState.roomPin === localStorage.getItem('last_room_pin') ? (
              <div className="brutal-box p-12 bg-[var(--accent)] flex flex-col items-center">
                <div className="w-16 h-16 border-8 border-gray-800 border-t-[var(--primary)] rounded-full animate-spin mx-auto mb-8"></div>
                <h2 className="text-4xl font-black uppercase text-[var(--dark)] mb-4">¡Estás dentro!</h2>
                <p className="font-bold opacity-70 text-xl">Mira la pantalla del profesor. El juego está por comenzar...</p>
                <div className="mt-6 bg-white px-4 py-2 font-bold uppercase border-2 border-black">
                  Tu apodo: {user?.displayName}
                </div>
              </div>
            ) : globalState.isActive && globalState.isPlaying && globalState.roomPin === localStorage.getItem('last_room_pin') ? (
              <div className="brutal-box p-12 bg-white flex flex-col items-center">
                <h2 className="text-4xl font-black uppercase text-[var(--primary)] mb-4">¡El profesor ha iniciado!</h2>
                <p className="font-bold opacity-70 mb-8 text-xl">
                  Modalidad: <span className="uppercase badge bg-[var(--accent)] px-3 py-1 rounded-full border-2 border-black ml-2 shadow-[2px_2px_0_0_var(--dark)]">{globalState.mode === 'infantil' ? 'Infantil' : globalState.mode === 'universitario' ? 'Universitario' : 'Lección Propia'}</span>
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
                <h2 className="text-3xl font-black uppercase mb-2">Esperando partida...</h2>
                <p className="font-bold opacity-60">El profesor aún no ha abierto la sala.</p>
              </div>
            )}
            
            <div className="mt-8 flex flex-col items-center gap-4">
              <button 
                onClick={() => setCurScreen('leaderboard')}
                className="flex w-full max-w-sm items-center justify-center gap-3 brutal-btn bg-[var(--white)] cursor-pointer hover:bg-gray-50 shadow-[4px_4px_0px_rgba(27,26,25,1)] text-sm py-3"
              >
                <Trophy className="w-5 h-5 text-[var(--secondary)]" />
                Ver Cartelera de Puntajes
              </button>

              <button 
                onClick={() => setCurScreen('profile')}
                className="flex w-full max-w-sm items-center justify-center gap-3 brutal-btn bg-[var(--primary)] text-white cursor-pointer hover:brightness-105 shadow-[4px_4px_0px_rgba(27,26,25,1)] text-sm py-3"
              >
                <UserCircle className="w-5 h-5 text-white" />
                Ver mi Perfil y Logros
              </button>
            </div>
          </div>
        )}

        {curScreen === 'menu' && role === 'teacher' && (
          <div className="max-w-4xl mx-auto flex flex-col items-center p-4 space-y-8 w-full animate-in fade-in">
            
            <div className="w-full bg-[var(--accent)] p-6 rounded-2xl border-4 border-black text-center shadow-[6px_6px_0_0_var(--dark)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20"><Settings className="w-24 h-24 rotate-12" /></div>
              <h2 className="text-2xl font-black uppercase text-[var(--dark)] relative z-10">Panel del Profesor</h2>
              <div className="font-bold mt-3 text-lg bg-white/50 inline-block px-6 py-2 rounded-full border-2 border-black relative z-10">
                Estado de la clase: {globalState.isActive ? <span className="text-green-700 font-black">Activo (MODO: {globalState.mode.toUpperCase()})</span> : <span className="text-red-600 font-black">Inactivo (Sala de espera)</span>}
              </div>
              
              {globalState.isActive && !globalState.isPlaying && (
                <div className="mt-8 bg-white p-6 border-4 border-[var(--dark)] inline-block relative z-10 w-full max-w-sm mx-auto shadow-[4px_4px_0_0_var(--dark)]">
                  <h3 className="text-xl font-bold uppercase mb-2">Sala de Espera</h3>
                  <div className="text-4xl font-black text-[var(--primary)] mb-4 tracking-widest">PIN: {globalState.roomPin}</div>
                  <p className="font-bold text-gray-500 mb-4">{globalState.joinedStudents?.length || 0} estudiantes conectados</p>
                  <button onClick={launchClassGame} className="w-full brutal-btn bg-green-500 text-white py-3 shadow-[3px_3px_0_0_var(--dark)] uppercase">Empezar Clase</button>
                  <button 
                     onClick={async () => {
                       await fetch('/api/game-state', {
                         method: 'POST',
                         headers: {'Content-Type': 'application/json'},
                         body: JSON.stringify({ pin: localStorage.getItem('teacher_pin'), isActive: false })
                       });
                     }}
                     className="mt-4 w-full brutal-btn bg-[#ff4d4d] text-white py-2 text-sm uppercase"
                  >Cerrar Sala</button>
                </div>
              )}

              {globalState.isActive && globalState.isPlaying && (
                <div className="w-full flex justify-center">
                  <div className="mt-6 flex flex-col md:flex-row justify-center items-center gap-4 relative z-10 w-full max-w-sm mb-4">
                    <button 
                      onClick={async () => {
                         await fetch('/api/game-state', {
                           method: 'POST',
                           headers: {'Content-Type': 'application/json'},
                           body: JSON.stringify({ 
                             pin: localStorage.getItem('teacher_pin'), 
                             isActive: true,
                             isPlaying: false,
                             roomPin: globalState.roomPin, 
                             mode: globalState.mode, 
                             customWords: globalState.customWords,
                             forceRestart: true 
                           })
                         });
                         showToast("¡Lección reiniciada hacia la sala de espera!");
                      }}
                      className="w-full brutal-btn bg-white text-[var(--dark)] text-sm px-4 py-3 cursor-pointer shadow-[3px_3px_0_0_var(--dark)]"
                    >
                      Reiniciar Lobby
                    </button>

                    <button 
                      onClick={async () => {
                         await fetch('/api/game-state', {
                           method: 'POST',
                           headers: {'Content-Type': 'application/json'},
                           body: JSON.stringify({ pin: localStorage.getItem('teacher_pin'), isActive: false })
                         });
                      }}
                      className="w-full brutal-btn bg-[#ff4d4d] text-white text-sm px-4 py-3 cursor-pointer shadow-[3px_3px_0_0_var(--dark)]"
                    >
                      Terminar
                    </button>
                  </div>
                </div>
              )}

              {globalState.isActive && globalState.isPlaying && (
                <LiveClassStats joinedStudents={globalState.joinedStudents || []} gameEndTime={globalState.gameEndTime} />
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

            <div className="grid md:grid-cols-2 gap-8 w-full">
              {/* Custom Lesson Card */}
              <button 
                onClick={() => setCurScreen('setup')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(27,26,25,0.15)] text-left relative overflow-hidden cursor-pointer bg-[var(--white)]"
              >
                <div className="w-16 h-16 bg-[var(--primary)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6 text-[var(--white)]">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-center w-full">Configurar Lección Propia</h3>
                <p className="font-bold opacity-70">Pega un texto y la IA creará la lección.</p>
              </button>
              
              {/* Saved Lessons Card */}
              <button 
                onClick={() => setCurScreen('saved_lessons')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(27,26,25,0.15)] text-left relative overflow-hidden cursor-pointer"
              >
                <div className="w-16 h-16 bg-[var(--accent)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6 text-[var(--dark)]">
                  <Library className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-center w-full">Materias Guardadas</h3>
                <p className="font-bold opacity-70">Carga lecciones previas (Auditoría, Contabilidad...).</p>
              </button>

              {/* Infantil Mode Card */}
              <button 
                onClick={() => publishGame('infantil')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(27,26,25,0.15)] text-left relative overflow-hidden cursor-pointer"
              >
                <div className="w-16 h-16 bg-[var(--accent)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6">
                  <Play className="w-8 h-8 text-[var(--dark)]" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-[var(--primary)] text-center w-full">Modo Infantil Rápido</h3>
                <p className="font-bold opacity-70">Para niños de 7 a 10 años.</p>
              </button>

              {/* Universitario Mode Card */}
              <button 
                onClick={() => publishGame('universitario')}
                className="brutal-box flex flex-col items-center text-center p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_rgba(27,26,25,0.15)] text-left relative overflow-hidden cursor-pointer"
              >
                <div className="w-16 h-16 bg-[var(--secondary)] border-2 border-[var(--dark)] rounded-xl flex items-center justify-center mb-6 text-[var(--white)]">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-center w-full">Universitario Rápido</h3>
                <p className="font-bold opacity-70">Conceptos científicos complejos con IA.</p>
              </button>
            </div>

            <div className="mt-8 flex flex-col md:flex-row justify-center w-full pb-8 gap-4">
              <button 
                onClick={() => setCurScreen('stats')}
                className="flex items-center justify-center gap-3 brutal-btn bg-[var(--accent)] cursor-pointer shadow-[4px_4px_0px_rgba(27,26,25,1)] text-sm py-3"
              >
                <BarChart className="w-5 h-5 text-[var(--dark)]" />
                Estadísticas del Aula
              </button>
              <button 
                onClick={() => setCurScreen('leaderboard')}
                className="flex items-center justify-center gap-3 brutal-btn bg-[var(--white)] cursor-pointer hover:bg-gray-50 shadow-[4px_4px_0px_rgba(27,26,25,1)] text-sm py-3"
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

        {curScreen === 'profile' && (
          <UserProfileView onBack={() => setCurScreen('menu')} />
        )}

        {curScreen === 'saved_lessons' && (
          <SavedLessonsView 
             onBack={() => setCurScreen('menu')} 
             onPlayLesson={(words, m) => {
               publishGame(m, words);
               setCurScreen('menu'); // returns teacher to panel
             }} 
          />
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
          <Game 
            mode={mode} 
            customWords={customWords} 
            globalEndTime={globalState.gameEndTime}
            onBack={() => {
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
                className="w-full brutal-btn bg-[var(--secondary)] text-white hover:brightness-105 active:scale-95 transition-all text-sm py-3 cursor-pointer shadow-[3px_3px_0px_rgba(27,26,25,1)] font-black uppercase"
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
                  className="w-full brutal-btn bg-[var(--accent)] text-[var(--dark)] flex items-center justify-center gap-2 hover:brightness-95 py-3 text-sm cursor-pointer shadow-[3px_3px_0px_rgba(27,26,25,1)] font-bold uppercase border-[3px]"
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
                className="w-full brutal-btn bg-[var(--primary)] text-white hover:brightness-105 active:scale-95 transition-all text-sm py-3 cursor-pointer shadow-[3px_3px_0px_rgba(27,26,25,1)] font-black uppercase"
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
            "px-6 py-3 font-black uppercase shadow-[4px_4px_0_0_var(--dark)] border-[3px] border-black text-sm",
            feedbackMsg.isError ? "bg-red-400 text-white" : "bg-green-400 text-black"
          )}>
            {feedbackMsg.text}
          </div>
        </div>
      )}
    </div>
  );
}
