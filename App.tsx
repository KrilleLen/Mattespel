import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import { Menu } from './components/Menu';

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  // Default to 'all' (mixed tables)
  const [selectedTable, setSelectedTable] = useState<number | 'all'>('all');

  const startGame = () => {
    setScore(0);
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setGameState(GameState.GAME_OVER);
  };

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gray-900">
      {/* Background Gradient for the whole app */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900 via-gray-900 to-black z-0 pointer-events-none" />
      
      {gameState === GameState.MENU && (
        <Menu 
          onStart={startGame} 
          selectedTable={selectedTable}
          onSelectTable={setSelectedTable}
        />
      )}
      
      {gameState === GameState.PLAYING && (
        <GameCanvas 
          onGameOver={handleGameOver} 
          selectedTable={selectedTable}
        />
      )}
      
      {gameState === GameState.GAME_OVER && (
        <Menu 
          onStart={startGame} 
          lastScore={score} 
          isGameOver={true}
          selectedTable={selectedTable}
          onSelectTable={setSelectedTable}
        />
      )}
    </div>
  );
};

export default App;