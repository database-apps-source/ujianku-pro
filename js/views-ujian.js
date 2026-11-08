/* views-ujian.js — mesin ujian CAT: timer jam-server, autosave debounce+retry, backup lokal, kirim berulang, pencatatan pelanggaran */
'use strict';
const Exam = {
  s: null, aktif: false, tick: null, saveT: null, saving: false, dirty: false, lastOk: 0, warned: {}, fs: 0, pelanggaran: 0, kirim: false, bound: false,
  kunciLokal() { return 'u:' + (Session.user && Session.user.id) + ':exam'; },
  siapkan(d) {
    const lok = Store.get(this.kunciLokal()) || {};
    const jaw = Object.assign({}, d.jawaban || {}, lok.jaw || {}), rag = Object.assign({}, d.ragu || {}, lok.ragu || {});
    if (d.serverNow) Clock.off = d.serverNow - Date.now();
    this.s = { soal: d.soal, subtes: d.subtes, jaw, rag, idx: Number(lok.idx) || 0, deadline: new Date(d.mulai).getTime() + d.durasiDetik * 1000, fz: Number(Store.get('exam_fz')) || 1 };
    if (this.s.idx >= d.soal.length) this.s.idx = 0;
    this.aktif = true; this.kirim = false; this.warned = {}; this.pelanggaran = 0; this.dirty = Object.keys(lok.jaw || {}).length > 0; this.saving = false;
    this.simpanLokal();
  },
  simpanLokal() { if (!this.s) return; Store.set(this.kunciLokal(), { jaw: this.s.jaw, ragu: this.s.rag, idx: this.s.idx, t: Date.now() }); },
  bersih() { this.aktif = false; clearInterval(this.tick); clearTimeout(this.saveT); this.lepas(); if (Session.user) Store.del(this.kunciLokal()); this.s = null; },
  sisa() { return Math.max(0, Math.round((this.s.deadline - Clock.now()) / 1000)); },
  cur() { return this.s.soal[this.s.idx]; },
  subIdx() { const sb = this.s.subtes; const id = this.cur().idSubtes; return sb.findIndex(x => x.id === id); },
  terjawab() { return this.s.soal.filter(q => this.s.jaw[q.id]).length; },

  /* ---------- render ---------- */
  view() {
    const s = this.s, q = this.cur(), si = this.subIdx(), sub = s.subtes[si];
    const tabs = s.subtes.map((x, i) => { const qs = s.soal.filter(z => z.idSubtes === x.id), jw = qs.filter(z => s.jaw[z.id]).length; return `<button class="subtab ${i === si ? 'on' : ''}" data-act="exSub" data-i="${i}">${esc(singkatSubtes(x.nama))} <span class="c">${jw}/${qs.length}</span></button>`; }).join('');
    const dalamSub = s.soal.filter(z => z.idSubtes === q.idSubtes), noDalam = dalamSub.indexOf(q) + 1;
    const opsi = q.opsi.map((o, i) => { const L = String.fromCharCode(65 + i); return `<button class="opt ${s.jaw[q.id] === o.k ? 'sel' : ''}" data-act="exJawab" data-k="${o.k}" role="radio" aria-checked="${s.jaw[q.id] === o.k}"><span class="l">${L}</span><span>${esc(o.t)}</span><span class="r">${s.jaw[q.id] === o.k ? ic('checkc', 'sm') : ''}</span></button>`; }).join('');
    return `<div class="exam" style="--fz:${s.fz}">
      <div class="exam-top"><div class="brand"><div class="logo">${ic('landmark')}</div><div><b>CAT Perangkat Desa</b><span>${esc(Session.user.nama)} · ${esc(Session.user.nomor || '')}</span></div></div>
        <div class="timer" id="ex-timer" role="timer"><small>SISA WAKTU</small><div class="t" id="ex-t">${hms(this.sisa())}</div></div>
        <div class="sync" id="ex-sync"></div><div class="fz" role="group" aria-label="Ukuran huruf">${[[.9, 'A−'], [1, 'A'], [1.2, 'A+']].map(([v, t]) => `<button class="${s.fz === v ? 'on' : ''}" data-act="exFz" data-v="${v}">${t}</button>`).join('')}</div>
        <button class="btn icon ghost sheetbtn" data-act="exSheet" aria-label="Daftar soal">${ic('grid')}</button>
        <button class="btn pri" data-act="exKirim" style="margin-left:auto">${ic('save')} <span>Kirim Jawaban</span></button></div>
      <div class="subtabs" role="tablist">${tabs}</div>
      <div class="exam-body"><section class="qcard"><div class="qhead"><div class="row gap-s"><span class="qno">Soal ${q.no}</span><span class="muted sm">${esc(sub.nama)} · ${noDalam}/${dalamSub.length}</span></div>
          <button class="btn sm ${s.rag[q.id] ? 'warn' : 'ghost'}" data-act="exRagu" style="${s.rag[q.id] ? 'background:#f59e0b;color:#fff' : ''}">${ic('flag', 'sm')} ${s.rag[q.id] ? 'Ragu-ragu ✓' : 'Tandai Ragu'}</button></div>
        <div class="qbody"><div class="qtext">${esc(q.q)}</div>${q.gambar ? `<img class="qimg" src="${esc(q.gambar)}" alt="Gambar soal" loading="lazy">` : ''}<div role="radiogroup">${opsi}</div></div>
        <div class="qfoot"><button class="btn ghost" data-act="exPrev" ${s.idx === 0 ? 'disabled' : ''}>${ic('left')} Sebelumnya</button>${s.idx === s.soal.length - 1 ? `<button class="btn ok" data-act="exKirim">${ic('save')} Selesai & Kirim</button>` : `<button class="btn pri" data-act="exNext">Berikutnya ${ic('right')}</button>`}</div></section>
        <aside class="navpanel stack"><div class="card"><div class="card-h"><h3>Daftar Soal</h3><span class="mono sm muted">${this.terjawab()}/${s.soal.length}</span></div><div class="navgrid" id="ex-nav">${this.navHtml(q.idSubtes)}</div>
          <div class="legend mt"><span><i style="background:var(--secondary)"></i>Terjawab</span><span><i style="background:#f59e0b"></i>Ragu</span><span><i style="background:var(--surface-high)"></i>Kosong</span></div></div>
          <div class="card"><div class="sm muted">Pintasan: <b class="mono">A–E</b> pilih · <b class="mono">←/→</b> pindah · <b class="mono">R</b> ragu</div></div></aside></div></div>`;
  },
  navHtml(idSub) { const s = this.s; return s.soal.map((z, i) => z.idSubtes !== idSub ? '' : `<button class="nq ${s.jaw[z.id] ? 'a' : ''} ${s.rag[z.id] ? 'f' : ''} ${i === s.idx ? 'cur' : ''}" data-act="exGo" data-i="${i}" aria-label="Soal ${z.no}">${z.no}</button>`).join(''); },
  gambar() { const v = $('#view'); if (v) v.innerHTML = this.view(); this.status(); window.scrollTo(0, 0); },
  status() {
    const e = $('#ex-sync'); if (!e) return; let c = '', t = '';
    if (!Api.net.online) { c = 'off'; t = ic('wifioff', 'sm') + ' Offline — jawaban aman di perangkat'; }
    else if (this.saving) { c = 'busy'; t = ic('refresh', 'sm spin') + ' Menyimpan…'; }
    else if (this.dirty) { c = 'busy'; t = ic('clock', 'sm') + ' Menunggu simpan'; }
    else { t = ic('checkc', 'sm') + ' Tersimpan' + (this.lastOk ? ' ' + jamWib(this.lastOk).slice(0, 8) : ''); }
    e.className = 'sync ' + c; e.innerHTML = t;
  },

  /* ---------- aksi ---------- */
  jawab(k) { const q = this.cur(); this.s.jaw[q.id] = this.s.jaw[q.id] === k ? '' : k; if (!this.s.jaw[q.id]) delete this.s.jaw[q.id]; this.ubah(); },
  ubah() { this.simpanLokal(); this.dirty = true; this.gambar(); clearTimeout(this.saveT); this.saveT = setTimeout(() => this.simpan(), 1500); },
  async simpan(paksa) {
    if (!this.s || this.kirim) return; if (this.saving) { this.saveT = setTimeout(() => this.simpan(), 1200); return; }
    if (!this.dirty && !paksa) return; this.saving = true; this.status();
    const snap = JSON.stringify([this.s.jaw, this.s.rag]);
    try {
      const r = await Api.call('ujianSimpan', { jawaban: this.s.jaw, ragu: this.s.rag }, { write: true, retries: 1, timeout: 20000 });
      if (r && r.selesai) { this.selesaiServer(r.hasil); return; }
      if (JSON.stringify([this.s.jaw, this.s.rag]) === snap) this.dirty = false; this.lastOk = Clock.now();
      if (r && r.sisaDetik != null) this.s.deadline = Clock.now() + r.sisaDetik * 1000;
    } catch (e) { this.dirty = true; clearTimeout(this.saveT); this.saveT = setTimeout(() => this.simpan(), 5000); }
    finally { this.saving = false; this.status(); }
  },
  selesaiServer(h) { Store.sess.set('hasil_kirim', h || {}); this.bersih(); D.invalidate('boot'); refreshPeserta(); Router.go('selesai'); },
  pindah(i) { if (i < 0 || i >= this.s.soal.length) return; this.s.idx = i; this.simpanLokal(); this.gambar(); },
  async kirimTanya() {
    const s = this.s, kosong = s.soal.length - this.terjawab(), ragu = s.soal.filter(q => s.rag[q.id]).length;
    const r = await Modal.confirm({ title: 'Kirim jawaban sekarang?', msg: 'Setelah dikirim, jawaban <b>tidak dapat diubah</b> lagi.', extra: `<div class="sumgrid"><div class="box"><b style="color:var(--secondary)">${this.terjawab()}</b><span class="sm muted">Terjawab</span></div><div class="box"><b style="color:${kosong ? 'var(--error)' : 'var(--ok)'}">${kosong}</b><span class="sm muted">Kosong</span></div><div class="box"><b style="color:#d97706">${ragu}</b><span class="sm muted">Ragu</span></div></div>${kosong ? `<div class="alert mt">${ic('alert')}<div>Masih ada <b>${kosong}</b> soal belum dijawab.</div></div>` : ''}`, okText: 'Ya, Kirim', noText: 'Periksa Lagi' });
    if (r.ok) this.kirimFinal(false);
  },
  async kirimFinal(otomatis) {
    if (this.kirim) return; this.kirim = true; clearTimeout(this.saveT); clearInterval(this.tick);
    const ov = Modal.open({ title: otomatis ? 'Waktu habis' : 'Mengirim jawaban', persist: true, noFocus: true, body: `<div class="center"><div class="avatar" style="margin:0 auto 1rem">${ic('refresh', 'spin')}</div><p id="kr-msg">${otomatis ? 'Waktu ujian habis. Jawaban Anda dikirim otomatis…' : 'Mohon tunggu, jangan menutup halaman…'}</p></div>` });
    for (let i = 0; ; i++) {
      try {
        const r = await Api.call('ujianKirim', { jawaban: this.s.jaw, ragu: this.s.rag, otomatis: !!otomatis }, { write: true, retries: 2, timeout: 60000 });
        Modal.close(ov); try { document.fullscreenElement && document.exitFullscreen(); } catch (e) { } this.selesaiServer(r); return;
      } catch (e) {
        if (e.server && e.code !== 'SERVER') { if (/sudah/i.test(e.message)) { Modal.close(ov); this.selesaiServer({}); return; } Modal.close(ov); this.kirim = false; Toast.err(e.message); this.tickMulai(); return; }
        const m = $('#kr-msg'); if (m) m.textContent = 'Koneksi bermasalah. Jawaban aman di perangkat; mencoba mengirim ulang (' + (i + 1) + ')…';
        this.simpanLokal(); await sleep(Math.min(8000, 1500 * (i + 1)));
      }
    }
  },

  /* ---------- timer & pengawasan ---------- */
  tickMulai() {
    clearInterval(this.tick);
    this.tick = setInterval(() => {
      if (!this.s || this.kirim) return; const r = this.sisa(), e = $('#ex-t'); if (e) e.textContent = hms(r);
      const t = $('#ex-timer'); if (t) t.classList.toggle('low', r <= 300);
      [[600, '10 menit lagi'], [300, '5 menit lagi'], [60, '1 menit lagi']].forEach(([b, m]) => { if (r <= b && r > b - 5 && !this.warned[b]) { this.warned[b] = 1; Toast.warn('Sisa waktu ' + m + '. Periksa jawaban Anda.'); } });
      if (r <= 0) this.kirimFinal(true);
    }, 500);
  },
  lapor(jenis, ket) { this.pelanggaran++; Api.call('ujianKejadian', { jenis, keterangan: ket || '' }, { write: true, retries: 0, timeout: 8000 }).catch(() => { }); },
  ikat() {
    if (this.bound) return; this.bound = true;
    this._vis = () => { if (document.hidden && this.aktif && !this.kirim) { this.lapor('pindah tab', 'Halaman ujian disembunyikan'); this.simpan(true); } else if (!document.hidden) this.tickMulai(); };
    this._blur = debounce(() => { if (this.aktif && !this.kirim && !document.hidden && !document.hasFocus()) this.lapor('jendela kehilangan fokus', ''); }, 800);
    this._fs = () => { if (this.aktif && !this.kirim && !document.fullscreenElement && this.fs) { this.lapor('keluar layar penuh', ''); this.peringatFs(); } this.fs = document.fullscreenElement ? 1 : this.fs; };
    this._unload = e => { if (this.aktif && !this.kirim) { this.simpanLokal(); e.preventDefault(); e.returnValue = ''; } };
    this._key = e => { if (!this.aktif || Modal.top() || /INPUT|TEXTAREA/.test(e.target.tagName)) return; const k = e.key.toUpperCase();
      if (/^[A-E]$/.test(k)) { const q = this.cur(), o = q.opsi[k.charCodeAt(0) - 65]; if (o) this.jawab(o.k); } else if (e.key === 'ArrowRight') this.pindah(this.s.idx + 1); else if (e.key === 'ArrowLeft') this.pindah(this.s.idx - 1); else if (k === 'R') { this.s.rag[this.cur().id] = !this.s.rag[this.cur().id]; if (!this.s.rag[this.cur().id]) delete this.s.rag[this.cur().id]; this.ubah(); } };
    this._ctx = e => { if (this.aktif) e.preventDefault(); };
    this._net = () => { this.status(); if (Api.net.online && this.dirty) this.simpan(true); };
    document.addEventListener('visibilitychange', this._vis); window.addEventListener('blur', this._blur); document.addEventListener('fullscreenchange', this._fs);
    window.addEventListener('beforeunload', this._unload); document.addEventListener('keydown', this._key); document.addEventListener('contextmenu', this._ctx); document.addEventListener('copy', this._ctx);
    window.addEventListener('ujk:net', this._net); window.addEventListener('online', this._net);
  },
  lepas() {
    if (!this.bound) return; this.bound = false;
    document.removeEventListener('visibilitychange', this._vis); window.removeEventListener('blur', this._blur); document.removeEventListener('fullscreenchange', this._fs);
    window.removeEventListener('beforeunload', this._unload); document.removeEventListener('keydown', this._key); document.removeEventListener('contextmenu', this._ctx); document.removeEventListener('copy', this._ctx);
    window.removeEventListener('ujk:net', this._net); window.removeEventListener('online', this._net);
  },
  peringatFs() {
    if ($('#fs-warn')) return;
    Modal.open({ title: 'Kembali ke layar penuh', persist: true, noFocus: true, body: `<div class="alert err">${ic('alert')}<div>Anda keluar dari layar penuh. Pelanggaran ini <b>tercatat</b> dan dapat dilihat pengawas.</div></div><div id="fs-warn"></div>`, footer: `<button class="btn pri" id="fs-ok">${ic('maximize')} Kembali ke Layar Penuh</button><button class="btn ghost" id="fs-skip">Lanjut tanpa layar penuh</button>` });
    const ov = Modal.top(); $('#fs-ok', ov).onclick = () => { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => { }); Modal.close(ov); };
    $('#fs-skip', ov).onclick = () => { this.fs = 0; Modal.close(ov); };
  },
  async pulihkan() {
    try { const d = await aksi('ujianMulai', {}, { silent: true }); if (d.selesai) { this.selesaiServer(d.hasil); return; } this.siapkan(d); this.mulaiTampil(); }
    catch (e) { Toast.err(e.message); Router.go('dashboard'); }
  },
  mulaiTampil() { this.gambar(); this.ikat(); this.tickMulai(); if (document.fullscreenElement) this.fs = 1; else if (document.documentElement.requestFullscreen) this.fs = 0; }
};

