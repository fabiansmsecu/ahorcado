import React, { useState, useEffect } from 'react';
import { GameMode, GameState } from '../types';
import { HangmanFigure } from './HangmanFigure';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { auth, saveUserScore, getCurrentUser } from '../firebase';
import { playSound } from '../audio';
import { Clock, Gamepad2, Grid, Search, Trophy, BookOpen } from 'lucide-react';

import { LiveClassStats } from './LiveClassStats';
import { CrosswordGame } from './CrosswordGame';
import { WordSearchGame } from './WordSearchGame';

interface WordData {
  word: string;
  hint: string;
}

interface GameProps {
  mode: GameMode;
  onBack: () => void;
  customWords?: {word: string, hint: string}[];
  globalEndTime?: number | null;
  roomPin?: string;
  forcedGameStyle?: 'ahorcado' | 'sopa_letras' | 'crucigrama';
}

const ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

export const Game: React.FC<GameProps> = ({ mode, onBack, customWords, globalEndTime, roomPin, forcedGameStyle }) => {
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [remainingCustomWords, setRemainingCustomWords] = useState<{word: string, hint: string}[] | null>(
    customWords ? [...customWords] : null
  );

  const isKids = mode === 'infantil';
  const maxMistakes = 3;

  const INFANTIL_WORDS = [
    { word: "GATO", hint: "Animal que maúlla y caza ratones" },
    { word: "SOL", hint: "Estrella grande que nos da luz y calor de día" },
    { word: "LUNA", hint: "Sale de noche en el cielo y brilla" },
    { word: "MESA", hint: "Mueble con cuatro patas donde comemos" },
    { word: "ROSA", hint: "Flor hermosa que tiene espinas" },
    { word: "AGUA", hint: "Líquido transparente que bebemos cuando tenemos sed" },
    { word: "PERRO", hint: "Animal que ladra y es el mejor amigo de las personas" },
    { word: "PAN", hint: "Alimento horneado que se hace con harina" },
    { word: "TREN", hint: "Vehículo largo que viaja sobre rieles" },
    { word: "CASA", hint: "Lugar donde vives con tu familia" }
  ];

  const UNIVERSITARIO_WORDS = [
    { word: "PARADIGMA", hint: "Modelo, patrón o ejemplo que sirve de referencia en una ciencia o disciplina." },
    { word: "CATEDRA", hint: "Materia particular que enseña un profesor o aula donde se imparte." },
    { word: "EPISTEME", hint: "Conocimiento científico o saberes firmemente establecidos y fundados." },
    { word: "SINTESIS", hint: "Composición de un todo por la reunión de sus partes o resumen descriptivo." },
    { word: "HEURISTICA", hint: "Arte o ciencia del descubrimiento, invención o resolución pragmática de problemas." },
    { word: "EVIDENCIA", hint: "Certeza manifiesta y tan clara que nadie puede dudar legítimamente de ella." },
    { word: "METODOLOGIA", hint: "Conjunto de procedimientos que se siguen rigurosamente en una investigación." },
    { word: "ANALOGIA", hint: "Relación o correspondencia lógica de semejanza entre cosas distintas." }
  ];

  const [selectedStyle, setSelectedStyle] = useState<'selection' | 'ahorcado' | 'crucigrama' | 'sopa_letras'>(forcedGameStyle || 'selection');
  
  useEffect(() => {
    if (forcedGameStyle) {
      setSelectedStyle(forcedGameStyle);
    } else {
      setSelectedStyle('selection');
    }
  }, [forcedGameStyle]);

  const [startTime, setStartTime] = useState<number>(0);

  const fetchWord = async () => {
    setLoading(true);
    setWordData(null);
    setGuessedLetters(new Set());
    setMistakes(0);
    setGameState('playing');
    
    // Set dynamic limit depending on game difficulty mode
    let initialTime = 90; // Default normal
    if (mode === 'facil' || mode === 'infantil') {
      initialTime = 120;
    } else if (mode === 'dificil') {
      initialTime = 75;
    } else if (mode === 'superdificil') {
      initialTime = 40; // High stakes pressure
    } else if (mode === 'universitario') {
      initialTime = 90;
    }
    setTimeLeft(initialTime);
    setStartTime(Date.now());

    if (remainingCustomWords !== null) {
      if (remainingCustomWords.length === 0) {
        setGameState('completed');
        setLoading(false);
        return;
      }
      const randomIndex = Math.floor(Math.random() * remainingCustomWords.length);
      const picked = remainingCustomWords[randomIndex];
      // remove picked word from remaining
      const newRemaining = remainingCustomWords.filter((_, i) => i !== randomIndex);
      setRemainingCustomWords(newRemaining);
      
      setWordData(picked);
      setLoading(false);
      return;
    }

    if (isKids) {
      const randomWord = INFANTIL_WORDS[Math.floor(Math.random() * INFANTIL_WORDS.length)];
      setWordData({ word: randomWord.word.toUpperCase(), hint: randomWord.hint });
      setLoading(false);
      return;
    }

    try {
      const prompt = `Genera una palabra secreta única, educativa y sumamente interesante en español de nivel universitario (conceptos generales de administración, ciencia, historia, tecnología, literatura o sociedad).
Evita a toda costa términos excesivamente raros, rebuscados, arcaicos o de uso extremadamente limitado. La palabra debe ser común y reconocible.
Retorna la palabra y la pista separadas por un pipe (|).
Ejemplo: TECNOLOGÍA|Conjunto de teorías y de técnicas que permiten el aprovechamiento práctico del conocimiento científico.
Instrucciones críticas:
1. La palabra debe ir ANTES del pipe, en MAYÚSCULAS, SIN TILDES, UNA SOLA PALABRA.
2. La pista va DESPUÉS del pipe y debe ser clara e inteligente.
3. No incluyas markdown ni nada más.`;

      const response = await fetch('/api/generate-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const dataJson = await response.json();
      const text = dataJson.text || "";
      const parts = text.split('|');
      
      if (parts.length >= 2) {
        const word = parts[0].trim();
        const hint = parts.slice(1).join('|').trim();
        // Remove accents and ensure uppercase
        const cleanWord = word.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, "");
        if (cleanWord.length > 0) {
          setWordData({ word: cleanWord, hint: hint });
        } else {
          throw new Error("Invalid word");
        }
      } else {
        setWordData({ word: "UNIVERSIDAD", hint: "Institución académica" }); // fallback
      }
    } catch (e) {
      console.error(e);
      setWordData({ word: "PROGRAMACION", hint: "El arte de crear software" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset custom words pool when game mode/props change
    if (customWords) {
      setRemainingCustomWords([...customWords]);
    } else {
      setRemainingCustomWords(null);
    }
  }, [mode, customWords]);

  useEffect(() => {
    // Start fetching first word when remaining queue is ready or if it's default mode
    if ((customWords && remainingCustomWords === null) && !loading) return; 
    // ^ just a small check to let the previous effect run first
    fetchWord();
  }, [mode, customWords]); // Re-fetch initial word when mode or custom logic changes

  useEffect(() => {
    if (!wordData || gameState !== 'playing') return;

    if (!globalEndTime && timeLeft <= 0) {
       setGameState('lost');
       playSound.lose();
       updateUserScore(false);
       return;
    }

    const timerId = setInterval(() => {
      if (globalEndTime) {
         const remaining = Math.max(0, Math.floor((globalEndTime - Date.now()) / 1000));
         setTimeLeft(remaining);
         if (remaining <= 0) {
            setGameState('lost');
            playSound.lose();
            updateUserScore(false);
            clearInterval(timerId);
         }
      } else {
         setTimeLeft(prev => prev - 1);
      }
    }, 1000);

    return () => clearInterval(timerId);
  }, [globalEndTime, timeLeft, wordData, gameState]);

  useEffect(() => {
    if (!wordData || gameState !== 'playing') return;

    const uniqueLetters = new Set(wordData.word.split("").filter(c => c !== ' '));
    const isWon = Array.from(uniqueLetters).every(char => guessedLetters.has(char));
    const isLost = mistakes >= maxMistakes;

    if (isWon) {
      setGameState('won');
      playSound.win();
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700', '#FF8C00', '#00FA9A'] });
      updateUserScore(true);
    } else if (isLost) {
      setGameState('lost');
      playSound.lose();
      updateUserScore(false);
    }
  }, [guessedLetters, mistakes, wordData, gameState]);

  const updateUserScore = async (won: boolean) => {
    const user = getCurrentUser();
    
    // Fallback if fully anonymous/offline without name
    let uid = localStorage.getItem('guest_uid') || "local-guest-" + Math.floor(Math.random()*10000);
    localStorage.setItem('guest_uid', uid);
    
    let name = "Jugador Anónimo";

    if (user) {
      uid = user.uid;
      name = user.displayName || user.name || name;
    } else {
      // Maybe we stored name via lobby?
      const localName = localStorage.getItem('local_user') || localStorage.getItem('student_name');
      if (localName) {
         try {
           const parsed = JSON.parse(localName);
           name = parsed.displayName || parsed.name || localName;
         } catch {
           name = localName;
         }
      }
    }

    const timeSpent = Math.floor((Date.now() - startTime) / 1000); // in seconds
    
    // Points based on time and mistakes: base 10 + time bonus 
    let points = won ? 10 : 0;
    if (won) {
        if (timeSpent < 10) points += 5; // Fast guess!
        if (mistakes === 0) points += 5; // Perfect execution
    }

    try {
      await saveUserScore(uid, name, points, won, wordData?.word, timeSpent, mistakes);
    } catch (error) {
      console.warn("Could not save score:", error);
    }

    try {
      await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid, 
          name, 
          won, 
          word: wordData?.word, 
          score: won ? 10 : 0,
          roomPin: localStorage.getItem('last_room_pin')
        })
      });
    } catch (e) {
      console.warn("Could not update class stats:", e);
    }
  };

  const saveCompletedGameScore = async (earnedPoints: number, secondsBeforeWin: number, gameStyleName: string) => {
    const user = getCurrentUser();
    let uid = localStorage.getItem('guest_uid') || "local-guest-" + Math.floor(Math.random()*10000);
    localStorage.setItem('guest_uid', uid);
    let name = "Jugador Anónimo";

    if (user) {
      uid = user.uid;
      name = user.displayName || user.name || name;
    } else {
      const localName = localStorage.getItem('local_user') || localStorage.getItem('student_name');
      if (localName) {
         try {
           const parsed = JSON.parse(localName);
           name = parsed.displayName || parsed.name || localName;
         } catch {
           name = localName;
         }
      }
    }

    try {
      await saveUserScore(uid, name, earnedPoints, true, `Completado: ${gameStyleName}`, secondsBeforeWin, 0);
    } catch (error) {
      console.warn("Could not save score:", error);
    }

    try {
      await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid, 
          name, 
          won: true, 
          word: `Completado: ${gameStyleName}`, 
          score: earnedPoints,
          roomPin: localStorage.getItem('last_room_pin')
        })
      });
    } catch (e) {
      console.warn("Could not update class stats:", e);
    }
  };

  const handlePartialScore = async (points: number, word: string, won: boolean) => {
    const user = getCurrentUser();
    let uid = localStorage.getItem('guest_uid') || "local-guest-" + Math.floor(Math.random()*10000);
    localStorage.setItem('guest_uid', uid);
    let name = "Jugador Anónimo";

    if (user) {
      uid = user.uid;
      name = user.displayName || user.name || name;
    } else {
      const localName = localStorage.getItem('local_user') || localStorage.getItem('student_name');
      if (localName) {
         try {
           const parsed = JSON.parse(localName);
           name = parsed.displayName || parsed.name || localName;
         } catch {
           name = localName;
         }
      }
    }

    try {
      await saveUserScore(uid, name, points, won, word, 0, won ? 0 : 1);
    } catch (e) {}
    
    try {
      await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid, name, won, word, score: points, roomPin: localStorage.getItem('last_room_pin')
        })
      });
    } catch {}
  };

  const handleGuess = (char: string) => {
    if (gameState !== 'playing' || guessedLetters.has(char) || !wordData) return;

    const newSet = new Set(guessedLetters).add(char);
    setGuessedLetters(newSet);

    if (!wordData.word.includes(char)) {
      setMistakes(m => m + 1);
      playSound.wrong();
    } else {
      playSound.correct();
    }
  };

  const handleWinAlternativeGame = async (points: number, timeSpent: number, styleName: string) => {
    await saveCompletedGameScore(points, timeSpent, styleName);
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    setGameState('completed');
  };

  // Word arrays source
  const activeGameWords = customWords && customWords.length > 0
    ? customWords
    : (isKids ? INFANTIL_WORDS : UNIVERSITARIO_WORDS);

  const renderCompletedModal = () => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="brutal-box p-8 max-w-sm w-full text-center animate-in zoom-in-95 bg-[var(--white)] border-4 border-black shadow-[8px_8px_0_0_#000]">
        <h2 className="text-4xl font-black mb-4 uppercase text-[var(--secondary)]">
          ¡Lección Completada!
        </h2>
        <p className="text-[var(--dark)] font-bold mb-6">
          Has terminado esta actividad interactiva con éxito. ¡Sigue aprendiendo con nuevos retos!
        </p>
        
        <button 
          onClick={onBack}
          className="w-full brutal-btn bg-white border-2 border-black text-black hover:bg-gray-100 font-bold py-2.5 uppercase"
        >
          Volver al Menú Principal
        </button>
      </div>
    </div>
  );



  if (selectedStyle === 'selection') {
    return (
      <div className="flex flex-col items-center w-full max-w-5xl mx-auto p-4 space-y-8 animate-in fade-in duration-200">
        <div className="text-center space-y-2 max-w-2xl mt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--accent)] border-2 border-black text-xs font-black uppercase tracking-wider rounded-full shadow-[2px_2px_0_0_#000]">
            <BookOpen className="w-3.5 h-3.5" /> MODO: {mode}
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--dark)] tracking-tight">
            🎮 Selecciona tu Actividad
          </h1>
          <p className="text-slate-600 font-bold text-sm md:text-base leading-relaxed">
            Elige una de las tres dinámicas interactivas para practicar y dominar el vocabulario configurado en esta lección.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {/* Card 1: Ahorcado */}
          <div className="brutal-box p-6 bg-amber-50 hover:-translate-y-2 hover:translate-x-1 hover:shadow-[10px_10px_0_0_#000] transition-all flex flex-col justify-between border-4 border-black group shadow-[5px_5px_0_0_#000]">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-amber-300 border-3 border-black flex items-center justify-center shadow-[3px_3px_0_0_#000] shrink-0">
                <Gamepad2 className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
                Ahorcado Clásico
              </h2>
              <p className="text-xs font-bold text-slate-600 leading-relaxed">
                Descubre los conceptos letra por letra antes de agotar los turnos. El clásico dibujo para afianzar retención de términos.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStyle('ahorcado');
                playSound.correct();
              }}
              className="mt-8 brutal-btn w-full bg-[var(--primary)] text-white font-black py-3 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              ¡JUGAR AHORCADO!
            </button>
          </div>

          {/* Card 2: Sopa de Letras */}
          <div className="brutal-box p-6 bg-teal-50 hover:-translate-y-2 hover:translate-x-1 hover:shadow-[10px_10px_0_0_#000] transition-all flex flex-col justify-between border-4 border-black group shadow-[5px_5px_0_0_#000]">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-teal-300 border-3 border-black flex items-center justify-center shadow-[3px_3px_0_0_#000] shrink-0">
                <Search className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
                Sopa de Letras
              </h2>
              <p className="text-xs font-bold text-slate-600 leading-relaxed">
                Localiza las palabras clave ocultas en una retícula interactiva de letras mezcladas. Soporta búsqueda diagonal y bidireccional.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStyle('sopa_letras');
                playSound.correct();
              }}
              className="mt-8 brutal-btn w-full bg-[var(--secondary)] text-white font-black py-3 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              ¡BUSCAR PALABRAS!
            </button>
          </div>

          {/* Card 3: Crucigrama */}
          <div className="brutal-box p-6 bg-purple-50 hover:-translate-y-2 hover:translate-x-1 hover:shadow-[10px_10px_0_0_#000] transition-all flex flex-col justify-between border-4 border-black group shadow-[5px_5px_0_0_#000]">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-purple-300 border-3 border-black flex items-center justify-center shadow-[3px_3px_0_0_#000] shrink-0">
                <Grid className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
                Crucigrama
              </h2>
              <p className="text-xs font-bold text-slate-600 leading-relaxed">
                Interpola los términos de manera cruzada descifrando sus definiciones y pistas académicas en una plantilla interactiva.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStyle('crucigrama');
                playSound.correct();
              }}
              className="mt-8 brutal-btn w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              ¡RESOLVER CRUCIGRAMA!
            </button>
          </div>
        </div>

        <button 
          onClick={onBack}
          className="brutal-btn bg-white hover:bg-gray-100 text-black border-2 border-black max-w-xs font-black py-2.5 px-8 flex items-center gap-2 transition-all cursor-pointer"
        >
          ← Volver al Menú
        </button>
      </div>
    );
  }

  if (selectedStyle === 'sopa_letras') {
    return (
      <div className="w-full animate-in fade-in duration-200">
        <div className="max-w-6xl mx-auto px-4 pt-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-black font-black uppercase mb-1 border-b border-transparent hover:border-black"
          >
            ← Volver al Panel
          </button>
        </div>
        <WordSearchGame 
          words={activeGameWords} 
          onBack={onBack} 
          onWinAll={(points, seconds) => handleWinAlternativeGame(points, seconds, "Sopa de Letras")}
          onPartialScore={handlePartialScore}
        />
        {gameState === 'completed' && renderCompletedModal()}
      </div>
    );
  }

  if (selectedStyle === 'crucigrama') {
    return (
      <div className="w-full animate-in fade-in duration-200">
        <div className="max-w-6xl mx-auto px-4 pt-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-black font-black uppercase mb-1 border-b border-transparent hover:border-black"
          >
            ← Volver al Panel
          </button>
        </div>
        <CrosswordGame 
          words={activeGameWords} 
          onBack={onBack} 
          onWinAll={(points, seconds) => handleWinAlternativeGame(points, seconds, "Crucigrama")}
          onPartialScore={handlePartialScore}
        />
        {gameState === 'completed' && renderCompletedModal()}
      </div>
    );
  }

  // --- HANGMAN GAMEPLAY VIEW ---

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="animate-spin h-10 w-10 border-4 border-orange-500 rounded-full border-t-transparent flex-shrink-0" />
        <p className={isKids ? "text-orange-600 font-bold" : "text-gray-600 font-mono"}>
          Pensando en una palabra...
        </p>
      </div>
    );
  }

  if (!wordData) return null;

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex justify-between w-full items-center mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="brutal-btn bg-[var(--white)] text-[var(--dark)] flex items-center gap-2 px-6 py-2"
          >
            ← Panel
          </button>
        </div>

        {/* Timer UI */}
        <div className={cn(
            "flex items-center gap-2 brutal-box px-6 py-2 text-2xl font-black bg-[var(--white)] border-[4px]",
            timeLeft <= 10 ? "text-red-600 animate-pulse bg-red-100" : "text-[var(--dark)]"
        )}>
           <Clock className="w-6 h-6" />
           {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>

        <div className="mode-badge uppercase">
          Modo: {mode}
        </div>
      </div>

      <div className="w-full flex flex-col md:flex-row lg:grid lg:grid-cols-[450px_1fr] gap-8 items-start justify-center">
        <HangmanFigure mistakes={mistakes} mode={mode} />

        <div className="flex flex-col items-center space-y-8 w-full">
          {/* Hint */}
          <div className="brutal-box w-full max-w-md text-center p-6 bg-[var(--accent)] text-[var(--dark)]">
            <p className="font-bold text-lg">💡 Pista: {wordData.hint}</p>
          </div>

          {/* Word Display */}
          <div translate="no" className="notranslate brutal-box w-full py-6 md:py-8 px-2 md:px-4 text-center">
            <div className="flex flex-wrap justify-center gap-x-6 md:gap-x-12 gap-y-4 text-2xl md:text-5xl font-black uppercase tracking-widest text-[var(--dark)]">
              {wordData.word.split(' ').map((wordPart, wpIdx) => (
                <div key={wpIdx} className="flex flex-wrap justify-center gap-x-1 sm:gap-x-2">
                  {wordPart.split('').map((char, i) => (
                    <span 
                      key={`${wpIdx}-${i}`} 
                      className={cn(
                        "inline-block border-b-[3px] md:border-b-4 border-[var(--dark)] pb-1 min-w-[24px] sm:min-w-[32px] md:min-w-[48px]",
                        !guessedLetters.has(char) && gameState === 'playing' ? "text-transparent" : "text-current",
                        (gameState === 'lost' && !guessedLetters.has(char)) && "text-[var(--primary)]"
                      )}
                    >
                      {char}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Keyboard */}
          <div translate="no" className="notranslate brutal-box w-full p-4 md:p-6 grid grid-cols-7 sm:grid-cols-9 gap-2 md:gap-3 bg-[var(--white)]">
            {ALPHABET.map(char => {
              const guessed = guessedLetters.has(char);
              const isCorrect = wordData.word.includes(char);
              return (
                <button
                  key={char}
                  disabled={guessed || gameState !== 'playing'}
                  onClick={() => handleGuess(char)}
                  className={cn(
                    "aspect-square flex justify-center items-center font-bold text-lg rounded-lg transition-transform",
                    !guessed && "bg-[var(--bg-color)] border-2 border-[var(--dark)] hover:scale-105 active:scale-95 cursor-pointer shadow-[2px_2px_0px_rgba(27,26,25,0.1)]",
                    guessed && isCorrect && "bg-[var(--secondary)] text-white border-2 border-[var(--dark)] scale-95",
                    guessed && !isCorrect && "bg-[#E0E0E0] text-[#999] border-2 border-dashed border-[#999] scale-95 cursor-not-allowed"
                  )}
                >
                  {char}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {roomPin && (
         <div className="w-full max-w-4xl mt-8 pb-12">
            <LiveClassStats joinedStudents={[]} gameEndTime={globalEndTime || null} roomPin={roomPin} />
         </div>
      )}

      {/* Game Over Modal overlay */}
      {gameState !== 'playing' && gameState !== 'completed' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="brutal-box p-8 max-w-sm w-full text-center animate-in zoom-in-95 bg-[var(--white)]">
            <h2 className={cn("text-4xl font-black mb-4 uppercase", gameState === 'won' ? "text-[var(--secondary)]" : "text-[var(--primary)]")}>
              {gameState === 'won' ? '¡Ganaste!' : '¡Perdiste!'}
            </h2>
            <p className="text-[var(--dark)] font-bold mb-2">La palabra era:</p>
            <p className="text-3xl font-black mb-8 tracking-widest uppercase text-[var(--dark)]">
              {wordData.word}
            </p>
            {gameState === 'won' && <p className="text-sm font-bold bg-[var(--accent)] border-2 border-[var(--dark)] text-[var(--dark)] p-2 rounded-lg mb-6 shadow-[2px_2px_0px_rgba(27,26,25,0.1)]">+10 Puntos</p>}
            
            <button 
              onClick={fetchWord}
              className="w-full brutal-btn bg-[var(--primary)] text-white hover:brightness-110"
            >
              {customWords ? 'Siguiente Palabra' : 'Jugar de nuevo'}
            </button>
          </div>
        </div>
      )}

      {/* Lesson Completed Modal overlay */}
      {gameState === 'completed' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="brutal-box p-8 max-w-sm w-full text-center animate-in zoom-in-95 bg-[var(--white)]">
            <h2 className="text-4xl font-black mb-4 uppercase text-[var(--secondary)]">
              ¡Lección Completada!
            </h2>
            <p className="text-[var(--dark)] font-bold mb-6">
              Has terminado todas las palabras de esta lección personalizada.
            </p>
            
            <button 
              onClick={onBack}
              className="w-full brutal-btn bg-[var(--primary)] text-white hover:brightness-110"
            >
              Volver al Menú
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
