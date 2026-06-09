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
  const [globalState, setGlobalState] = useState<{isActive: boolean, isPlaying: boolean, roomPin: string, mode: string, customWords: any, sessionId: string, joinedStudents: string[], gameEndTime: number | null, attemptsLimit?: number}>({isActive: false, isPlaying: false, roomPin: '', mode: 'infantil', customWords: null, sessionId: '', joinedStudents: [], gameEndTime: null, attemptsLimit: 0});
  const [currentSession, setCurrentSession] = useState('');

  const [mode, setMode] = useState<GameMode>('infantil');
  const [user, setUser] = useState<any | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [customWords, setCustomWords] = useState<{word: string, hint: string}[] | undefined>();

  // Nickname registration state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [studentPinInput, setStudentPinInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Professor PIN & Feedback state
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherPinInput, setTeacherPinInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{text: string, isError: boolean} | null>(null);

  // Time Limit config
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(3);
  const [teacherGameStyle, setTeacherGameStyle] = useState<'ahorcado'|'sopa_letras'|'crucigrama'>('ahorcado');

  // PIN Configuration for Teacher
  const [pinSemester, setPinSemester] = useState('A2026');
  const [pinSubject, setPinSubject] = useState('');
  const [pinGroup, setPinGroup] = useState('');
  const [pinTopic, setPinTopic] = useState('');

  const buildRoomPin = () => {
     let parts = [];
     if (pinSemester.trim()) parts.push(pinSemester.trim().toUpperCase().replace(/\s+/g, ''));
     
     if (pinSubject.trim()) {
        const subjStr = pinSubject.trim().split(' ').map(w => w.substring(0,3).toUpperCase()).join('');
        if (subjStr) parts.push(subjStr);
     }

     if (pinGroup.trim()) {
        parts.push(pinGroup.trim().toUpperCase().substring(0,2));
     }
     
     if (pinTopic.trim()) {
        const topicStr = pinTopic.trim().split(' ').map(w => w.substring(0,3).toUpperCase()).join('');
        if (topicStr) parts.push(topicStr);
     }
     
     const randomDigits = Math.floor(100 + Math.random() * 900).toString(); // 3 digit suffix
     parts.push(randomDigits);
     
     return parts.join('-');
  };

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
        const currentPin = role === 'teacher' ? localStorage.getItem('teacher_active_room') : localStorage.getItem('last_room_pin');
        const res = await fetch(`/api/game-state?roomPin=${currentPin || ''}`);
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
             const attemptsInfo = localStorage.getItem(`attempts_${data.sessionId}`);
             const attempts = attemptsInfo ? parseInt(attemptsInfo, 10) : 0;
             if (data.attemptsLimit && data.attemptsLimit > 0 && attempts >= data.attemptsLimit) {
                // Prevent auto-starting if limit is reached
             } else {
                startGame(data.mode as GameMode, data.customWords, data.sessionId);
             }
          }
        }
      } catch (e) {}
    };
    fetchState();
    const interval = setInterval(fetchState, 1500); // 1.5s update for clocks
    return () => clearInterval(interval);
  }, [curScreen, currentSession, role, user]);

  const startGame = (m: GameMode, words?: {word: string, hint: string}[], sessionIdToTrack?: string) => {
    if (role === 'student' && sessionIdToTrack) {
       const attemptsInfo = localStorage.getItem(`attempts_${sessionIdToTrack}`);
       const attempts = attemptsInfo ? parseInt(attemptsInfo, 10) : 0;
       
       if (globalState.attemptsLimit && globalState.attemptsLimit > 0 && attempts >= globalState.attemptsLimit) {
           showToast("Ya has alcanzado el límite de intentos para esta lección.", true);
           return;
       }
       localStorage.setItem(`attempts_${sessionIdToTrack}`, (attempts + 1).toString());
    }

    setMode(m);
    setCustomWords(words);
    setCurScreen('game');
  };

  const publishGame = async (m: GameMode, words?: {word: string, hint: string}[], attemptsLimit?: number) => {
    const pin = localStorage.getItem('teacher_pin') || '';
    const roomPinCode = buildRoomPin();
    const defaultTime = words ? words.length * 2 : (m === 'infantil' ? 10 : 15);
    setTimeLimitMinutes(defaultTime);
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
          gameEndTime: null,
          attemptsLimit: attemptsLimit || 0
        })
      });
      if (res.ok) {
        localStorage.setItem('teacher_active_room', roomPinCode);
        showToast("¡Sala creada! Esperando estudiantes.");
      } else {
        if (res.status === 403) {
          showToast("Error: PIN de profesor revocado o inválido. Por favor, ingresa nuevamente.", true);
          setRole(null);
          localStorage.removeItem('teacher_pin');
          setShowTeacherModal(true);
        } else {
          showToast("Error al publicar la sala.", true);
        }
      }
    } catch(e) {}
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 font-bold text-gray-600">Cargando partida...</div>;
  }

  const launchClassGame = async (styleToLaunch?: string) => {
    const pin = localStorage.getItem('teacher_pin') || '';
    let endTime = Date.now() + timeLimitMinutes * 60 * 1000;
    try {
      await fetch('/api/game-state', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ pin, roomPin: globalState.roomPin, isPlaying: true, gameEndTime: endTime, selectedGameStyle: styleToLaunch || teacherGameStyle })
      });
      showToast("¡Juego iniciado en la clase!");
    } catch (e) {}
  };

  const kickStudent = async (studentName: string) => {
    const pin = localStorage.getItem('teacher_pin') || '';
    try {
      const res = await fetch('/api/kick-student', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ pin, roomPin: globalState.roomPin, studentName })
      });
      if (res.ok) {
         showToast(`Has expulsado a ${studentName} de la sala.`);
         // Optimistically update UI
         setGlobalState(prev => ({
           ...prev,
           joinedStudents: (prev.joinedStudents || []).filter(name => name !== studentName)
         }));
      }
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
                className="flex items-center gap-2 bg-red-500 border-[2px] border-[var(--dark)] px-4 py-2 rounded-[12px] font-bold tracking-tight hover:brightness-95 cursor-pointer shadow-[2px_2px_0px_rgba(27,26,25,1)] hover:translate-y-[-1px] transition-all text-xs uppercase text-white"
                title="Borrar o Cambiar mi Nombre"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Cambiar Nombre</span>
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
            {(!globalState.isActive || globalState.roomPin !== localStorage.getItem('last_room_pin')) ? (
              <div className="brutal-box p-12 bg-white flex flex-col items-center">
                <h2 className="text-4xl font-black uppercase text-[var(--primary)] mb-4">Ingresar a Clase</h2>
                <p className="font-bold mb-8">Ingresa el PIN que te dio tu profesor para entrar a la sala.</p>
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
                {(() => {
                   const attemptsInfo = localStorage.getItem(`attempts_${globalState.sessionId}`);
                   const attempts = attemptsInfo ? parseInt(attemptsInfo, 10) : 0;
                   const limit = globalState.attemptsLimit || 0;
                   if (limit > 0 && attempts >= limit) {
                     return (
                         <div className="bg-red-100 border-2 border-red-500 text-red-700 font-bold p-4 rounded-xl text-lg">
                            Has alcanzado el límite de intentos permitidos ({limit}) para esta lección.
                         </div>
                     );
                   }
                   return (
                     <button 
                        onClick={() => startGame(globalState.mode as GameMode, globalState.customWords, globalState.sessionId)}
                        className="brutal-btn bg-[var(--secondary)] text-white text-2xl py-6 px-12 animate-pulse hover:animate-none cursor-pointer"
                     >
                       🚀 ¡Entrar a Jugar!
                     </button>
                   );
                })()}
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
              <div className="font-bold my-4 text-lg bg-white/50 inline-block px-6 py-2 rounded-full border-2 border-[var(--dark)] relative z-10">
                Estado de la clase: {globalState.isActive ? <span className="text-green-700 font-black">Activo (MODO: {globalState.mode.toUpperCase()})</span> : <span className="text-red-600 font-black">Inactivo (Sala de espera)</span>}
              </div>

              {globalState.isActive && (
                <div className="mb-8 w-full max-w-sm mx-auto bg-yellow-300 border-[6px] border-black p-4 shadow-[8px_8px_0_0_black] -rotate-1 relative z-10">
                  <p className="font-black text-xl uppercase mb-1">PIN PARA ALUMNOS:</p>
                  <p className="font-black text-6xl tracking-[0.1em]">{globalState.roomPin}</p>
                </div>
              )}
              
              {globalState.isActive && !globalState.isPlaying && (
                <div className="mt-4 bg-white p-6 border-4 border-[var(--dark)] inline-block relative z-10 w-full max-w-sm mx-auto shadow-[4px_4px_0_0_var(--dark)]">
                  <h3 className="text-xl font-bold uppercase mb-2">Sala de Espera</h3>
                  
                  <div className="mb-4 text-left border-2 border-black p-2 bg-gray-50 h-32 overflow-y-auto w-full">
                    <p className="font-bold text-gray-500 mb-2 border-b-2 border-black pb-1 text-sm">
                      {globalState.joinedStudents?.length || 0} estudiantes conectados
                    </p>
                    {globalState.joinedStudents && globalState.joinedStudents.length > 0 ? (
                      <ul className="space-y-1">
                        {globalState.joinedStudents.map((s: string) => (
                          <li key={s} className="flex justify-between items-center bg-white border border-gray-200 p-1 text-sm">
                            <span className="font-bold truncate" title={s}>{s}</span>
                            <button 
                               onClick={() => kickStudent(s)} 
                               className="text-red-500 hover:text-red-700 font-bold px-2 py-0.5 border border-red-200 bg-red-50"
                               title="Expulsar"
                            >X</button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full opacity-50">
                         <span className="text-xs font-bold">Aún no hay estudiantes</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-6 text-left w-full">
                    <label className="block font-bold text-[var(--dark)] mb-2 uppercase text-sm">Tiempo Límite (Minutos):</label>
                    <div className="flex gap-2">
                      <button onClick={() => setTimeLimitMinutes(prev => Math.max(1, prev - 1))} className="brutal-btn bg-gray-200 px-4 py-2 font-black text-xl hover:bg-gray-300">-</button>
                      <div className="flex-1 brutal-box p-2 text-center text-xl font-black bg-gray-100">{timeLimitMinutes} min</div>
                      <button onClick={() => setTimeLimitMinutes(prev => prev + 1)} className="brutal-btn bg-gray-200 px-4 py-2 font-black text-xl hover:bg-gray-300">+</button>
                    </div>
                  </div>

                  <div className="w-full text-left mb-4">
                    <h3 className="block font-black text-[var(--dark)] mb-3 text-lg uppercase text-center bg-yellow-200 border-2 border-black py-2 rounded-lg">¿Qué van a jugar?</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => {
                          setTeacherGameStyle('ahorcado');
                          setTimeout(() => launchClassGame('ahorcado'), 0);
                        }}
                        className="brutal-btn w-full bg-[var(--primary)] text-white font-black py-3 text-sm flex items-center justify-center gap-2 hover:bg-orange-600"
                      >
                        <Gamepad2 className="w-5 h-5" /> ¡INICIAR AHORCADO!
                      </button>

                      <button 
                        onClick={() => {
                          setTeacherGameStyle('sopa_letras');
                          setTimeout(() => launchClassGame('sopa_letras'), 0);
                        }}
                        className="brutal-btn w-full bg-[var(--secondary)] text-white font-black py-3 text-sm flex items-center justify-center gap-2 hover:bg-green-600"
                      >
                        <Search className="w-5 h-5" /> ¡INICIAR SOPA DE LETRAS!
                      </button>

                      <button 
                        onClick={() => {
                          setTeacherGameStyle('crucigrama');
                          setTimeout(() => launchClassGame('crucigrama'), 0);
                        }}
                        className="brutal-btn w-full bg-indigo-600 text-white font-black py-3 text-sm flex items-center justify-center gap-2 hover:bg-indigo-700"
                      >
                        <Grid className="w-5 h-5" /> ¡INICIAR CRUCIGRAMA!
                      </button>
                    </div>
                  </div>

                  <button 
                     onClick={async () => {
                       await fetch('/api/game-state', {
                         method: 'POST',
                         headers: {'Content-Type': 'application/json'},
                         body: JSON.stringify({ pin: localStorage.getItem('teacher_pin'), roomPin: globalState.roomPin, isActive: false })
                       });
                       localStorage.setItem('teacher_last_room', globalState.roomPin);
                       localStorage.removeItem('teacher_active_room');
                     }}
                     className="mt-2 w-full brutal-btn bg-[#ff4d4d] text-white py-3 font-bold uppercase hover:bg-red-600"
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
                           body: JSON.stringify({ pin: localStorage.getItem('teacher_pin'), roomPin: globalState.roomPin, isActive: false })
                         });
                         localStorage.setItem('teacher_last_room', globalState.roomPin);
                         localStorage.removeItem('teacher_active_room');
                      }}
                      className="w-full brutal-btn bg-[#ff4d4d] text-white text-sm px-4 py-3 cursor-pointer shadow-[3px_3px_0_0_var(--dark)]"
                    >
                      Terminar
                    </button>
                  </div>
                </div>
              )}

              {globalState.isActive && globalState.isPlaying && (
                <LiveClassStats joinedStudents={globalState.joinedStudents || []} gameEndTime={globalState.gameEndTime} roomPin={globalState.roomPin} />
              )}
            </div>

            <div className="text-center space-y-2 pt-4">
              <h2 className="text-3xl font-black tracking-tight uppercase">
                {globalState.isActive ? 'Cambiar Lección' : '1. CREAR SESIÓN: Elige qué van a jugar'}
              </h2>
              <p className="font-bold opacity-80">
                Al seleccionar un modo u configurar una lección, esta será enviada directamente a las pantallas de tus estudiantes.
              </p>
            </div>

            {!globalState.isActive && (
              <div className="w-full bg-white p-6 border-4 border-black shadow-[4px_4px_0_0_black]">
                <h3 className="text-xl font-black uppercase mb-4">Configurar PIN de Sala</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                  <div>
                    <label className="block font-bold mb-1">Semestre</label>
                    <input 
                      type="text" 
                      value={pinSemester}
                      onChange={e => setPinSemester(e.target.value)}
                      placeholder="Ej. A2026"
                      className="w-full p-2 border-2 border-black font-bold outline-none focus:bg-gray-100 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Materia</label>
                    <input 
                      type="text" 
                      value={pinSubject}
                      onChange={e => setPinSubject(e.target.value)}
                      placeholder="Ej. Auditoría Forense"
                      className="w-full p-2 border-2 border-black font-bold outline-none focus:bg-gray-100 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Grupo / Paralelo</label>
                    <input 
                      type="text" 
                      value={pinGroup}
                      onChange={e => setPinGroup(e.target.value)}
                      placeholder="Ej. A, B"
                      className="w-full p-2 border-2 border-black font-bold outline-none focus:bg-gray-100 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Tema</label>
                    <input 
                      type="text" 
                      value={pinTopic}
                      onChange={e => setPinTopic(e.target.value)}
                      placeholder="Ej. Teorías"
                      className="w-full p-2 border-2 border-black font-bold outline-none focus:bg-gray-100 uppercase"
                    />
                  </div>
                </div>
                <div className="mt-4 p-3 bg-gray-100 border-2 border-dashed border-gray-400 text-center font-bold">
                  Vista Previa del PIN de sala: <span className="text-[var(--primary)] text-xl font-black">{buildRoomPin()}</span> (Se regenerarán los 3 últimos dígitos al crear)
                </div>
              </div>
            )}

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
             onStart={(words, m, attempts) => {
               if (role === 'teacher') publishGame(m as GameMode, words, attempts);
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
            roomPin={globalState.roomPin || localStorage.getItem('last_room_pin') || undefined}
            forcedGameStyle={globalState.selectedGameStyle}
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
              if (!firstNameInput.trim() || !lastNameInput.trim() || !usernameInput.trim()) {
                setLoginError('Por favor completa todos los campos.');
                return;
              }
              const formattedName = `${firstNameInput.trim()} ${lastNameInput.trim()} (@${usernameInput.trim()})`;
              loginWithNickname(formattedName, usernameInput.trim());
              setShowLoginModal(false);
              setFirstNameInput('');
              setLastNameInput('');
              setUsernameInput('');
              setLoginError('');
            }} className="space-y-4">
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="block text-sm font-black uppercase text-[var(--dark)] mb-1">
                    Nombre
                  </label>
                  <input 
                    type="text"
                    maxLength={20}
                    value={firstNameInput}
                    onChange={(e) => setFirstNameInput(e.target.value)}
                    placeholder="Ej: Juan" 
                    className="w-full p-3 brutal-box text-sm font-bold outline-none border-[3px] border-[var(--dark)] focus:border-[var(--primary)] placeholder:opacity-50 bg-white"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm font-black uppercase text-[var(--dark)] mb-1">
                    Apellido
                  </label>
                  <input 
                    type="text"
                    maxLength={20}
                    value={lastNameInput}
                    onChange={(e) => setLastNameInput(e.target.value)}
                    placeholder="Ej: Pérez" 
                    className="w-full p-3 brutal-box text-sm font-bold outline-none border-[3px] border-[var(--dark)] focus:border-[var(--primary)] placeholder:opacity-50 bg-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-black uppercase text-[var(--dark)] mb-1">
                  Usuario Corto
                </label>
                <input 
                  type="text"
                  maxLength={10}
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Ej: juanperez1" 
                  className="w-full p-3 brutal-box text-sm font-bold outline-none border-[3px] border-[var(--dark)] focus:border-[var(--primary)] placeholder:opacity-50 bg-white"
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
              Introduce el PIN para administrar la sesión. (Por defecto usa: <strong>profe123</strong>)
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const pin = teacherPinInput.trim();
              if (pin) {
                try {
                  const res = await fetch('/api/verify-pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin })
                  });
                  if (res.ok) {
                    localStorage.setItem('teacher_pin', pin);
                    setRole('teacher');
                    setShowTeacherModal(false);
                    setTeacherPinInput('');
                    setLoginError('');
                  } else {
                    setLoginError('PIN Incorrecto');
                  }
                } catch(e) {
                  setLoginError('Error de red');
                }
              }
            }} className="space-y-4">
              {loginError && <div className="text-red-500 font-bold mb-2 uppercase">{loginError}</div>}
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

      {/* Footer */}
      <footer className="mt-auto pt-8 text-center pb-4 text-sm font-bold text-gray-500">
        <p>Una aplicación creada por <span className="text-gray-800">Fabián Delgado Loor</span></p>
        <p className="mt-1">
          <a 
            href="https://deltechaudit.ec/quienes-somos/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline hover:text-[var(--primary)] transition-colors"
          >
            Deltech Audit
          </a>
        </p>
      </footer>
    </div>
  );
}
