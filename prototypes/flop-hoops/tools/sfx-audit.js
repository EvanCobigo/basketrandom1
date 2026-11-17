// PROTOTYPE - NOT FOR PRODUCTION
// Sound audit (iteration 47): every sound effect rendered through the game's own audio engine into an OfflineAudioContext
// (injected as window.GAME_AUDIO, which startAudio() accepts), measured, and written out as WAV; and a stretch of real
// CPU-vs-CPU gameplay recorded the same way, with the offline context's clock following the game clock, plus a log of
// every sound and voice it started.
// Usage: node tools/sfx-audit.js <game dir> <out dir> [--match-secs 40] [--seed 7] [--levels 5,5]
// Per sound (each intensity it takes): peak dBFS, loudness (max momentary, K-weighted, approx. LUFS), spectral centroid Hz,
// share of energy above 4 kHz, attack ms (to the envelope peak), decay ms (peak to -40 dB), and how different 8 repeats are.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = process.argv[2], out = process.argv[3];
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SR = 44100;
// the intensities each sound is called with in play (sounds not listed are called with no argument)
const ARGS = {
  floor: [2, 6, 12], bop: [1, 5, 10], board: [2, 6, 12], rim: [2, 6, 12], bounce: [0.1, 0.5, 1], shoot: [0.3, 0.7, 1],
  jump: [0, 1], cheer: [0.6, 1], dribble: [0, 1], pass: [0.4, 0.9], catch: [0, 1], dunk: ['tomahawk', 'hammer'],
  sizzle: [0.6, 1], land: [6, 10, 16], steal: [], intercept: [], fakebit: [], takeoff: [], heat: [0.5, 1], blast: [], back: [], focus: [],
};

function wav(file, L, R) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
  fs.writeFileSync(file, b);
}

