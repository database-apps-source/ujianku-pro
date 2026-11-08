/* core.js — util, ikon, penyimpanan, API (fetch+retry+idempotensi), data layer SWR, UI primitif, router.
   Prinsip GAS Instant UX PRO: render sinkron dari cache → revalidasi di latar belakang → tanpa layar kosong. */
'use strict';
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const hashStr = s => { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; };
const fmtN = (n, d = 2) => (n == null || n === '' || isNaN(n)) ? '–' : Number(n).toFixed(d).replace('.', ',');
const pad2 = n => (n < 10 ? '0' : '') + n;
const hms = sec => { sec = Math.max(0, Math.floor(sec)); return pad2(Math.floor(sec / 3600)) + ':' + pad2(Math.floor(sec % 3600 / 60)) + ':' + pad2(sec % 60); };
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const tglIndo = (s, hari) => { if (!s) return '–'; const d = new Date(String(s).length <= 10 ? s + 'T00:00:00+07:00' : s); if (isNaN(d)) return s; const w = new Date(d.getTime() + 7 * 3600000); return (hari ? HARI[w.getUTCDay()] + ', ' : '') + w.getUTCDate() + ' ' + BLN[w.getUTCMonth()] + ' ' + w.getUTCFullYear(); };
const jamWib = s => { if (!s) return '–'; const d = new Date(s); if (isNaN(d)) return s; const w = new Date(d.getTime() + 7 * 3600000); return pad2(w.getUTCHours()) + ':' + pad2(w.getUTCMinutes()) + ':' + pad2(w.getUTCSeconds()); };
const tglJam = s => { if (!s) return '–'; return tglIndo(s) + ' ' + jamWib(s).slice(0, 5); };
const singkatSubtes = n => ({ 'Pancasila dan UUD 1945': 'Pancasila', 'Pemerintahan Umum dan Pemerintahan Daerah': 'Pemda', 'Pemerintahan Desa': 'Pemdes', 'Peraturan Perundang-undangan': 'Peraturan UU', 'Administrasi Pemerintahan Desa': 'Adm. Desa', 'Keuangan dan Pembangunan Desa': 'Keuangan Desa', 'Pengetahuan Umum': 'Peng. Umum', 'Teknologi Informasi dan Komputer': 'TIK', 'Kemampuan Numerik dan Logika': 'Logika', 'Kepemimpinan dan Pelayanan Publik': 'Pelayanan' }[n] || n);
const unduhBlob = (blob, nama) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); };
const b64Blob = (b64, mime) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); };
const csvUnduh = (nama, header, rows) => { const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; const s = '﻿' + [header].concat(rows).map(r => r.map(q).join(';')).join('\r\n'); unduhBlob(new Blob([s], { type: 'text/csv;charset=utf-8' }), nama); };
const muatSkrip = (() => { const c = {}; return src => c[src] || (c[src] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Gagal memuat pustaka: ' + src)); document.head.appendChild(s); })); })();
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

/* ---------- Ikon (subset SVG, tanpa library) ---------- */
const IC = {
  landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  grid: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  play: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  checkc: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  terminal: '<path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  print: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
  edit: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  left: '<path d="m12 19-7-7 7-7M19 12H5"/>', right: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
  idcard: '<path d="M16 10h2M16 14h2M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  settings: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  clip: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  door: '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  mega: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  wifioff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  headset: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
  stop: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>'
};
const ic = (n, c) => `<svg class="ic ${c || ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ---------- Penyimpanan aman (try/catch; tetap jalan tanpa localStorage) ---------- */
const Store = (() => {
  const mem = {}; const NS = 'ujk1:';
  const ok = (() => { try { localStorage.setItem(NS + 't', '1'); localStorage.removeItem(NS + 't'); return true; } catch (e) { return false; } })();
  return {
    get(k, d) { try { if (k in mem) return mem[k]; if (ok) { const v = localStorage.getItem(NS + k); if (v != null) return (mem[k] = JSON.parse(v)); } } catch (e) { } return d === undefined ? null : d; },
    set(k, v) { mem[k] = v; try { if (ok) localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { delete mem[k]; try { if (ok) localStorage.removeItem(NS + k); } catch (e) { } },
    sess: { get(k) { try { const v = sessionStorage.getItem(NS + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { } }, del(k) { try { sessionStorage.removeItem(NS + k); } catch (e) { } } },
    clearUser(uid) { try { Object.keys(localStorage).filter(k => k.startsWith(NS + 'u:' + uid + ':')).forEach(k => localStorage.removeItem(k)); } catch (e) { } Object.keys(mem).filter(k => k.startsWith('u:' + uid + ':')).forEach(k => delete mem[k]); }
  };
})();

/* ---------- Jam server (timer ujian tidak bisa dimanipulasi jam perangkat) ---------- */
const Clock = { off: 0, sync(serverMs, t0, t1) { if (serverMs) this.off = serverMs - (t0 + t1) / 2; }, now() { return Date.now() + this.off; } };

/* ---------- Telemetri kinerja ---------- */
const Perf = { log: [], add(a, total, server) { this.log.push({ a, total, server, net: total - (server || 0), t: Date.now() }); if (this.log.length > 100) this.log.shift(); if (total > 3000) console.warn('[perf] lambat', a, total + 'ms (server ' + server + 'ms)'); } };
window.UJK_PERF = Perf;

/* ---------- Session ---------- */
const Session = {
  cur: null,
  load() { this.cur = Store.sess.get('sess') || Store.get('sess'); return this.cur; },
  set(s) { this.cur = s; if (s.user.kind === 'p') { Store.sess.set('sess', s); Store.del('sess'); } else { Store.set('sess', s); Store.sess.del('sess'); } },
  clear() { this.cur = null; Store.del('sess'); Store.sess.del('sess'); },
  get token() { return this.cur && this.cur.token; }, get user() { return this.cur && this.cur.user; }
};

/* ---------- API ---------- */
const Api = {
  url() { const u = Store.get('gas_url') || (window.UJK_CONFIG || {}).GAS_URL; return u && /^https:\/\/script\.google(usercontent)?\.com\//.test(u) ? u : ''; },
  net: { online: navigator.onLine },
  async call(action, data, o) {
    o = o || {};
    const url = o.url || this.url();
    if (!url) throw Object.assign(new Error('URL backend belum diisi.'), { code: 'SETUP' });
    const tulis = !!o.write;
    const reqId = tulis ? (o.reqId || uuid()) : undefined;
    const body = JSON.stringify({ action, data: data || {}, token: o.noAuth ? undefined : Session.token, reqId });
    const maxTry = o.retries != null ? o.retries : (tulis ? 2 : 3), timeout = o.timeout || (tulis ? 90000 : 25000);
    let lastErr;
    for (let i = 0; i <= maxTry; i++) {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
      const t0 = Date.now();
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow', signal: ctl.signal });
        clearTimeout(tm);
        if (!res.ok && res.status >= 500) throw Object.assign(new Error('Server ' + res.status), { retry: true });
        const j = await res.json(); const t1 = Date.now();
        Clock.sync(j.now, t0, t1); Perf.add(action, t1 - t0, j.ms); this.setOnline(true);
        if (!j.success) {
          const e = Object.assign(new Error(j.message || 'Gagal'), { code: j.code, server: true });
          if (e.code === 'AUTH' || e.code === 'SESI_DIGANTI') window.dispatchEvent(new CustomEvent('ujk:auth', { detail: e }));
          if (j.code === 'SERVER' && i < maxTry && !tulis) { lastErr = e; await sleep(500 * (i + 1)); continue; }
          throw e;
        }
        return j.data;
      } catch (e) {
        clearTimeout(tm);
        if (e.server) throw e;
        lastErr = e.name === 'AbortError' ? Object.assign(new Error('Koneksi lambat (waktu habis).'), { code: 'TIMEOUT' }) : Object.assign(new Error(navigator.onLine ? 'Tidak dapat menjangkau server.' : 'Anda sedang offline.'), { code: 'NET' });
        this.setOnline(false);
        if (i < maxTry) await sleep(Math.min(4000, 700 * Math.pow(2, i)) + Math.random() * 300);
      }
    }
    throw lastErr;
  },
  setOnline(v) { if (this.net.online !== v) { this.net.online = v; window.dispatchEvent(new CustomEvent('ujk:net', { detail: v })); } }
};
window.addEventListener('online', () => Api.setOnline(true)); window.addEventListener('offline', () => Api.setOnline(false));

/* ---------- Data layer: SWR + cache lokal + patch optimistis ---------- */
const D = {
  mem: {}, inflight: {}, ns() { return 'u:' + ((Session.user && Session.user.id) || 'anon') + ':'; },
  peek(key) { const m = this.mem[key]; if (m) return m.v; const s = Store.get(this.ns() + key); if (s) { this.mem[key] = { v: s.v, t: 0, h: hashStr(JSON.stringify(s.v)) }; return s.v; } return null; },
  put(key, v, persist) { const h = hashStr(JSON.stringify(v)); const old = this.mem[key]; this.mem[key] = { v, t: Date.now(), h }; if (persist !== false) { try { const j = JSON.stringify(v); if (j.length < 400000) Store.set(this.ns() + key, { v }); } catch (e) { } } return !old || old.h !== h; },
  /** Kembalikan cache seketika; revalidasi di latar belakang jika basi. Render ulang halaman hanya bila data berubah. */
  use(key, action, data, o) {
    o = o || {}; const ttl = (o.ttl != null ? o.ttl : 45) * 1000;
    const m = this.mem[key]; const cur = this.peek(key);
    const basi = !this.mem[key] || Date.now() - this.mem[key].t > ttl;
    if (basi && !this.inflight[key]) this.refresh(key, action, data, o);
    return cur;
  },
  async refresh(key, action, data, o) {
    if (this.inflight[key]) return this.inflight[key];
    const p = (async () => {
      try { const r = await Api.call(action, data, { retries: 2 }); const berubah = this.put(key, r, !(o && o.noPersist)); if (berubah && !(o && o.silent)) Router.refresh(key); return r; }
      catch (e) { if (e.code === 'FORBIDDEN' || e.code === 'VALIDASI') console.warn(key, e.message); return null; }
      finally { delete this.inflight[key]; }
    })();
    this.inflight[key] = p; return p;
  },
  patch(key, fn) { const cur = this.peek(key); if (cur == null) return; const v = JSON.parse(JSON.stringify(cur)); fn(v); this.put(key, v); Router.refresh(key); },
  invalidate(prefix) { Object.keys(this.mem).forEach(k => { if (k.startsWith(prefix)) this.mem[k].t = 0; }); },
  reset() { this.mem = {}; this.inflight = {}; }
};

/* ---------- UI primitif ---------- */
const Toast = {
  show(msg, tipe, ms) { let c = $('.toasts'); if (!c) { c = document.createElement('div'); c.className = 'toasts'; document.body.appendChild(c); } const t = document.createElement('div'); t.className = 'toast ' + (tipe || ''); t.setAttribute('role', 'status'); t.innerHTML = ic(tipe === 'ok' ? 'checkc' : tipe === 'err' ? 'alert' : 'info') + '<div>' + esc(msg) + '</div>'; c.appendChild(t); setTimeout(() => t.remove(), ms || 4200); },
  ok(m) { this.show(m, 'ok'); }, err(m) { this.show(m, 'err', 6000); }, warn(m) { this.show(m, 'warn', 6000); }
};
const Progress = { n: 0, start() { this.n++; const b = $('#topprogress'); if (b) { b.style.opacity = 1; b.style.width = '60%'; } }, done() { this.n = Math.max(0, this.n - 1); if (this.n) return; const b = $('#topprogress'); if (b) { b.style.width = '100%'; setTimeout(() => { b.style.opacity = 0; b.style.width = '0'; }, 220); } } };
const Modal = {
  stack: [],
  open(o) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal ${o.size || ''}" role="dialog" aria-modal="true"><div class="modal-h"><h3>${esc(o.title || '')}</h3><button class="btn icon ghost" data-act="modalClose" aria-label="Tutup">${ic('x')}</button></div><div class="modal-b">${o.body || ''}</div>${o.footer ? `<div class="modal-f">${o.footer}</div>` : ''}</div>`;
    ov.addEventListener('mousedown', e => { if (e.target === ov && !o.persist) Modal.close(ov); });
    document.body.appendChild(ov); this.stack.push(ov); const f = $('input,select,textarea', ov); if (f && !o.noFocus) setTimeout(() => f.focus(), 30);
    if (o.onMount) o.onMount(ov); return ov;
  },
  close(ov) { ov = ov || this.stack[this.stack.length - 1]; if (!ov) return; ov.remove(); this.stack = this.stack.filter(x => x !== ov); },
  closeAll() { this.stack.forEach(o => o.remove()); this.stack = []; },
  top() { return this.stack[this.stack.length - 1]; },
  confirm(o) {
    return new Promise(res => {
      const reason = o.reason ? `<div class="field mt"><label class="lbl">${esc(o.reasonLabel || 'Alasan')} <span class="req">*</span></label><textarea class="inp" id="cf-reason" placeholder="${esc(o.reasonPh || 'Tulis alasan…')}"></textarea></div>` : '';
      const ov = this.open({ title: o.title || 'Konfirmasi', persist: true, body: `<p>${o.msg || ''}</p>${o.extra || ''}${reason}<div class="errtxt hidden" id="cf-err"></div>`, footer: `<button class="btn ghost" id="cf-no">${esc(o.noText || 'Batal')}</button><button class="btn ${o.danger ? 'danger' : 'pri'}" id="cf-ok">${esc(o.okText || 'Ya, lanjutkan')}</button>` });
      $('#cf-no', ov).onclick = () => { this.close(ov); res({ ok: false }); };
      $('#cf-ok', ov).onclick = () => { const r = o.reason ? $('#cf-reason', ov).value.trim() : ''; if (o.reason && r.length < (o.minReason || 5)) { const e = $('#cf-err', ov); e.textContent = 'Alasan wajib diisi (min. ' + (o.minReason || 5) + ' karakter).'; e.classList.remove('hidden'); return; } this.close(ov); res({ ok: true, reason: r, ov }); };
    });
  }
};

const badge = (txt, tipe, extra) => `<span class="badge ${tipe || ''} ${extra || ''}">${esc(txt)}</span>`;
const STATUS_TIPE = { 'Lulus': 'ok', 'Terpilih': 'ok', 'Cadangan': 'info', 'Tidak Terpilih': '', 'Tidak Memenuhi Syarat': 'err', 'Tidak Lengkap': 'warn', 'Final': 'ok', 'Draf': 'warn', 'Sementara': 'warn', 'Belum': '', 'Hadir': 'ok', 'Tidak Hadir': 'err', 'Belum Hadir': '', 'Berjalan': 'info', 'Selesai': 'ok', 'Dihentikan': 'err', 'Dikunci': 'err', 'Aktif': 'ok', 'Terpakai': 'info', 'TERBIT': 'ok', 'DITARIK': 'err', 'Terjadwal': '', 'Terverifikasi': 'ok', 'Mudah': 'ok', 'Sedang': 'info', 'Sulit': 'warn', 'Arsip': '' };
const sBadge = s => badge(s, STATUS_TIPE[s] || '');

/* Form builder */
const Form = {
  fields(defs, v) {
    v = v || {};
    return defs.map(f => {
      if (f.type === 'html') return f.html;
      const id = 'f-' + f.name, val = v[f.name] == null ? (f.def == null ? '' : f.def) : v[f.name];
      let inp;
      if (f.type === 'select') inp = `<select class="inp" id="${id}" name="${f.name}" ${f.dis ? 'disabled' : ''}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${(f.options || []).map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
      else if (f.type === 'textarea') inp = `<textarea class="inp" id="${id}" name="${f.name}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}" ${f.maxlength ? `maxlength="${f.maxlength}"` : ''}>${esc(val)}</textarea>`;
      else if (f.type === 'checkbox') return `<label class="chk field"><input type="checkbox" name="${f.name}" ${val === true || val === 'true' ? 'checked' : ''}><span>${f.label}</span></label>`;
      else inp = `<input class="inp" id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.dis ? 'disabled' : ''} ${f.type === 'password' ? 'autocomplete="new-password"' : ''}>`;
      return `<div class="field" ${f.half ? '' : ''}><label class="lbl" for="${id}">${esc(f.label)}${f.req ? ' <span class="req">*</span>' : ''}</label>${inp}${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
    }).join('');
  },
  read(root) { const o = {}; $$('[name]', root).forEach(el => { if (el.disabled) return; o[el.name] = el.type === 'checkbox' ? el.checked : el.value; }); return o; }
};

/* Tabel dengan pencarian & paginasi lokal (tanpa panggilan jaringan) */
const TS = {};
const Table = {
  html(id, def) {
    const st = TS[id] || (TS[id] = { q: '', page: 1 }); st.def = def;
    return `<div id="tw-${id}">${this.inner(id)}</div>`;
  },
  inner(id) {
    const st = TS[id], d = st.def, size = d.pageSize || 25;
    let rows = d.rows || [];
    if (d.filters) rows = d.filters(rows, st);
    const q = (st.q || '').toLowerCase();
    if (q) rows = rows.filter(r => (d.searchKeys || d.cols.map(c => c.k)).some(k => String(r[k] == null ? '' : r[k]).toLowerCase().includes(q)));
    const total = rows.length, pages = Math.max(1, Math.ceil(total / size)); if (st.page > pages) st.page = pages;
    const view = rows.slice((st.page - 1) * size, st.page * size);
    const head = d.cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('') + (d.actions ? '<th></th>' : '');
    const body = view.map((r, i) => `<tr data-rid="${esc(r.id || i)}">${d.cols.map(c => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.fmt ? c.fmt(r[c.k], r) : esc(r[c.k] == null ? '' : r[c.k])}</td>`).join('')}${d.actions ? `<td class="right"><div class="row gap-s" style="justify-content:flex-end">${d.actions(r)}</div></td>` : ''}</tr>`).join('');
    return `${d.search === false ? '' : `<div class="row wrap mb">${d.toolbarPre || ''}<div class="searchbox grow" style="min-width:200px">${ic('search')}<input class="inp" data-tq="${id}" id="tq-${id}" placeholder="${esc(d.searchPh || 'Cari…')}" value="${esc(st.q)}" aria-label="Cari"></div>${d.toolbar || ''}</div>`}
      <div class="tbl-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${d.cols.length + (d.actions ? 1 : 0)}"><div class="empty">${ic('inbox')}<div>${esc(d.empty || 'Belum ada data.')}</div></div></td></tr>`}</tbody></table></div>
      ${total > size ? `<div class="pager"><span>${(st.page - 1) * size + 1}–${Math.min(total, st.page * size)} dari ${total}</span><div class="row gap-s"><button class="btn sm ghost" data-tpage="${id}" data-d="-1" ${st.page <= 1 ? 'disabled' : ''}>${ic('left', 'sm')}</button><span>${st.page}/${pages}</span><button class="btn sm ghost" data-tpage="${id}" data-d="1" ${st.page >= pages ? 'disabled' : ''}>${ic('right', 'sm')}</button></div></div>` : `<div class="pager"><span>${total} data</span></div>`}`;
  },
  update(id) { const w = $('#tw-' + id); if (!w) return; const a = document.activeElement, was = a && a.id === 'tq-' + id, pos = was ? a.selectionStart : 0; w.innerHTML = this.inner(id); if (was) { const n = $('#tq-' + id); n.focus(); n.setSelectionRange(pos, pos); } }
};
document.addEventListener('input', e => { const id = e.target.dataset && e.target.dataset.tq; if (id) { TS[id].q = e.target.value; TS[id].page = 1; clearTimeout(TS[id].t); TS[id].t = setTimeout(() => Table.update(id), 160); } });
document.addEventListener('click', e => { const b = e.target.closest('[data-tpage]'); if (b) { const id = b.dataset.tpage; TS[id].page += Number(b.dataset.d); Table.update(id); } });

