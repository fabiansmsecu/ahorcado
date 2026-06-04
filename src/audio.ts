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

export const playSound = {
  correct: () => {
    try {
      playTone(523.25, 'sine', 0.1); // C5
      setTimeout(() => playTone(659.25, 'sine', 0.15), 100); // E5
    } catch(e) {}
  },
  wrong: () => {
    try {
      playTone(300, 'sawtooth', 0.15, 0.15);
      setTimeout(() => playTone(250, 'sawtooth', 0.2, 0.15), 150);
    } catch(e) {}
  },
  win: () => {
    try {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'square', 0.15, 0.1), i * 150);
      });
    } catch(e) {}
  },
  lose: () => {
    try {
      [400, 350, 300, 250].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'sawtooth', 0.3, 0.15), i * 200);
      });
    } catch(e) {}
  }
};
