/* views-kelola.js — penilaian, hasil & finalisasi, bank/paket soal, pengguna, pengaturan */
'use strict';
const RUBRIK = {
  Praktik: ['Ketepatan hasil kerja', 'Kecepatan & efisiensi', 'Penguasaan aplikasi', 'Kerapian & format dokumen'],
  Wawancara: ['Pengetahuan pemerintahan desa', 'Komunikasi & penyampaian', 'Sikap & integritas', 'Motivasi & komitmen']
};
const nilaiCell = v => v == null || v === '' ? '<span class="muted">–</span>' : `<b class="mono">${fmtN(v)}</b>`;

/* ================= PENILAIAN ================= */
Router.routes.penilaian = {
  title: 'Penilaian', keys: ['boot', 'nilai'],
  render() {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 60 }); if (!b) return skelStaf();
    const N = D.use('nilai', 'penilaianDaftar', {}, { ttl: 10 });
    if (!N) return `<div class="stack">${pageHead('Penilaian')}<div class="skel" style="height:300px"></div></div>`;
    const penguji = Session.user.peran === 'Penguji';
    const rows = N.rows.map(r => Object.assign({ id: r.idPeserta + '|' + r.komponen }, r));
    const sb = (r) => sBadge(r.status === 'Belum' ? 'Belum' : r.status);
    if (penguji) {
      const st = TS.pn || (TS.pn = { q: '', page: 1 });
      const sel = N.komponen.length > 1 ? `<select class="inp" id="pn-k" style="max-width:180px"><option value="">Semua komponen</option>${N.komponen.map(k => `<option ${st.k === k ? 'selected' : ''}>${k}</option>`).join('')}</select>` : '';
      return `<div class="stack">${pageHead('Penilaian Peserta', 'Peserta yang ditugaskan kepada Anda. Nilai Final terkunci dan hanya dapat dikoreksi Ketua Panitia.')}<div class="card">${Table.html('pn', { rows, searchKeys: ['nomor', 'nama', 'jabatan'], filters: (rs, s) => s.k ? rs.filter(r => r.komponen === s.k) : rs, toolbarPre: sel,
        cols: [{ k: 'nomor', label: 'Nomor', cls: 'mono' }, { k: 'nama', label: 'Nama', fmt: v => `<b>${esc(v)}</b>` }, { k: 'jabatan', label: 'Formasi', fmt: (v, r) => esc(v) + `<div class="sm muted">${esc(r.desa)}</div>` }, { k: 'komponen', label: 'Komponen' }, { k: 'kehadiran', label: 'Hadir', fmt: v => sBadge(v === 'Hadir' ? 'Hadir' : 'Belum Hadir') }, { k: 'nilai', label: 'Nilai', num: true, fmt: nilaiCell }, { k: 'status', label: 'Status', fmt: (v, r) => sb(r) }],
        actions: r => `<a class="btn sm ${r.status === 'Final' ? 'ghost' : 'pri'}" href="#/penilaian_form/${r.idPeserta}/${r.komponen}">${ic(r.status === 'Final' ? 'eye' : 'edit', 'sm')} ${r.status === 'Final' ? 'Lihat' : 'Nilai'}</a>` })}</div></div>`;
    }
    /* Panitia: kelengkapan + penugasan + koreksi */
    const ca = Session.user.peran === 'Ketua Panitia', per = {}; N.rows.forEach(r => { const k = r.komponen; per[k] = per[k] || { n: 0, f: 0, d: 0, t: 0 }; per[k].n++; if (r.status === 'Final') per[k].f++; if (r.status === 'Draf') per[k].d++; if (r.idPenguji) per[k].t++; });
    const pm = mapBy(N.penguji || []);
    return `<div class="stack">${pageHead('Penilaian Praktik & Wawancara', 'Kelola penugasan penguji dan pantau kelengkapan nilai.', `<button class="btn pri" data-act="tugasForm">${ic('users')} Tugaskan Penguji</button>`)}
      <div class="kpis">${Object.keys(per).map(k => kpi(k, `${per[k].f}/${per[k].n}`, `${per[k].d} draf · ${per[k].t} sudah ditugaskan`, 'edit')).join('')}</div>
      <div class="card">${Table.html('pn', { rows, searchKeys: ['nomor', 'nama', 'jabatan'], filters: (rs, s) => s.k ? rs.filter(r => r.komponen === s.k) : rs, toolbarPre: `<select class="inp" id="pn-k" style="max-width:180px"><option value="">Semua komponen</option>${N.komponen.map(k => `<option ${(TS.pn || {}).k === k ? 'selected' : ''}>${k}</option>`).join('')}</select>`,
        cols: [{ k: 'nomor', label: 'Nomor', cls: 'mono' }, { k: 'nama', label: 'Nama', fmt: v => `<b>${esc(v)}</b>` }, { k: 'jabatan', label: 'Formasi' }, { k: 'komponen', label: 'Komponen' }, { k: 'idPenguji', label: 'Penguji', fmt: v => esc((pm[v] || {}).nama || '—') }, { k: 'nilai', label: 'Nilai', num: true, fmt: nilaiCell }, { k: 'status', label: 'Status', fmt: (v, r) => sb(r) }],
        actions: ca ? r => (r.status !== 'Belum' || r.kehadiran === 'Hadir') ? `<button class="btn sm ghost" data-act="koreksi" data-p="${r.idPeserta}" data-k="${r.komponen}" data-n="${r.nilai == null ? '' : r.nilai}" data-nm="${esc(r.nama)}">${ic('edit', 'sm')} Koreksi</button>` : '' : null })}</div></div>`;
  },
  mount() { const s = $('#pn-k'); if (s) s.onchange = e => { (TS.pn || (TS.pn = { q: '', page: 1 })).k = e.target.value; TS.pn.page = 1; Table.update('pn'); }; Poll.start(() => D.refresh('nilai', 'penilaianDaftar', {}), 20000); }, cleanup() { Poll.stop(); }
};
Actions.tugasForm = () => {
  const b = boot(), N = D.peek('nilai'), pg = (N && N.penguji) || [];
  if (!pg.length) { Toast.warn('Belum ada pengguna berperan Penguji. Tambahkan di menu Pengguna.'); return; }
  formModal({ title: 'Tugaskan Penguji', fields: [{ name: 'idPenguji', label: 'Penguji', req: 1, type: 'select', placeholder: 'Pilih penguji', options: pg.map(x => [x.id, x.nama + ' (' + (x.komponen || 'Keduanya') + ')']) }, { name: 'komponen', label: 'Komponen', req: 1, type: 'select', options: ['Praktik', 'Wawancara'] }, { name: 'idFormasi', label: 'Cakupan formasi', type: 'select', placeholder: 'Semua formasi', options: b.formasi.filter(f => f.idKegiatan === b.kegiatanAktif).map(f => [f.id, f.jabatan + ' — ' + f.desa]) }, { name: 'idRuang', label: 'Cakupan ruang', type: 'select', placeholder: 'Semua ruang', options: b.ruang.map(r => [r.id, r.nama]) }, { type: 'html', html: '<div class="hint">Penugasan lama untuk peserta & komponen yang sama akan diganti.</div>' }],
    onSave: async v => { const r = await aksi('penugasanSet', v, { ok: 'Penugasan disimpan.' }); D.refresh('nilai', 'penilaianDaftar', {}); } });
};
Actions.koreksi = el => formModal({ title: 'Koreksi Nilai — ' + el.dataset.nm, fields: [{ name: 'komponen', label: 'Komponen', type: 'select', options: ['Tertulis', 'Praktik', 'Wawancara'], def: el.dataset.k }, { name: 'nilai', label: 'Nilai baru (0–100)', type: 'number', min: 0, max: 100, step: '0.01', def: el.dataset.n, req: 1 }, { name: 'alasan', label: 'Alasan koreksi', type: 'textarea', req: 1, hint: 'Tercatat pada log audit.' }],
  onSave: async v => { await aksi('penilaianKoreksi', Object.assign({ idPeserta: el.dataset.p }, v), { ok: 'Nilai dikoreksi.' }); D.refresh('nilai', 'penilaianDaftar', {}); D.refresh('l:hasil', 'hasilList', {}); } });

