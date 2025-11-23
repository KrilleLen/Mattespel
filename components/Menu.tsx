import React from 'react';

interface MenuProps {
  onStart: () => void;
  lastScore?: number;
  isGameOver?: boolean;
  selectedTable: number | 'all';
  onSelectTable: (table: number | 'all') => void;
}

export const Menu: React.FC<MenuProps> = ({ 
  onStart, 
  lastScore, 
  isGameOver, 
  selectedTable, 
  onSelectTable 
}) => {
  
  const renderTableButton = (value: number | 'all', label: string) => {
    const isSelected = selectedTable === value;
    return (
      <button
        key={value}
        onClick={() => onSelectTable(value)}
        className={`
          relative px-3 py-2 rounded-lg font-bold text-sm transition-all duration-200 border-2
          ${isSelected 
            ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)] scale-110 z-10' 
            : 'bg-black/40 border-purple-900 text-purple-300 hover:border-purple-500 hover:text-white'
          }
        `}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white">
      <div className="bg-black/70 backdrop-blur-md p-8 rounded-3xl border-4 border-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.3)] text-center max-w-2xl w-full mx-4 overflow-hidden relative">
        
        {/* Title */}
        <h1 className="text-4xl md:text-5xl mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 font-[Black_Ops_One] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
          {isGameOver ? "GAME OVER" : "CAESAR'S PAINTBALL"}
        </h1>

        {/* Score Display */}
        {isGameOver && (
          <div className="mb-6 animate-bounce">
            <p className="text-lg text-gray-300 font-[Orbitron]">Mission Report</p>
            <p className="text-6xl font-bold text-yellow-400 drop-shadow-lg font-[Black_Ops_One]">{lastScore}</p>
          </div>
        )}

        {/* Table Selection Grid */}
        <div className="mb-8">
          <p className="text-blue-200 font-[Orbitron] mb-3 text-sm uppercase tracking-widest">Select Mission (Table)</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => renderTableButton(num, `x${num}`))}
            {renderTableButton('all', 'ALL')}
          </div>
        </div>

        {/* Instructions (Only show on start screen) */}
        {!isGameOver && (
          <div className="mb-8 space-y-1 text-blue-200/80 font-['Orbitron'] text-sm">
            <p>🎯 Shoot the <span className="text-white font-bold">correct answer</span> box.</p>
            <p>⚠️ Watch out! Not all falling boxes are correct.</p>
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={onStart}
          className="group relative px-10 py-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-bold rounded-full text-2xl transition-all duration-200 transform hover:scale-105 hover:shadow-[0_0_30px_rgba(192,132,252,0.6)] w-full max-w-xs border-2 border-purple-400/50"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />
          <span className="relative flex items-center justify-center gap-2 font-[Black_Ops_One] tracking-wider">
            {isGameOver ? "RETRY" : "START GAME"}
          </span>
        </button>
      </div>
    </div>
  );
};