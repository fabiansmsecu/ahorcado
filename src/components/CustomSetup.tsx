import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { BookOpen, FileText, Loader2, Save } from 'lucide-react';
import { saveLesson } from '../firebase';

interface CustomSetupProps {
  onStart: (words: { word: string; hint: string }[], mode: string) => void;
  onBack: () => void;
}

export const CustomSetup: React.FC<CustomSetupProps> = ({ onStart, onBack }) => {
  const [text, setText] = useState('');
  const [inputType, setInputType] = useState<'text' | 'words'>('text');
  const [mode, setMode] = useState<string>('dificil');
  const [wordCount, setWordCount] = useState<number>(10);
  
  // Custom lesson metadata
  const [subject, setSubject] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (mode === 'facil') difficultyDesc = 'niños o principiantes (lenguaje muy sencillo, pistas muy claras y obvias)';
      else if (mode === 'dificil') difficultyDesc = 'estudiantes (conceptos intermedios, pistas un poco abstractas)';
      else if (mode === 'superdificil') difficultyDesc = 'expertos universitarios (conceptos muy avanzados, poco comunes y pistas intelectuales y ambiguas)';
      
      const promptInstructions = `A partir del siguiente texto, extrae HASTA un MÁXIMO de ${wordCount} palabras clave para un juego del ahorcado.
Audiencia: ${difficultyDesc}.
Retorna exactamente UNA palabra por línea, separada de su pista con un pipe (|).
Ejemplo:
PALABRA|Pista muy corta aquí.
OTRAPALABRA|Otra pista corta aquí.

Instrucciones críticas de formato para cada línea:
1. La palabra ANTES del pipe debe ser UNA SOLA PALABRA, en MAYÚSCULAS, SIN TILDES, SIN ESPACIOS, SIN SÍMBOLOS.
2. La pista DESPUÉS del pipe debe ser MUY CORTA (máximo 6 palabras).
3. No incluyas nada más en tu respuesta. Sin markdown, sin introducciones ni conclusiones. Procesalo velozmente.

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
        
        // Save the generated lesson in Firebase
        await saveLesson(subject.trim(), lessonTitle.trim(), cleanedWords, mode);

        onStart(cleanedWords, mode);
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

        <div className="grid md:grid-cols-2 gap-6">
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
    </div>
  );
};