/* Form nilai penguji (w_13) */
Router.routes.penilaian_form = {
  title: 'Form Penilaian', noRefresh: true,
  render(ctx) {
    const [id, komp] = ctx.args; const N = D.peek('nilai');
    const r = N && N.rows.find(x => x.idPeserta === id && x.komponen === komp);
    if (!r) { D.refresh('nilai', 'penilaianDaftar', {}).then(() => Router.render()); return skelStaf(); }
    const kunci = r.status === 'Final', ru = RUBRIK[komp] || [], rin = r.rincian || {};
    const nilaiAwal = r.nilai == null ? '' : r.nilai;
    return `<div class="stack" style="max-width:860px"><a href="#/penilaian" class="row gap-s">${ic('left', 'sm')} Kembali ke daftar</a>
      <div class="card"><div class="row sp wrap"><div><span class="badge info mono">${esc(r.nomor)}</span><h2 class="mt-s">${esc(r.nama)}</h2><div class="muted">${esc(r.jabatan)} · ${esc(r.desa)}</div></div><div class="center"><div class="muted sm">Komponen</div><h3>${komp}</h3>${sBadge(r.status)}</div></div></div>
      ${r.kehadiran !== 'Hadir' ? `<div class="alert err">${ic('alert')}<div>Peserta belum/tidak hadir; nilai tidak dapat disimpan.</div></div>` : ''}
      ${kunci ? `<div class="alert info">${ic('lock')}<div>Nilai sudah <b>Final</b> dan terkunci. Hubungi Ketua Panitia untuk koreksi.</div></div>` : ''}
      <form id="nf" class="card"><div class="card-h"><h3>Rubrik Penilaian (0–100)</h3><span class="muted sm">rata-rata menjadi saran nilai</span></div>
        ${ru.map((k, i) => `<div class="field"><div class="row sp"><label class="lbl" for="rb${i}">${esc(k)}</label><b class="mono" id="rbv${i}">${rin[k] != null ? rin[k] : 0}</b></div><input type="range" id="rb${i}" data-k="${esc(k)}" min="0" max="100" step="1" value="${rin[k] != null ? rin[k] : 0}" ${kunci ? 'disabled' : ''} style="width:100%"></div>`).join('')}
        <div class="grid2 mt"><div class="field"><label class="lbl">Nilai akhir komponen (0–100) <span class="req">*</span></label><input class="inp mono" name="nilai" id="nf-nilai" type="number" min="0" max="100" step="0.01" value="${nilaiAwal}" ${kunci ? 'disabled' : ''} style="font-size:20px;font-weight:700"><div class="hint">Batas minimum ${N.ambang[komp === 'Praktik' ? 'NK' : 'NW']}. Boleh disesuaikan dari saran rubrik.</div></div>
        <div class="field"><label class="lbl">Catatan penilaian ${kunci ? '' : '<span class="req">*</span>'}</label><textarea class="inp" name="catatan" rows="4" ${kunci ? 'disabled' : ''} placeholder="Dasar pemberian nilai (min. 10 karakter untuk Final)">${esc(r.catatan || '')}</textarea></div></div>
        ${kunci ? '' : `<label class="chk mt"><input type="checkbox" name="pakta"><span>Saya menyatakan penilaian ini objektif, bebas konflik kepentingan, dan sesuai rubrik.</span></label>`}
        <div class="errtxt hidden" id="nf-err"></div>
        ${kunci || r.kehadiran !== 'Hadir' ? '' : `<div class="row wrap mt"><button class="btn ghost" type="button" data-act="nilaiSimpan" data-s="Draf">${ic('save')} Simpan Draf</button><button class="btn ok" type="button" data-act="nilaiSimpan" data-s="Final">${ic('lock')} Simpan Final</button></div>`}</form></div>`;
  },
  mount() {
    const rs = $$('#nf input[type=range]'), n = $('#nf-nilai');
    rs.forEach((r, i) => r.oninput = () => { $('#rbv' + i).textContent = r.value; const avg = rs.reduce((a, x) => a + Number(x.value), 0) / rs.length; if (n && !n.disabled) n.value = (Math.round(avg * 100) / 100); });
  }
};
Actions.nilaiSimpan = async el => {
  const [id, komp] = Router.cur.args, f = $('#nf'), v = Form.read(f), rincian = {}; $$('#nf input[type=range]').forEach(r => rincian[r.dataset.k] = Number(r.value));
  const er = $('#nf-err'); er.classList.add('hidden');
  if (v.nilai === '') { er.textContent = 'Nilai wajib diisi.'; er.classList.remove('hidden'); return; }
  if (el.dataset.s === 'Final') { const c = await Modal.confirm({ title: 'Simpan sebagai Final?', msg: `Nilai <b>${fmtN(v.nilai)}</b> akan dikunci dan tidak dapat diubah penguji.`, okText: 'Ya, Final' }); if (!c.ok) return; }
  try { const r = await aksi('penilaianSimpan', { idPeserta: id, komponen: komp, nilai: v.nilai, catatan: v.catatan, rincian, status: el.dataset.s, pakta: v.pakta }, { ok: el.dataset.s === 'Final' ? 'Nilai final tersimpan.' : 'Draf tersimpan.' });
    D.patch('nilai', n => { const x = n.rows.find(y => y.idPeserta === id && y.komponen === komp); if (x) Object.assign(x, r.row); }); D.invalidate('boot'); Router.go('penilaian'); }
  catch (e) { er.textContent = e.message; er.classList.remove('hidden'); }
};

