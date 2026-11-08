/* app.js — boot, shell (sidebar/topbar), menu per peran, guard rute, sesi */
'use strict';
const PUBLIK = ['login', 'staf', 'setup', 'verifikasi'];
const POLOS = ['login', 'staf', 'setup', 'verifikasi', 'ganti', 'ujian'];
const SA = 'Super Admin', KT = 'Ketua Panitia', TS_ = 'Tim Soal', PW = 'Pengawas', PG = 'Penguji', PM = 'Pimpinan', PS = 'Peserta';
const SEMUA_STAF = [SA, KT, TS_, PW, PG, PM];
/* Menu per peran — mengikuti PRD §10.2 */
const MENU = [
  { r: 'dashboard', t: 'Dasbor', i: 'grid', p: [...SEMUA_STAF, PS], g: 'UTAMA' },
  { r: 'jadwal', t: 'Jadwal & Ujian', i: 'calendar', p: [PS], g: 'UTAMA' },
  { r: 'hasil', t: 'Hasil Saya', i: 'chart', p: [PS], g: 'UTAMA', peserta: true },
  { r: 'profil', t: 'Profil', i: 'user', p: [PS], g: 'UTAMA' },
  { r: 'kegiatan', t: 'Kegiatan & Formasi', i: 'layers', p: [SA, KT], g: 'PERSIAPAN' },
  { r: 'peserta', t: 'Data Peserta', i: 'users', p: [SA, KT, PM], g: 'PERSIAPAN' },
  { r: 'ruang', t: 'Ruang & Sesi', i: 'door', p: [SA, KT], g: 'PERSIAPAN' },
  { r: 'soal', t: 'Bank & Paket Soal', i: 'book', p: [SA, TS_], g: 'PERSIAPAN' },
  { r: 'monitoring', t: 'Monitoring Ruang', i: 'laptop', p: [SA, KT, PW], g: 'PELAKSANAAN' },
  { r: 'penilaian', t: 'Penilaian', i: 'edit', p: [PG, SA, KT], g: 'PELAKSANAAN' },
  { r: 'rekap', t: 'Hasil & Finalisasi', i: 'chart', p: [SA, KT, PM], g: 'HASIL' },
  { r: 'dokumen', t: 'Cetak Dokumen', i: 'print', p: [SA, KT, PW, PM], g: 'HASIL' },
  { r: 'template', t: 'Template Dokumen', i: 'file', p: [SA, KT], g: 'PENGATURAN' },
  { r: 'pengguna', t: 'Pengguna', i: 'shield', p: [SA], g: 'PENGATURAN' },
  { r: 'pengaturan', t: 'Pengaturan', i: 'settings', p: [SA, KT], g: 'PENGATURAN' }
];
const RUTE_EKSTRA = { penilaian_form: [PG, SA, KT], ujian: [PS], selesai: [PS], mulai: [PS] };
const menuUntuk = peran => MENU.filter(m => m.p.indexOf(peran) >= 0);
const bolehRute = (nama, peran) => { const m = MENU.find(x => x.r === nama); if (m) return m.p.indexOf(peran) >= 0; if (RUTE_EKSTRA[nama]) return RUTE_EKSTRA[nama].indexOf(peran) >= 0; return false; };

