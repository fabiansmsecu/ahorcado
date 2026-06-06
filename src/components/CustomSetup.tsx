import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { BookOpen, FileText, Loader2, Save, AlertTriangle, RefreshCw, Play, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { saveLesson } from '../firebase';

interface ValidationResult {
  word: string;
  hint: string;
  warnings: string[];
}

const validateGeneratedWords = (
  words: { word: string; hint: string }[],
  currentMode: string,
  textSource: string,
  isTextType: boolean
): ValidationResult[] => {
  // Normalize the source text to help with matching
  const normalizedSource = textSource
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^A-Z0-9\s]/g, ""); // allow basic letters and numbers and spaces
  
  return words.map(item => {
    const warnings: string[] = [];
    const normalizedWord = item.word
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z]/g, "");

    // 1. Context validation (only relevant if source was unstructured text)
    if (isTextType && normalizedWord.length > 2) {
      // Check if word is physically in the normalized source text
      const isWordInText = normalizedSource.includes(normalizedWord);
      
      if (!isWordInText) {
        warnings.push("La palabra no fue encontrada directamente en tu texto de estudio. Podría estar fuera de contexto o inventada.");
      }
    }

    // 2. Length validation
    const len = normalizedWord.length;
    if (len < 3) {
      warnings.push("La palabra es demasiado corta para un juego interactivo de ahorcado (< 3 letras).");
    }

    if (currentMode === 'facil') {
      if (len < 4) {
        warnings.push("La palabra es excesivamente corta incluso para nivel fácil (< 4 letras).");
      }
      if (len > 10) {
        warnings.push(`La palabra tiene ${len} letras, lo cual supera el nivel recomendado para niños/principiantes (> 10 letras).`);
      }
    } else if (currentMode === 'dificil') {
      if (len < 5) {
        warnings.push("La palabra es muy corta para el nivel medio/difícil (< 5 letras).");
      }
      if (len > 15) {
        warnings.push(`La palabra tiene ${len} letras, lo cual es muy extenso para un nivel medio y entorpece el cálculo.`);
      }
    } else if (currentMode === 'superdificil') {
      if (len < 6) {
        warnings.push("La palabra es inusualmente corta para un nivel de alta maestría (< 6 letras).");
      }
      if (len > 18) {
        warnings.push(`La palabra es excesivamente larga para jugarse cómodo con una pista intelectual compleja (> 18 letras).`);
      }
    }

    // 3. Gibberish/hallucination checks
    if (/(.)\1\1/.test(normalizedWord)) {
      const matchWord = normalizedWord.match(/(.)\1\1/)?.[0] || "";
      warnings.push(`Contiene repeticiones inusuales de la misma letra en secuencia (p.ej.: '${matchWord}').`);
    }
    const consonantMatches = normalizedWord.match(/[^AEIOU]{5,}/);
    if (consonantMatches) {
      warnings.push(`Contiene una secuencia muy poco común de consonantes consecutivas ('${consonantMatches[0]}').`);
    }

    // 4. Clue sanity check
    if (!item.hint || item.hint.trim().length < 5) {
      warnings.push("La pista o definición generada es demasiado corta, críptica o vacía.");
    }

    return {
      word: item.word,
      hint: item.hint,
      warnings
    };
  });
};

interface CustomSetupProps {
  onStart: (words: { word: string; hint: string }[], mode: string, maxAttempts?: number) => void;
  onBack: () => void;
}

