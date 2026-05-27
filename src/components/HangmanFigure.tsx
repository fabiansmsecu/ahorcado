import React from 'react';
import { motion } from 'motion/react';
import { GameMode } from '../types';
import { cn } from '../lib/utils';

interface HangmanFigureProps {
  mistakes: number;
  mode: GameMode;
}

export const HangmanFigure: React.FC<HangmanFigureProps> = ({ mistakes, mode }) => {
  const isKids = mode === 'infantil';
  const figureColor = '#FF6321'; // We'll override with theme primary inside SVG
  const gallowsColor = '#2F2F2F'; // Theme dark
  const strokeWidth = 8;
  const figureStrokeWidth = 6;

  const parts = [
    // 1. Head
    <motion.circle key="head" cx="130" cy="80" r="20" stroke="var(--primary)" strokeWidth={figureStrokeWidth} fill="white" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} />,
    // 2. Torso
    <motion.line key="torso" x1="130" y1="100" x2="130" y2="160" stroke="var(--primary)" strokeWidth={figureStrokeWidth} initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1 }} />,
    // 3. Left Arm
    <motion.line key="l-arm" x1="130" y1="115" x2="100" y2="140" stroke="var(--primary)" strokeWidth={figureStrokeWidth} initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1 }} />,
    // 4. Right Arm
    <motion.line key="r-arm" x1="130" y1="115" x2="160" y2="140" stroke="var(--primary)" strokeWidth={figureStrokeWidth} initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1 }} />,
    // 5. Left Leg
    <motion.line key="l-leg" x1="130" y1="160" x2="110" y2="200" stroke="var(--primary)" strokeWidth={figureStrokeWidth} initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1 }} />,
    // 6. Right Leg
    <motion.line key="r-leg" x1="130" y1="160" x2="150" y2="200" stroke="var(--primary)" strokeWidth={figureStrokeWidth} initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1 }} />
  ];

  return (
    <div className="brutal-box flex justify-center items-center h-[350px] w-full max-w-[350px] p-4 relative bg-[var(--white)]">
      <svg width="200" height="250" viewBox="0 0 200 250" className="w-[200px] h-[250px]">
        {/* Base and Gallows */}
        <path d="M20 230 L180 230" stroke="var(--dark)" strokeWidth={strokeWidth} fill="none" />
        <path d="M50 230 L50 30 L130 30 L130 60" stroke="var(--dark)" strokeWidth={strokeWidth} fill="none" />

        {/* Dynamic Parts based on mistakes */}
        {parts.slice(0, mistakes)}
      </svg>
      
      {mistakes > 0 && mistakes < 6 && (
        <div className="absolute bottom-4 font-black text-sm uppercase" style={{color: 'var(--primary)'}}>
          ¡Cuidado! Te quedan {6 - mistakes} intentos
        </div>
      )}
    </div>
  );
};
