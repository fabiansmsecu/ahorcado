import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { playSound } from '../audio';
import confetti from 'canvas-confetti';
import { Check, HelpCircle, RefreshCw, AlertCircle, Eye } from 'lucide-react';

interface CrosswordGameProps {
  words: { word: string; hint: string }[];
  onBack: () => void;
  onWinAll: (points: number, timeSpent: number) => void;
}

interface PlacedWord {
  word: string;
  clean: string;
  hint: string;
  row: number;
  col: number;
  direction: 'H' | 'V';
  number: number;
}

interface GridCell {
  char: string;
  number: number | null;
  words: PlacedWord[]; // words that cross this cell
}

export const CrosswordGame: React.FC<CrosswordGameProps> = ({ words, onBack, onWinAll }) => {
  const [gridSize, setGridSize] = useState(13);
  const [grid, setGrid] = useState<(GridCell | null)[][]>([]);
  const [placedWords, setPlacedWords] = useState<PlacedWord[]>([]);
  
  // User cell inputs stored as "row,col" -> char
  const [userInput, setUserInput] = useState<{ [key: string]: string }>({});
  const [checked, setChecked] = useState(false);
  const [selectedWord, setSelectedWord] = useState<PlacedWord | null>(null);
  
  // Ref container for focus management
  const cellRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const startTimeRef = useRef<number>(Date.now());
  const [timeSpent, setTimeSpent] = useState(0);

  const generateCrossword = () => {
    startTimeRef.current = Date.now();
    setUserInput({});
    setChecked(false);
    setSelectedWord(null);

    // 1. Process words
    const cleanList = words.map(w => {
      const clean = w.word
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z]/g, "");
      return {
        original: w.word,
        clean,
        hint: w.hint
      };
    }).filter(w => w.clean.length > 1); // Only words with >= 2 characters

    if (cleanList.length === 0) {
      return;
    }

    // Sort by length descending for better placement first
    cleanList.sort((a, b) => b.clean.length - a.clean.length);

    const size = Math.max(13, Math.max(...cleanList.map(w => w.clean.length)) + 3);
    setGridSize(size);

    // We represent empty cells that will be populated
    const cells: string[][] = Array(size).fill(null).map(() => Array(size).fill(''));
    const matches: PlacedWord[] = [];
    let wordNumber = 1;

    // Helper: check if horizontal word fits and doesn't collide
    const checkHorizontal = (word: string, r: number, c: number): boolean => {
      if (c + word.length > size) return false;
      // Check left boundary safety
      if (c > 0 && cells[r][c - 1] !== '') return false;
      // Check right boundary safety
      if (c + word.length < size && cells[r][c + word.length] !== '') return false;

      for (let i = 0; i < word.length; i++) {
        const curC = c + i;
        const targetChar = cells[r][curC];
        if (targetChar !== '' && targetChar !== word[i]) {
          return false;
        }
        // Check adjacent cells for safety if we are not intersecting (i.e. empty cell)
        if (targetChar === '') {
          if (r > 0 && cells[r - 1][curC] !== '') return false;
          if (r < size - 1 && cells[r + 1][curC] !== '') return false;
        }
      }
      return true;
    };

    // Helper: check if vertical word fits and doesn't collide
    const checkVertical = (word: string, r: number, c: number): boolean => {
      if (r + word.length > size) return false;
      // Check top boundary safety
      if (r > 0 && cells[r - 1][c] !== '') return false;
      // Check bottom boundary safety
      if (r + word.length < size && cells[r + word.length][c] !== '') return false;

      for (let i = 0; i < word.length; i++) {
        const curR = r + i;
        const targetChar = cells[curR][c];
        if (targetChar !== '' && targetChar !== word[i]) {
          return false;
        }
        // Check adjacent cells safety for empty spaces
        if (targetChar === '') {
          if (c > 0 && cells[curR][c - 1] !== '') return false;
          if (c < size - 1 && cells[curR][c + 1] !== '') return false;
        }
      }
      return true;
    };

    // Step 2. Place first word in horizontal center-ish
    const firstWordObj = cleanList[0];
    const initialRow = Math.floor(size / 2);
    const initialCol = Math.floor((size - firstWordObj.clean.length) / 2);

    for (let i = 0; i < firstWordObj.clean.length; i++) {
      cells[initialRow][initialCol + i] = firstWordObj.clean[i];
    }
    
    matches.push({
      word: firstWordObj.original,
      clean: firstWordObj.clean,
      hint: firstWordObj.hint,
      row: initialRow,
      col: initialCol,
      direction: 'H',
      number: wordNumber++
    });

    // Step 3. Place subsequent words looking for intersections
    for (let wIdx = 1; wIdx < cleanList.length; wIdx++) {
      const wObj = cleanList[wIdx];
      const word = wObj.clean;
      let placed = false;

      // Try intersecting with already placed words
      for (const placedW of matches) {
        if (placed) break;

        for (let i = 0; i < word.length; i++) {
          if (placed) break;

          const letter = word[i];
          // Find if this letter exists in the placed word
          for (let j = 0; j < placedW.clean.length; j++) {
            if (placed) break;

            if (placedW.clean[j] === letter) {
              // We found character match!
              // Calculate target coordinates based on placed word orientation
              if (placedW.direction === 'H') {
                // Placed word is horizontal, we place this vertical
                const targetCol = placedW.col + j;
                const targetRow = placedW.row - i;

                if (targetRow >= 0 && targetRow + word.length <= size) {
                  if (checkVertical(word, targetRow, targetCol)) {
                    // Carve
                    for (let charI = 0; charI < word.length; charI++) {
                      cells[targetRow + charI][targetCol] = word[charI];
                    }
                    matches.push({
                      word: wObj.original,
                      clean: word,
                      hint: wObj.hint,
                      row: targetRow,
                      col: targetCol,
                      direction: 'V',
                      number: wordNumber++
                    });
                    placed = true;
                  }
                }
              } else {
                // Placed word is vertical, we place this horizontal
                const targetRow = placedW.row + j;
                const targetCol = placedW.col - i;

                if (targetCol >= 0 && targetCol + word.length <= size) {
                  if (checkHorizontal(word, targetRow, targetCol)) {
                    // Carve
                    for (let charI = 0; charI < word.length; charI++) {
                      cells[targetRow][targetCol + charI] = word[charI];
                    }
                    matches.push({
                      word: wObj.original,
                      clean: word,
                      hint: wObj.hint,
                      row: targetRow,
                      col: targetCol,
                      direction: 'H',
                      number: wordNumber++
                    });
                    placed = true;
                  }
                }
              }
            }
          }
        }
      }

      // Step 4. Fallback Placement for words that have no intersection letters at all (forces successful layout!)
      if (!placed) {
        // Look for empty row with empty spacing to lay word down isolatedly
        for (let r = 2; r < size - 2; r += 2) {
          if (placed) break;
          // check if row is empty
          let rowEmpty = true;
          for (let c = 0; c < size; c++) {
            if (cells[r][c] !== '' || (r > 0 && cells[r-1][c] !== '') || (r < size-1 && cells[r+1][c] !== '')) {
              rowEmpty = false;
              break;
            }
          }

          if (rowEmpty && word.length <= size - 2) {
            const startCol = 1;
            for (let charI = 0; charI < word.length; charI++) {
              cells[r][startCol + charI] = word[charI];
            }
            matches.push({
              word: wObj.original,
              clean: word,
              hint: wObj.hint,
              row: r,
              col: startCol,
              direction: 'H',
              number: wordNumber++
            });
            placed = true;
          }
        }
      }
    }

    // Assign consistent crossword numbers depending on top-down cell scanner
    // Map of row-col coordinates to assigned number
    const numMap: { [key: string]: number } = {};
    let realNumIdx = 1;

    // Scan top-to-bottom, left-to-right to assign starting square clue numbers
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Is this coordinate the start of any placed word?
        const starters = matches.filter(w => w.row === r && w.col === c);
        if (starters.length > 0) {
          numMap[`${r}-${c}`] = realNumIdx;
          starters.forEach(w => {
            w.number = realNumIdx;
          });
          realNumIdx++;
        }
      }
    }

    // Now populate full grid array states
    const gridData: (GridCell | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
    
    matches.forEach(w => {
      for (let i = 0; i < w.clean.length; i++) {
        const activeR = w.direction === 'H' ? w.row : w.row + i;
        const activeC = w.direction === 'H' ? w.col + i : w.col;
        
        let cellObj = gridData[activeR][activeC];
        if (!cellObj) {
          cellObj = {
            char: w.clean[i],
            number: numMap[`${activeR}-${activeC}`] || null,
            words: []
          };
          gridData[activeR][activeC] = cellObj;
        }
        cellObj.words.push(w);
      }
    });

    setGrid(gridData);
    setPlacedWords(matches);
  };

  useEffect(() => {
    if (words && words.length > 0) {
      generateCrossword();
    }
  }, [words]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleInputChange = (r: number, c: number, val: string) => {
    const cleanVal = val.toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
    const lastChar = cleanVal.length > 0 ? cleanVal[cleanVal.length - 1] : '';
    
    const key = `${r}-${c}`;
    const updatedInputs = { ...userInput, [key]: lastChar };
    setUserInput(updatedInputs);

    // Dynamic focus navigation to next cell of active selected word
    if (lastChar && selectedWord) {
      const { clean, row, col, direction } = selectedWord;
      // Get index of current cursor
      const idx = direction === 'H' ? c - col : r - row;
      if (idx >= 0 && idx < clean.length - 1) {
        // focus next
        const nextR = direction === 'H' ? row : row + idx + 1;
        const nextC = direction === 'H' ? col + idx + 1 : col;
        const nextKey = `${nextR}-${nextC}`;
        cellRefs.current[nextKey]?.focus();
      }
    }
  };

  const handleKeyDown = (r: number, c: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Navigate backwards on Backspace if empty to let erasing be smooth 
    if (e.key === 'Backspace' && !userInput[`${r}-${c}`] && selectedWord) {
      const { row, col, direction } = selectedWord;
      const idx = direction === 'H' ? c - col : r - row;
      if (idx > 0) {
        const prevR = direction === 'H' ? row : row + idx - 1;
        const prevC = direction === 'H' ? col + idx - 1 : col;
        const prevKey = `${prevR}-${prevC}`;
        cellRefs.current[prevKey]?.focus();
      }
    }
  };

  const handleClueClick = (w: PlacedWord) => {
    setSelectedWord(w);
    // Auto-focus starting cell
    const startKey = `${w.row}-${w.col}`;
    cellRefs.current[startKey]?.focus();
  };

  // Check answers
  const handleCheck = () => {
    setChecked(true);
    let allMatches = true;

    // Validate overall cells
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = grid[r]?.[c];
        if (cell) {
          const userVal = userInput[`${r}-${c}`] || '';
          if (userVal !== cell.char) {
            allMatches = false;
          }
        }
      }
    }

    if (allMatches) {
      playSound.win();
      confetti({ particleCount: 150, spread: 80 });
      // Victory callback
      setTimeout(() => {
        onWinAll(20, timeSpent);
      }, 1000);
    } else {
      playSound.wrong();
    }
  };

  const handleRevealAll = () => {
    const revealed: { [key: string]: string } = {};
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = grid[r]?.[c];
        if (cell) {
          revealed[`${r}-${c}`] = cell.char;
        }
      }
    }
    setUserInput(revealed);
    setChecked(true);
  };

  const acrossClues = placedWords.filter(w => w.direction === 'H').sort((a,b) => a.number - b.number);
  const downClues = placedWords.filter(w => w.direction === 'V').sort((a,b) => a.number - b.number);

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 space-y-6">
      {/* Action Header */}
      <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 border-b-4 border-black pb-4 mb-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="brutal-btn bg-white text-black font-black px-6 py-2 border-2 border-black"
          >
            ← Volver
          </button>
          <button
            onClick={generateCrossword}
            className="brutal-btn bg-amber-100 hover:bg-amber-200 text-black font-black px-4 py-2 flex items-center gap-2 border-2 border-black"
          >
            <RefreshCw className="w-4 h-4" /> REINICIAR
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="font-mono bg-white border-2 border-black px-4 py-1.5 rounded font-black shadow-[3px_3px_0_0_#000]">
            ⏱️ TIEMPO: {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
          </div>
          <div className="bg-[var(--accent)] border-2 border-black px-4 py-1.5 rounded font-black uppercase text-xs shadow-[3px_3px_0_0_#000]">
            CRUCIGRAMA INTERACTIVO
          </div>
        </div>
      </div>

      <div className="w-full bg-white border-4 border-black p-4 rounded-2xl shadow-[8px_8px_0_0_rgba(0,0,0,1)] grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        
        {/* Left Grid Area */}
        <div className="flex flex-col items-center justify-center p-2">
          {selectedWord && (
            <div className="mb-4 bg-purple-50 border-2 border-purple-400 py-3 px-6 rounded-xl font-bold text-center text-purple-950 text-sm w-full max-w-md shadow-[3px_3px_0_0_rgba(168,85,247,1)]">
              <span className="font-black uppercase tracking-wider block text-xs text-purple-400 mb-1">
                Pista {selectedWord.number} {selectedWord.direction === 'H' ? 'Horizontal' : 'Vertical'}
              </span>
              💡 "{selectedWord.hint}"
            </div>
          )}

          {/* Grid Panel Scrollable wrapper */}
          <div className="max-w-full overflow-auto bg-slate-900 p-6 rounded-2xl border-4 border-black shadow-[inner_0_4px_6px_rgba(0,0,0,0.6)]">
            <div 
              className="grid gap-1 bg-slate-950 p-2 rounded-xl"
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(40px, 1fr))`,
              }}
            >
              {Array.from({ length: gridSize }).map((_, r) => 
                Array.from({ length: gridSize }).map((_, c) => {
                  const cell = grid[r]?.[c];
                  if (!cell) {
                    return (
                      <div 
                        key={`empty-${r}-${c}`} 
                        className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 border border-slate-950 transition-colors"
                      />
                    );
                  }

                  const key = `${r}-${c}`;
                  const isSelected = selectedWord && cell.words.some(w => w.word === selectedWord.word);
                  const userVal = userInput[key] || '';
                  const isCorrect = userVal === cell.char;
                  
                  return (
                    <div 
                      key={key} 
                      className={cn(
                        "w-10 h-10 md:w-12 md:h-12 relative flex items-center justify-center bg-white border-2 border-slate-300 font-black",
                        isSelected && "bg-amber-100 border-amber-500 ring-2 ring-amber-400",
                        checked && userVal && (isCorrect ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500")
                      )}
                    >
                      {/* Starts Number Label */}
                      {cell.number !== null && (
                        <span className="absolute top-0.5 left-1 text-[9px] font-black leading-none text-slate-500">
                          {cell.number}
                        </span>
                      )}
                      
                      {/* Individual cell letter input */}
                      <input
                        ref={el => (cellRefs.current[key] = el)}
                        type="text"
                        maxLength={1}
                        value={userVal}
                        onKeyDown={(e) => handleKeyDown(r, c, e)}
                        onFocus={() => {
                          // Select corresponding starting word clue automatically on focal index
                          if (cell.words.length > 0 && (!selectedWord || !cell.words.includes(selectedWord))) {
                            setSelectedWord(cell.words[0]);
                          }
                        }}
                        onChange={(e) => handleInputChange(r, c, e.target.value)}
                        className={cn(
                          "w-full h-full text-center focus:outline-none uppercase text-base sm:text-lg font-black bg-transparent text-slate-800 transition-all select-none"
                        )}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 justify-center w-full">
            <button
              onClick={handleCheck}
              className="brutal-btn bg-[var(--primary)] text-white hover:brightness-110 flex items-center gap-2 px-8 py-3 text-sm font-black"
            >
              <Check className="w-5 h-5" /> COMPROBAR RESPUESTAS
            </button>
            <button
              onClick={handleRevealAll}
              className="brutal-btn bg-white hover:bg-slate-50 border-2 border-black text-slate-700 flex items-center gap-2 px-6 py-3 text-sm font-black"
            >
              <Eye className="w-5 h-5" /> SOLUCIÓN RÁPIDA
            </button>
          </div>
        </div>

        {/* Right Clues Dashboard Column */}
        <div className="flex flex-col space-y-4">
          <div className="bg-gray-50 border-3 border-black p-4 rounded-xl flex-1 flex flex-col min-h-[50vh]">
            <h3 className="font-black text-base uppercase tracking-wide border-b-2 border-black pb-2 mb-4 text-[var(--dark)]">
              Lista de Pistas
            </h3>

            {/* Horizontal Segment */}
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <h4 className="font-extrabold text-xs uppercase text-slate-400 tracking-widest mb-2 border-l-4 border-amber-500 pl-2">
                  Horizontales (Across)
                </h4>
                {acrossClues.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400 italic">Ninguna</p>
                ) : (
                  <div className="space-y-2">
                    {acrossClues.map((clue, idx) => {
                      const isSelected = selectedWord && selectedWord.number === clue.number && selectedWord.direction === 'H';
                      return (
                        <div
                          key={`across-${idx}`}
                          onClick={() => handleClueClick(clue)}
                          className={cn(
                            "p-2.5 rounded-lg border-2 border-slate-300 font-bold text-xs cursor-pointer text-slate-700 transition-all hover:translate-x-1 select-none",
                            isSelected ? "bg-amber-100 border-amber-500 text-amber-950 scale-102" : "bg-white hover:bg-slate-50"
                          )}
                        >
                          <span className="font-black text-amber-600 mr-1.5">{clue.number}.</span>
                          <span>{clue.hint}</span>
                          <span className="block mt-1 font-mono text-[10px] text-slate-400">({clue.clean.length} letras)</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Vertical Segment */}
              <div className="pt-4 border-t-2 border-dashed border-slate-200">
                <h4 className="font-extrabold text-xs uppercase text-slate-400 tracking-widest mb-2 border-l-4 border-purple-500 pl-2">
                  Verticales (Down)
                </h4>
                {downClues.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400 italic">Ninguna</p>
                ) : (
                  <div className="space-y-2">
                    {downClues.map((clue, idx) => {
                      const isSelected = selectedWord && selectedWord.number === clue.number && selectedWord.direction === 'V';
                      return (
                        <div
                          key={`down-${idx}`}
                          onClick={() => handleClueClick(clue)}
                          className={cn(
                            "p-2.5 rounded-lg border-2 border-slate-300 font-bold text-xs cursor-pointer text-slate-700 transition-all hover:translate-x-1 select-none",
                            isSelected ? "bg-amber-100 border-amber-500 text-amber-950 scale-102" : "bg-white hover:bg-slate-50"
                          )}
                        >
                          <span className="font-black text-purple-600 mr-1.5">{clue.number}.</span>
                          <span>{clue.hint}</span>
                          <span className="block mt-1 font-mono text-[10px] text-slate-400">({clue.clean.length} letras)</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
