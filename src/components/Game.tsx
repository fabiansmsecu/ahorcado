import React, { useState, useEffect } from 'react';
import { GameMode, GameState } from '../types';
import { HangmanFigure } from './HangmanFigure';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { auth, saveUserScore } from '../firebase';

interface WordData {
  word: string;
  hint: string;
}

interface GameProps {
  mode: GameMode;
  onBack: () => void;
  customWords?: {word: string, hint: string}[];
}

const ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

export const Game: React.FC<GameProps> = ({ mode, onBack, customWords }) => {
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [loading, setLoading] = useState(true);
  const [remainingCustomWords, setRemainingCustomWords] = useState<{word: string, hint: string}[] | null>(
    customWords ? [...customWords] : null
  );

  const isKids = mode === 'infantil';
  const maxMistakes = 6;

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

  const fetchWord = async () => {
    setLoading(true);
    setWordData(null);
    setGuessedLetters(new Set());
    setMistakes(0);
    setGameState('playing');

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

    const uniqueLetters = new Set(wordData.word.split(""));
    const isWon = Array.from(uniqueLetters).every(char => guessedLetters.has(char) || char === ' ');
    const isLost = mistakes >= maxMistakes;

    if (isWon) {
      setGameState('won');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      updateUserScore();
    } else if (isLost) {
      setGameState('lost');
    }
  }, [guessedLetters, mistakes, wordData, gameState]);

  const updateUserScore = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const name = auth.currentUser.displayName || "Jugador";

    try {
      await saveUserScore(uid, name, 10);
    } catch (error) {
      console.warn("Could not save score:", error);
    }
  };

  const handleGuess = (char: string) => {
    if (gameState !== 'playing' || guessedLetters.has(char) || !wordData) return;

    const newSet = new Set(guessedLetters).add(char);
    setGuessedLetters(newSet);

    if (!wordData.word.includes(char)) {
      setMistakes(m => m + 1);
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
          <div className="brutal-box w-full py-8 px-4 text-center">
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-4 text-3xl md:text-5xl font-black uppercase tracking-widest text-[var(--dark)]">
              {wordData.word.split('').map((char, i) => (
                char === ' ' ? <div key={i} className="w-4 md:w-8" /> :
                <span 
                  key={i} 
                  className={cn(
                    "inline-block border-b-4 border-[var(--dark)] pb-1 min-w-[32px] md:min-w-[48px]",
                    !guessedLetters.has(char) && gameState === 'playing' ? "text-transparent" : "text-current",
                    (gameState === 'lost' && !guessedLetters.has(char)) && "text-[var(--primary)]" // reveal missed letters
                  )}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          {/* Keyboard */}
          <div className="brutal-box w-full p-4 md:p-6 grid grid-cols-7 sm:grid-cols-9 gap-2 md:gap-3 bg-[var(--white)]">
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
                    !guessed && "bg-[var(--bg-color)] border-2 border-[var(--dark)] hover:scale-105 active:scale-95 cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,0.1)]",
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
            {gameState === 'won' && <p className="text-sm font-bold bg-[var(--accent)] border-2 border-[var(--dark)] text-[var(--dark)] p-2 rounded-lg mb-6 shadow-[2px_2px_0px_rgba(0,0,0,0.1)]">+10 Puntos</p>}
            
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
