/** Hiệu ứng âm thanh tổng hợp bằng WebAudio — không cần tệp âm thanh. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let lastPlay = new Map<string, number>();

try {
  muted = localStorage.getItem('suongdo.mute') === '1';
} catch {
  /* bỏ qua */
}

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.5, slide = 0, delay = 0): void {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.4, filter = 1200): void {
  const c = ac();
  if (!c || !master) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filter;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export function sfx(name: string): void {
  if (muted) return;
  const now = performance.now();
  if (now - (lastPlay.get(name) ?? 0) < 60) return;
  lastPlay.set(name, now);
  switch (name) {
    case 'chop':
      noise(0.08, 0.35, 900);
      tone(140, 0.08, 'square', 0.12, -40);
      break;
    case 'hit':
      noise(0.06, 0.3, 2000);
      break;
    case 'hurt':
      tone(220, 0.15, 'sawtooth', 0.25, -120);
      break;
    case 'pickup':
      tone(660, 0.06, 'square', 0.12);
      tone(990, 0.08, 'square', 0.1, 0, 0.05);
      break;
    case 'level':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.12, 0, i * 0.08));
      break;
    case 'bow':
      tone(500, 0.1, 'triangle', 0.2, -300);
      break;
    case 'gun':
      noise(0.2, 0.6, 3000);
      break;
    case 'boom':
      noise(0.5, 0.7, 500);
      tone(80, 0.4, 'sine', 0.4, -40);
      break;
    case 'break':
      noise(0.25, 0.5, 700);
      break;
    case 'drink':
    case 'splash':
      noise(0.15, 0.2, 600);
      tone(300, 0.1, 'sine', 0.1, 200);
      break;
    case 'click':
      tone(880, 0.03, 'square', 0.08);
      break;
    case 'coin':
      tone(1200, 0.05, 'square', 0.1);
      tone(1600, 0.08, 'square', 0.1, 0, 0.05);
      break;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('suongdo.mute', m ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
}
