'use client'

import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Chess } from 'chess.js';

type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
type PieceColor = 'w' | 'b';

interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  position: [number, number];
}

interface Chess3DProps {
  fen: string;
  boardOrientation: 'white' | 'black';
  onSquareClick?: (square: string) => void;
  selectedSquare?: string | null;
  isMyTurn?: boolean;
}

// Chess piece models using simple geometries
function ChessPieceModel({ piece, position, isSelected, onClick }: {
  piece: ChessPiece;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = isSelected ? Math.sin(state.clock.elapsedTime * 3) * 0.1 : 0;
      meshRef.current.position.y = position[1] + (hovered ? 0.1 : 0) + (isSelected ? 0.2 : 0);
    }
  });

  const geometry = useMemo(() => {
    switch (piece.type) {
      case 'p': // Pawn
        return new THREE.ConeGeometry(0.15, 0.4, 8);
      case 'r': // Rook
        return new THREE.BoxGeometry(0.25, 0.45, 0.25);
      case 'n': // Knight
        return new THREE.ConeGeometry(0.2, 0.5, 6);
      case 'b': // Bishop
        return new THREE.ConeGeometry(0.18, 0.55, 8);
      case 'q': // Queen
        return new THREE.ConeGeometry(0.22, 0.6, 8);
      case 'k': // King
        return new THREE.CylinderGeometry(0.2, 0.25, 0.65, 8);
      default:
        return new THREE.BoxGeometry(0.2, 0.4, 0.2);
    }
  }, [piece.type]);

  const material = useMemo(() => {
    const baseColor = piece.color === 'w' ? '#f0f0f0' : '#2d2d2d';
    const emissive = piece.color === 'w' ? '#ffffff' : '#000000';
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: isSelected ? '#4444ff' : emissive,
      emissiveIntensity: isSelected ? 0.2 : 0.05,
      metalness: 0.3,
      roughness: 0.7,
    });
  }, [piece.color, isSelected]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      castShadow
      receiveShadow
      scale={hovered ? 1.1 : 1}
    >
      {/* Add a crown-like top for the king */}
      {piece.type === 'k' && (
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 6]} />
          <meshStandardMaterial color={piece.color === 'w' ? '#ffd700' : '#b8860b'} />
        </mesh>
      )}
      
      {/* Add cross on top for the queen */}
      {piece.type === 'q' && (
        <group position={[0, 0.35, 0]}>
          <mesh>
            <sphereGeometry args={[0.05]} />
            <meshStandardMaterial color={piece.color === 'w' ? '#ffd700' : '#b8860b'} />
          </mesh>
        </group>
      )}
    </mesh>
  );
}