export const CustomSetup: React.FC<CustomSetupProps> = ({ onStart, onBack }) => {
  const [text, setText] = useState('');
  const [inputType, setInputType] = useState<'text' | 'words'>('text');
  const [mode, setMode] = useState<string>('dificil');
  const [wordCount, setWordCount] = useState<number>(10);
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  
  // Custom lesson metadata
  const [subject, setSubject] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-validation state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [pendingWords, setPendingWords] = useState<{ word: string; hint: string }[]>([]);

  const handleRegenerateFromModal = () => {
    setShowValidationModal(false);
    handleGenerate();
  };

  const handleBypassValidation = async () => {
    setLoading(true);
    try {
      await saveLesson(subject.trim(), lessonTitle.trim(), pendingWords, mode);
      setShowValidationModal(false);
      onStart(pendingWords, mode, maxAttempts);
    } catch (err: any) {
      console.error("Error saving lesson from bypass:", err);
      setError(`Ocurrió un error al guardar la lección: ${err.message || "Error desconocido"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Por favor, ingresa algún texto o palabras.");
      return;
    }
    if (!subject.trim() || !lessonTitle.trim()) {
      setError("Por favor, ingresa una materia y el título de la lección para guardar tu historial.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let difficultyDesc = 'dificultad normal';
      if (mode === 'facil') {
        difficultyDesc = 'Nivel Principiante/Fácil (selecciona solo palabras clave principales, sencillas y muy representativas del texto; las pistas o descripciones deben ser sumamente directas, sencillas y obvias)';
      } else if (mode === 'dificil') {
        difficultyDesc = 'Nivel Intermedio (selecciona términos técnicos muy relevantes del texto; las pistas deben ser definiciones profesionales claras, precisas y directas)';
      } else if (mode === 'superdificil') {
        difficultyDesc = 'Nivel Avanzado/Super Difícil (selecciona conceptos medulares, principales e indispensables del tema de estudio. Está TERMINANTEMENTE PROHIBIDO elegir términos sumamente oscuros, raros, marginales, rebuscados o inventados; deben ser términos clave principales como "FRAUDE", "EVIDENCIA", "CONTROL", "RIESGO". La dificultad alta se logra haciendo pistas o definiciones desafiantes, muy analíticas, conceptuales y que requieran síntesis o pensamiento crítico, en lugar de pistas directas u obvias)';
      }
      
      const promptInstructions = `A partir del siguiente texto, extrae HASTA un MÁXIMO de ${wordCount} palabras clave para un juego del ahorcado.
Audiencia: ${difficultyDesc}.
Retorna exactamente UNA palabra por línea, separada de su pista con un pipe (|).
Ejemplo:
PALABRA|Pista muy corta aquí.
OTRAPALABRA|Otra pista corta aquí.

Instrucciones críticas de formato para cada línea:
1. La palabra ANTES del pipe debe ser UNA SOLA PALABRA, en MAYÚSCULAS, SIN TILDES, SIN ESPACIOS, SIN SÍMBOLOS.
2. La palabra elegida DEBE ser un concepto real, común, principal y central del texto fuente. Está PROHIBIDO extraer palabras rebuscadas, raras, inventadas o marginales.
3. La pista DESPUÉS del pipe debe ser MUY CORTA (máximo 6 palabras).
4. No incluyas nada más en tu respuesta. Sin markdown, sin introducciones ni conclusiones. Procesalo velozmente.

Texto fuente:
${text}`;

      const response = await fetch('/api/generate-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptInstructions })
      });
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      const dataJson = await response.json();
      const responseText = dataJson.text || "";
      const lines = responseText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.includes('|'));
      
      const data = {
        words: lines.map((line: string) => {
          const [word, ...hintParts] = line.split('|');
          return { word: word.trim(), hint: hintParts.join('|').trim() };
        })
      };

      if (data.words && Array.isArray(data.words) && data.words.length > 0) {
        // Enforce formatting
        const cleanedWords = data.words.map((w: any) => ({
          word: w.word.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, ""),
          hint: w.hint
        })).filter((w: any) => w.word.length > 0);
        
        if (cleanedWords.length === 0) throw new Error("No se encontraron palabras válidas en la respuesta de la IA.");
        
        // Pre-validation check
        const results = validateGeneratedWords(cleanedWords, mode, text, inputType === 'text');
        const hasWarnings = results.some(r => r.warnings.length > 0);

        if (hasWarnings) {
          setValidationResults(results);
          setPendingWords(cleanedWords);
          setShowValidationModal(true);
        } else {
          // Save the generated lesson in Firebase
          await saveLesson(subject.trim(), lessonTitle.trim(), cleanedWords, mode);
          onStart(cleanedWords, mode, maxAttempts);
        }
      } else {
        throw new Error("El formato de respuesta de la IA fue incorrecto o está vacío.");
      }

    } catch (err: any) {
      console.error("Error generating text:", err);
      setError(`Ocurrió un error al procesar: ${err.message || "Error desconocido"}. Comprueba la conexión o intenta con un texto más corto.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pt-10 px-4">
      <div className="flex justify-between items-center bg-[var(--white)] p-6 rounded-2xl border-4 border-[var(--dark)] shadow-[6px_6px_0_0_var(--dark)]">
        <button onClick={onBack} className="brutal-btn bg-gray-100 text-[var(--dark)] flex items-center gap-2 px-4 py-2 text-sm shadow-[2px_2px_0px_rgba(27,26,25,1)] border-[3px]">
          ← Volver
        </button>
        <div className="flex items-center gap-4 flex-1 justify-center relative -left-8">
           <BookOpen className="w-10 h-10 text-[var(--primary)]" />
           <h2 className="text-3xl font-black uppercase text-[var(--dark)]">Crear Nueva Lección</h2>
        </div>
      </div>

      <div className="brutal-box p-6 md:p-8 space-y-8 bg-[var(--white)]">

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2 mb-4">
            <label className="font-black text-[var(--dark)] text-lg uppercase flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[var(--primary)]" /> Materia o Asignatura
            </label>
            <input 
              type="text"
              placeholder="Ej: Auditoría Forense"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 brutal-box text-lg font-medium outline-none focus:border-[var(--primary)] bg-white"
            />
          </div>
          <div className="space-y-2 mb-4">
            <label className="font-black text-[var(--dark)] text-lg uppercase flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--secondary)]" /> Título de la Lección
            </label>
            <input 
              type="text"
              placeholder="Ej: Lección 1"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              className="w-full p-3 brutal-box text-lg font-medium outline-none focus:border-[var(--secondary)] bg-white"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="font-black text-[var(--dark)] text-lg uppercase flex items-center gap-2">
            1. Origen de las Palabras
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button 
              className={cn("brutal-btn py-3 text-sm flex items-center justify-center gap-2", inputType === 'text' ? "bg-[var(--accent)]" : "bg-white text-gray-500")}
              onClick={() => setInputType('text')}
            >
              <FileText className="w-4 h-4" /> Texto de Estudio
            </button>
            <button 
              className={cn("brutal-btn py-3 text-sm flex items-center justify-center gap-2", inputType === 'words' ? "bg-[var(--accent)]" : "bg-white text-gray-500")}
              onClick={() => setInputType('words')}
            >
              <BookOpen className="w-4 h-4" /> Lista Manual
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="font-black text-[var(--dark)] text-lg uppercase">
            2. Pega tu contenido aquí
          </label>
          <textarea 
            className="w-full h-32 p-4 brutal-box resize-none outline-none focus:border-[var(--primary)] text-lg font-medium"
            placeholder={inputType === 'text' ? "Pega aquí un fragmento de texto, artículo o lección..." : "Pega aquí palabras separadas por comas o saltos de línea..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <label className="font-black text-[var(--dark)] text-lg uppercase">3. Dificultad</label>
            <div className="flex flex-col gap-2">
              <button 
                className={cn("w-full brutal-btn py-2 text-sm", mode === 'facil' ? "bg-[var(--secondary)] text-white" : "bg-white text-gray-500")}
                onClick={() => setMode('facil')}
              >
                Fácil
              </button>
              <button 
                className={cn("w-full brutal-btn py-2 text-sm", mode === 'dificil' ? "bg-[var(--primary)] text-white" : "bg-white text-gray-500")}
                onClick={() => setMode('dificil')}
              >
                Difícil
              </button>
              <button 
                className={cn("w-full brutal-btn py-2 text-sm", mode === 'superdificil' ? "bg-[var(--dark)] text-white" : "bg-white text-gray-500")}
                onClick={() => setMode('superdificil')}
              >
                Super Difícil
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="font-black text-[var(--dark)] text-lg uppercase">4. Cantidad</label>
            <select 
              className="w-full p-3 brutal-box bg-white font-bold outline-none cursor-pointer"
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
            >
              <option value={5}>5 Palabras</option>
              <option value={10}>10 Palabras</option>
              <option value={15}>15 Palabras</option>
              <option value={20}>20 Palabras</option>
            </select>
          </div>

          <div className="space-y-4">
            <label className="font-black text-[var(--dark)] text-lg uppercase">5. Intentos MÁX</label>
            <select 
              className="w-full p-3 brutal-box bg-white font-bold outline-none cursor-pointer"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
            >
              <option value={1}>1 Intento</option>
              <option value={2}>2 Intentos</option>
              <option value={3}>3 Intentos</option>
              <option value={0}>Sin límite</option>
            </select>
            <p className="text-sm font-bold text-gray-500 leading-tight">Veces que los alumnos pueden completar esta lección antes de bloquear el sistema.</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-100 border-2 border-red-500 rounded-xl font-bold text-red-700">
            {error}
          </div>
        )}

        <div className="pt-4">
          <button 
            className="w-full brutal-btn bg-[var(--primary)] text-white flex items-center justify-center gap-3 py-4 text-xl"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Procesando lección con IA...
              </>
            ) : (
              "GENERAR Y JUGAR"
            )}
          </button>
        </div>
      </div>

      {showValidationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="brutal-box p-6 md:p-8 max-w-2xl w-full bg-white animate-in zoom-in-95 max-h-[90vh] flex flex-col shadow-[8px_8px_0_0_#000]">
            <div className="bg-amber-100 border-[4px] border-amber-500 p-4 rounded-xl flex items-start gap-4 mb-6">
              <AlertTriangle className="w-10 h-10 text-amber-600 shrink-0 mt-1" />
              <div>
                <h3 className="font-black uppercase text-xl text-[var(--dark)]">Pre-validación de Calidad</h3>
                <p className="text-sm font-bold text-gray-700 leading-snug">
                  La IA ha sugerido {pendingWords.length} términos, pero algunos no se ajustan perfectamente a los umbrales esperados de dificultad (<span className="underline uppercase font-extrabold">{mode}</span>) o contexto.
                </p>
              </div>
            </div>

            <h4 className="font-black uppercase text-xs tracking-wider text-gray-400 mb-2">Resumen de Evaluación:</h4>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-6 border-[3px] border-black p-4 bg-gray-50 rounded-xl max-h-[45vh]">
              {validationResults.map((v, i) => {
                const hasWarnings = v.warnings.length > 0;
                return (
                  <div key={i} className={cn(
                    "p-3 rounded-lg border-2 border-black flex flex-col gap-1 transition-all",
                    hasWarnings ? "bg-red-50 border-red-500 shadow-[3px_3px_0_0_rgba(239,68,68,1)]" : "bg-green-50 border-green-500/50"
                  )}>
                    <div className="flex justify-between items-center">
                      <span className="font-black tracking-wide font-mono text-base text-[var(--dark)]">{v.word}</span>
                      {hasWarnings ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 border-2 border-red-500 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          ⚠️ Advertencia
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 border-2 border-green-400 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          ✓ Óptima
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-gray-500 leading-snug">Pista: {v.hint}</div>
                    {hasWarnings && (
                      <ul className="mt-2 pl-4 list-disc space-y-1 border-t border-dashed border-red-200 pt-2">
                        {v.warnings.map((warn, index) => (
                          <li key={index} className="text-xs font-black text-red-700 leading-tight">{warn}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleRegenerateFromModal}
                disabled={loading}
                className="flex-1 brutal-btn bg-white text-gray-800 flex items-center justify-center gap-2 py-3 hover:bg-gray-100 transition-all font-black uppercase text-sm border-2 border-black"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                Regenerar con IA
              </button>
              <button
                onClick={handleBypassValidation}
                disabled={loading}
                className="flex-1 brutal-btn bg-[var(--primary)] text-white flex items-center justify-center gap-2 py-3 font-black uppercase text-sm"
              >
                <Play className="w-4 h-4 fill-white" />
                Ignorar y Jugar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