/* ================= HASIL & FINALISASI ================= */
Router.routes.rekap = {
  title: 'Hasil & Finalisasi', keys: ['l:hasil', 'boot'],
  render() {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 60 }); if (!b) return skelStaf();
    const H = D.use('l:hasil', 'hasilList', {}, { ttl: 10 });
    if (!H) return `<div class="stack">${pageHead('Hasil & Finalisasi')}<div class="skel" style="height:300px"></div></div>`;
    const ketua = Session.user.peran === 'Ketua Panitia', seleksi = H.kegiatan.jenis !== 'Kompetensi';
    const st = TS.hs || (TS.hs = { q: '', page: 1 });
    const ringkas = {}; H.rows.forEach(r => ringkas[r.status || 'Belum'] = (ringkas[r.status || 'Belum'] || 0) + 1);
    const fopt = b.formasi.filter(f => f.idKegiatan === b.kegiatanAktif);
    return `<div class="stack">${pageHead('Hasil & Finalisasi', `${esc(H.kegiatan.nama)} · NA = NT×${H.bobot.NT}% + NK×${H.bobot.NK}% + NW×${H.bobot.NW}%`, `${sBadge(H.final ? 'Final' : 'Sementara')}<button class="btn ghost" data-act="hasilCsv">${ic('download')} CSV</button><button class="btn ghost" data-act="hasilXlsx">${ic('download')} Excel</button>${ketua ? (H.final ? `<button class="btn danger" data-act="bukaFinal">${ic('unlock')} Buka Finalisasi</button>` : `<button class="btn ok" data-act="finalisasi">${ic('lock')} Finalisasi Hasil</button>`) : ''}`)}
      <div class="legend">${Object.keys(ringkas).map(k => `<span>${sBadge(k)} <b>${ringkas[k]}</b></span>`).join('')}</div>
      <div class="card">${Table.html('hs', { rows: H.rows, searchKeys: ['nomor', 'nama', 'jabatan', 'desa', 'status'], pageSize: 30, toolbarPre: `<select class="inp" id="hs-f" style="max-width:260px"><option value="">Semua formasi</option>${fopt.map(f => `<option value="${f.id}" ${st.f === f.id ? 'selected' : ''}>${esc(f.jabatan)} — ${esc(f.desa)}</option>`).join('')}</select>`, filters: (rs, s) => s.f ? rs.filter(r => r.idFormasi === s.f) : rs,
        cols: [...(seleksi ? [{ k: 'peringkat', label: '#', num: true, fmt: v => v || '–' }] : []), { k: 'nomor', label: 'Nomor', cls: 'mono' }, { k: 'nama', label: 'Nama', fmt: v => `<b>${esc(v)}</b>` }, { k: 'jabatan', label: 'Formasi', fmt: (v, r) => esc(v) + `<div class="sm muted">${esc(r.desa)}</div>` }, { k: 'nt', label: 'NT', num: true, fmt: nilaiCell }, { k: 'nk', label: 'NK', num: true, fmt: nilaiCell }, { k: 'nw', label: 'NW', num: true, fmt: nilaiCell }, { k: 'na', label: 'NA', num: true, fmt: v => v == null ? '–' : `<b class="mono" style="color:var(--primary-c)">${fmtN(v)}</b>` }, { k: 'status', label: 'Status', fmt: v => sBadge(v || 'Belum') }] })}</div></div>`;
  },
  mount() { const s = $('#hs-f'); if (s) s.onchange = e => { TS.hs.f = e.target.value; TS.hs.page = 1; Table.update('hs'); }; }
};
const hasilBaris = () => { const H = D.peek('l:hasil'); return H.rows.map(r => [r.peringkat || '', r.nomor, r.nama, r.jabatan, r.desa, r.ruang, r.nt, r.nk, r.nw, r.na, r.status, r.publikasi]); };
const HASIL_HEAD = ['Peringkat', 'Nomor', 'Nama', 'Jabatan', 'Desa', 'Ruang', 'NT', 'NK', 'NW', 'NA', 'Status', 'Publikasi'];
Actions.hasilCsv = () => csvUnduh('hasil-seleksi.csv', HASIL_HEAD, hasilBaris());
Actions.hasilXlsx = async () => { await muatSkrip(XLSX_URL); const ws = XLSX.utils.aoa_to_sheet([HASIL_HEAD].concat(hasilBaris())); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Hasil'); XLSX.writeFile(wb, 'hasil-seleksi.xlsx'); };
Actions.finalisasi = async () => {
  const r = await Modal.confirm({ title: 'Finalisasi hasil?', msg: 'Seluruh nilai & peringkat dikunci. Dokumen resmi dapat diterbitkan setelah ini. Hanya dapat dibuka kembali oleh Ketua Panitia dengan alasan tertulis.', okText: 'Finalisasi' }); if (!r.ok) return;
  try { const d = await aksi('finalisasi', {}, { ok: 'Hasil difinalisasi.' }); afterFinal(); }
  catch (e) { if (e.code === 'KONFIRMASI') { const c = await Modal.confirm({ title: 'Masih ada nilai Draf', msg: esc(e.message), okText: 'Lanjutkan meski ada draf', danger: true }); if (c.ok) { await aksi('finalisasi', { paksa: true }, { ok: 'Hasil difinalisasi.' }); afterFinal(); } } }
};
const afterFinal = () => { D.refresh('l:hasil', 'hasilList', {}); D.refresh('boot', 'adminBootstrap', {}); };
Actions.bukaFinal = async () => { const r = await Modal.confirm({ title: 'Buka finalisasi?', msg: 'Hasil kembali berstatus Sementara dan <b>semua dokumen resmi yang terbit akan ditarik</b>.', danger: true, reason: true, minReason: 10, reasonPh: 'Alasan (min. 10 karakter)', okText: 'Buka Finalisasi' }); if (!r.ok) return; await aksi('bukaFinalisasi', { alasan: r.reason }, { ok: 'Finalisasi dibuka.' }); afterFinal(); };

/* ================= BANK & PAKET SOAL ================= */
Router.routes.soal = {
  title: 'Bank & Paket Soal', keys: ['boot', 'l:banksoal', 'l:paket', 'pv'],
  render(ctx) {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 60 }); if (!b) return skelStaf();
    const tab = ctx.args[0] || 'bank', t = (id, n) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-to="soal/${id}">${n}</button>`;
    const sb = b.subtes.filter(s => s.idKegiatan === b.kegiatanAktif).sort((a, c) => a.urutan - c.urutan), sm = mapBy(sb); let isi = '';
    if (tab === 'bank') {
      const L = useList('banksoal', null, 30); const st = TS.bk || (TS.bk = { q: '', page: 1 });
      isi = !L ? '<div class="skel" style="height:260px"></div>' : Table.html('bk', { rows: L.rows.filter(r => sm[r.idSubtes]).map(r => Object.assign({ sn: (sm[r.idSubtes] || {}).nama }, r)), searchKeys: ['pertanyaan', 'sn'], searchPh: 'Cari pertanyaan…', filters: (rs, s) => s.s ? rs.filter(r => r.idSubtes === s.s) : rs,
        toolbarPre: `<select class="inp" id="bk-s" style="max-width:240px"><option value="">Semua subtes</option>${sb.map(s => `<option value="${s.id}" ${st.s === s.id ? 'selected' : ''}>${esc(s.nama)}</option>`).join('')}</select>`,
        toolbar: `<button class="btn pri" data-act="soalForm">${ic('plus')} Soal</button><button class="btn ghost" data-act="soalImport">${ic('upload')} Impor</button><button class="btn ghost" data-act="soalTemplate">${ic('download')} Templat</button>`,
        cols: [{ k: 'sn', label: 'Subtes', fmt: v => esc(singkatSubtes(v)) }, { k: 'pertanyaan', label: 'Pertanyaan', fmt: v => esc(String(v).slice(0, 110)) + (String(v).length > 110 ? '…' : '') }, { k: 'kunci', label: 'Kunci', cls: 'mono' }, { k: 'kesulitan', label: 'Level', fmt: v => sBadge(v) }, { k: 'status', label: 'Status', fmt: (v, r) => sBadge(v) + (r.dipakai ? ' ' + badge('dipakai', 'info') : '') }],
        actions: r => `<button class="btn sm ghost" data-act="soalForm" data-id="${r.id}">${ic('edit', 'sm')}</button>${r.dipakai ? '' : `<button class="btn sm ghost" data-act="entHapus" data-e="banksoal" data-id="${r.id}" data-n="soal">${ic('trash', 'sm')}</button>`}` });
    } else {
      const P = useList('paket', null, 30), V = D.use('pv', 'paketValidasi', {}, { ttl: 20 }); const vm = mapBy(V ? V.paket : []);
      const ring = b.ringkasanSoal && b.ringkasanSoal.perSubtes || [];
      isi = `<div class="row sp wrap mb"><div class="muted">Paket harus memuat tepat <b>${V ? V.wajibTotal : '…'}</b> soal sesuai subtes.</div><button class="btn pri" data-act="paketBuat">${ic('plus')} Buat Paket Otomatis</button></div>
        ${ring.some(s => s.ada < s.butuh) ? `<div class="alert mb">${ic('alert')}<div>Bank soal belum cukup: ${ring.filter(s => s.ada < s.butuh).map(s => `${esc(singkatSubtes(s.nama))} (${s.ada}/${s.butuh})`).join(', ')}.</div></div>` : ''}` +
        (!P ? '<div class="skel" style="height:120px"></div>' : Table.html('pk', { rows: P.rows, search: false, cols: [{ k: 'nama', label: 'Paket', fmt: v => `<b>${esc(v)}</b>` }, { k: 'total', label: 'Soal', num: true }, { k: 'id', label: 'Validasi', fmt: v => { const x = vm[v]; return !x ? '…' : x.valid ? badge('Valid', 'ok') : `<span title="${esc(x.masalah.join('; '))}">${badge('Tidak valid', 'err')}</span><div class="sm muted">${esc(x.masalah.slice(0, 2).join('; '))}</div>`; } }], actions: r => `<button class="btn sm ghost" data-act="paketBuat" data-id="${r.id}" data-nama="${esc(r.nama)}" title="Acak ulang">${ic('refresh', 'sm')}</button>${b.terkunci ? '' : `<button class="btn sm ghost" data-act="entHapus" data-e="paket" data-id="${r.id}" data-n="paket">${ic('trash', 'sm')}</button>`}` }));
    }
    return `<div class="stack">${pageHead('Bank & Paket Soal', 'Soal yang sudah dipakai dalam ujian terkunci; arsipkan bila perlu diganti.')}<div class="tabs">${t('bank', 'Bank Soal')}${t('paket', 'Paket Soal')}</div><div class="card">${isi}</div></div>`;
  },
  mount() { const s = $('#bk-s'); if (s) s.onchange = e => { TS.bk.s = e.target.value; TS.bk.page = 1; Table.update('bk'); }; }
};
Actions.soalForm = el => {
  const b = boot(), L = D.peek('l:banksoal'), r = el.dataset.id ? L.rows.find(x => x.id === el.dataset.id) : { kunci: 'A', bobot: 1, kesulitan: 'Sedang', status: 'Aktif' };
  const sb = b.subtes.filter(s => s.idKegiatan === b.kegiatanAktif);
  const ov = formModal({ title: r.id ? 'Ubah Soal' : 'Tambah Soal', size: 'lg', row: r, fields: [{ name: 'idSubtes', label: 'Subtes', req: 1, type: 'select', placeholder: 'Pilih subtes', options: sb.map(s => [s.id, s.nama]) }, { name: 'pertanyaan', label: 'Pertanyaan', type: 'textarea', rows: 4, req: 1 }, { name: 'gambar', label: 'URL gambar (opsional)' }, ...['A', 'B', 'C', 'D', 'E'].map(k => ({ name: k, label: 'Pilihan ' + k, req: k < 'C' })), { name: 'kunci', label: 'Kunci jawaban', type: 'select', options: ['A', 'B', 'C', 'D', 'E'] }, { name: 'kesulitan', label: 'Tingkat', type: 'select', options: ['Mudah', 'Sedang', 'Sulit'] }, { name: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Arsip'] }],
    onSave: async v => { const res = await aksi('crudSave', { entitas: 'banksoal', row: Object.assign({}, r.id ? { id: r.id } : {}, v, { bobot: r.bobot || 1 }) }, { ok: 'Soal disimpan.' }); await D.refresh('l:banksoal', 'crudList', { entitas: 'banksoal' }); D.refresh('boot', 'adminBootstrap', {}); } });
};
const SOAL_HEAD = ['Subtes', 'Pertanyaan', 'A', 'B', 'C', 'D', 'E', 'Kunci'];
Actions.soalTemplate = () => csvUnduh('templat-soal.csv', SOAL_HEAD, [['Pancasila dan UUD 1945', 'Contoh pertanyaan?', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', '', 'A']]);
Actions.soalImport = () => {
  const ov = Modal.open({ title: 'Impor Soal', size: 'lg', persist: true, body: `<div class="alert info mb">${ic('info')}<div>Kolom: <b>Subtes, Pertanyaan, A, B, C, D, E, Kunci</b>. Format .csv atau .xlsx, maks. 500 baris.</div></div><input type="file" id="is-file" accept=".csv,.xlsx,.xls" class="inp"><div id="is-out" class="mt"></div>`, footer: `<button class="btn ghost" data-act="modalClose">Tutup</button><button class="btn pri" id="is-go" disabled>${ic('upload')} Simpan yang Valid</button>` });
  let rows = [];
  $('#is-file', ov).onchange = async e => { const f = e.target.files[0]; if (!f) return; const out = $('#is-out', ov); out.innerHTML = '<div class="skel" style="height:70px"></div>';
    try { if (/\.csv$/i.test(f.name)) rows = uraiCsv(await f.text()); else { await muatSkrip(XLSX_URL); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }); }
      const r = await aksi('bankImport', { rows, dryRun: true }, { silent: true });
      out.innerHTML = `<div class="sumgrid mb"><div class="box"><b>${r.total}</b><span class="sm muted">Baris</span></div><div class="box"><b style="color:var(--ok)">${r.valid}</b><span class="sm muted">Valid</span></div><div class="box"><b style="color:var(--error)">${r.gagal}</b><span class="sm muted">Bermasalah</span></div></div>` + (r.gagal ? `<div class="tbl-wrap" style="max-height:220px;overflow:auto"><table class="tbl"><tbody>${r.detail.filter(x => !x.ok).slice(0, 60).map(x => `<tr><td class="mono">${x.baris}</td><td>${esc(x.galat)}</td></tr>`).join('')}</tbody></table></div>` : '');
      $('#is-go', ov).disabled = !r.valid; } catch (er) { out.innerHTML = `<div class="alert err">${ic('alert')}<div>${esc(er.message)}</div></div>`; } };
  $('#is-go', ov).onclick = async () => { const b = $('#is-go', ov); b.disabled = true; try { await aksi('bankImport', { rows }, { ok: 'Soal diimpor.' }); Modal.close(ov); D.refresh('l:banksoal', 'crudList', { entitas: 'banksoal' }); D.refresh('boot', 'adminBootstrap', {}); } catch (e) { b.disabled = false; } };
};
Actions.paketBuat = async el => {
  const nama = el.dataset.nama; const f = await new Promise(res => { const ov = formModal({ title: nama ? 'Acak Ulang Paket' : 'Buat Paket Soal', fields: [{ name: 'nama', label: 'Nama paket', req: 1, def: nama || 'Paket ' + String.fromCharCode(65 + ((D.peek('l:paket') || { rows: [] }).rows.length % 26)) }, { name: 'izinkanKurang', type: 'checkbox', label: 'Izinkan paket kurang dari jumlah subtes (hanya untuk uji coba)' }], onSave: async v => { res(v); } }); });
  await aksi('paketBuat', Object.assign({}, el.dataset.id ? { id: el.dataset.id } : {}, f), { ok: 'Paket disimpan.' }); D.refresh('l:paket', 'crudList', { entitas: 'paket' }); D.refresh('pv', 'paketValidasi', {}); D.refresh('boot', 'adminBootstrap', {});
};

/* ================= PENGGUNA ================= */
const PERAN_STAF = ['Super Admin', 'Ketua Panitia', 'Tim Soal', 'Pengawas', 'Penguji', 'Pimpinan'];
Router.routes.pengguna = {
  title: 'Pengguna', keys: ['l:pengguna', 'boot'],
  render() {
    const L = useList('pengguna', null, 30); if (!L) return `<div class="stack">${pageHead('Pengguna')}<div class="skel" style="height:280px"></div></div>`;
    return `<div class="stack">${pageHead('Pengguna Petugas', 'Akun panitia, pengawas, penguji, dan pimpinan. Peserta dikelola di menu Data Peserta.', `<button class="btn pri" data-act="userForm">${ic('plus')} Pengguna</button>`)}
      <div class="card">${Table.html('us', { rows: L.rows, searchKeys: ['nama', 'username', 'peran'], cols: [{ k: 'nama', label: 'Nama', fmt: v => `<b>${esc(v)}</b>` }, { k: 'username', label: 'Username', cls: 'mono' }, { k: 'peran', label: 'Peran', fmt: (v, r) => esc(v) + (v === 'Penguji' ? ` <span class="sm muted">(${esc(r.komponen || 'Keduanya')})</span>` : '') }, { k: 'aktif', label: 'Status', fmt: v => v === false || v === 'false' ? badge('Nonaktif', 'err') : badge('Aktif', 'ok') }, { k: 'loginTerakhir', label: 'Login terakhir', fmt: v => v ? tglJam(v) : '–' }],
        actions: r => `<button class="btn sm ghost" data-act="userForm" data-id="${r.id}">${ic('edit', 'sm')}</button><button class="btn sm ghost" data-act="entHapus" data-e="pengguna" data-id="${r.id}" data-n="pengguna ${esc(r.nama)}">${ic('trash', 'sm')}</button>` })}</div></div>`;
  }
};
Actions.userForm = el => {
  const L = D.peek('l:pengguna'), r = el.dataset.id ? L.rows.find(x => x.id === el.dataset.id) : { peran: 'Pengawas', aktif: true, komponen: 'Keduanya' }; const b = boot();
  formModal({ title: r.id ? 'Ubah Pengguna' : 'Tambah Pengguna', row: r, fields: [{ name: 'nama', label: 'Nama lengkap', req: 1 }, { name: 'username', label: 'Username', req: 1, hint: 'Huruf kecil tanpa spasi.' }, { name: 'peran', label: 'Peran', type: 'select', options: PERAN_STAF }, { name: 'komponen', label: 'Komponen (khusus Penguji)', type: 'select', options: ['Keduanya', 'Praktik', 'Wawancara'] }, { name: 'ruang', label: 'Ruang (khusus Pengawas)', type: 'select', placeholder: '(sesuai penunjukan di Ruang)', options: b.ruang.map(x => [x.id, x.nama]) }, { name: 'password', label: r.id ? 'Kata sandi baru (kosongkan bila tidak diganti)' : 'Kata sandi awal', type: 'password', req: !r.id, hint: 'Min. 8 karakter, huruf & angka. Pengguna wajib menggantinya saat masuk pertama.' }, { name: 'aktif', type: 'checkbox', label: 'Akun aktif', def: true }],
    onSave: async v => { const row = Object.assign({}, r.id ? { id: r.id } : {}, v); if (!row.password) delete row.password; await aksi('crudSave', { entitas: 'pengguna', row }, { ok: 'Pengguna disimpan.' }); await D.refresh('l:pengguna', 'crudList', { entitas: 'pengguna' }); D.refresh('boot', 'adminBootstrap', {}); } });
};

/* ================= PENGATURAN ================= */
const cfgInp = (c, k, label, o) => Form.fields([Object.assign({ name: k, label, def: c[k] }, o || {})]);
async function simpanCfg(form, ket) {
  const v = Form.read(form); Object.keys(v).forEach(k => { if (typeof v[k] === 'boolean') v[k] = String(v[k]); });
  await aksi('konfigSimpan', { values: v, alasan: ket || '' }, { ok: 'Pengaturan disimpan.' }); await D.refresh('boot', 'adminBootstrap', {}); D.put('info', Object.assign({}, D.peek('info') || {}, {}));
}
Router.routes.pengaturan = {
  title: 'Pengaturan', keys: ['boot', 'l:log', 'l:tandatangan'], refreshWhileTyping: false,
  render(ctx) {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 60 }); if (!b) return skelStaf();
    const tab = ctx.args[0] || 'identitas', c = b.config, sa = Session.user.peran === 'Super Admin';
    const tabs = [['identitas', 'Identitas'], ['aturan', 'Aturan Nilai'], ['jadwal', 'Jadwal'], ['ttd', 'Tanda Tangan'], ['pengumuman', 'Pengumuman'], ['keamanan', 'Keamanan'], ['koneksi', 'Sistem & Data'], ...(sa ? [['log', 'Log Audit']] : [])];
    const kunci = b.terkunci;
    let isi = '';
    if (tab === 'identitas') isi = `<form class="cfg">${[['NAMA_INSTANSI', 'Nama panitia/instansi'], ['PEMERINTAH', 'Baris atas kop (Pemerintah)'], ['KECAMATAN', 'Kecamatan'], ['ALAMAT', 'Alamat sekretariat'], ['KONTAK', 'Kontak'], ['PANITIA_NAMA', 'Nama panitia pada tanda tangan'], ['FRONTEND_URL', 'URL aplikasi (untuk QR verifikasi)']].map(([k, l]) => cfgInp(c, k, l, k === 'FRONTEND_URL' ? { placeholder: 'https://username.github.io/ujianku-pro/' } : {})).join('')}<button class="btn pri" type="submit">${ic('save')} Simpan</button></form>`;
    if (tab === 'aturan') isi = `${kunci ? `<div class="alert mb">${ic('lock')}<div>Bobot, ambang batas, dan durasi <b>terkunci</b> karena ujian sudah dimulai.</div></div>` : ''}<form class="cfg"><div class="grid3">${[['BOBOT_NT', 'Bobot Tertulis (%)'], ['BOBOT_NK', 'Bobot Praktik (%)'], ['BOBOT_NW', 'Bobot Wawancara (%)'], ['AMBANG_NT', 'Batas Tertulis'], ['AMBANG_NK', 'Batas Praktik'], ['AMBANG_NW', 'Batas Wawancara']].map(([k, l]) => cfgInp(c, k, l, { type: 'number', min: 0, max: 100, dis: kunci })).join('')}</div><div class="grid2">${cfgInp(c, 'DURASI_MENIT', 'Durasi tes tertulis (menit)', { type: 'number', min: 10, dis: kunci })}${cfgInp(c, 'CADANGAN_JUMLAH', 'Jumlah cadangan per formasi', { type: 'number', min: 0 })}${cfgInp(c, 'PENALTI_SALAH', 'Pengurangan per jawaban salah', { type: 'number', min: 0, step: '0.01', dis: kunci })}${cfgInp(c, 'PAKET_MODE', 'Pembagian paket soal', { type: 'select', options: [['ruang', 'Per ruang'], ['peserta', 'Per peserta']] })}</div><div class="grid2">${Form.fields([{ name: 'TAMPIL_NILAI', type: 'checkbox', label: 'Tampilkan nilai kepada peserta', def: c.TAMPIL_NILAI }, { name: 'TAMPIL_PERINGKAT', type: 'checkbox', label: 'Tampilkan peringkat kepada peserta (setelah final)', def: c.TAMPIL_PERINGKAT }])}</div><button class="btn pri" type="submit">${ic('save')} Simpan</button></form>`;
    if (tab === 'jadwal') isi = `<form class="cfg">${cfgInp(c, 'JADWAL_PRAKTIK', 'Jadwal praktik (tampil di dasbor peserta)', { type: 'textarea' })}${cfgInp(c, 'JADWAL_WAWANCARA', 'Jadwal wawancara', { type: 'textarea' })}<button class="btn pri" type="submit">${ic('save')} Simpan</button></form>`;
    if (tab === 'keamanan') isi = `<form class="cfg"><div class="grid2">${[['MAKS_PIN_GAGAL', 'Batas percobaan PIN salah'], ['DURASI_KUNCI_MENIT', 'Lama kunci sementara (menit)'], ['PIN_BERLAKU_JAM', 'Masa berlaku PIN baru (jam)']].map(([k, l]) => cfgInp(c, k, l, { type: 'number', min: 1 })).join('')}</div><button class="btn pri" type="submit">${ic('save')} Simpan</button></form>`;
    if (tab === 'ttd') { const rows = (b.tandatangan || []).slice().sort((a, x) => a.urut - x.urut); isi = `<div class="row sp mb"><div class="muted">Pejabat penanda tangan (urutan 1–6 → penanda <span class="mono">{{NAMA_PEJABAT_1}}</span> dst. pada template).</div><button class="btn pri" data-act="ttdForm">${ic('plus')} Pejabat</button></div>` + Table.html('tt', { rows, search: false, cols: [{ k: 'urut', label: '#', num: true }, { k: 'pihak', label: 'Pihak' }, { k: 'nama', label: 'Nama' }, { k: 'jabatan', label: 'Jabatan' }], actions: r => `<button class="btn sm ghost" data-act="ttdForm" data-id="${r.id}">${ic('edit', 'sm')}</button><button class="btn sm ghost" data-act="entHapus" data-e="tandatangan" data-id="${r.id}" data-n="pejabat">${ic('trash', 'sm')}</button>` }); }
    if (tab === 'pengumuman') isi = `<div class="row sp mb"><div class="muted">Pengumuman tampil pada dasbor peserta.</div><button class="btn pri" data-act="pgmForm">${ic('plus')} Pengumuman</button></div>` + Table.html('pg', { rows: (b.pengumuman || []).slice().reverse(), search: false, cols: [{ k: 'judul', label: 'Judul' }, { k: 'isi', label: 'Isi', fmt: v => esc(String(v || '').slice(0, 90)) }, { k: 'aktif', label: 'Status', fmt: v => v === false ? badge('Nonaktif') : badge('Aktif', 'ok') }], actions: r => `<button class="btn sm ghost" data-act="pgmForm" data-id="${r.id}">${ic('edit', 'sm')}</button><button class="btn sm ghost" data-act="entHapus" data-e="pengumuman" data-id="${r.id}" data-n="pengumuman">${ic('trash', 'sm')}</button>` });
    if (tab === 'koneksi') isi = `<div class="stack"><div class="card"><div class="card-h"><h3>Status Sistem</h3></div><table class="tbl" style="min-width:0"><tbody><tr><td class="muted">Mode aplikasi</td><td>${badge(c.MODE_APLIKASI, c.MODE_APLIKASI === 'DEMO' ? 'warn' : 'ok')}</td></tr><tr><td class="muted">URL backend</td><td class="mono sm" style="word-break:break-all">${esc(Api.url())}</td></tr><tr><td class="muted">Latensi terakhir</td><td class="mono">${(() => { const p = Perf.log.slice(-5); return p.length ? Math.round(p.reduce((a, x) => a + x.total, 0) / p.length) + ' ms (rata-rata ' + p.length + ' panggilan)' : '–'; })()}</td></tr></tbody></table></div>
      <div class="card"><div class="card-h"><h3>Reset dari Backend (Apps Script)</h3></div><p class="muted mb">Operasi berisiko tidak disediakan di antarmuka web. Jalankan dari editor Apps Script (menu Run):</p>
      ${[['resetDataDummy()', 'Hapus data contoh/dummy lalu isi ulang data demo'], ['hapusDataDummy()', 'Hapus data demo saja (kosongkan peserta, soal, hasil contoh)'], ['aktifkanModeProduksi()', 'Beralih ke MODE PRODUKSI: bersihkan data demo & akun demo'], ['kembaliKeModeDemo()', 'Kembali ke mode demo'], ['resetPasswordSuperAdmin()', 'Reset sandi Super Admin (isi Script Property SUPERADMIN_PASSWORD_BARU lebih dulu)'], ['tampilkanInfoSetup()', 'Tampilkan URL & status setup di log'], ['siapkanTemplateDokumen()', 'Buat ulang template dokumen bawaan di Google Docs']].map(([f, d]) => `<div class="row mb"><code class="mono" style="min-width:250px;background:var(--surface-low);padding:.25rem .5rem;border-radius:6px">${f}</code><span class="muted sm">${d}</span></div>`).join('')}</div></div>`;
    if (tab === 'log') { const L = D.use('l:log', 'logList', { limit: 300 }, { ttl: 20 }); isi = !L ? '<div class="skel" style="height:240px"></div>' : Table.html('lg', { rows: L.rows, pageSize: 30, searchKeys: ['aksi', 'pengguna', 'objek', 'alasan'], cols: [{ k: 'waktu', label: 'Waktu', fmt: v => `<span class="mono sm">${tglJam(v)}</span>` }, { k: 'pengguna', label: 'Oleh' }, { k: 'aksi', label: 'Aksi', fmt: v => badge(v, 'info') }, { k: 'objek', label: 'Objek', cls: 'mono sm' }, { k: 'nilaiLama', label: 'Dari', fmt: v => esc(String(v || '').slice(0, 40)) }, { k: 'nilaiBaru', label: 'Ke', fmt: v => esc(String(v || '').slice(0, 40)) }, { k: 'alasan', label: 'Alasan' }] }); }
    return `<div class="stack">${pageHead('Pengaturan', 'Identitas, aturan penilaian, tanda tangan, pengumuman, dan sistem.')}<div class="tabs">${tabs.map(([i, n]) => `<button class="${tab === i ? 'on' : ''}" data-act="tab" data-to="pengaturan/${i}">${n}</button>`).join('')}</div><div class="card" style="max-width:${['log', 'ttd', 'pengumuman'].includes(tab) ? 'none' : '820px'}">${isi}</div></div>`;
  },
  mount() { $$('form.cfg').forEach(f => f.onsubmit = async e => { e.preventDefault(); const btn = $('button[type=submit]', f); btn.disabled = true; try { await simpanCfg(f); } catch (er) { } btn.disabled = false; }); }
};
Actions.ttdForm = el => { const r = el.dataset.id ? boot().tandatangan.find(x => x.id === el.dataset.id) : { urut: (boot().tandatangan || []).length + 1 };
  formModal({ title: r.id ? 'Ubah Pejabat' : 'Tambah Pejabat', row: r, fields: [{ name: 'urut', label: 'Urutan (1–6)', type: 'number', min: 1, max: 6 }, { name: 'pihak', label: 'Pihak', req: 1, placeholder: 'Ketua Panitia' }, { name: 'nama', label: 'Nama', req: 1 }, { name: 'jabatan', label: 'Jabatan / NIP' }], onSave: v => simpanEntitas('tandatangan', Object.assign({}, r.id ? { id: r.id } : {}, v, { urut: Number(v.urut) || 1 })) }); };
Actions.pgmForm = el => { const r = el.dataset.id ? boot().pengumuman.find(x => x.id === el.dataset.id) : { aktif: true };
  formModal({ title: r.id ? 'Ubah Pengumuman' : 'Tambah Pengumuman', row: r, fields: [{ name: 'judul', label: 'Judul', req: 1 }, { name: 'isi', label: 'Isi', type: 'textarea', rows: 4 }, { name: 'aktif', type: 'checkbox', label: 'Tampilkan kepada peserta', def: true }], onSave: v => simpanEntitas('pengumuman', Object.assign({}, r.id ? { id: r.id } : {}, v)) }); };
