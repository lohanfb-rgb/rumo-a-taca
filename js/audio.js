// =============================================================
//  SONS — tudo gerado pelo navegador (sem arquivos de áudio).
//  Depois vocês podem trocar por gravações de verdade!
// =============================================================

let ctx = null;
let mestre = null;        // volume geral (mudo = 0)
let mudo = false;
let torcidaFontes = [];
let ganhoMurmurio = null;
let ganhoBatucada = null;
let timerBatucada = null;
let fracaoBR = 0.5;
let empolgacao = 0;       // aumenta a batucada depois de gol do Brasil
let proximaBatida = 0;
let passo = 0;
let ruidoCache = null;

function iniciar() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  mestre = ctx.createGain();
  mestre.gain.value = mudo ? 0 : 1;
  mestre.connect(ctx.destination);
  return ctx;
}

// Precisa ser chamado depois de um toque/clique (regra dos navegadores)
export function destravarAudio() {
  const c = iniciar();
  if (c && c.state === 'suspended') c.resume();
}

export function alternarMudo() {
  mudo = !mudo;
  if (mestre) mestre.gain.value = mudo ? 0 : 1;
  if (mudo && window.speechSynthesis) window.speechSynthesis.cancel();
  return mudo;
}

export function estaMudo() { return mudo; }

function ruido() {
  if (ruidoCache) return ruidoCache;
  const seg = 4;
  const buf = ctx.createBuffer(1, ctx.sampleRate * seg, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // ruído "rosa" (mais grave, parece multidão)
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + w * 0.029591;
    b1 = 0.985 * b1 + w * 0.032534;
    b2 = 0.95 * b2 + w * 0.048056;
    d[i] = (b0 + b1 + b2 + w * 0.05) * 1.8;
  }
  ruidoCache = buf;
  return buf;
}

function fonteRuido(loop = false) {
  const s = ctx.createBufferSource();
  s.buffer = ruido();
  s.loop = loop;
  if (!loop) s.loopStart = 0;
  return s;
}

export function apito(longo = false) {
  if (!iniciar()) return;
  const t = ctx.currentTime;
  const vezes = longo ? 3 : 1;
  for (let i = 0; i < vezes; i++) {
    const ini = t + i * 0.45;
    const dur = longo && i === 2 ? 0.9 : 0.32;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 2900;
    lfo.frequency.value = 38;
    lfoG.gain.value = 180;
    lfo.connect(lfoG).connect(osc.frequency);
    g.gain.setValueAtTime(0, ini);
    g.gain.linearRampToValueAtTime(0.06, ini + 0.02);
    g.gain.setValueAtTime(0.06, ini + dur - 0.05);
    g.gain.linearRampToValueAtTime(0, ini + dur);
    osc.connect(g).connect(mestre);
    osc.start(ini); lfo.start(ini);
    osc.stop(ini + dur); lfo.stop(ini + dur);
  }
}

export function chute(forca = 0.5) {
  if (!iniciar()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
  g.gain.setValueAtTime(0.25 + forca * 0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(g).connect(mestre);
  osc.start(t); osc.stop(t + 0.16);
}

// ------------------------------------------------------------ torcida
// fracao: quanto da torcida é do Brasil (mando de campo)
export function iniciarTorcida(fracao = 0.5) {
  if (!iniciar()) return;
  pararTorcida();
  fracaoBR = fracao;
  empolgacao = 0;
  // murmúrio da multidão: duas camadas de ruído
  ganhoMurmurio = ctx.createGain();
  ganhoMurmurio.gain.value = 0.16;
  ganhoMurmurio.connect(mestre);
  const camadas = [[500, 0.7, 1], [1400, 1.2, 0.35]];
  for (const [freq, q, vol] of camadas) {
    const s = fonteRuido(true);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(ganhoMurmurio);
    s.start(0, Math.random() * 3);
    torcidaFontes.push(s);
  }
  // batucada (mais forte quanto mais brasileiros no estádio)
  ganhoBatucada = ctx.createGain();
  ganhoBatucada.gain.value = 0.1 + 0.35 * fracaoBR;
  ganhoBatucada.connect(mestre);
  proximaBatida = ctx.currentTime + 0.1;
  passo = 0;
  timerBatucada = setInterval(agendarBatucada, 60);
}

function surdo(t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g).connect(ganhoBatucada);
  o.start(t); o.stop(t + 0.36);
}

function tamborim(t, vol) {
  const s = fonteRuido();
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 3000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  s.connect(f).connect(g).connect(ganhoBatucada);
  s.start(t, Math.random() * 3, 0.08);
}

function agendarBatucada() {
  if (!ctx || !ganhoBatucada) return;
  const semicolcheia = 60 / 104 / 4; // ritmo de samba
  const intens = 0.6 + empolgacao * 0.6;
  empolgacao = Math.max(0, empolgacao - 0.004);
  while (proximaBatida < ctx.currentTime + 0.2) {
    const p = passo % 16;
    if (p === 0 || p === 8) surdo(proximaBatida, 0.5 * intens);
    if (p === 6 || p === 14) surdo(proximaBatida, 0.3 * intens);
    if ([0, 3, 6, 8, 10, 12, 14].includes(p)) tamborim(proximaBatida, 0.12 * intens);
    proximaBatida += semicolcheia;
    passo++;
  }
}

export function pararTorcida() {
  for (const s of torcidaFontes) { try { s.stop(); } catch (e) { /* ok */ } }
  torcidaFontes = [];
  clearInterval(timerBatucada);
  timerBatucada = null;
  if (ganhoMurmurio) { ganhoMurmurio.disconnect(); ganhoMurmurio = null; }
  if (ganhoBatucada) { ganhoBatucada.disconnect(); ganhoBatucada = null; }
}

// A torcida fica mais barulhenta por um tempo
export function vibrarTorcida(intensidade = 1, duracao = 3) {
  if (!ctx || !ganhoMurmurio) return;
  const t = ctx.currentTime;
  const g = ganhoMurmurio.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0.16 + 0.35 * intensidade, t + 0.3);
  g.linearRampToValueAtTime(0.16, t + duracao);
}

