import React, { useEffect, useState } from 'react';
import { Lesson, GameMode } from '../types';
import { getLessons, deleteLesson, updateLesson } from '../firebase';
import { BookOpen, Play, Calendar, Search, Trash2, Edit2, X, Plus, Save } from 'lucide-react';

interface SavedLessonsViewProps {
  onBack: () => void;
  onPlayLesson: (words: { word: string; hint: string }[], mode: GameMode) => void;
}

export const SavedLessonsView: React.FC<SavedLessonsViewProps> = ({ onBack, onPlayLesson }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const handleUpdateWord = (index: number, field: 'word' | 'hint', value: string) => {
    if (!editingLesson) return;
    const newWords = [...editingLesson.words];
    newWords[index] = { ...newWords[index], [field]: value };
    setEditingLesson({ ...editingLesson, words: newWords });
  };

  const handleRemoveWord = (index: number) => {
    if (!editingLesson) return;
    const newWords = [...editingLesson.words];
    newWords.splice(index, 1);
    setEditingLesson({ ...editingLesson, words: newWords });
  };

  const handleAddWord = () => {
    if (!editingLesson) return;
    setEditingLesson({ ...editingLesson, words: [...editingLesson.words, { word: '', hint: '' }] });
  };

  const handleSaveEdit = async () => {
    if (!editingLesson) return;
    try {
      await updateLesson(editingLesson.id, { 
        title: editingLesson.title,
        subject: editingLesson.subject,
        words: editingLesson.words.filter(w => w.word.trim() && w.hint.trim()) // simple validation
      });
      setLessons(prev => prev.map(l => l.id === editingLesson.id ? editingLesson : l));
      setEditingLesson(null);
    } catch(e) {
      console.error(e);
      alert("Error al guardar.");
    }
  };

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
                                onClick={() => setEditingLesson(JSON.parse(JSON.stringify(lesson)))}
                                className="brutal-btn bg-[#f5f5f5] text-[var(--dark)] p-2 flex items-center justify-center shadow-[2px_2px_0_0_var(--dark)] border-2 border-[var(--dark)] hover:bg-[#e0e0e0]"
                                title="Editar lección"
                             >
                                <Edit2 className="w-5 h-5" />
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

      {/* Edit Modal */}
      {editingLesson && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white brutal-box border-4 border-[var(--dark)] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[8px_8px_0_0_var(--dark)]">
            <div className="flex justify-between items-center border-b-4 border-[var(--dark)] p-4 bg-gray-50">
              <h2 className="text-2xl font-black uppercase text-[var(--primary)] flex items-center gap-2">
                <Edit2 className="w-6 h-6" /> Editar Lección
              </h2>
              <button 
                onClick={() => setEditingLesson(null)}
                className="hover:bg-red-100 p-2 brutal-btn border-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-2 uppercase">Materia</label>
                  <input 
                    type="text" 
                    value={editingLesson.subject}
                    onChange={(e) => setEditingLesson({...editingLesson, subject: e.target.value})}
                    className="w-full p-3 brutal-box font-bold border-2 focus:border-[var(--primary)] outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-2 uppercase">Título / Tema</label>
                  <input 
                    type="text" 
                    value={editingLesson.title}
                    onChange={(e) => setEditingLesson({...editingLesson, title: e.target.value})}
                    className="w-full p-3 brutal-box font-bold border-2 focus:border-[var(--primary)] outline-none bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-2 uppercase flex justify-between items-center">
                  <span>Palabras de la Lección ({editingLesson.words.length})</span>
                  <button 
                    onClick={handleAddWord}
                    className="brutal-btn bg-gray-200 px-3 py-1 text-sm font-bold flex items-center gap-1 shadow-[2px_2px_0_0_var(--dark)]"
                  >
                    <Plus className="w-4 h-4" /> Agregar Palabra
                  </button>
                </label>
                <div className="space-y-3 bg-gray-50 p-4 border-2 border-[var(--dark)]">
                  {editingLesson.words.map((w, index) => (
                    <div key={index} className="flex gap-2 items-center bg-white border-2 border-[var(--dark)] p-2">
                       <span className="font-bold w-6 text-center">{index + 1}.</span>
                       <input 
                         type="text"
                         value={w.word}
                         onChange={(e) => handleUpdateWord(index, 'word', e.target.value)}
                         placeholder="EJ: ECONOMIA"
                         className="flex-1 p-2 font-bold outline-none uppercase bg-gray-100 border-2 border-transparent focus:border-[var(--primary)]"
                       />
                       <input 
                         type="text"
                         value={w.hint}
                         onChange={(e) => handleUpdateWord(index, 'hint', e.target.value)}
                         placeholder="Pista... EJ: Ciencia que estudia los recursos..."
                         className="flex-[2] p-2 font-medium outline-none bg-gray-100 border-2 border-transparent focus:border-[var(--primary)]"
                       />
                       <button 
                         onClick={() => handleRemoveWord(index)}
                         className="p-2 text-red-500 hover:bg-red-100 brutal-btn border-2"
                         title="Eliminar palabra"
                       >
                         <Trash2 className="w-5 h-5"/>
                       </button>
                    </div>
                  ))}
                  {editingLesson.words.length === 0 && (
                    <p className="text-center font-bold text-red-500">Agrega al menos una palabra para que la lección sea válida.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t-4 border-[var(--dark)] bg-gray-50 flex justify-end gap-4">
               <button 
                 onClick={() => setEditingLesson(null)}
                 className="brutal-btn bg-gray-200 px-6 py-3 font-bold shadow-[2px_2px_0_0_var(--dark)]"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleSaveEdit}
                 disabled={editingLesson.words.length === 0 || !editingLesson.subject.trim() || !editingLesson.title.trim()}
                 className="brutal-btn bg-green-500 text-white px-6 py-3 font-black flex items-center gap-2 shadow-[2px_2px_0_0_var(--dark)] disabled:opacity-50"
               >
                 <Save className="w-5 h-5" /> Guardar Cambios
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