Router.routes.ujian = {
  title: 'Ujian', noRefresh: true,
  render() { return Exam.s ? Exam.view() : `<div class="exam"><div class="center" style="margin:30vh auto">${ic('refresh', 'lg spin')}<p class="muted mt-s">Memulihkan sesi ujian…</p></div></div>`; },
  mount() { if (Exam.s) { Exam.status(); Exam.ikat(); Exam.tickMulai(); if (document.fullscreenElement) Exam.fs = 1; } else Exam.pulihkan(); },
  cleanup() { /* timer tetap hidup selama ujian aktif; dibersihkan saat kirim/keluar */ }
};

Actions.exJawab = el => Exam.jawab(el.dataset.k);
Actions.exNext = () => Exam.pindah(Exam.s.idx + 1);
Actions.exPrev = () => Exam.pindah(Exam.s.idx - 1);
Actions.exGo = el => { Modal.closeAll(); Exam.pindah(Number(el.dataset.i)); };
Actions.exSub = el => { const sb = Exam.s.subtes[Number(el.dataset.i)]; Exam.pindah(Exam.s.soal.findIndex(q => q.idSubtes === sb.id)); };
Actions.exRagu = () => { const id = Exam.cur().id; if (Exam.s.rag[id]) delete Exam.s.rag[id]; else Exam.s.rag[id] = true; Exam.ubah(); };
Actions.exFz = el => { Exam.s.fz = Number(el.dataset.v); Store.set('exam_fz', Exam.s.fz); Exam.gambar(); };
Actions.exKirim = () => Exam.kirimTanya();
Actions.exSheet = () => { const s = Exam.s; Modal.open({ title: 'Daftar Soal', noFocus: true, body: s.subtes.map(sb => `<div class="mb"><div class="b sm mb">${esc(sb.nama)}</div><div class="navgrid">${Exam.navHtml(sb.id)}</div></div>`).join('') }); };