/* Grafik SVG ringan */
const Chart = {
  bars(vals, labels, o) {
    o = o || {}; const W = 560, H = o.h || 220, pl = 28, pb = 34, pt = 18, n = vals.length, max = o.max || 100, bw = (W - pl) / n;
    const y = v => pt + (H - pt - pb) * (1 - v / max);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Grafik batang')}">`;
    [0, 20, 40, 60, 80, 100].filter(t => t <= max).forEach(t => { s += `<line x1="${pl}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="#e6e8eb"/><text x="${pl - 4}" y="${y(t) + 3}" text-anchor="end">${t}</text>`; });
    vals.forEach((v, i) => { const x = pl + i * bw + bw * .15, w = bw * .7, yy = y(v || 0); const col = o.colors ? o.colors[i] : (v >= (o.ambang || 0) ? '#1d4ed7' : '#c0392b'); s += `<rect x="${x}" y="${yy}" width="${w}" height="${Math.max(0, H - pb - yy)}" rx="3" fill="${col}"/><text x="${x + w / 2}" y="${yy - 4}" text-anchor="middle" style="fill:#00236f;font-weight:600">${o.dec ? fmtN(v, 0) : v}</text><text x="${x + w / 2}" y="${H - pb + 13}" text-anchor="middle" style="font-size:9px">${esc(labels[i] || '')}</text>`; });
    if (o.ambang) s += `<line x1="${pl}" x2="${W}" y1="${y(o.ambang)}" y2="${y(o.ambang)}" stroke="#ba1a1a" stroke-dasharray="4 3"/><text x="${W - 2}" y="${y(o.ambang) - 4}" text-anchor="end" style="fill:#ba1a1a">batas ${o.ambang}</text>`;
    return s + '</svg>';
  }
};

