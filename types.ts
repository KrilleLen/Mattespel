export interface Point {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  angle: number;
  speed: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export interface Target {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  isCorrect: boolean;
  speed: number;
  color: string;
}

export type PowerUpType = 'shield' | 'rapid' | 'score';

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: PowerUpType;
  speed: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'splatter' | 'spark' | 'smoke';
}

export interface MathProblem {
  num1: number;
  num2: number;
  answer: number;
}