function grito(t, { freqIni, freqFim, vol, dur, q = 0.8, ataque = 0.15 }) {
  const s = fonteRuido();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(freqIni, t);
  f.frequency.linearRampToValueAtTime(freqFim, t + dur * 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + ataque);
  g.gain.setValueAtTime(vol, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(mestre);
  s.loop = true;
  s.start(t);
  s.stop(t + dur + 0.1);
}

// Gol! fracaoQueComemora = quanto do estádio torce para quem fez o gol
export function golTorcida(fracaoQueComemora) {
  if (!iniciar() || !ganhoMurmurio) return;
  const t = ctx.currentTime;
  const festa = fracaoQueComemora;
  const tristes = 1 - fracaoQueComemora;
  // explosão de alegria
  grito(t, { freqIni: 700, freqFim: 1300, vol: 0.15 + 0.75 * festa, dur: 5, q: 0.6, ataque: 0.2 });
  grito(t + 0.1, { freqIni: 2200, freqFim: 2600, vol: 0.05 + 0.25 * festa, dur: 4, q: 1.5 });
  // lamento de quem sofreu o gol
  if (tristes > 0.3) grito(t, { freqIni: 450, freqFim: 220, vol: 0.35 * tristes, dur: 1.8, q: 1.2, ataque: 0.1 });
  // o resto do estádio fica em silêncio por um tempo se a maioria sofreu o gol
  const g = ganhoMurmurio.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0.16 * (0.3 + festa), t + 0.5);
  g.linearRampToValueAtTime(0.16, t + 8);
  if (ganhoBatucada) {
    const gb = ganhoBatucada.gain;
    const base = 0.1 + 0.35 * fracaoBR;
    gb.cancelScheduledValues(t);
    gb.setValueAtTime(gb.value, t);
    // gol do time da casa: batucada explode; gol do visitante: batucada para um pouco
    gb.linearRampToValueAtTime(festa > 0.5 ? base * 1.6 : base * 0.2, t + 0.6);
    gb.linearRampToValueAtTime(base, t + 10);
  }
}

// Avisa a batucada que o Brasil fez gol (toca mais animada)
export function animarBatucada() { empolgacao = 1; }

// "Uhhhh!" — chance perigosa
export function uhhTorcida() {
  if (!iniciar() || !ganhoMurmurio) return;
  const t = ctx.currentTime;
  grito(t, { freqIni: 320, freqFim: 750, vol: 0.4, dur: 1.4, q: 1.4, ataque: 0.25 });
}

export function rede() {
  if (!iniciar()) return;
  const t = ctx.currentTime;
  const s = fonteRuido();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 1200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  s.connect(f).connect(g).connect(mestre);
  s.start(t, 0, 0.4);
}

// Narração com a voz do navegador (em português, se existir)
export function narrar(texto) {
  if (mudo || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    u.rate = 1.1;
    u.pitch = 1.1;
    const voz = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('pt'));
    if (voz) u.voice = voz;
    window.speechSynthesis.speak(u);
  } catch (e) { /* sem narração, tudo bem */ }
}

// Fogos de artifício: "pá!" e um chiadinho depois
export function fogo() {
  if (!iniciar()) return;
  const t = ctx.currentTime + Math.random() * 0.1;
  const s = fonteRuido();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  s.connect(f).connect(g).connect(mestre);
  s.start(t, Math.random() * 3, 0.55);
  const s2 = fonteRuido();
  const f2 = ctx.createBiquadFilter();
  f2.type = 'highpass'; f2.frequency.value = 4000;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.0001, t + 0.15);
  g2.gain.linearRampToValueAtTime(0.06, t + 0.25);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  s2.connect(f2).connect(g2).connect(mestre);
  s2.start(t + 0.15, Math.random() * 3, 1.1);
}