const App = {
  mode: '', user: null,
  async boot() {
    Session.load();
    this.layout('polos');
    $('#app').insertAdjacentHTML('afterbegin', '');
    Router.guard = r => this.guard(r);
    window.addEventListener('ujk:auth', e => this.sesiHabis(e.detail));
    window.addEventListener('ujk:net', e => this.netbar(e.detail));
    window.addEventListener('ujk:route', () => this.tandaiMenu());
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Session.user && Session.user.kind === 's' && App.autoRefresh) App.autoRefresh(); });
    if (!Api.url() && !PUBLIK.includes(Router.parse().name)) { location.hash = '#/setup'; }
    else if (!location.hash || location.hash === '#') { location.hash = Session.cur ? '#/dashboard' : '#/login'; }
    Router.render();
    if (Session.cur) this.pulihkan();
    if ('serviceWorker' in navigator && location.protocol === 'https:') { /* PWA opsional: tidak diaktifkan agar pembaruan versi selalu segar */ }
  },
  /** Setelah reload: tampilkan dari cache lalu revalidasi bootstrap di latar belakang */
  pulihkan() {
    const u = Session.user; if (!u) return;
    if (u.kind === 'p') D.refresh('boot', 'pesertaBootstrap', {}, { silent: false });
    else D.refresh('boot', 'adminBootstrap', {});
    Api.call('info', {}, { noAuth: true, retries: 1 }).then(i => D.put('info', i)).catch(() => { });
  },
  async masuk(d, tujuan) {
    Session.set({ token: d.token, user: d.user }); D.reset();
    if (d.bootstrap) D.put('boot', d.bootstrap);
    else if (d.user.kind === 's' && !d.user.wajibGanti) await D.refresh('boot', 'adminBootstrap', {}, { silent: true });
    if (d.bootstrap && d.bootstrap.serverNow) Clock.off = d.bootstrap.serverNow - Date.now();
    this.mode = ''; Router.go(tujuan || 'dashboard');
  },
  async keluar(pesan) {
    const u = Session.user; Session.clear(); D.reset(); if (u) Store.clearUser(u.id);
    if (typeof Exam !== "undefined" && Exam.bersih) Exam.bersih();
    this.mode = ''; Modal.closeAll();
    if (pesan) Toast.warn(pesan);
    location.hash = u && u.kind === 's' ? '#/staf' : '#/login'; Router.render();
  },
  sesiHabis(err) {
    if (!Session.cur) return;
    const diganti = err && err.code === 'SESI_DIGANTI';
    if (Router.cur.name === 'ujian' && typeof Exam !== "undefined" && Exam.simpanLokal) Exam.simpanLokal();
    this.keluar(diganti ? 'Akun Anda dipakai masuk di perangkat lain. Sesi ini dihentikan.' : 'Sesi berakhir. Silakan masuk kembali.');
  },
  guard(r) {
    const u = Session.user, n = r.name;
    if (!n) return u ? 'dashboard' : 'login';
    if (!u) { if (PUBLIK.includes(n)) { this.layout('polos'); return ''; } return 'login'; }
    if (typeof Exam !== "undefined" && Exam.aktif && n !== 'ujian' && n !== 'selesai') return 'ujian';
    if (u.kind === 's' && u.wajibGanti && n !== 'ganti') return 'ganti';
    if (n === 'ganti') { this.layout('polos'); return u.kind === 's' ? '' : 'dashboard'; }
    if (n === 'verifikasi') { this.layout('polos'); return ''; }
    if (PUBLIK.includes(n)) return 'dashboard';
    if (!bolehRute(n, u.peran)) return 'dashboard';
    this.layout(POLOS.includes(n) ? 'polos' : 'shell');
    return '';
  },
  layout(mode) {
    if (this.mode === mode && $('#view')) { if (mode === 'shell') this.perbaruiUser(); return; }
    this.mode = mode; const app = $('#app');
    if (mode === 'polos') { app.innerHTML = '<main id="view" tabindex="-1"></main>'; return; }
    const u = Session.user, dark = u.kind === 's';
    const grup = {}; menuUntuk(u.peran).forEach(m => (grup[m.g] = grup[m.g] || []).push(m));
    const nav = Object.keys(grup).map(g => `<div class="cap">${g}</div>` + grup[g].map(m => `<a class="nav" href="#/${m.r}" data-r="${m.r}">${ic(m.i)}<span>${m.t}</span></a>`).join('')).join('');
    const info = D.peek('info') || {}; const ins = (info.instansi && info.instansi.nama) || 'Panitia Seleksi';
    app.innerHTML = `<div class="shell ${dark ? 'dark' : ''}">
      <header class="topbar"><button class="btn icon ghost menu-btn" data-act="menu" aria-label="Menu">${ic('menu')}</button>
        <div class="brand"><div class="logo">${ic('landmark')}</div><div><b>UjianKu Pro</b><span>${esc(ins)}</span></div></div>
        <div class="pill hide-m" id="tb-kg">${ic('calendar', 'sm')}<span></span></div>
        <div class="userbox"><div class="nm"><b id="tb-nm"></b><span class="muted sm" id="tb-role"></span></div><div class="avatar" id="tb-av"></div>
        <button class="btn icon ghost" data-act="logout" aria-label="Keluar" title="Keluar">${ic('logout')}</button></div></header>
      <aside class="sidebar" id="sidebar">${nav}<div class="side-foot"><div class="tip"><b>${ic('shield', 'sm')} Aman & Terkini</b><span class="sm">Data tampil seketika dari cache dan disegarkan otomatis di latar belakang.</span></div></div></aside>
      <main class="main"><div class="page" id="view" tabindex="-1"></div></main>
      <footer class="footer"><div><b>${esc(ins)}</b>${esc((info.instansi && info.instansi.alamat) || '')}</div><div>UjianKu Pro v${esc((window.UJK_CONFIG || {}).VERSI || '1.0')} · Perlindungan data pribadi sesuai UU 27/2022</div></footer></div>`;
    this.perbaruiUser(); this.tandaiMenu();
  },
  perbaruiUser() {
    const u = Session.user; if (!u || !$('#tb-nm')) return;
    $('#tb-nm').textContent = u.nama; $('#tb-role').textContent = u.peran; $('#tb-av').textContent = (u.nama || '?').trim().charAt(0).toUpperCase();
    const b = D.peek('boot') || {}; const kg = b.kegiatan && !Array.isArray(b.kegiatan) ? b.kegiatan : (Array.isArray(b.kegiatan) ? b.kegiatan.find(k => k.id === b.kegiatanAktif) : null);
    const el = $('#tb-kg span'); if (el) el.textContent = kg ? kg.nama : '—';
  },
  tandaiMenu() {
    const n = Router.cur.name, alias = { penilaian_form: 'penilaian', mulai: 'jadwal', selesai: 'jadwal' }[n] || n;
    $$('.sidebar .nav').forEach(a => a.classList.toggle('on', a.dataset.r === alias));
    const sb = $('#sidebar'); if (sb) sb.classList.remove('open'); const sc = $('.scrim'); if (sc) sc.remove();
    window.scrollTo(0, 0);
  },
  netbar(on) {
    let b = $('#netbar');
    if (on) { if (b) { b.innerHTML = ic('checkc', 'sm') + ' Koneksi pulih'; setTimeout(() => b && b.remove(), 1800); } return; }
    if (!b) { b = document.createElement('div'); b.id = 'netbar'; b.className = 'netbar'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.innerHTML = ic('wifioff', 'sm') + ' Koneksi terputus — mencoba lagi otomatis…';
  },
  autoRefresh: null
};
Actions.menu = () => { const sb = $('#sidebar'); if (!sb) return; sb.classList.toggle('open'); if (sb.classList.contains('open')) { const s = document.createElement('div'); s.className = 'scrim'; s.onclick = () => { sb.classList.remove('open'); s.remove(); }; document.body.appendChild(s); } };
Actions.logout = async () => { if (Router.cur.name === 'ujian') return; const r = await Modal.confirm({ title: 'Keluar dari aplikasi?', msg: 'Anda perlu masuk kembali untuk melanjutkan.', okText: 'Keluar' }); if (r.ok) App.keluar(); };
Actions.refreshData = async () => { Progress.start(); try { const u = Session.user; await D.refresh('boot', u.kind === 'p' ? 'pesertaBootstrap' : 'adminBootstrap', {}); D.invalidate('l:'); Router.refresh(); Toast.ok('Data diperbarui.'); } finally { Progress.done(); } };

/* Prefetch data ringan saat kursor/jari mendekati menu → klik terasa instan */
document.addEventListener('pointerover', e => { const a = e.target.closest && e.target.closest('.sidebar .nav'); if (a && App.prefetch) App.prefetch(a.dataset.r); });

/* Util tampilan halaman */
const pageHead = (judul, sub, kanan) => `<div class="page-h"><div><div class="crumb">${ic('landmark', 'sm')} Beranda › ${esc(judul)}</div><h1>${esc(judul)}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="row gap-s wrap">${kanan || ''}</div></div>`;
const boot = () => D.peek('boot') || {};
const kegAktif = () => { const b = boot(); return (b.kegiatan || []).find(k => k.id === b.kegiatanAktif) || (b.kegiatan || [])[0] || null; };
const mapBy = (arr, k) => { const m = {}; (arr || []).forEach(x => m[x[k || 'id']] = x); return m; };

window.addEventListener('DOMContentLoaded', () => App.boot());