// Chess board square
function ChessSquare({ position, isLight, isSelected, isHighlighted, onClick }: {
  position: [number, number, number];
  isLight: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  
  const color = useMemo(() => {
    if (isSelected) return '#4CAF50';
    if (isHighlighted) return '#FFC107';
    if (hovered) return isLight ? '#e8e8e8' : '#666666';
    return isLight ? '#f0d9b5' : '#b58863';
  }, [isLight, isSelected, isHighlighted, hovered]);

  return (
    <mesh
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      receiveShadow
    >
      <boxGeometry args={[0.9, 0.1, 0.9]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// Coordinate labels
function CoordinateLabels({ boardOrientation }: { boardOrientation: 'white' | 'black' }) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  const orderedFiles = boardOrientation === 'white' ? files : [...files].reverse();
  const orderedRanks = boardOrientation === 'white' ? [...ranks].reverse() : ranks;

  return (
    <group>
      {/* File labels (a-h) */}
      {orderedFiles.map((file, index) => (
        <Text
          key={`file-${file}`}
          position={[index - 3.5, -0.5, -4.5]}
          fontSize={0.3}
          color="#666666"
          anchorX="center"
          anchorY="middle"
        >
          {file}
        </Text>
      ))}
      
      {/* Rank labels (1-8) */}
      {orderedRanks.map((rank, index) => (
        <Text
          key={`rank-${rank}`}
          position={[-4.5, -0.5, index - 3.5]}
          fontSize={0.3}
          color="#666666"
          anchorX="center"
          anchorY="middle"
        >
          {rank}
        </Text>
      ))}
    </group>
  );
}

// Main 3D Chess Scene
function Chess3DSceneContent({ fen, boardOrientation, onSquareClick, selectedSquare }: Chess3DProps) {
  const [pieces, setPieces] = useState<ChessPiece[]>([]);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

  // Parse FEN to get piece positions
  useEffect(() => {
    const chess = new Chess(fen);
    const board = chess.board();
    const newPieces: ChessPiece[] = [];

    board.forEach((row, rankIndex) => {
      row.forEach((square, fileIndex) => {
        if (square) {
          const actualRank = boardOrientation === 'white' ? 7 - rankIndex : rankIndex;
          const actualFile = boardOrientation === 'white' ? fileIndex : 7 - fileIndex;
          
          newPieces.push({
            type: square.type as PieceType,
            color: square.color as PieceColor,
            position: [actualFile, actualRank]
          });
        }
      });
    });

    setPieces(newPieces);

    // Get possible moves for selected square
    if (selectedSquare) {
      const moves = chess.moves({ square: selectedSquare, verbose: true });
      setPossibleMoves(moves.map(move => move.to));
    } else {
      setPossibleMoves([]);
    }
  }, [fen, selectedSquare, boardOrientation]);

  const handleSquareClick = (file: number, rank: number) => {
    if (!onSquareClick) return;
    
    // Convert board coordinates to chess notation
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
    
    const actualFile = boardOrientation === 'white' ? file : 7 - file;
    const actualRank = boardOrientation === 'white' ? 7 - rank : rank;
    
    const square = files[actualFile] + ranks[actualRank];
    onSquareClick(square);
  };

  return (
    <>
      {/* Board squares */}
      {Array.from({ length: 8 }, (_, rank) =>
        Array.from({ length: 8 }, (_, file) => {
          const isLight = (file + rank) % 2 === 0;
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
          
          const actualFile = boardOrientation === 'white' ? file : 7 - file;
          const actualRank = boardOrientation === 'white' ? 7 - rank : rank;
          const square = files[actualFile] + ranks[actualRank];
          
          const isSelected = selectedSquare === square;
          const isHighlighted = possibleMoves.includes(square);

          return (
            <ChessSquare
              key={`${file}-${rank}`}
              position={[file - 3.5, -0.05, rank - 3.5]}
              isLight={isLight}
              isSelected={isSelected}
              isHighlighted={isHighlighted}
              onClick={() => handleSquareClick(file, rank)}
            />
          );
        })
      )}

      {/* Chess pieces */}
      {pieces.map((piece, index) => {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
        const square = files[piece.position[0]] + ranks[piece.position[1]];
        const isSelected = selectedSquare === square;

        return (
          <ChessPieceModel
            key={`${piece.type}-${piece.color}-${index}`}
            piece={piece}
            position={[piece.position[0] - 3.5, 0.2, piece.position[1] - 3.5]}
            isSelected={isSelected}
            onClick={() => onSquareClick?.(square)}
          />
        );
      })}

      {/* Coordinate labels */}
      <CoordinateLabels boardOrientation={boardOrientation} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.3} />

      {/* Camera controls with upper view */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={15}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.2} // Limit rotation to keep upper view
        target={[0, 0, 0]}
      />
    </>
  );
}

// Main export with Canvas wrapper
export default function Chess3DScene(props: Chess3DProps) {
  return (
    <Canvas
      shadows
      camera={{
        position: [0, 8, 6],
        fov: 50,
      }}
      gl={{ antialias: true }}
    >
      <Chess3DSceneContent {...props} />
    </Canvas>
  );
}

