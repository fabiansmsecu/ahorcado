import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';

interface ClassStats {
  players: Record<string, { name: string, score: number, gamesPlayed: number }>;
  failedWords: Record<string, number>;
  totalGames: number;
  totalWins: number;
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#2F2F2F', '#FF9F1C', '#E71D36'];

export const ClassStatsView = ({ onBack }: { onBack: () => void }) => {
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const pin = localStorage.getItem('teacher_pin') || '';
        const res = await fetch(`/api/stats?pin=${pin}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error("Error fetching stats", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
    // Poll stats every 5s if we want it real time
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = async () => {
    if (!window.confirm("¿Seguro que deseas borrar las estadísticas? Esto no borrará la tabla de clasificación a largo plazo, solo la sesión actual.")) return;
    
    try {
      const pin = localStorage.getItem('teacher_pin') || '';
      await fetch(`/api/stats/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      setStats({
        players: {},
        failedWords: {},
        totalGames: 0,
        totalWins: 0
      });
    } catch(e) {}
  };

  if (loading) return <div className="text-center animate-pulse py-12 font-bold uppercase">Cargando estadísticas...</div>;
  if (!stats) return <div className="text-center font-bold uppercase py-12 text-red-500">Error al cargar estadísticas</div>;

  // Prepare active players data
  const playersMap = Object.values(stats.players);
  const activePlayersData = playersMap
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 5) // top 5 most active
    .map(p => ({
      name: p.name,
      partidas: p.gamesPlayed
    }));

  // Prepare failed words data
  const failedWordsData = Object.entries(stats.failedWords)
    .map(([word, fails]) => ({ word, fallos: fails }))
    .sort((a, b) => b.fallos - a.fallos)
    .slice(0, 5); // top 5 failed

  // Prepare progress data
  const winRate = stats.totalGames > 0 ? Math.round((stats.totalWins / stats.totalGames) * 100) : 0;
  const progressData = [
    { name: 'Ganadas', value: stats.totalWins },
    { name: 'Perdidas', value: stats.totalGames - stats.totalWins }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center bg-[var(--white)] p-6 rounded-2xl border-4 border-black shadow-[6px_6px_0_0_#000]">
        <button 
          onClick={onBack}
          className="brutal-btn bg-gray-100 text-[var(--dark)] flex items-center gap-2 px-4 py-2 text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] border-[3px]"
        >
          ← Volver
        </button>
        <h2 className="text-2xl font-black uppercase text-[var(--dark)] flex-1 text-center">Estadísticas de la Clase</h2>
        <button 
          onClick={handleReset}
          className="brutal-btn bg-red-400 text-white flex items-center gap-2 px-4 py-2 text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] border-[3px] hover:bg-red-500"
        >
          Reiniciar
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Basic numbers */}
        <div className="brutal-box p-6 bg-[var(--accent)] col-span-3 lg:col-span-1 flex flex-col justify-center items-center text-center">
          <h3 className="text-xl font-bold uppercase opacity-80 mb-2">Total Partidas</h3>
          <p className="text-6xl font-black tracking-tighter mb-4">{stats.totalGames}</p>
          <div className="w-full bg-[var(--white)] rounded-full h-4 border-2 border-black overflow-hidden mb-2">
            <div className="bg-[var(--secondary)] h-full transition-all" style={{ width: `${winRate}%` }}></div>
          </div>
          <p className="font-bold text-sm">Porcentaje de éxito: {winRate}%</p>
        </div>

        {/* Most active players bar chart */}
        <div className="brutal-box p-6 bg-[var(--white)] col-span-3 lg:col-span-2">
          <h3 className="text-lg font-black uppercase mb-4">Jugadores Más Activos (Partidas)</h3>
          <div className="h-[200px] w-full">
            {activePlayersData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={activePlayersData}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#ccc" vertical={false} />
                   <XAxis dataKey="name" tick={{fontFamily: 'inherit', fontWeight: 'bold'}} />
                   <YAxis allowDecimals={false} tick={{fontFamily: 'inherit', fontWeight: 'bold'}} />
                   <Tooltip cursor={{fill: '#f0f0f0'}} contentStyle={{ borderRadius: '12px', border: '3px solid black', fontWeight: 'bold', fontFamily: 'inherit' }} />
                   <Bar dataKey="partidas" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center font-bold opacity-50 uppercase text-center">
                Aún no hay partidas jugadas
              </div>
            )}
          </div>
        </div>

        {/* Progress Pie Chart */}
        <div className="brutal-box p-6 bg-[var(--white)] col-span-3 md:col-span-1">
          <h3 className="text-lg font-black uppercase mb-4 text-center">Progreso Promedio</h3>
          <div className="h-[200px] w-full">
            {stats.totalGames > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={progressData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="#000"
                    strokeWidth={3}
                  >
                    {progressData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--secondary)' : 'var(--primary)'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '3px solid black', fontWeight: 'bold', fontFamily: 'inherit' }} />
                  <Legend wrapperStyle={{ fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center font-bold opacity-50 uppercase text-center">
                Esperando resultados
              </div>
            )}
          </div>
        </div>

        {/* Failed Words Bar Chart */}
        <div className="brutal-box p-6 bg-[var(--white)] col-span-3 md:col-span-2">
          <h3 className="text-lg font-black uppercase mb-4">Palabras que Más Fallaron</h3>
          <div className="h-[200px] w-full">
            {failedWordsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={failedWordsData} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{fontFamily: 'inherit', fontWeight: 'bold'}} />
                  <YAxis dataKey="word" type="category" width={100} tick={{fontFamily: 'inherit', fontWeight: 'bold', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f0f0f0'}} contentStyle={{ borderRadius: '12px', border: '3px solid black', fontWeight: 'bold', fontFamily: 'inherit' }} />
                  <Bar dataKey="fallos" fill="var(--accent)" radius={[0, 8, 8, 0]} stroke="#000" strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center font-bold opacity-50 uppercase text-center">
                Nadie ha perdido aún ¡Qué bien!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
