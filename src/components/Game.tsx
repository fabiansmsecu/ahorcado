import React, { useState, useEffect } from 'react';
import { GameMode, GameState } from '../types';
import { HangmanFigure } from './HangmanFigure';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { auth, saveUserScore, getCurrentUser } from '../firebase';
import { playSound } from '../audio';
import { Clock } from 'lucide-react';

import { LiveClassStats } from './LiveClassStats';

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
}

const ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

export const Game: React.FC<GameProps> = ({ mode, onBack, customWords, globalEndTime, roomPin }) => {
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

  const [startTime, setStartTime] = useState<number>(0);

  const fetchWord = async () => {
    setLoading(true);
    setWordData(null);
    setGuessedLetters(new Set());
    setMistakes(0);
    setGameState('playing');
    setTimeLeft(120); // 120 seconds per word
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
      const prompt = `Genera una palabra secreta única en español para jugar al ahorcado nivel universitario (conceptos científicos, palabras cultas, filosofía, términos complejos).
Retorna la palabra y la pista separadas por un pipe (|).
Ejemplo: EPISTEMOLOGÍA|Rama de la filosofía que estudia los principios, fundamentos, extensión y métodos del conocimiento humano.
Instrucciones críticas:
1. La palabra debe ir ANTES del pipe, en MAYÚSCULAS, SIN TILDES, UNA SOLA PALABRA.
2. La pista va DESPUÉS del pipe.
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
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 space-y-8">
      {/* Header */}
      <div className="flex justify-between w-full items-center mb-4">
        <button 
          onClick={onBack}
          className="brutal-btn bg-[var(--white)] text-[var(--dark)] flex items-center gap-2 px-6 py-2"
        >
          ← Volver
        </button>

        {/* Timer UI */}
        <div className={cn(
            "flex items-center gap-2 brutal-box px-6 py-2 text-2xl font-black bg-[var(--white)] border-[4px]",
            timeLeft <= 10 ? "text-red-600 animate-pulse bg-red-100" : "text-[var(--dark)]"
        )}>
           <Clock className="w-6 h-6" />
           {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>

        <div className="mode-badge">
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
