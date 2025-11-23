import React, { useEffect, useRef, useState } from 'react';
import { Player, Projectile, Target, Particle, MathProblem, PowerUp, PowerUpType } from '../types';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  selectedTable: number | 'all';
}

// --- Game Constants ---
const PLAYER_SPEED = 400; 
const PROJECTILE_SPEED = 800;
const FIRE_RATE_DEFAULT = 200; 
const FIRE_RATE_RAPID = 80;
// Faster spawn rate (1 second) to populate screen with more wrong answers
const TARGET_SPAWN_RATE = 1000; 
const POWERUP_SPAWN_RATE = 8000; // Spawn a powerup every 8 seconds roughly
// Faster falling speed for better pacing
const BASE_TARGET_SPEED = 80; 

const COLORS = [
  '#F472B6', // Pink
  '#A78BFA', // Purple
  '#34D399', // Green
  '#60A5FA', // Blue
  '#FBBF24', // Yellow
];

const GameCanvas: React.FC<GameCanvasProps> = ({ onGameOver, selectedTable }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // --- Audio Context Ref ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const current16thNoteRef = useRef<number>(0);
  const schedulerIntervalRef = useRef<number | null>(null);
  const isMusicPlayingRef = useRef<boolean>(false);

  // --- Game State Refs (Mutable for performance) ---
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const lastFireTimeRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);
  const lastPowerUpSpawnTimeRef = useRef<number>(0);
  
  const playerRef = useRef<Player>({ x: 0, y: 0, width: 40, height: 40, color: '#60A5FA', angle: -Math.PI / 2, speed: PLAYER_SPEED });
  const projectilesRef = useRef<Projectile[]>([]);
  const targetsRef = useRef<Target[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const problemRef = useRef<MathProblem>({ num1: 2, num2: 2, answer: 4 });
  
  // Active Effects (Timestamps when they expire)
  const activeEffectsRef = useRef({
    shield: 0,
    rapid: 0,
    score: 0
  });
  
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const isRunningRef = useRef(true);
  
  // Input State
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  // Enhanced Input State for Split Controls & Virtual Joystick
  const inputRef = useRef({
    // Virtual Joystick (Left Side)
    moveTouchId: null as number | null,
    moveOriginX: 0,
    moveOriginY: 0,
    moveX: 0, // Current finger position X
    moveY: 0, // Current finger position Y

    // Aiming (Right Side / Mouse)
    fireTouchId: null as number | null,
    aimOriginX: 0, // New: For relative aiming
    aimOriginY: 0, // New: For relative aiming
    aimX: 0,
    aimY: 0,
    
    isFiring: false,
    isUsingMouse: false, 
  });

  // --- React State for HUD ---
  const [hudScore, setHudScore] = useState(0);
  const [hudLives, setHudLives] = useState(3);
  const [currentProblem, setCurrentProblem] = useState("2 x 2 = ?");

  // --- Sound System ---
  const createNoiseBuffer = (ctx: AudioContext) => {
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  };

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
      noiseBufferRef.current = createNoiseBuffer(audioCtxRef.current);
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    
    // Start Music Loop if not playing
    if (!isMusicPlayingRef.current && isRunningRef.current) {
        startMusic();
    }
  };

  // --- Music Synthesis ---
  const playKick = (ctx: AudioContext, time: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    gain.gain.setValueAtTime(0.5, time); // Volume
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  };

  const playHiHat = (ctx: AudioContext, time: number) => {
    if (!noiseBufferRef.current) return;
    const source = ctx.createBufferSource();
    source.buffer = noiseBufferRef.current;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    const gain = ctx.createGain();
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    
    source.start(time);
    source.stop(time + 0.05);
  };

  const playBass = (ctx: AudioContext, time: number, freq: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, time);
    filter.frequency.linearRampToValueAtTime(600, time + 0.1);
    filter.frequency.linearRampToValueAtTime(200, time + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.15, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.1);
    gain.gain.linearRampToValueAtTime(0, time + 0.2);

    osc.start(time);
    osc.stop(time + 0.2);
  };

  const scheduleNote = (beatNumber: number, time: number) => {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;

      // Kick: Four on the floor (0, 4, 8, 12)
      if (beatNumber % 4 === 0) {
          playKick(ctx, time);
      }

      // HiHat: Off beats (2, 6, 10, 14)
      if (beatNumber % 4 === 2) {
           playHiHat(ctx, time);
      }

      // Bass: Driving 8th notes
      if (beatNumber % 2 === 0) {
          // Progression: E2 (steps 0-7), G2 (steps 8-11), A2 (steps 12-15)
          let freq = 82.41; // E2
          if (beatNumber >= 8 && beatNumber < 12) freq = 98.00; // G2
          if (beatNumber >= 12) freq = 110.00; // A2
          
          playBass(ctx, time, freq);
      }
  };

  const nextNote = () => {
      const secondsPerBeat = 60.0 / 130; // 130 BPM
      nextNoteTimeRef.current += 0.25 * secondsPerBeat; // Advance by 16th note
      current16thNoteRef.current++;
      if (current16thNoteRef.current === 16) {
          current16thNoteRef.current = 0;
      }
  };

  const scheduler = () => {
      if (!audioCtxRef.current) return;
      // Schedule notes ahead (lookahead 0.1s)
      while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
          scheduleNote(current16thNoteRef.current, nextNoteTimeRef.current);
          nextNote();
      }
  };

  const startMusic = () => {
      if (isMusicPlayingRef.current || !audioCtxRef.current) return;
      isMusicPlayingRef.current = true;
      nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.1;
      current16thNoteRef.current = 0;
      schedulerIntervalRef.current = window.setInterval(scheduler, 25);
  };

  const stopMusic = () => {
      if (schedulerIntervalRef.current) {
          clearInterval(schedulerIntervalRef.current);
          schedulerIntervalRef.current = null;
      }
      isMusicPlayingRef.current = false;
  };


  // --- Sound FX ---
  const playSound = (type: 'shoot' | 'correct' | 'wrong' | 'gameover' | 'powerup' | 'shield_hit') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'shoot') {
      // Pew pew - high to low frequency sweep
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'correct') {
      // Nice Ding
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'wrong') {
      // Buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'gameover') {
      // Sad slide
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(50, now + 1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 1);
      osc.start(now);
      osc.stop(now + 1);
    } else if (type === 'powerup') {
      // Rising magical sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'shield_hit') {
      // Deflect sound
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  };

  // --- Helpers ---
  const generateProblem = () => {
    let num1, num2;

    if (selectedTable === 'all') {
      num1 = Math.floor(Math.random() * 9) + 2; // 2 to 10
      num2 = Math.floor(Math.random() * 9) + 2;
    } else {
      num1 = selectedTable;
      // For specific tables, we can range 1-10
      num2 = Math.floor(Math.random() * 10) + 1; 
    }

    const answer = num1 * num2;
    problemRef.current = { num1, num2, answer };
    setCurrentProblem(`${num1} x ${num2} = ?`);
  };

  const spawnPowerUp = (canvasWidth: number) => {
    const types: PowerUpType[] = ['shield', 'rapid', 'score'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    powerUpsRef.current.push({
      id: Date.now() + Math.random(),
      x: Math.random() * (canvasWidth - 60) + 30,
      y: -50,
      radius: 20,
      type: type,
      speed: BASE_TARGET_SPEED * 1.5 // Fall slightly faster than targets
    });
  };

  const spawnTarget = (canvasWidth: number) => {
    const correctExists = targetsRef.current.some(t => t.isCorrect);
    // If no correct target exists, we might spawn one (40% chance).
    // If correct target exists, we ALWAYS spawn wrong answers.
    const shouldSpawnCorrect = !correctExists && Math.random() < 0.4;
    
    let value = 0;
    if (shouldSpawnCorrect) {
        value = problemRef.current.answer;
    } else {
        const offset = (Math.floor(Math.random() * 5) + 1) * (Math.random() > 0.5 ? 1 : -1); 
        if (Math.random() > 0.5) {
             const n1 = selectedTable === 'all' ? (Math.floor(Math.random() * 9) + 2) : selectedTable;
             const n2 = Math.floor(Math.random() * 10) + 1;
             value = n1 * n2;
        } else {
             value = problemRef.current.answer + offset;
        }
        if (value === problemRef.current.answer) value = value + 5;
        if (value <= 0) value = 1;
    }

    const target: Target = {
      id: Date.now() + Math.random(),
      x: Math.random() * (canvasWidth - 80) + 40, 
      y: -60,
      width: 70,
      height: 60,
      value: value,
      isCorrect: value === problemRef.current.answer,
      speed: BASE_TARGET_SPEED + (scoreRef.current * 0.01), 
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };
    
    targetsRef.current.push(target);
  };

  const createExplosion = (x: number, y: number, color: string) => {
    // 1. Paint Splatters
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * (100 + Math.random() * 100),
        vy: Math.sin(angle) * (100 + Math.random() * 100),
        life: 1.0,
        maxLife: 1.0,
        size: 4 + Math.random() * 4,
        color: color,
        type: 'splatter'
      });
    }

    // 2. Sparks (Bright, fast, short-lived)
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 250;
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.6,
        size: 2,
        color: '#FFFFE0', // Light yellow/white
        type: 'spark'
      });
    }

    // 3. Smoke (Slow, expanding, fading)
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 10 + Math.random() * 30;
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
        size: 10 + Math.random() * 10,
        color: '#FFFFFF', 
        type: 'smoke'
      });
    }
  };

  // --- Game Loop ---
  const update = (time: number, deltaTime: number) => {
    if (!isRunningRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;

    // 1. Movement Logic
    let dxMove = 0;
    let dyMove = 0;
    const keys = keysRef.current;

    // Check for keyboard input (WASD / Arrows)
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) dxMove -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dxMove += 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) dyMove -= 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) dyMove += 1;

    // Calculate movement from inputs
    if (dxMove !== 0 || dyMove !== 0) {
      // Keyboard Movement
      const length = Math.sqrt(dxMove * dxMove + dyMove * dyMove);
      dxMove /= length;
      dyMove /= length;
      playerRef.current.x += dxMove * playerRef.current.speed * deltaTime;
      playerRef.current.y += dyMove * playerRef.current.speed * deltaTime;
    } else if (inputRef.current.moveTouchId !== null) {
      // Virtual Joystick Movement (Left Side)
      const maxJoystickDist = 50;
      const stickDx = inputRef.current.moveX - inputRef.current.moveOriginX;
      const stickDy = inputRef.current.moveY - inputRef.current.moveOriginY;
      const dist = Math.sqrt(stickDx * stickDx + stickDy * stickDy);

      // Deadzone of 5 pixels
      if (dist > 5) {
        // Normalize speed based on distance pulled (0 to 1)
        const speedRatio = Math.min(dist / maxJoystickDist, 1.0);
        const dirX = stickDx / dist;
        const dirY = stickDy / dist;

        playerRef.current.x += dirX * playerRef.current.speed * speedRatio * deltaTime;
        playerRef.current.y += dirY * playerRef.current.speed * speedRatio * deltaTime;
      }
    }

    // Clamp player to screen bounds
    const pHalf = playerRef.current.width / 2;
    playerRef.current.x = Math.max(pHalf, Math.min(canvas.width - pHalf, playerRef.current.x));
    playerRef.current.y = Math.max(pHalf, Math.min(canvas.height - pHalf, playerRef.current.y));

    // 2. Rotation Logic
    let targetAngle = playerRef.current.angle;
    
    // Priority 1: Aiming with Right Touch (Relative Joystick)
    if (inputRef.current.isFiring && !inputRef.current.isUsingMouse) {
        const dx = inputRef.current.aimX - inputRef.current.aimOriginX;
        const dy = inputRef.current.aimY - inputRef.current.aimOriginY;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Only rotate if dragging significantly (aiming), otherwise keep current angle
        if (dist > 10) {
           targetAngle = Math.atan2(dy, dx);
        }
    } 
    // Priority 2: Aiming with Mouse (if last input was mouse)
    else if (inputRef.current.isUsingMouse) {
        const aimX = inputRef.current.aimX;
        const aimY = inputRef.current.aimY;
        const dx = aimX - playerRef.current.x;
        const dy = aimY - playerRef.current.y;
        targetAngle = Math.atan2(dy, dx);
    }
    // Priority 3: Moving with Virtual Joystick (Face movement direction)
    else if (inputRef.current.moveTouchId !== null) {
         const dx = inputRef.current.moveX - inputRef.current.moveOriginX;
         const dy = inputRef.current.moveY - inputRef.current.moveOriginY;
         // Only rotate if stick is pushed enough
         if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            targetAngle = Math.atan2(dy, dx);
         }
    }
    
    // Smooth rotation (optional, but instant is often better for shooters)
    playerRef.current.angle = targetAngle;

    // 3. Shooting
    const isRapidFire = Date.now() < activeEffectsRef.current.rapid;
    const currentFireRate = isRapidFire ? FIRE_RATE_RAPID : FIRE_RATE_DEFAULT;

    if (inputRef.current.isFiring && time - lastFireTimeRef.current > currentFireRate) {
      playSound('shoot');
      
      const angle = playerRef.current.angle;
      // Spawn bullet at the tip of the ship
      const noseDist = 20;
      const noseX = playerRef.current.x + Math.cos(angle) * noseDist;
      const noseY = playerRef.current.y + Math.sin(angle) * noseDist;
      
      projectilesRef.current.push({
        id: Date.now(),
        x: noseX,
        y: noseY,
        vx: Math.cos(angle) * PROJECTILE_SPEED,
        vy: Math.sin(angle) * PROJECTILE_SPEED,
        radius: 6,
        color: isRapidFire ? '#EF4444' : COLORS[Math.floor(Math.random() * COLORS.length)]
      });
      lastFireTimeRef.current = time;
    }

    // 4. Update Projectiles
    projectilesRef.current.forEach(p => {
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
    });
    projectilesRef.current = projectilesRef.current.filter(p => 
      p.x >= -50 && p.x <= canvas.width + 50 && p.y >= -50 && p.y <= canvas.height + 50
    );

    // 5. Spawn Targets & Powerups
    if (time - lastSpawnTimeRef.current > TARGET_SPAWN_RATE) {
      spawnTarget(canvas.width);
      lastSpawnTimeRef.current = time;
    }

    if (time - lastPowerUpSpawnTimeRef.current > POWERUP_SPAWN_RATE) {
        spawnPowerUp(canvas.width);
        lastPowerUpSpawnTimeRef.current = time;
    }

    // 6. Update Targets & Collisions
    targetsRef.current.forEach(t => {
      t.y += t.speed * deltaTime;
    });

    projectilesRef.current.forEach(p => {
      targetsRef.current.forEach(t => {
        if (
          p.x > t.x - t.width/2 &&
          p.x < t.x + t.width/2 &&
          p.y > t.y - t.height/2 &&
          p.y < t.y + t.height/2
        ) {
          createExplosion(t.x, t.y, p.color);
          
          if (t.value === problemRef.current.answer) {
            playSound('correct');
            const isScoreMultiplier = Date.now() < activeEffectsRef.current.score;
            scoreRef.current += 100 * (isScoreMultiplier ? 2 : 1);
            setHudScore(scoreRef.current);
            generateProblem();
            
            // Remove ONLY the hit target
            targetsRef.current = targetsRef.current.filter(target => target.id !== t.id);
            
            // Update remaining targets (distractors stay, but might become correct for new problem by chance)
            targetsRef.current.forEach(target => {
                target.isCorrect = target.value === problemRef.current.answer;
            });
          } else {
            // Wrong answer logic
            const isShielded = Date.now() < activeEffectsRef.current.shield;
            if (isShielded) {
                playSound('shield_hit');
                // Remove shield on hit? Or keep it for duration? Let's keep for duration to make it strong.
                // Just create visual feedback
                createExplosion(playerRef.current.x, playerRef.current.y, '#00FFFF');
            } else {
                playSound('wrong');
                livesRef.current -= 1;
                setHudLives(livesRef.current);
                if (livesRef.current <= 0) {
                  playSound('gameover');
                  isRunningRef.current = false;
                  stopMusic();
                  onGameOver(scoreRef.current);
                }
            }
             targetsRef.current = targetsRef.current.filter(target => target.id !== t.id);
          }
          p.x = -1000; 
        }
      });
    });

    targetsRef.current = targetsRef.current.filter(t => {
      return t.y <= canvas.height + 100;
    });

    // 7. PowerUp Logic (Movement & Collection)
    powerUpsRef.current.forEach(pu => {
        pu.y += pu.speed * deltaTime;
        
        // Check collision with player ship
        const distSq = (pu.x - playerRef.current.x) ** 2 + (pu.y - playerRef.current.y) ** 2;
        const combinedRadius = pu.radius + playerRef.current.width/2;
        
        if (distSq < combinedRadius ** 2) {
            // Collect PowerUp
            playSound('powerup');
            const duration = 10000; // 10 seconds duration
            
            if (pu.type === 'shield') activeEffectsRef.current.shield = Date.now() + duration;
            if (pu.type === 'rapid') activeEffectsRef.current.rapid = Date.now() + duration;
            if (pu.type === 'score') activeEffectsRef.current.score = Date.now() + duration;

            pu.y = canvas.height + 200; // Remove from screen
        }
    });
    powerUpsRef.current = powerUpsRef.current.filter(pu => pu.y <= canvas.height + 100);
    
    // 8. Update Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      
      // Type specific update logic
      if (p.type === 'smoke') {
        p.vx *= 0.95; // Slow down
        p.vy *= 0.95;
        p.size += 20 * deltaTime; // Expand
        p.life -= deltaTime * 0.8;
      } else if (p.type === 'spark') {
        p.vx *= 0.9; // Decelerate fast
        p.vy *= 0.9; 
        p.life -= deltaTime * 1.5;
      } else {
        // Splatter default
        p.life -= deltaTime * 1.5;
      }
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(76, 29, 149, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 50) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += 50) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // --- Draw Virtual Joystick (Left) ---
    if (inputRef.current.moveTouchId !== null) {
        // Base
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(inputRef.current.moveOriginX, inputRef.current.moveOriginY, 40, 0, Math.PI * 2);
        ctx.stroke();

        // Stick
        ctx.fillStyle = 'rgba(96, 165, 250, 0.5)'; // Blue tint
        ctx.beginPath();
        
        // Calculate stick clamp position for visual
        const dx = inputRef.current.moveX - inputRef.current.moveOriginX;
        const dy = inputRef.current.moveY - inputRef.current.moveOriginY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const maxDist = 40;
        
        let stickX = inputRef.current.moveX;
        let stickY = inputRef.current.moveY;
        
        if (dist > maxDist) {
            stickX = inputRef.current.moveOriginX + (dx/dist) * maxDist;
            stickY = inputRef.current.moveOriginY + (dy/dist) * maxDist;
        }

        ctx.arc(stickX, stickY, 20, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Draw Virtual Joystick (Right - Aim) ---
    if (inputRef.current.fireTouchId !== null) {
        // Base
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.2)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(inputRef.current.aimOriginX, inputRef.current.aimOriginY, 40, 0, Math.PI * 2);
        ctx.stroke();

        // Stick
        ctx.fillStyle = 'rgba(250, 96, 96, 0.5)'; // Red tint
        ctx.beginPath();
        
        // Calculate stick clamp position for visual
        const dx = inputRef.current.aimX - inputRef.current.aimOriginX;
        const dy = inputRef.current.aimY - inputRef.current.aimOriginY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const maxDist = 40;
        
        let stickX = inputRef.current.aimX;
        let stickY = inputRef.current.aimY;
        
        if (dist > maxDist) {
            stickX = inputRef.current.aimOriginX + (dx/dist) * maxDist;
            stickY = inputRef.current.aimOriginY + (dy/dist) * maxDist;
        }

        ctx.arc(stickX, stickY, 20, 0, Math.PI * 2);
        ctx.fill();
    }

    // Power Ups (On Screen)
    powerUpsRef.current.forEach(pu => {
        ctx.save();
        ctx.shadowBlur = 10;
        
        if (pu.type === 'shield') {
            ctx.fillStyle = '#22d3ee'; // Cyan
            ctx.shadowColor = '#22d3ee';
        } else if (pu.type === 'rapid') {
            ctx.fillStyle = '#f87171'; // Red
            ctx.shadowColor = '#f87171';
        } else {
            ctx.fillStyle = '#facc15'; // Gold
            ctx.shadowColor = '#facc15';
        }
        
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2);
        ctx.fill();

        // Icon inside
        ctx.fillStyle = 'black';
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = pu.type === 'shield' ? 'S' : pu.type === 'rapid' ? 'R' : 'x2';
        ctx.fillText(label, pu.x, pu.y);

        ctx.restore();
    });

    // Particles
    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      
      if (p.type === 'smoke') {
        // Draw Smoke
        ctx.fillStyle = `rgba(200, 200, 200, ${p.life * 0.4})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        // Draw Spark (Line/Streak)
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); // Trail behind velocity
        ctx.stroke();
      } else {
        // Draw Splatter
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Player
    ctx.save();
    ctx.translate(playerRef.current.x, playerRef.current.y);
    
    // --- Active Effects Visuals on Player ---
    const now = Date.now();
    
    // Shield Visual
    if (now < activeEffectsRef.current.shield) {
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.5 + Math.sin(now / 100) * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Rapid Fire Visual (Engine Glow)
    if (now < activeEffectsRef.current.rapid) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ef4444';
    } else {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#60A5FA';
    }

    // Rotate to face aim. 
    ctx.rotate(playerRef.current.angle + Math.PI/2); 
    
    ctx.fillStyle = '#3B82F6';
    
    ctx.beginPath();
    ctx.moveTo(0, -20); // Nose
    ctx.lineTo(-15, 15); // Left Wing
    ctx.lineTo(0, 10); // Engine
    ctx.lineTo(15, 15); // Right Wing
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = '#93C5FD';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Flame
    if (Math.random() > 0.3) {
      ctx.fillStyle = now < activeEffectsRef.current.rapid ? '#ef4444' : '#F59E0B'; 
      ctx.shadowColor = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 25 + Math.random() * 10);
      ctx.lineTo(4, 12);
      ctx.lineTo(-4, 12);
      ctx.fill();
    }
    ctx.restore();

    // Name Label (Keeps upright)
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'black';
    // Add Score Multiplier indicator near name
    if (now < activeEffectsRef.current.score) {
        ctx.fillStyle = '#facc15';
        ctx.fillText('x2 SCORE', playerRef.current.x, playerRef.current.y - 40);
        ctx.fillStyle = 'white';
    }
    ctx.fillText('CAESAR', playerRef.current.x, playerRef.current.y + 45);
    ctx.shadowBlur = 0;

    // Targets
    targetsRef.current.forEach(t => {
      ctx.shadowBlur = 10;
      ctx.shadowColor = t.color;
      ctx.fillStyle = 'rgba(20, 20, 30, 0.9)';
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 3;
      const x = t.x - t.width / 2;
      const y = t.y - t.height / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, t.width, t.height, 8);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px Orbitron';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText(t.value.toString(), t.x, t.y);
    });

    // Projectiles
    projectilesRef.current.forEach(p => {
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };

  const loop = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (time - previousTimeRef.current) / 1000;
      update(time, deltaTime);
      draw();
    }
    previousTimeRef.current = time;
    if (isRunningRef.current) {
      requestRef.current = requestAnimationFrame(loop);
    }
  };

  // --- Event Listeners ---
  useEffect(() => {
    // Try to start audio immediately when game loads
    initAudio();

    const handleKeyDown = (e: KeyboardEvent) => { 
        keysRef.current[e.key] = true; 
        initAudio(); // Ensure audio starts on first key interaction if autoplay failed
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    
    // Mouse aim
    const handleMouseMove = (e: MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        inputRef.current.aimX = e.clientX - rect.left;
        inputRef.current.aimY = e.clientY - rect.top;
        inputRef.current.isUsingMouse = true;
    };
    const handleMouseDown = () => { 
        initAudio();
        inputRef.current.isFiring = true; 
    };
    const handleMouseUp = () => { inputRef.current.isFiring = false; };
    
    // Touch Events
    const handleTouchStart = (e: TouchEvent) => {
       e.preventDefault();
       initAudio();
       
       if (!canvasRef.current) return;
       const rect = canvasRef.current.getBoundingClientRect();
       const halfWidth = rect.width / 2;

       for (let i = 0; i < e.changedTouches.length; i++) {
         const t = e.changedTouches[i];
         const tx = t.clientX - rect.left;
         const ty = t.clientY - rect.top;

         // Logic: Left half starts virtual joystick. Right half starts aiming/firing.
         if (tx < halfWidth) {
            // Left: Movement Joystick Start
            inputRef.current.moveTouchId = t.identifier;
            inputRef.current.moveOriginX = tx;
            inputRef.current.moveOriginY = ty;
            inputRef.current.moveX = tx;
            inputRef.current.moveY = ty;
         } else {
            // Right: Aim & Fire Joystick Start (Relative)
            inputRef.current.fireTouchId = t.identifier;
            inputRef.current.aimOriginX = tx; // Store origin for relative calc
            inputRef.current.aimOriginY = ty;
            inputRef.current.aimX = tx;
            inputRef.current.aimY = ty;
            inputRef.current.isFiring = true;
            inputRef.current.isUsingMouse = false; // Touch priority
         }
       }
    };

    const handleTouchMove = (e: TouchEvent) => {
       e.preventDefault();
       if (!canvasRef.current) return;
       const rect = canvasRef.current.getBoundingClientRect();
       
       for (let i = 0; i < e.changedTouches.length; i++) {
         const t = e.changedTouches[i];
         
         if (t.identifier === inputRef.current.moveTouchId) {
            inputRef.current.moveX = t.clientX - rect.left;
            inputRef.current.moveY = t.clientY - rect.top;
         }
         if (t.identifier === inputRef.current.fireTouchId) {
            inputRef.current.aimX = t.clientX - rect.left;
            inputRef.current.aimY = t.clientY - rect.top;
         }
       }
    };

    const handleTouchEnd = (e: TouchEvent) => {
       e.preventDefault();
       for (let i = 0; i < e.changedTouches.length; i++) {
         const t = e.changedTouches[i];
         if (t.identifier === inputRef.current.moveTouchId) {
            inputRef.current.moveTouchId = null;
         }
         if (t.identifier === inputRef.current.fireTouchId) {
            inputRef.current.fireTouchId = null;
            inputRef.current.isFiring = false;
         }
       }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    const cvs = canvasRef.current;
    if(cvs) {
        cvs.addEventListener('touchstart', handleTouchStart, {passive: false});
        cvs.addEventListener('touchend', handleTouchEnd, {passive: false});
        cvs.addEventListener('touchmove', handleTouchMove, {passive: false});
    }

    requestRef.current = requestAnimationFrame(loop);
    generateProblem();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
       if(cvs) {
        cvs.removeEventListener('touchstart', handleTouchStart);
        cvs.removeEventListener('touchend', handleTouchEnd);
        cvs.removeEventListener('touchmove', handleTouchMove);
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      stopMusic();
      if (audioCtxRef.current) {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable]); 

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        playerRef.current.x = Math.min(playerRef.current.x, window.innerWidth - 40);
        playerRef.current.y = Math.min(playerRef.current.y, window.innerHeight - 40);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    
    // Initialize center
    if (canvasRef.current) {
        playerRef.current.x = canvasRef.current.width / 2;
        playerRef.current.y = canvasRef.current.height - 100;
    }
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full cursor-crosshair">
      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none select-none">
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div 
                key={i} 
                className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center transition-all ${i < hudLives ? 'bg-red-500 scale-100' : 'bg-transparent scale-75 opacity-30'}`}
            >
                ❤️
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center">
            <div className="bg-black/70 border-2 border-purple-500 px-8 py-4 rounded-xl backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                <span className="text-4xl font-[Orbitron] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 font-bold tracking-widest">
                    {currentProblem}
                </span>
            </div>
            <p className="text-blue-300 mt-2 text-sm font-bold tracking-wider animate-pulse">SHOOT THE ANSWER!</p>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-400 font-[Orbitron]">SCORE</p>
          <p className="text-3xl text-yellow-400 font-[Black_Ops_One] drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
            {hudScore.toLocaleString()}
          </p>
        </div>
      </div>
      
      <div className="absolute bottom-4 w-full flex justify-between px-8 pointer-events-none opacity-30 text-white font-[Orbitron] text-xs">
        <div className="border border-white/30 rounded-full px-4 py-2">JOYSTICK (LEFT) TO MOVE</div>
        <div className="border border-white/30 rounded-full px-4 py-2">TAP (RIGHT) TO SHOOT / DRAG TO AIM</div>
      </div>

      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

export default GameCanvas;