/* ---------- Router hash (instan: render sinkron dari cache) ---------- */
const Router = {
  routes: {}, cur: { name: '', args: [] }, guard: null,
  parse() { const h = (location.hash || '').replace(/^#\/?/, ''); const p = h.split('/').filter(Boolean).map(decodeURIComponent); return { name: p[0] || '', args: p.slice(1) }; },
  go(path) { if (('#/' + path) === location.hash) this.render(); else location.hash = '#/' + path; },
  render() {
    Progress.done(); const r = this.parse(); this.cur = r;
    if (this.guard) { const g = this.guard(r); if (g) { if (g !== r.name) { location.replace('#/' + g); } return; } }
    const el = $('#view'); if (!el) return;
    const v = this.routes[r.name];
    if (!v) { el.innerHTML = `<div class="empty">${ic('alert')}<div>Halaman tidak ditemukan.</div></div>`; return; }
    if (v.cleanup && this._last && this._last !== v) { try { this._last.cleanup && this._last.cleanup(); } catch (e) { } }
    if (this._last && this._last !== v && this._last.cleanup) { try { this._last.cleanup(); } catch (e) { } }
    this._last = v; this.ctx = { args: r.args, name: r.name };
    el.innerHTML = v.render(this.ctx);
    if (v.mount) v.mount(el, this.ctx);
    document.title = (v.title || 'UjianKu Pro') + ' • UjianKu Pro';
    window.dispatchEvent(new CustomEvent('ujk:route', { detail: r }));
  },
  /** Render ulang halaman aktif sambil mempertahankan fokus & scroll (dipanggil saat data cache berubah). */
  refresh(key) {
    const v = this._last; if (!v || !$('#view') || v.noRefresh) return;
    if (v.keys && key && !v.keys.some(k => key.startsWith(k))) return;
    const a = document.activeElement; const info = a && a.id && $('#view').contains(a) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
    if (a && $('#view').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.dataset.tq === undefined && !v.refreshWhileTyping) return;
    const y = window.scrollY; $('#view').innerHTML = v.render(this.ctx); if (v.mount) v.mount($('#view'), this.ctx);
    if (info) { const n = $('#' + info.id); if (n) { n.focus(); try { n.setSelectionRange(info.s, info.e); } catch (e) { } } } window.scrollTo(0, y);
  }
};
window.addEventListener('hashchange', () => Router.render());

/* ---------- Aksi (delegasi klik) ---------- */
const Actions = {
  modalClose() { Modal.close(); }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = Actions[el.dataset.act]; if (fn) { e.preventDefault(); Promise.resolve(fn(el, e)).catch(err => { console.error(err); Toast.err(err.message || 'Terjadi kesalahan'); }); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && Modal.top() && !Modal.top().querySelector('[data-persist]')) { const m = Modal.top(); if (!m.dataset.persist) Modal.close(); } });

/* Panggil API tulis dengan indikator + penanganan galat seragam */
async function aksi(action, data, o) {
  o = o || {}; Progress.start();
  try { const r = await Api.call(action, data, { write: true, reqId: o.reqId }); if (o.ok) Toast.ok(o.ok); return r; }
  catch (e) { if (!o.silent) Toast.err(e.message); throw e; }
  finally { Progress.done(); }
}
