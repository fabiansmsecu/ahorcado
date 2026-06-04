import React, { useEffect, useState } from 'react';
import { Lesson, GameMode } from '../types';
import { getLessons, deleteLesson } from '../firebase';
import { BookOpen, Play, Calendar, Search, Trash2 } from 'lucide-react';

interface SavedLessonsViewProps {
  onBack: () => void;
  onPlayLesson: (words: { word: string; hint: string }[], mode: GameMode) => void;
}

export const SavedLessonsView: React.FC<SavedLessonsViewProps> = ({ onBack, onPlayLesson }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLessons = async () => {
      setLoading(true);
      try {
        const data = await getLessons();
        setLessons(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLessons();
  }, []);

  const filteredLessons = lessons.filter(l => 
    l.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by Subject
  const groupedLessons = filteredLessons.reduce((acc, lesson) => {
    const s = lesson.subject || 'Sin Materia';
    if (!acc[s]) acc[s] = [];
    acc[s].push(lesson);
    return acc;
  }, {} as Record<string, Lesson[]>);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pt-10 px-4">
      <div className="flex justify-between items-center bg-[var(--white)] p-6 rounded-2xl border-4 border-[var(--dark)] shadow-[6px_6px_0_0_var(--dark)]">
        <button 
          onClick={onBack}
          className="brutal-btn bg-gray-100 text-[var(--dark)] flex items-center gap-2 px-4 py-2 text-sm shadow-[2px_2px_0px_rgba(27,26,25,1)] border-[3px]"
        >
          ← Volver
        </button>
        <div className="flex items-center gap-4 flex-1 justify-center relative -left-8">
           <BookOpen className="w-10 h-10 text-[var(--primary)]" />
           <h2 className="text-3xl font-black uppercase text-[var(--dark)]">Materias y Lecciones</h2>
        </div>
      </div>

      <div className="brutal-box p-6 bg-[var(--white)]">
         <div className="flex items-center gap-4 mb-6 border-4 border-black p-2 bg-white flex-1">
            <Search className="w-6 h-6 text-gray-400 ml-2" />
            <input 
              type="text" 
              placeholder="Buscar por materia o lección..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-lg outline-none font-bold placeholder-gray-400"
            />
         </div>

         {loading ? (
             <div className="p-12 text-center text-gray-500 font-bold uppercase">Cargando tu catálogo de materias...</div>
         ) : Object.keys(groupedLessons).length === 0 ? (
             <div className="p-12 text-center text-gray-500 font-bold uppercase border-4 border-dashed border-gray-300">
               No se encontraron lecciones. ¡Crea una nueva!
             </div>
         ) : (
            <div className="space-y-8">
              {Object.entries(groupedLessons).map(([subject, subLessons]) => (
                <div key={subject} className="space-y-4">
                   <h3 className="text-3xl font-black uppercase text-[var(--primary)] border-b-4 border-black pb-2">📂 {subject}</h3>
                   <div className="grid md:grid-cols-2 gap-4">
                     {subLessons.map(lesson => (
                       <div key={lesson.id} className="border-4 border-[var(--dark)] p-4 bg-gray-50 shadow-[4px_4px_0_0_var(--dark)] flex flex-col gap-3 hover:translate-y-px hover:shadow-[2px_2px_0_0_var(--dark)] transition-all">
                          <div className="flex justify-between items-start">
                            <h4 className="font-black text-xl text-[var(--dark)]">{lesson.title}</h4>
                            <span className="text-xs font-bold bg-[var(--accent)] px-2 py-1 border-2 border-[var(--dark)] uppercase">{lesson.mode}</span>
                          </div>
                          
                          <div className="text-sm font-bold opacity-60 flex items-center gap-2">
                             <Calendar className="w-4 h-4" />
                             {new Date(lesson.createdAt).toLocaleDateString()} • {lesson.words.length} palabras
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mt-2 mb-4">
                            {lesson.words.slice(0, 3).map((w, i) => (
                               <span key={i} className="text-xs bg-white border border-[var(--dark)] px-2 py-0.5 font-bold">{w.word}</span>
                            ))}
                            {lesson.words.length > 3 && <span className="text-xs font-bold opacity-60">+{lesson.words.length - 3}...</span>}
                          </div>

                          <div className="mt-auto flex gap-2">
                             <button 
                                onClick={async () => {
                                  if (confirm("¿Seguro que deseas eliminar esta lección?")) {
                                     await deleteLesson(lesson.id);
                                     setLessons(prev => prev.filter(l => l.id !== lesson.id));
                                  }
                                }}
                                className="brutal-btn bg-red-500 text-white p-2 flex items-center justify-center shadow-[2px_2px_0_0_var(--dark)]"
                                title="Eliminar lección"
                             >
                                <Trash2 className="w-5 h-5" />
                             </button>
                             <button 
                                onClick={() => onPlayLesson(lesson.words, lesson.mode)}
                                className="w-full brutal-btn bg-[var(--secondary)] text-white py-2 flex items-center justify-center gap-2 shadow-[2px_2px_0_0_var(--dark)]"
                             >
                                <Play className="w-5 h-5" /> Enviar y Jugar
                             </button>
                          </div>
                       </div>
                     ))}
                   </div>
                </div>
              ))}
            </div>
         )}
      </div>
    </div>
  );
};
