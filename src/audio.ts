let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
  
  gainNode.gain.setValueAtTime(vol, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

function playSweepingTone(startFreq: number, endFreq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
  
  gainNode.gain.setValueAtTime(vol, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

export const playSound = {
  correct: () => {
    try {
      // Happy bloop!
      playSweepingTone(400, 800, 'sine', 0.15, 0.1);
      setTimeout(() => playSweepingTone(800, 1200, 'sine', 0.2, 0.1), 100);
    } catch(e) {}
  },
  wrong: () => {
    try {
      // Funny bonk / squish down, LOUD and goofy
      playSweepingTone(400, 100, 'square', 0.25, 0.3);
      setTimeout(() => playSweepingTone(150, 40, 'sawtooth', 0.2, 0.4), 100);
    } catch(e) {}
  },
  win: () => {
    try {
      // Triumphant bouncy fanfare!
      playSweepingTone(400, 600, 'triangle', 0.15, 0.2);
      setTimeout(() => playSweepingTone(500, 800, 'triangle', 0.15, 0.2), 150);
      setTimeout(() => playSweepingTone(600, 1000, 'triangle', 0.15, 0.2), 300);
      setTimeout(() => playSweepingTone(1000, 1200, 'square', 0.4, 0.2), 450);
    } catch(e) {}
  },
  lose: () => {
    try {
      // Womp womp womp wamp... (EXTREMELY LOUD sad trombone / squeaky fart sound for the class to hear)
      playSweepingTone(300, 270, 'sawtooth', 0.4, 0.5);
      setTimeout(() => playSweepingTone(270, 240, 'sawtooth', 0.4, 0.6), 400);
      setTimeout(() => playSweepingTone(240, 210, 'sawtooth', 0.4, 0.7), 800);
      setTimeout(() => playSweepingTone(210, 30, 'sawtooth', 1.5, 0.9), 1200);
    } catch(e) {}
  }
};
