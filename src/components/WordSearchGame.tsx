import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { playSound } from '../audio';
import confetti from 'canvas-confetti';
import { HelpCircle, Check, Info, RefreshCw } from 'lucide-react';

interface WordSearchGameProps {
  words: { word: string; hint: string }[];
  onBack: () => void;
  onWinAll: (points: number, timeSpent: number) => void;
  onPartialScore?: (points: number, word: string, won: boolean) => void;
}

const DIRECTIONS = [
  [0, 1],   // Horizontal right
  [1, 0],   // Vertical down
  [1, 1],   // Diagonal down-right
  [-1, 1],  // Diagonal up-right
  [0, -1],  // Horizontal left
  [-1, 0],  // Vertical up
  [1, -1],  // Diagonal down-left
  [-1, -1]  // Diagonal up-left
];

const ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

export const WordSearchGame: React.FC<WordSearchGameProps> = ({ words, onBack, onWinAll, onPartialScore }) => {
  const [gridSize, setGridSize] = useState(12);
  const [grid, setGrid] = useState<string[][]>([]);
  const [cleanWordsList, setCleanWordsList] = useState<{ original: string; clean: string; hint: string; found: boolean; color: string }[]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]); // holds 'clean' strings
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set()); // list of "row-col" strings
  const [cellColors, setCellColors] = useState<{ [key: string]: string }>({}); // map of "row-col" to color classes
  
  // Selection state
  const [startCell, setStartCell] = useState<{ r: number; c: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);
  const [selectedWordHint, setSelectedWordHint] = useState<string | null>(null);
  
  const startTimeRef = useRef<number>(Date.now());
  const [timeSpent, setTimeSpent] = useState(0);

  // Pastel highlight colors for found words
  const COLORS = [
    'bg-emerald-200 border-emerald-400 text-emerald-900',
    'bg-amber-200 border-amber-400 text-amber-900',
    'bg-sky-200 border-sky-400 text-sky-900',
    'bg-purple-200 border-purple-400 text-purple-900',
    'bg-rose-200 border-rose-400 text-rose-900',
    'bg-pink-200 border-pink-400 text-pink-900',
    'bg-teal-200 border-teal-400 text-teal-900',
    'bg-indigo-200 border-indigo-400 text-indigo-900'
  ];

  // Initialize and generate Sopa de Letras
  const generateSopa = () => {
    startTimeRef.current = Date.now();
    setFoundWords([]);
    setFoundCells(new Set());
    setCellColors({});
    setStartCell(null);
    setHoveredCell(null);

    // 1. Process words
    const cleanList = words.map((w, idx) => {
      const clean = w.word
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z]/g, "");
      return {
        original: w.word,
        clean,
        hint: w.hint,
        found: false,
        color: COLORS[idx % COLORS.length]
      };
    }).filter(w => w.clean.length > 0);

    setCleanWordsList(cleanList);

    // Optimize grid size based on the longest word
    const longestWordLen = Math.max(...cleanList.map(w => w.clean.length), 8);
    const calculatedSize = Math.max(longestWordLen + 2, 12);
    setGridSize(calculatedSize);

    // Initial grid state empty
    let tempGrid: string[][] = Array(calculatedSize).fill(null).map(() => Array(calculatedSize).fill(''));

    // Place words
    cleanList.forEach(wObj => {
      const { clean } = wObj;
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 250) {
        attempts++;
        const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        const [dr, dc] = direction;
        
        // Random starting coordinate
        const startR = Math.floor(Math.random() * calculatedSize);
        const startC = Math.floor(Math.random() * calculatedSize);

        // Check boundary
        const endR = startR + dr * (clean.length - 1);
        const endC = startC + dc * (clean.length - 1);

        if (endR < 0 || endR >= calculatedSize || endC < 0 || endC >= calculatedSize) {
          continue;
        }

        // Check overlay collision
        let ok = true;
        for (let i = 0; i < clean.length; i++) {
          const currR = startR + dr * i;
          const currC = startC + dc * i;
          if (tempGrid[currR][currC] !== '' && tempGrid[currR][currC] !== clean[i]) {
            ok = false;
            break;
          }
        }

        if (ok) {
          // Success, carve word in grid
          for (let i = 0; i < clean.length; i++) {
            const currR = startR + dr * i;
            const currC = startC + dc * i;
            tempGrid[currR][currC] = clean[i];
          }
          placed = true;
        }
      }
    });

    // Fill empty spots with random letters
    for (let r = 0; r < calculatedSize; r++) {
      for (let c = 0; c < calculatedSize; c++) {
        if (tempGrid[r][c] === '') {
          tempGrid[r][c] = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        }
      }
    }

    setGrid(tempGrid);
  };

  useEffect(() => {
    if (words && words.length > 0) {
      generateSopa();
    }
  }, [words]);

  // Keep time track
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check if coordinates trace a straight line
  const getLineCells = (start: { r: number; c: number }, end: { r: number; c: number }) => {
    const cells: { r: number; c: number }[] = [];
    const dr = end.r - start.r;
    const dc = end.c - start.c;

    const absR = Math.abs(dr);
    const absC = Math.abs(dc);

    // Must be horizontal, vertical, or perfectly diagonal
    if (dr === 0 || dc === 0 || absR === absC) {
      const stepR = dr === 0 ? 0 : dr / absR;
      const stepC = dc === 0 ? 0 : dc / absC;
      const steps = Math.max(absR, absC);

      for (let i = 0; i <= steps; i++) {
        cells.push({ r: start.r + stepR * i, c: start.c + stepC * i });
      }
    }
    return cells;
  };

  const getSelectedWordString = (cells: { r: number; c: number }[]) => {
    return cells.map(cell => grid[cell.r]?.[cell.c] || "").join("");
  };

  const handleCellClick = (r: number, c: number) => {
    if (!startCell) {
      // First click: lock start
      setStartCell({ r, c });
      setHoveredCell({ r, c });
      playSound.correct();
    } else {
      // Second click: submit choice
      const lineCells = getLineCells(startCell, { r, c });
      if (lineCells.length > 0) {
        const text = getSelectedWordString(lineCells);
        const reversedText = text.split("").reverse().join("");

        // Check if matched anything
        const match = cleanWordsList.find(
          wObj => !wObj.found && (wObj.clean === text || wObj.clean === reversedText)
        );

        if (match) {
          // Found it!
          playSound.win();
          confetti({ particleCount: 30, spread: 40 });
          
          if (onPartialScore) {
            onPartialScore(10, match.clean, true);
          }
          
          // Mark found
          const updatedList = cleanWordsList.map(wObj => 
            wObj.clean === match.clean ? { ...wObj, found: true } : wObj
          );
          setCleanWordsList(updatedList);
          setFoundWords(prev => [...prev, match.clean]);

          // Update highlighted cells
          const nextFoundCells = new Set(foundCells);
          const nextCellColors = { ...cellColors };
          lineCells.forEach(cell => {
            const key = `${cell.r}-${cell.c}`;
            nextFoundCells.add(key);
            nextCellColors[key] = match.color;
          });
          setFoundCells(nextFoundCells);
          setCellColors(nextCellColors);

          // Check Win Condition
          const remaining = updatedList.filter(w => !w.found).length;
          if (remaining === 0) {
            confetti({ particleCount: 150, spread: 80 });
            // Award score and transition
            setTimeout(() => {
              onWinAll(20, timeSpent);
            }, 800);
          }
        } else {
          playSound.wrong();
          if (onPartialScore) {
            onPartialScore(-2, text, false);
          }
        }
      }
      // Reset selection
      setStartCell(null);
      setHoveredCell(null);
    }
  };

  const handleCellHover = (r: number, c: number) => {
    if (startCell) {
      setHoveredCell({ r, c });
    }
  };

  // Traced grid cells currently being hovered
  const currentLineCells = startCell && hoveredCell ? getLineCells(startCell, hoveredCell) : [];
  const currentTextSelection = getSelectedWordString(currentLineCells);

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 space-y-6">
      {/* Top action row */}
      <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 border-b-4 border-black pb-4 mb-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="brutal-btn bg-white text-black font-black px-6 py-2 border-2 border-black"
          >
            ← Volver
          </button>
          <button
            onClick={generateSopa}
            className="brutal-btn bg-amber-100 hover:bg-amber-200 text-black font-black px-4 py-2 flex items-center gap-2 border-2 border-black"
          >
            <RefreshCw className="w-4 h-4" /> REGENERAR
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="font-mono bg-white border-2 border-black px-4 py-1.5 rounded font-black shadow-[3px_3px_0_0_#000]">
            ⏱️ TIEMPO: {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
          </div>
          <div className="bg-[var(--accent)] border-2 border-black px-4 py-1.5 rounded font-black uppercase text-xs shadow-[3px_3px_0_0_#000]">
            SOPA DE LETRAS
          </div>
        </div>
      </div>

      <div className="w-full bg-white border-4 border-black p-4 rounded-2xl shadow-[8px_8px_0_0_rgba(0,0,0,1)] grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* Left Side: Word Search Grid */}
        <div className="flex flex-col items-center justify-center">
          {startCell && (
            <div className="mb-4 bg-amber-50 border-2 border-amber-400 py-2 px-6 rounded-xl font-black font-mono text-center text-amber-900 tracking-widest text-lg w-full max-w-md shadow-[3px_3px_0_0_rgba(245,158,11,1)]">
              🔍 SELECCIÓN: {currentTextSelection || "..."}
            </div>
          )}

          {/* Sopa grid */}
          <div 
            className="grid gap-1 md:gap-1.5 bg-gray-100 p-3 md:p-4 rounded-xl border-4 border-black max-w-full overflow-auto select-none"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            }}
          >
            {grid.map((row, r) => 
              row.map((char, c) => {
                const key = `${r}-${c}`;
                const isFound = foundCells.has(key);
                const isStart = startCell && startCell.r === r && startCell.c === c;
                const isInCurrentSelection = currentLineCells.some(cell => cell.r === r && cell.c === c);
                
                let cellClass = "bg-white text-gray-800 border-gray-300 hover:bg-gray-100";
                
                if (isFound) {
                  cellClass = cellColors[key] || "bg-green-200 border-green-500 text-green-900";
                } else if (isStart) {
                  cellClass = "bg-orange-400 text-white border-black scale-105 rotate-3 shadow-[2px_2px_0_1px_rgba(0,0,0,1)] animate-pulse";
                } else if (isInCurrentSelection) {
                  cellClass = "bg-amber-300 text-black border-amber-600 font-black";
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleCellClick(r, c)}
                    onMouseEnter={() => handleCellHover(r, c)}
                    className={cn(
                      "w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 flex items-center justify-center font-black rounded border-2 text-center text-xs sm:text-base md:text-lg transition-all uppercase cursor-pointer",
                      cellClass
                    )}
                  >
                    {char}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-400">
            <Info className="w-4 h-4 text-gray-400 shrink-0" />
            <span>Instrucciones: Haz clic en la letra de inicio y luego en la letra final de la palabra para seleccionarla. Soportado horizontal, vertical y diagonal libre.</span>
          </div>
        </div>

        {/* Right Side: Clues & Words Track List */}
        <div className="flex flex-col space-y-4">
          <div className="bg-gray-50 border-3 border-black p-4 rounded-xl">
            <h3 className="font-black text-lg uppercase tracking-wide border-b-2 border-black pb-2 mb-3 text-[var(--dark)] flex items-center justify-between">
              <span>Palabras Escondidas</span>
              <span className="badge bg-black text-white px-2 py-0.5 rounded text-xs select-none">
                {foundWords.length}/{cleanWordsList.length}
              </span>
            </h3>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {cleanWordsList.map((w, idx) => (
                <div 
                  key={idx}
                  onClick={() => setSelectedWordHint(selectedWordHint === w.hint ? null : w.hint)}
                  className={cn(
                    "p-3 rounded-lg border-2 border-black flex flex-col cursor-pointer transition-all hover:translate-x-1",
                    w.found 
                      ? `${w.color} opacity-75 shadow-none` 
                      : "bg-white shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000]"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span 
                      className={cn(
                        "font-black tracking-widest font-mono text-sm",
                        w.found ? "line-through opacity-60" : "text-black"
                      )}
                    >
                      {w.found ? w.clean : w.clean.split("").map(() => "_").join(" ")}
                    </span>
                    {w.found ? (
                      <Check className="w-5 h-5 text-green-700 shrink-0 font-bold" />
                    ) : (
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 border border-slate-300 rounded-full font-bold select-none">
                        Revelar Pista
                      </span>
                    )}
                  </div>
                  
                  {/* Persistent or expandable hint clue view */}
                  {(w.found || selectedWordHint === w.hint) && (
                    <div className="mt-2 text-xs text-gray-600 font-bold leading-relaxed border-t border-dashed border-black/10 pt-2 flex items-start gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                      <span>{w.hint}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
