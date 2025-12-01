'use client'

import React from 'react';
import dynamic from 'next/dynamic';

interface Chess3DProps {
  fen: string;
  boardOrientation: 'white' | 'black';
  onSquareClick?: (square: string) => void;
  selectedSquare?: string | null;
  isMyTurn?: boolean;
}

// Dynamically import the entire 3D scene to avoid SSR issues
const Chess3DScene = dynamic(() => import('./Chess3DScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gradient-to-br from-blue-900 to-purple-900 rounded-2xl flex items-center justify-center text-white relative">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Loading 3D Chess...</p>
      </div>
    </div>
  )
});

// Fallback component for when 3D fails
function Chess3DFallback({ onSquareClick, fen, boardOrientation, selectedSquare }: Chess3DProps) {
  const [pieces, setPieces] = React.useState<Array<{type: string, color: string, square: string}>>([]);

  React.useEffect(() => {
    try {
      const Chess = require('chess.js').Chess;
      const chess = new Chess(fen);
      const board = chess.board();
      const newPieces: Array<{type: string, color: string, square: string}> = [];

      board.forEach((row: any[], rankIndex: number) => {
        row.forEach((square: any, fileIndex: number) => {
          if (square) {
            const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
            const squareNotation = files[fileIndex] + ranks[7 - rankIndex];
            
            newPieces.push({
              type: square.type,
              color: square.color,
              square: squareNotation
            });
          }
        });
      });

      setPieces(newPieces);
    } catch (error) {
      console.error('Error parsing chess position:', error);
    }
  }, [fen]);

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = boardOrientation === 'white' ? ['8', '7', '6', '5', '4', '3', '2', '1'] : ['1', '2', '3', '4', '5', '6', '7', '8'];
  const orderedFiles = boardOrientation === 'white' ? files : [...files].reverse();

  const pieceSymbols: {[key: string]: string} = {
    'wp': '♙', 'wr': '♖', 'wn': '♘', 'wb': '♗', 'wq': '♕', 'wk': '♔',
    'bp': '♟', 'br': '♜', 'bn': '♞', 'bb': '♝', 'bq': '♛', 'bk': '♚'
  };

  return (
    <div className="w-full h-96 bg-gradient-to-br from-blue-900 to-purple-900 rounded-2xl overflow-hidden shadow-2xl relative p-4">
      <div className="bg-yellow-100 rounded-lg p-2 mb-4 text-center">
        <p className="text-sm text-gray-800">🎮 3D Mode (Fallback View)</p>
      </div>
      
      <div className="grid grid-cols-8 gap-0 aspect-square max-w-sm mx-auto border-4 border-amber-800 rounded-lg overflow-hidden">
        {ranks.map((rank, rankIndex) => 
          orderedFiles.map((file, fileIndex) => {
            const square = file + rank;
            const isLight = (rankIndex + fileIndex) % 2 === 0;
            const piece = pieces.find(p => p.square === square);
            const isSelected = selectedSquare === square;
            
            return (
              <div
                key={square}
                className={`
                  aspect-square flex items-center justify-center text-2xl cursor-pointer transition-all duration-200
                  ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
                  ${isSelected ? 'ring-4 ring-green-400 bg-green-200' : ''}
                  hover:brightness-110
                `}
                onClick={() => onSquareClick?.(square)}
              >
                {piece && (
                  <span className={`text-3xl select-none ${piece.color === 'w' ? 'text-white drop-shadow-lg' : 'text-black'}`}>
                    {pieceSymbols[piece.color + piece.type] || '?'}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Main 3D Chess component with error boundary
export default function Chess3D({ fen, boardOrientation, onSquareClick, selectedSquare, isMyTurn }: Chess3DProps) {
  const [use3D, setUse3D] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    // Reset error state when props change
    setHasError(false);
  }, [fen]);

  if (hasError || !use3D) {
    return (
      <div className="w-full h-96 bg-gradient-to-br from-blue-900 to-purple-900 rounded-2xl overflow-hidden shadow-2xl relative">
        <Chess3DFallback
          fen={fen}
          boardOrientation={boardOrientation}
          onSquareClick={onSquareClick}
          selectedSquare={selectedSquare}
          isMyTurn={isMyTurn}
        />
        
        {/* Turn indicator overlay */}
        {isMyTurn && (
          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse z-10">
            Your Turn
          </div>
        )}
        
        {/* Switch back to 3D button */}
        <div className="absolute bottom-4 right-4">
          <button
            onClick={() => { setUse3D(true); setHasError(false); }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
          >
            Try 3D
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-96 bg-gradient-to-br from-blue-900 to-purple-900 rounded-2xl overflow-hidden shadow-2xl relative">
      <React.Suspense fallback={
        <div className="w-full h-full flex items-center justify-center text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading 3D Chess...</p>
          </div>
        </div>
      }>
        <ErrorBoundary onError={() => setHasError(true)}>
          <Chess3DScene
            fen={fen}
            boardOrientation={boardOrientation}
            onSquareClick={onSquareClick}
            selectedSquare={selectedSquare}
            isMyTurn={isMyTurn}
          />
        </ErrorBoundary>
      </React.Suspense>
      
      {/* Turn indicator overlay */}
      {isMyTurn && (
        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse z-10">
          Your Turn
        </div>
      )}
      
      {/* Switch to 2D button */}
      <div className="absolute bottom-4 right-4">
        <button
          onClick={() => setUse3D(false)}
          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
        >
          Use 2D
        </button>
      </div>
    </div>
  );
}

// Simple error boundary component
class ErrorBoundary extends React.Component<{children: React.ReactNode, onError: () => void}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