// ---- measurements (on the mono mix) ----
function biquad(x, b0, b1, b2, a1, a2) { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
function kweight(x) {   // ITU-R BS.1770 pre-filter (shelf) and RLB high-pass, at 44.1 kHz
  const s = biquad(x, 1.53084123, -2.65097990, 1.16916684, -1.66375011, 0.71265753);
  return biquad(s, 1.0, -2.0, 1.0, -1.98916967, 0.98919181);
}
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, vi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; } } }
function measure(L, R) {
  const n = L.length, m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = (L[i] + R[i]) / 2;
  let peak = 0, pi = 0; for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) { peak = a; pi = i; } }
  const k = kweight(m), w = Math.round(0.4 * SR), hop = Math.round(0.05 * SR); let lufs = -99;
  for (let s = 0; s + w <= n || s === 0; s += hop) { let e = 0; const end = Math.min(n, s + w); for (let i = s; i < end; i++) e += k[i] * k[i]; const ms = e / w; if (ms > 0) lufs = Math.max(lufs, -0.691 + 10 * Math.log10(ms * 2)); if (end === n) break; }
  // spectrum: energy-weighted average over 2048-sample frames
  const N = 2048; let num = 0, den = 0, hi = 0;
  for (let s = 0; s + N <= n; s += N / 2) { const re = new Float64Array(N), im = new Float64Array(N); let fe = 0; for (let i = 0; i < N; i++) { const hw = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); re[i] = m[s + i] * hw; fe += re[i] * re[i]; } if (fe < 1e-9) continue; fft(re, im);
    for (let b = 1; b < N / 2; b++) { const p = re[b] * re[b] + im[b] * im[b], f = b * SR / N; num += f * p; den += p; if (f > 4000) hi += p; } }
  // envelope (5 ms RMS) for the attack and decay
  const ew = Math.round(0.005 * SR), env = []; for (let s = 0; s < n; s += ew) { let e = 0; for (let i = s; i < Math.min(n, s + ew); i++) e += m[i] * m[i]; env.push(Math.sqrt(e / ew)); }
  let ep = 0, ei = 0; env.forEach((v, i) => { if (v > ep) { ep = v; ei = i; } });
  let di = ei; while (di < env.length && env[di] > ep * 0.01) di++;
  let first = 0; while (first < env.length && env[first] < ep * 0.05) first++;
  return { peakDb: +(20 * Math.log10(peak || 1e-9)).toFixed(1), lufs: +lufs.toFixed(1), centroid: den ? Math.round(num / den) : 0, hiPct: den ? +(100 * hi / den).toFixed(1) : 0,
    attackMs: (ei - first) * 5, decayMs: (di - ei) * 5 };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.resolve(dir) + '/index.html?manual=1');
  await pg.evaluate(() => { toMenu(); game.step(2, false); muted = false; });
  // one render: a fresh offline context, the engine started on it, the call made, rendered
  const render = (name, a, secs) => pg.evaluate(async ([name, a, secs, SR]) => {
    for (const k in lastSound) delete lastSound[k];
    audio = null; window.GAME_AUDIO = new OfflineAudioContext(2, Math.round(SR * secs), SR); startAudio();
    if (a === null) sfx[name](); else sfx[name](a);
    const buf = await window.GAME_AUDIO.startRendering();
    return [Array.from(buf.getChannelData(0)), Array.from(buf.getChannelData(1))];
  }, [name, a, secs, SR]);
  const names = await pg.evaluate(() => Object.keys(sfx));
  const rows = [];
  for (const name of names) {
    const args = ARGS[name] && ARGS[name].length ? ARGS[name] : [null];
    for (const a of args) {
      const secs = /cheer|win|sparks|perfect|swish|dunk|blast/.test(name) ? 3 : 1.6;
      const [L, R] = await render(name, a, secs);
      const r = measure(L, R);
      // how different repeats are: the loudness and centroid spread of 8 calls in a row
      const reps = [];
      for (let k = 0; k < 8; k++) { const [l2, r2] = await render(name, a, secs); const mm = measure(l2, r2); reps.push(mm); }
      const spread = k => +(Math.max(...reps.map(x => x[k])) - Math.min(...reps.map(x => x[k]))).toFixed(1);
      const label = name + (a === null ? '' : '(' + a + ')');
      rows.push({ sound: label, ...r, repLufs: spread('lufs'), repCentroid: spread('centroid') });
      wav(path.join(out, label.replace(/[()]/g, '_') + '.wav'), L, R);
    }
  }
  const cols = ['sound', 'peakDb', 'lufs', 'centroid', 'hiPct', 'attackMs', 'decayMs', 'repLufs', 'repCentroid'];
  const tsv = [cols.join('\t'), ...rows.map(r => cols.map(c => r[c]).join('\t'))].join('\n');
  fs.writeFileSync(path.join(out, 'sounds.tsv'), tsv + '\n');
  console.log(tsv);

  // ---- gameplay: a CPU-vs-CPU match, the offline clock following the game clock ----
  const secs = Number(arg('match-secs', 40)), seed = Number(arg('seed', 7)), lv = arg('levels', '5,5').split(',').map(Number);
  const g = await pg.evaluate(async ([secs, seed, lv, SR]) => {
    for (const k in lastSound) delete lastSound[k];
    CONFIG.win_score.value = 99; CONFIG.seed = seed; toMenu(); game.step(2, false); newMatch('sim', lv);
    window.__simT = 0;
    const off = new OfflineAudioContext(2, Math.round(SR * (secs + 3)), SR);
    window.GAME_AUDIO = new Proxy(off, { get: (t, k) => k === 'currentTime' ? window.__simT : (typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
    audio = null; startAudio(); muted = false;
    // log every sound and every voice (tone / noise) started
    const log = [], voices = [];
    for (const k of Object.keys(sfx)) { const f = sfx[k]; sfx[k] = function (...a) { log.push([k, +window.__simT.toFixed(3), a[0] === undefined ? '' : String(a[0])]); return f.apply(this, a); }; }
    const T0 = tone, N0 = noise;
    tone = function (freq, dur, type, vol, delay = 0) { voices.push([window.__simT + delay, window.__simT + delay + dur]); return T0.apply(this, arguments); };
    noise = function (dur, vol, freq, delay = 0) { voices.push([window.__simT + delay, window.__simT + delay + dur]); return N0.apply(this, arguments); };
    const steps = Math.round(secs * 60);
    for (let i = 0; i < steps; i++) { game.step(1, false); window.__simT += 1 / 60; }
    tone = T0; noise = N0;
    const buf = await off.startRendering();
    // the most voices sounding at once, and sounds landing within 30 ms of another sound
    let peakV = 0; for (let t = 0; t < secs; t += 0.01) { const n = voices.filter(v => v[0] <= t && v[1] > t).length; if (n > peakV) peakV = n; }
    const close = {}; for (let i = 1; i < log.length; i++) for (let j = i - 1; j >= 0 && log[i][1] - log[j][1] < 0.03; j--) { const k = [log[j][0], log[i][0]].sort().join('+'); close[k] = (close[k] || 0) + 1; }
    const counts = {}; for (const [k] of log) counts[k] = (counts[k] || 0) + 1;
    return { L: Array.from(buf.getChannelData(0)), R: Array.from(buf.getChannelData(1)), counts, perSec: +(log.length / secs).toFixed(2), voicesPerSec: +(voices.length / secs).toFixed(1), peakVoices: peakV, close, score: game.state.score };
  }, [secs, seed, lv, SR]);
  wav(path.join(out, 'match.wav'), g.L, g.R);
  const gm = measure(g.L, g.R);
  const summary = { match: { secs, seed, levels: lv, score: g.score, peakDb: gm.peakDb, lufs: gm.lufs, centroid: gm.centroid, hiPct: gm.hiPct, soundsPerSec: g.perSec, voicesPerSec: g.voicesPerSec, peakVoices: g.peakVoices, counts: g.counts, within30ms: g.close }, errs };
  fs.writeFileSync(path.join(out, 'match.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary));
  await b.close();
})();
