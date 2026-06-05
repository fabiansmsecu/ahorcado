import React, { useEffect, useState } from 'react';
import { Trophy, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface Result {
  uid: string;
  name: string;
  won: boolean;
  word: string;
  score: number;
  time: number;
}

export function LiveClassStats({ joinedStudents, gameEndTime, roomPin }: { joinedStudents: string[], gameEndTime: number | null, roomPin: string }) {
  const [results, setResults] = useState<Result[]>([]);
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number}[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/class-stats?roomPin=${encodeURIComponent(roomPin)}`);
        const data = await res.json();
        setResults(data.results || []);

        const leaderRes = await fetch(`/api/room-leaderboard?roomPin=${encodeURIComponent(roomPin)}`);
        const leaderData = await leaderRes.json();
        setLeaderboard(leaderData.leaderboard || []);
      } catch (e) {}
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, [roomPin]);

  useEffect(() => {
     if (!gameEndTime) return;
     const timer = setInterval(() => {
        setTimeLeft(Math.max(0, Math.floor((gameEndTime - Date.now()) / 1000)));
     }, 1000);
     return () => clearInterval(timer);
  }, [gameEndTime]);

  return (
    <div className="w-full mt-6 bg-[var(--white)] p-6 border-4 border-[var(--dark)] shadow-[6px_6px_0_0_var(--dark)]">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
        <h3 className="text-2xl font-black uppercase text-[var(--dark)] flex items-center gap-2">
          Resultados en Vivo
          <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm flex items-center gap-2 border-2 border-red-200 ml-2 shadow-[2px_2px_0_0_rgba(220,38,38,1)]">
             <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
             LIVE
          </span>
        </h3>

        {gameEndTime && (
          <div className={cn(
             "flex items-center gap-2 brutal-box px-4 py-2 font-black text-xl border-[3px] shadow-[3px_3px_0_0_var(--dark)]",
             timeLeft <= 10 ? "text-red-600 bg-red-100 animate-pulse" : "text-[var(--dark)] bg-white"
          )}>
             <Clock className="w-5 h-5" />
             {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>
      
      {joinedStudents.length === 0 && results.length === 0 ? (
        <div className="text-center p-8 text-gray-400 font-bold">Nadie se ha unido todavía.</div>
      ) : (
        <div className="space-y-3">
          {/* Combine joined students and those who somehow skipped the lobby */}
          {Array.from(new Set([...joinedStudents, ...results.map(r => r.name)]))
            .map(studentName => {
              const studentScoreObj = leaderboard.find(l => l.name === studentName);
              const score = studentScoreObj ? studentScoreObj.score : 0;
              return { studentName, score };
            })
            .sort((a, b) => b.score - a.score)
            .map(({ studentName, score: studentScore }, index) => {
             const studentResult = [...results].reverse().find(r => r.name === studentName);
             return (
               <div key={studentName} className="flex items-center justify-between p-3 border-2 border-black rounded-lg bg-gray-50 uppercase font-bold text-sm sm:text-base">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-black flex items-center justify-center font-black text-gray-500 text-xs">
                     #{index + 1}
                   </div>
                   {studentName} <span className="ml-2 bg-yellow-200 border border-yellow-400 px-2 rounded-full text-xs text-yellow-800 shadow-[1px_1px_0_0_#ca8a04]">PUNTOS: {studentScore}</span>
                 </div>
                 
                 <div>
                   {!studentResult ? (
                     <span className="flex items-center gap-2 text-blue-600">
                        <Clock className="w-5 h-5 animate-spin" /> Jugando...
                     </span>
                   ) : studentResult.won ? (
                     <span className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" /> ¡Salvado! (+{studentResult.score})
                     </span>
                   ) : (
                     <span className="flex items-center gap-2 text-red-600">
                        <XCircle className="w-5 h-5" /> Ahorcado
                     </span>
                   )}
                 </div>
               </div>
             );
          })}
        </div>
      )}
    </div>
  );
}
