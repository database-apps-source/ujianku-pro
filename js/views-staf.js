/* views-staf.js — dasbor per peran, kegiatan/formasi/subtes, peserta, ruang & sesi, monitoring */
'use strict';
const BOOTKEY = { kegiatan: 'kegiatan', formasi: 'formasi', ruang: 'ruang', sesi: 'sesi', subtes: 'subtes', pengumuman: 'pengumuman', tandatangan: 'tandatangan' };
const adm = () => Session.user && Session.user.kind === 's';
const skelStaf = () => `<div class="stack"><div class="skel" style="height:56px"></div><div class="kpis">${'<div class="skel" style="height:96px"></div>'.repeat(4)}</div><div class="skel" style="height:240px"></div></div>`;
const bisaTulis = (...p) => p.includes(Session.user.peran);
const listKey = (e, extra) => 'l:' + e + (extra || '');
const useList = (e, extra, ttl) => D.use(listKey(e, extra), 'crudList', Object.assign({ entitas: e }, extra || {}), { ttl: ttl == null ? 30 : ttl });

/** Simpan entitas dengan UI optimistis: tampil seketika, rollback bila server menolak. */
async function simpanEntitas(ent, row, listKeys) {
  const bk = BOOTKEY[ent], baru = !row.id, tmp = baru ? 'tmp-' + uuid() : row.id;
  const keys = bk ? ['boot'] : (listKeys || [listKey(ent)]);
  const snap = keys.map(k => [k, JSON.stringify(D.peek(k))]);
  const terap = (v, rowBaru, idLama) => { const arr = bk ? v[bk] : v.rows; if (!arr) return; const i = arr.findIndex(x => x.id === idLama); if (i >= 0) arr[i] = Object.assign({}, arr[i], rowBaru); else arr.push(rowBaru); };
  keys.forEach(k => D.patch(k, v => terap(v, Object.assign({}, row, { id: tmp }), tmp)));
  try {
    const r = await aksi('crudSave', { entitas: ent, row });
    keys.forEach(k => D.patch(k, v => terap(v, r.row, tmp)));
    if (bk) { D.invalidate('boot'); } return r.row;
  } catch (e) { snap.forEach(([k, s]) => { if (s && s !== 'null') D.put(k, JSON.parse(s)); }); Router.refresh(); throw e; }
}
async function hapusEntitas(ent, id, nama, alasan) {
  const bk = BOOTKEY[ent], key = bk ? 'boot' : listKey(ent), snap = JSON.stringify(D.peek(key));
  D.patch(key, v => { const a = bk ? v[bk] : v.rows; const i = a.findIndex(x => x.id === id); if (i >= 0) a.splice(i, 1); });
  try { await aksi('crudHapus', { entitas: ent, id, alasan }, { ok: (nama || 'Data') + ' dihapus.' }); }
  catch (e) { D.put(key, JSON.parse(snap)); Router.refresh(); throw e; }
}
const konfHapus = (ent, id, nama) => Modal.confirm({ title: 'Hapus ' + nama + '?', msg: 'Tindakan ini tidak dapat dibatalkan.', danger: true, okText: 'Hapus', reason: true, reasonPh: 'Alasan penghapusan' }).then(r => r.ok && hapusEntitas(ent, id, nama, r.reason));

/** Modal form generik untuk CRUD */
function formModal(o) {
  const ov = Modal.open({ title: o.title, size: o.size, persist: true, body: `<form id="fm" novalidate>${o.html || Form.fields(o.fields, o.row)}<div class="errtxt hidden" id="fm-err"></div></form>`, footer: `<button class="btn ghost" data-act="modalClose">Batal</button><button class="btn pri" id="fm-ok">${ic('save')} Simpan</button>`, onMount: ov => o.onMount && o.onMount(ov) });
  const kirim = async () => {
    const v = Form.read($('#fm', ov)); const bad = (o.fields || []).find(f => f.req && !String(v[f.name] == null ? '' : v[f.name]).trim());
    const er = $('#fm-err', ov); er.classList.add('hidden');
    if (bad) { er.textContent = bad.label + ' wajib diisi.'; er.classList.remove('hidden'); return; }
    const b = $('#fm-ok', ov); b.disabled = true;
    try { await o.onSave(v, ov); Modal.close(ov); } catch (e) { er.textContent = e.message; er.classList.remove('hidden'); b.disabled = false; }
  };
  $('#fm-ok', ov).onclick = kirim; $('#fm', ov).onsubmit = e => { e.preventDefault(); kirim(); };
  return ov;
}

/* ================= DASBOR STAF ================= */
const kpi = (k, v, s, i) => `<div class="kpi"><div class="row sp"><div class="k">${k}</div>${i ? `<div class="ico">${ic(i)}</div>` : ''}</div><div class="v mono">${v}</div><div class="s">${s || ''}</div></div>`;
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const progres = (a, b, cls) => `<div class="bar ${cls || ''}"><i style="width:${pct(a, b)}%"></i></div>`;

Router.routes.dashStaf = {
  render() {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 20 }); if (!b) return skelStaf();
    const u = Session.user, st = b.stats, kg = kegAktif();
    const sapa = `<div class="page-h"><div><div class="crumb">${ic('landmark', 'sm')} ${esc(u.peran)}</div><h1>Selamat datang, ${esc(u.nama.split(' ').filter(x => !/\.$|^H$/.test(x))[0] || u.nama)}</h1><p class="muted">${kg ? esc(kg.nama) : 'Belum ada kegiatan aktif'}${b.config.MODE_APLIKASI === 'DEMO' ? ' · ' + badge('MODE DEMO', 'warn') : ''}</p></div><button class="btn ghost" data-act="refreshData">${ic('refresh')} Segarkan</button></div>`;
    if (u.peran === 'Penguji') {
      const r = b.ringkasPenguji || {};
      return `<div class="stack">${sapa}<div class="kpis">${kpi('Peserta Ditugaskan', r.ditugaskan || 0, 'komponen: ' + esc(u.komponen || '-'), 'users')}${kpi('Draf', r.draf || 0, 'belum difinalkan', 'edit')}${kpi('Final', r.final || 0, 'sudah dikunci', 'checkc')}</div><div class="card"><a class="btn pri lg" href="#/penilaian">${ic('edit')} Mulai Menilai</a></div></div>`;
    }
    if (u.peran === 'Tim Soal') {
      const r = b.ringkasanSoal || { perSubtes: [], paket: [] };
      return `<div class="stack">${sapa}<div class="card"><div class="card-h"><h3>Kecukupan Bank Soal</h3><a class="btn sm pri" href="#/soal">${ic('book', 'sm')} Kelola Soal</a></div>${r.perSubtes.map(s => `<div class="mb"><div class="row sp"><span>${esc(s.nama)}</span><span class="mono sm ${s.ada >= s.butuh ? '' : 'muted'}">${s.ada} / butuh ${s.butuh} ${s.ada >= s.butuh ? '✓' : ''}</span></div>${progres(Math.min(s.ada, s.butuh), s.butuh, s.ada >= s.butuh ? 'ok' : 'warn')}</div>`).join('') || '<div class="empty">Belum ada subtes.</div>'}</div></div>`;
    }
    if (!st) return `<div class="stack">${sapa}<div class="empty">${ic('inbox')}<div>Belum ada data statistik.</div></div></div>`;
    const siap = [['Kegiatan aktif', !!kg, 'kegiatan'], ['Formasi', b.formasi.some(f => f.idKegiatan === b.kegiatanAktif), 'kegiatan'], ['Subtes', b.subtes.length > 0, 'kegiatan'], ['Peserta', st.total > 0, 'peserta'], ['Ruang & sesi', b.ruang.length > 0 && b.sesi.length > 0, 'ruang']];
    const pj = (b.ringkasanSoal && b.ringkasanSoal.paket.length) ? 1 : 0;
    const kesiapan = (u.peran === 'Super Admin' || u.peran === 'Ketua Panitia') ? `<div class="card"><div class="card-h"><h3>Kesiapan Pelaksanaan</h3></div>${siap.map(([n, ok, r]) => `<div class="row sp mb"><span class="row gap-s">${ic(ok ? 'checkc' : 'alert', 'sm')} ${n}</span>${ok ? badge('Siap', 'ok') : `<a href="#/${r}" class="btn sm ghost">Lengkapi</a>`}</div>`).join('')}</div>` : '';
    const maxBin = Math.max(1, ...st.distribusi);
    return `<div class="stack">${sapa}
      <div class="kpis">${kpi('Total Peserta', st.total, `${st.hadir} hadir · ${st.belumHadir} belum`, 'users')}${kpi('Sedang Mengerjakan', st.mengerjakan, 'ujian CAT berjalan', 'laptop')}${kpi('Selesai CAT', st.selesai, `${pct(st.selesai, st.total)}% dari peserta`, 'checkc')}${kpi('Rata-rata NT', fmtN(st.rataNT), `tertinggi ${fmtN(st.maksNT)} · lolos ${st.lolosNT}`, 'award')}${kpi('Praktik Final', st.praktikFinal, `dari ${st.total}`, 'edit')}${kpi('Wawancara Final', st.wawancaraFinal, `dari ${st.total}`, 'headset')}</div>
      <div class="cols"><div class="stack">
        <div class="card"><div class="card-h"><h3>Sebaran Nilai Tes Tertulis</h3><span class="muted sm">${st.selesai} peserta</span></div><div class="chartwrap">${Chart.bars(st.distribusi, ['0–9', '10–19', '20–29', '30–39', '40–49', '50–59', '60–69', '70–79', '80–89', '90–100'], { max: maxBin, aria: 'Sebaran nilai', colors: st.distribusi.map((_, i) => i >= 6 ? '#0a7f55' : '#1d4ed7') }).replace(/>\s*(\d+)<\/text>/g, '>$1</text>')}</div></div>
        <div class="card"><div class="card-h"><h3>Progres per Ruang</h3>${bisaTulis('Super Admin', 'Ketua Panitia', 'Pengawas') ? `<a class="btn sm ghost" href="#/monitoring">${ic('laptop', 'sm')} Monitoring</a>` : ''}</div>${st.perRuang.map(r => `<div class="mb"><div class="row sp"><b>${esc(r.nama)}</b><span class="mono sm muted">${r.selesai} selesai · ${r.sedang} berjalan · ${r.absen} absen / ${r.total}</span></div>${progres(r.selesai, r.total, 'ok')}</div>`).join('') || '<div class="empty">Belum ada ruang.</div>'}</div>
        <div class="card"><div class="card-h"><h3>Per Formasi</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Jabatan</th><th>Desa</th><th class="num">Kuota</th><th class="num">Peserta</th><th class="num">Selesai</th><th class="num">NT ≥ batas</th></tr></thead><tbody>${st.perFormasi.map(f => `<tr><td>${esc(f.jabatan)}</td><td>${esc(f.desa)}</td><td class="num">${f.kuota || '–'}</td><td class="num">${f.total}</td><td class="num">${f.selesai}</td><td class="num">${f.atas}</td></tr>`).join('')}</tbody></table></div></div></div>
        <div class="stack">${kesiapan}<div class="card"><div class="card-h"><h3>Pengumuman</h3>${bisaTulis('Super Admin', 'Ketua Panitia') ? `<a class="btn sm ghost" href="#/pengaturan/pengumuman">Kelola</a>` : ''}</div>${(b.pengumuman || []).filter(x => x.aktif).slice(-3).reverse().map(x => `<div class="mb"><b>${esc(x.judul)}</b><div class="sm muted">${esc(x.isi || '')}</div></div>`).join('') || '<div class="muted sm">Belum ada pengumuman.</div>'}</div></div></div></div>`;
  },
  mount() { Poll.start(() => D.refresh('boot', 'adminBootstrap', {}), 25000); }, cleanup() { Poll.stop(); }
};

/* ================= KEGIATAN / FORMASI / SUBTES ================= */
Router.routes.kegiatan = {
  title: 'Kegiatan & Formasi', keys: ['boot'],
  render(ctx) {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 60 }); if (!b) return skelStaf();
    const tab = ctx.args[0] || 'kegiatan', t = (id, n) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-to="kegiatan/${id}">${n}</button>`;
    const kid = b.kegiatanAktif, fm = mapBy(b.formasi), canW = bisaTulis('Super Admin', 'Ketua Panitia');
    let isi = '';
    if (tab === 'kegiatan') isi = Table.html('kg', { rows: b.kegiatan.map(k => Object.assign({ aktif: k.id === kid }, k)), cols: [{ k: 'nama', label: 'Nama Kegiatan' }, { k: 'jenis', label: 'Jenis' }, { k: 'tahun', label: 'Tahun' }, { k: 'lokasi', label: 'Lokasi' }, { k: 'status', label: 'Status', fmt: (v, r) => sBadge(v) + (r.aktif ? ' ' + badge('Aktif', 'info') : '') }], toolbar: canW ? `<button class="btn pri" data-act="kgForm">${ic('plus')} Kegiatan</button>` : '', actions: canW ? r => `${r.aktif ? '' : `<button class="btn sm ghost" data-act="kgAktif" data-id="${r.id}">Jadikan aktif</button>`}<button class="btn sm ghost" data-act="kgForm" data-id="${r.id}">${ic('edit', 'sm')}</button><button class="btn sm ghost" data-act="entHapus" data-e="kegiatan" data-id="${r.id}" data-n="kegiatan">${ic('trash', 'sm')}</button>` : null });
    if (tab === 'formasi') isi = Table.html('fm', { rows: b.formasi.filter(f => f.idKegiatan === kid), cols: [{ k: 'jabatan', label: 'Jabatan' }, { k: 'desa', label: 'Desa' }, { k: 'kuota', label: 'Kuota', num: true }], toolbar: canW ? `<button class="btn pri" data-act="fmForm">${ic('plus')} Formasi</button>` : '', actions: canW ? r => `<button class="btn sm ghost" data-act="fmForm" data-id="${r.id}">${ic('edit', 'sm')}</button><button class="btn sm ghost" data-act="entHapus" data-e="formasi" data-id="${r.id}" data-n="formasi">${ic('trash', 'sm')}</button>` : null });
    if (tab === 'subtes') { const rows = b.subtes.filter(s => s.idKegiatan === kid).sort((a, c) => a.urutan - c.urutan); const tot = rows.reduce((a, s) => a + Number(s.jumlah || 0), 0); isi = `<div class="alert info mb">${ic('info')}<div>Total <b>${tot}</b> soal dalam ${rows.length} subtes · waktu ${b.config.DURASI_MENIT} menit. ${b.terkunci ? '<b>Terkunci:</b> ujian sudah dimulai.' : ''}</div></div>` + Table.html('sb', { rows, search: false, pageSize: 50, cols: [{ k: 'urutan', label: '#', num: true }, { k: 'nama', label: 'Subtes' }, { k: 'jumlah', label: 'Jumlah Soal', num: true }], toolbar: '', actions: canW ? r => `<button class="btn sm ghost" data-act="sbForm" data-id="${r.id}">${ic('edit', 'sm')}</button>` : null }); }
    return `<div class="stack">${pageHead('Kegiatan & Formasi', 'Atur kegiatan seleksi, formasi jabatan, dan struktur subtes.')}<div class="tabs">${t('kegiatan', 'Kegiatan')}${t('formasi', 'Formasi')}${t('subtes', 'Subtes')}</div><div class="card">${isi}</div></div>`;
  }
};
Actions.tab = el => Router.go(el.dataset.to);
Actions.entHapus = el => konfHapus(el.dataset.e, el.dataset.id, el.dataset.n);
Actions.kgAktif = async el => { const b = boot(); const r = await Modal.confirm({ title: 'Jadikan kegiatan aktif?', msg: 'Seluruh dasbor, peserta, dan dokumen akan mengacu pada kegiatan ini.' }); if (!r.ok) return; await aksi('konfigSimpan', { values: { KEGIATAN_AKTIF: el.dataset.id } }, { ok: 'Kegiatan aktif diganti.' }); await D.refresh('boot', 'adminBootstrap', {}); D.invalidate('l:'); };
Actions.kgForm = el => { const r = el.dataset.id ? boot().kegiatan.find(x => x.id === el.dataset.id) : { tahun: new Date().getFullYear(), jenis: 'Seleksi', status: 'Draf' };
  formModal({ title: r.id ? 'Ubah Kegiatan' : 'Tambah Kegiatan', row: r, fields: [{ name: 'nama', label: 'Nama kegiatan', req: 1 }, { name: 'jenis', label: 'Jenis', type: 'select', options: [['Seleksi', 'Seleksi (ada kuota & peringkat)'], ['Kompetensi', 'Ujian Kompetensi (lulus/tidak)']] }, { name: 'tahun', label: 'Tahun', type: 'number' }, { name: 'lokasi', label: 'Lokasi' }, { name: 'status', label: 'Status', type: 'select', options: ['Draf', 'Berjalan', 'Selesai'] }], onSave: v => simpanEntitas('kegiatan', Object.assign({}, r.id ? { id: r.id } : {}, v, { tahun: Number(v.tahun) })) }); };
Actions.fmForm = el => { const r = el.dataset.id ? boot().formasi.find(x => x.id === el.dataset.id) : {}; const kid = boot().kegiatanAktif;
  formModal({ title: r.id ? 'Ubah Formasi' : 'Tambah Formasi', row: r, fields: [{ name: 'jabatan', label: 'Jabatan', req: 1, placeholder: 'Contoh: Kepala Seksi Pemerintahan' }, { name: 'desa', label: 'Desa', placeholder: 'Nama desa' }, { name: 'kuota', label: 'Kuota (formasi seleksi)', type: 'number', min: 0 }], onSave: v => simpanEntitas('formasi', Object.assign({}, r.id ? { id: r.id } : { idKegiatan: kid }, v, { kuota: Number(v.kuota) || 0 })) }); };
Actions.sbForm = el => { const r = boot().subtes.find(x => x.id === el.dataset.id);
  formModal({ title: 'Ubah Subtes', row: r, fields: [{ name: 'nama', label: 'Nama subtes', req: 1 }, { name: 'urutan', label: 'Urutan', type: 'number' }, { name: 'jumlah', label: 'Jumlah soal', type: 'number', min: 1, dis: boot().terkunci, hint: boot().terkunci ? 'Terkunci karena ujian sudah dimulai.' : '' }], onSave: v => simpanEntitas('subtes', Object.assign({ id: r.id }, v, { urutan: Number(v.urutan), jumlah: Number(v.jumlah || r.jumlah) })) }); };

/* ================= PESERTA ================= */
Router.routes.peserta = {
  title: 'Data Peserta', keys: ['boot', 'l:peserta'],
  render() {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 60 }); const L = useList('peserta', null, 20); if (!b) return skelStaf();
    if (!L) return `<div class="stack">${pageHead('Data Peserta')}<div class="skel" style="height:300px"></div></div>`;
    const fm = mapBy(b.formasi), rg = mapBy(b.ruang), ss = mapBy(b.sesi), canW = bisaTulis('Super Admin', 'Ketua Panitia');
    const rows = L.rows.map(p => Object.assign({}, p, { jab: (fm[p.idFormasi] || {}).jabatan || '–', desa: (fm[p.idFormasi] || {}).desa || '', rng: (rg[p.idRuang] || {}).nama || '–', sesiN: (ss[p.idSesi] || {}).nama || '–' }));
    const st = TS.ps || (TS.ps = { q: '', page: 1 });
    const tombol = canW ? `<button class="btn pri" data-act="psForm">${ic('plus')} Peserta</button><button class="btn ghost" data-act="psImport">${ic('upload')} Impor</button><button class="btn ghost" data-act="psDistribusi">${ic('swap')} Distribusi Ruang</button>` : '';
    return `<div class="stack">${pageHead('Data Peserta', `${rows.length} peserta terdaftar. NIK disamarkan untuk melindungi data pribadi.`, `<button class="btn ghost" data-act="psCsv">${ic('download')} CSV</button>`)}
      <div class="card">${Table.html('ps', { rows, searchKeys: ['nomor', 'nama', 'jab', 'desa', 'rng'], searchPh: 'Cari nomor, nama, formasi, ruang…', toolbar: tombol, cols: [{ k: 'nomor', label: 'Nomor', cls: 'mono' }, { k: 'nama', label: 'Nama', fmt: v => `<b>${esc(v)}</b>` }, { k: 'nik', label: 'NIK', cls: 'mono' }, { k: 'jab', label: 'Formasi', fmt: (v, r) => esc(v) + `<div class="sm muted">${esc(r.desa)}</div>` }, { k: 'rng', label: 'Ruang / Sesi', fmt: (v, r) => esc(v) + `<div class="sm muted">${esc(r.sesiN)}</div>` }, { k: 'kehadiran', label: 'Hadir', fmt: v => sBadge(v === 'Hadir' ? 'Hadir' : v === 'Tidak Hadir' ? 'Tidak Hadir' : 'Belum Hadir') }, { k: 'pinStatus', label: 'PIN', fmt: v => sBadge(v) }], actions: canW ? r => `<button class="btn sm ghost" data-act="psForm" data-id="${r.id}" aria-label="Ubah">${ic('edit', 'sm')}</button><button class="btn sm ghost" data-act="entHapus" data-e="peserta" data-id="${r.id}" data-n="peserta ${esc(r.nama)}" aria-label="Hapus">${ic('trash', 'sm')}</button>` : null })}</div></div>`;
  }
};
Actions.psForm = el => {
  const b = boot(), r = el.dataset.id ? D.peek(listKey('peserta')).rows.find(x => x.id === el.dataset.id) : {};
  formModal({ title: r.id ? 'Ubah Peserta' : 'Tambah Peserta', size: 'lg', row: r, fields: [{ name: 'nomor', label: 'Nomor peserta', req: 1, placeholder: 'P-2026-0001' }, { name: 'nama', label: 'Nama lengkap', req: 1 }, { name: 'nik', label: 'NIK (16 digit)', hint: r.id ? 'Kosongkan/biarkan tersamar bila tidak diubah.' : '' }, { name: 'tempatLahir', label: 'Tempat lahir' }, { name: 'tglLahir', label: 'Tanggal lahir', type: 'date' }, { name: 'idFormasi', label: 'Formasi', req: 1, type: 'select', placeholder: 'Pilih formasi', options: b.formasi.filter(f => f.idKegiatan === b.kegiatanAktif).map(f => [f.id, f.jabatan + ' — ' + f.desa]) }, { name: 'idSesi', label: 'Sesi ujian', type: 'select', placeholder: '(belum ditempatkan)', options: b.sesi.map(s => [s.id, s.nama + ' · ' + tglIndo(s.tanggal) + ' · ' + ((b.ruang.find(x => x.id === s.idRuang) || {}).nama || '')]) }, { name: 'statusBerkas', label: 'Status berkas', type: 'select', options: ['Terverifikasi', 'Belum', 'Tidak Memenuhi Syarat'], def: 'Terverifikasi' }],
    onSave: v => { const row = Object.assign({}, r.id ? { id: r.id } : {}, v); if (r.id && /\*/.test(v.nik)) delete row.nik; const rs = b.sesi.find(x => x.id === v.idSesi); if (rs) row.idRuang = rs.idRuang; return simpanEntitas('peserta', row).then(() => D.refresh(listKey('peserta'), 'crudList', { entitas: 'peserta' })); } });
};
Actions.psCsv = () => { const L = D.peek(listKey('peserta')); if (!L) return; const b = boot(), fm = mapBy(b.formasi), rg = mapBy(b.ruang); csvUnduh('peserta.csv', ['Nomor', 'Nama', 'NIK', 'Tempat Lahir', 'Tanggal Lahir', 'Jabatan', 'Desa', 'Ruang', 'Kehadiran'], L.rows.map(p => [p.nomor, p.nama, p.nik, p.tempatLahir, p.tglLahir, (fm[p.idFormasi] || {}).jabatan, (fm[p.idFormasi] || {}).desa, (rg[p.idRuang] || {}).nama, p.kehadiran])); };

/* Impor CSV/XLSX: urai di browser → dry-run → konfirmasi */
function uraiCsv(teks) {
  const sep = (teks.split('\n')[0].match(/;/g) || []).length > (teks.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < teks.length; i++) { const c = teks[i];
    if (q) { if (c === '"') { if (teks[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === sep) { r.push(f); f = ''; } else if (c === '\n') { r.push(f.replace(/\r$/, '')); rows.push(r); r = []; f = ''; } else f += c; }
  if (f || r.length) { r.push(f.replace(/\r$/, '')); rows.push(r); }
  const h = rows.shift().map(x => x.replace(/^﻿/, '').trim()); return rows.filter(x => x.some(c => String(c).trim())).map(x => { const o = {}; h.forEach((k, i) => o[k] = x[i] == null ? '' : x[i].trim()); return o; });
}
Actions.psImport = () => {
  const ov = Modal.open({ title: 'Impor Peserta', size: 'lg', persist: true, body: `<div class="alert info mb">${ic('info')}<div>Kolom: <b>Nomor, NIK, Nama, Tempat Lahir, Tanggal Lahir, Formasi (atau Jabatan), Desa, Ruang</b>. Format <b>.csv</b> atau <b>.xlsx</b>, maks. 600 baris per unggahan. Sistem memeriksa lebih dulu (tanpa menyimpan).</div>
    <div class="row wrap mb"><input type="file" id="im-file" accept=".csv,.xlsx,.xls" class="inp"><button class="btn ghost" data-act="psTemplate">${ic('download')} Unduh Templat CSV</button></div><div id="im-out"></div>`, footer: `<button class="btn ghost" data-act="modalClose">Tutup</button><button class="btn pri" id="im-go" disabled>${ic('upload')} Simpan yang Valid</button>` });
  let rows = [];
  $('#im-file', ov).onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const out = $('#im-out', ov); out.innerHTML = '<div class="skel" style="height:80px"></div>';
    try {
      if (/\.csv$/i.test(f.name)) rows = uraiCsv(await f.text());
      else { await muatSkrip(XLSX_URL); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true }); }
      const r = await aksi('importPeserta', { rows, dryRun: true }, { silent: true });
      out.innerHTML = `<div class="sumgrid mb"><div class="box"><b>${r.total}</b><span class="sm muted">Baris</span></div><div class="box"><b style="color:var(--ok)">${r.valid}</b><span class="sm muted">Valid</span></div><div class="box"><b style="color:var(--error)">${r.gagal}</b><span class="sm muted">Bermasalah</span></div></div>` + (r.gagal ? `<div class="tbl-wrap" style="max-height:240px;overflow:auto"><table class="tbl"><thead><tr><th>Baris</th><th>Masalah</th></tr></thead><tbody>${r.detail.filter(x => !x.ok).slice(0, 80).map(x => `<tr><td class="mono">${x.baris}</td><td>${esc((x.nama || '') + ' — ' + x.galat)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="alert ok">${ic('checkc')}<div>Semua baris valid.</div></div>`);
      $('#im-go', ov).disabled = !r.valid;
    } catch (er) { out.innerHTML = `<div class="alert err">${ic('alert')}<div>${esc(er.message)}</div></div>`; }
  };
  $('#im-go', ov).onclick = async () => { const b = $('#im-go', ov); b.disabled = true; b.innerHTML = ic('refresh', 'spin') + ' Menyimpan…'; try { const r = await aksi('importPeserta', { rows }, { ok: 'Peserta diimpor.' }); Modal.close(ov); D.refresh(listKey('peserta'), 'crudList', { entitas: 'peserta' }); D.refresh('boot', 'adminBootstrap', {}); } catch (e) { b.disabled = false; b.innerHTML = ic('upload') + ' Simpan yang Valid'; } };
};
Actions.psTemplate = () => csvUnduh('templat-peserta.csv', ['Nomor', 'NIK', 'Nama', 'Tempat Lahir', 'Tanggal Lahir', 'Formasi', 'Desa', 'Ruang'], [['P-2026-0101', '3201010101010001', 'Contoh Nama', 'Bogor', '1990-05-17', 'Kepala Seksi Pemerintahan', 'Sukamaju', 'Ruang 1']]);
Actions.psDistribusi = () => {
  const b = boot();
  const ov = Modal.open({ title: 'Distribusi Peserta ke Ruang & Sesi', persist: true, body: `<p class="muted mb">Peserta dibagi berurutan sesuai nomor dan kapasitas ruang pada tiap sesi.</p><label class="chk"><input type="checkbox" id="ds-ulang"><span>Bagi ulang <b>semua</b> peserta (timpa penempatan yang sudah ada)</span></label>`, footer: `<button class="btn ghost" data-act="modalClose">Batal</button><button class="btn pri" id="ds-go">${ic('swap')} Bagi Otomatis</button>` });
  $('#ds-go', ov).onclick = async () => { try { const r = await aksi('distribusiPeserta', { mode: 'otomatis', ulang: $('#ds-ulang', ov).checked }); Modal.close(ov); Toast.ok(`${r.dibagi} peserta ditempatkan.` + (r.tidakTertampung ? ` ${r.tidakTertampung} tidak tertampung — tambah sesi/kapasitas.` : '')); D.refresh(listKey('peserta'), 'crudList', { entitas: 'peserta' }); } catch (e) { } };
};

/* ================= RUANG & SESI ================= */
Router.routes.ruang = {
  title: 'Ruang & Sesi', keys: ['boot'],
  render() {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 60 }); if (!b) return skelStaf();
    const rg = mapBy(b.ruang), staf = mapBy(b.staf || []), canW = bisaTulis('Super Admin', 'Ketua Panitia');
    const sRows = b.sesi.map(s => Object.assign({ rn: (rg[s.idRuang] || {}).nama || '–' }, s)).sort((a, c) => (a.tanggal + a.mulai).localeCompare(c.tanggal + c.mulai));
    return `<div class="stack">${pageHead('Ruang & Sesi', 'Ruang ujian, pengawas, dan jadwal sesi CAT.')}
      <div class="card"><div class="card-h"><h3>Ruang Ujian</h3>${canW ? `<button class="btn pri sm" data-act="rgForm">${ic('plus', 'sm')} Ruang</button>` : ''}</div>${Table.html('rg', { rows: b.ruang, search: false, cols: [{ k: 'nama', label: 'Ruang' }, { k: 'lokasi', label: 'Lokasi' }, { k: 'kapasitas', label: 'Kapasitas', num: true }, { k: 'idPengawas', label: 'Pengawas', fmt: v => esc((staf[v] || {}).nama || '–') }], actions: canW ? r => `<button class="btn sm ghost" data-act="rgForm" data-id="${r.id}">${ic('edit', 'sm')}</button><button class="btn sm ghost" data-act="entHapus" data-e="ruang" data-id="${r.id}" data-n="ruang">${ic('trash', 'sm')}</button>` : null })}</div>
      <div class="card"><div class="card-h"><h3>Sesi Ujian</h3>${canW ? `<button class="btn pri sm" data-act="ssForm">${ic('plus', 'sm')} Sesi</button>` : ''}</div>${Table.html('ss', { rows: sRows, search: false, cols: [{ k: 'nama', label: 'Sesi' }, { k: 'tanggal', label: 'Tanggal', fmt: v => tglIndo(v, true) }, { k: 'mulai', label: 'Waktu', fmt: (v, r) => `<span class="mono">${esc(String(v).slice(0, 5))}–${esc(String(r.selesai).slice(0, 5))}</span>` }, { k: 'rn', label: 'Ruang' }, { k: 'status', label: 'Status', fmt: v => sBadge(v) }], actions: canW ? r => `<button class="btn sm ghost" data-act="ssForm" data-id="${r.id}">${ic('edit', 'sm')}</button><button class="btn sm ghost" data-act="entHapus" data-e="sesi" data-id="${r.id}" data-n="sesi">${ic('trash', 'sm')}</button>` : null })}</div></div>`;
  }
};
Actions.rgForm = el => { const b = boot(), r = el.dataset.id ? b.ruang.find(x => x.id === el.dataset.id) : {};
  formModal({ title: r.id ? 'Ubah Ruang' : 'Tambah Ruang', row: r, fields: [{ name: 'nama', label: 'Nama ruang', req: 1 }, { name: 'lokasi', label: 'Lokasi / gedung' }, { name: 'kapasitas', label: 'Kapasitas komputer/perangkat', type: 'number', min: 1, def: 20 }, { name: 'idPengawas', label: 'Pengawas ruang', type: 'select', placeholder: '(belum ditunjuk)', options: (b.staf || []).filter(s => s.peran === 'Pengawas').map(s => [s.id, s.nama]) }], onSave: v => simpanEntitas('ruang', Object.assign({}, r.id ? { id: r.id } : {}, v, { kapasitas: Number(v.kapasitas) || 1 })) }); };
Actions.ssForm = el => { const b = boot(), r = el.dataset.id ? b.sesi.find(x => x.id === el.dataset.id) : {};
  formModal({ title: r.id ? 'Ubah Sesi' : 'Tambah Sesi', row: r, fields: [{ name: 'nama', label: 'Nama sesi', req: 1, placeholder: 'Sesi 1 — Pagi' }, { name: 'idRuang', label: 'Ruang', req: 1, type: 'select', placeholder: 'Pilih ruang', options: b.ruang.map(x => [x.id, x.nama]) }, { name: 'tanggal', label: 'Tanggal', type: 'date', req: 1 }, { name: 'mulai', label: 'Jam mulai', type: 'time', req: 1 }, { name: 'selesai', label: 'Jam selesai', type: 'time', req: 1 }], onSave: v => simpanEntitas('sesi', Object.assign({}, r.id ? { id: r.id } : {}, v)) }); };

/* ================= MONITORING RUANG ================= */
const MON = { idRuang: '', idSesi: '', filter: '', pilih: {} };
Router.routes.monitoring = {
  title: 'Monitoring Ruang', keys: ['boot', 'mon'], refreshWhileTyping: false,
  render() {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 60 }); if (!b) return skelStaf();
    if (adm() && b.ruang.length === 1 && !MON.idRuang) MON.idRuang = b.ruang[0].id;
    const M = D.use('mon', 'monitoring', { idRuang: MON.idRuang, idSesi: MON.idSesi }, { ttl: 4, noPersist: true });
    const rows = (M && M.rows || []).filter(r => !MON.filter || r.status === MON.filter || (MON.filter === 'pelanggaran' && r.pelanggaran > 0) || (MON.filter === 'kunci' && r.pin === 'Dikunci'));
    const all = M ? M.rows : [], c = k => all.filter(r => r.status === k).length;
    const sesiOpt = (M ? M.sesi : b.sesi).filter(s => !MON.idRuang || s.idRuang === MON.idRuang);
    const sesiAktif = sesiOpt.find(s => s.id === MON.idSesi);
    const canW = bisaTulis('Super Admin', 'Ketua Panitia', 'Pengawas');
    const chips = [['', 'Semua', all.length], ['Belum Hadir', 'Belum hadir', all.filter(r => r.status === 'Belum Hadir').length], ['Hadir', 'Hadir', c('Hadir')], ['Berjalan', 'Mengerjakan', c('Berjalan')], ['Selesai', 'Selesai', c('Selesai')], ['pelanggaran', 'Pelanggaran', all.filter(r => r.pelanggaran > 0).length], ['kunci', 'PIN terkunci', all.filter(r => r.pin === 'Dikunci').length]].map(([k, n, v]) => `<button class="subtab ${MON.filter === k ? 'on' : ''}" data-act="monFilter" data-k="${k}">${n} <span class="c">${v}</span></button>`).join('');
    return `<div class="stack">${pageHead('Monitoring Ruang', 'Pantau kehadiran dan progres ujian secara langsung. Diperbarui otomatis tiap beberapa detik.', `<span class="sync ${Api.net.online ? '' : 'off'}">${ic('refresh', 'sm')} live</span>`)}
      <div class="card"><div class="row wrap"><select class="inp" id="mon-r" style="max-width:240px"><option value="">Semua ruang</option>${b.ruang.map(r => `<option value="${r.id}" ${r.id === MON.idRuang ? 'selected' : ''}>${esc(r.nama)}</option>`).join('')}</select>
        <select class="inp" id="mon-s" style="max-width:300px"><option value="">Semua sesi</option>${sesiOpt.map(s => `<option value="${s.id}" ${s.id === MON.idSesi ? 'selected' : ''}>${esc(s.nama)} · ${tglIndo(s.tanggal)}</option>`).join('')}</select>
        ${sesiAktif && canW ? `<span class="row gap-s">${sBadge(sesiAktif.status)}${sesiAktif.status !== 'Berjalan' ? `<button class="btn ok sm" data-act="sesiSet" data-id="${sesiAktif.id}" data-s="Berjalan">${ic('play', 'sm')} Buka Sesi</button>` : `<button class="btn danger sm" data-act="sesiSet" data-id="${sesiAktif.id}" data-s="Selesai">${ic('stop', 'sm')} Tutup Sesi</button>`}</span>` : ''}
        ${canW ? `<button class="btn ghost sm" data-act="monHadirMassal">${ic('checkc', 'sm')} Tandai hadir yang dipilih</button>` : ''}</div></div>
      <div class="subtabs" style="border-radius:12px">${chips}</div>
      ${M ? '' : '<div class="skel" style="height:260px"></div>'}
      <div class="card" ${M ? '' : 'hidden'}><div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:34px"><input type="checkbox" id="mon-all" aria-label="Pilih semua"></th><th>Nomor</th><th>Nama</th><th>Status</th><th class="num">Terjawab</th><th class="num">Sisa</th><th class="num">Pelanggaran</th><th>PIN</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td><input type="checkbox" data-pilih="${r.id}" ${MON.pilih[r.id] ? 'checked' : ''}></td><td class="mono">${esc(r.nomor)}</td><td><b>${esc(r.nama)}</b></td><td>${sBadge(r.status)}</td><td class="num mono">${r.terjawab || '–'}</td><td class="num mono">${r.sisaDetik != null ? hms(r.sisaDetik) : '–'}</td><td class="num">${r.pelanggaran ? badge(r.pelanggaran, 'warn') : '–'}</td><td>${sBadge(r.pin)}</td><td class="right">${canW ? `<div class="row gap-s" style="justify-content:flex-end">${r.kehadiran !== 'Hadir' && !r.idSesiUjian ? `<button class="btn sm ok" data-act="hadir" data-id="${r.id}" data-s="Hadir">Hadir</button><button class="btn sm ghost" data-act="hadir" data-id="${r.id}" data-s="Tidak Hadir">Absen</button>` : ''}<button class="btn sm ghost" data-act="monMenu" data-id="${r.id}" aria-label="Aksi lain">${ic('settings', 'sm')}</button></div>` : ''}</td></tr>`).join('') || `<tr><td colspan="9"><div class="empty">${ic('inbox')}<div>Tidak ada peserta pada filter ini.</div></div></td></tr>`}</tbody></table></div></div></div>`;
  },
  mount() {
    $('#mon-r').onchange = e => { MON.idRuang = e.target.value; MON.idSesi = ''; MON.pilih = {}; D.mem.mon = null; Router.refresh(); D.refresh('mon', 'monitoring', { idRuang: MON.idRuang, idSesi: MON.idSesi }, { noPersist: true }); };
    $('#mon-s').onchange = e => { MON.idSesi = e.target.value; MON.pilih = {}; D.refresh('mon', 'monitoring', { idRuang: MON.idRuang, idSesi: MON.idSesi }, { noPersist: true }); };
    const al = $('#mon-all'); if (al) al.onchange = e => { const M = D.peek('mon'); (M ? M.rows : []).forEach(r => { if (e.target.checked) MON.pilih[r.id] = 1; else delete MON.pilih[r.id]; }); $$('[data-pilih]').forEach(c => c.checked = e.target.checked); };
    $$('[data-pilih]').forEach(c => c.onchange = () => { if (c.checked) MON.pilih[c.dataset.pilih] = 1; else delete MON.pilih[c.dataset.pilih]; });
    Poll.start(() => D.refresh('mon', 'monitoring', { idRuang: MON.idRuang, idSesi: MON.idSesi }, { noPersist: true }), 5000);
  },
  cleanup() { Poll.stop(); }
};
Actions.monFilter = el => { MON.filter = el.dataset.k; Router.refresh(); };
const monPatch = (ids, fn) => D.patch('mon', v => v.rows.forEach(r => { if (ids.includes(r.id)) fn(r); }));
Actions.hadir = async el => { const id = el.dataset.id, s = el.dataset.s; monPatch([id], r => { r.kehadiran = s; r.status = s === 'Hadir' ? 'Hadir' : 'Tidak Hadir'; }); try { await aksi('kehadiranSet', { ids: [id], status: s }); } catch (e) { D.refresh('mon', 'monitoring', { idRuang: MON.idRuang, idSesi: MON.idSesi }, { noPersist: true }); } };
Actions.monHadirMassal = async () => { const ids = Object.keys(MON.pilih); if (!ids.length) { Toast.warn('Pilih peserta terlebih dahulu.'); return; } monPatch(ids, r => { if (!r.idSesiUjian) { r.kehadiran = 'Hadir'; r.status = 'Hadir'; } }); MON.pilih = {}; try { await aksi('kehadiranSet', { ids, status: 'Hadir' }, { ok: ids.length + ' peserta ditandai hadir.' }); } catch (e) { D.refresh('mon', 'monitoring', { idRuang: MON.idRuang, idSesi: MON.idSesi }, { noPersist: true }); } };
Actions.sesiSet = async el => { const r = await Modal.confirm({ title: el.dataset.s === 'Berjalan' ? 'Buka sesi ujian?' : 'Tutup sesi ujian?', msg: el.dataset.s === 'Berjalan' ? 'Peserta yang sudah ditandai hadir dapat mulai mengerjakan.' : 'Sesi ditutup. Peserta yang belum mulai tidak dapat memulai.', okText: 'Ya' }); if (!r.ok) return; D.patch('boot', v => { const s = v.sesi.find(x => x.id === el.dataset.id); if (s) s.status = el.dataset.s; }); try { await aksi('sesiKontrol', { id: el.dataset.id, status: el.dataset.s }, { ok: 'Status sesi diperbarui.' }); } catch (e) { D.refresh('boot', 'adminBootstrap', {}); } };
Actions.monMenu = el => {
  const M = D.peek('mon'), r = M.rows.find(x => x.id === el.dataset.id);
  const ov = Modal.open({ title: r.nama, body: `<div class="muted mb mono">${esc(r.nomor)} · ${sBadge(r.status)} · PIN ${sBadge(r.pin)}</div><div class="stack">
    ${r.pin === 'Dikunci' ? `<button class="btn ghost block" data-act="monAksi" data-a="buka" data-id="${r.id}">${ic('unlock')} Buka kunci PIN</button>` : ''}
    <button class="btn ghost block" data-act="monAksi" data-a="pin" data-id="${r.id}">${ic('key')} Buat PIN baru (kartu hilang/lupa)</button>
    ${r.status === 'Berjalan' ? `<button class="btn danger block" data-act="monAksi" data-a="hentikan" data-id="${r.id}">${ic('stop')} Hentikan ujian peserta</button>` : ''}
    ${['Dihentikan', 'Dikunci'].includes(r.status) ? `<button class="btn ok block" data-act="monAksi" data-a="bukaKembali" data-id="${r.id}">${ic('play')} Buka kembali ujian</button>` : ''}
    ${r.kehadiran === 'Hadir' && !r.idSesiUjian ? `<button class="btn ghost block" data-act="hadir" data-id="${r.id}" data-s="Belum">${ic('history')} Batalkan kehadiran</button>` : ''}
    <button class="btn ghost block" data-act="monLog" data-id="${r.id}">${ic('list')} Riwayat kejadian</button></div>` });
};
Actions.monLog = async el => { Modal.closeAll(); const r = await Api.call('kejadianList', { idRuang: MON.idRuang }); const p = D.peek('mon').rows.find(x => x.id === el.dataset.id); const rows = r.rows.filter(x => x.nomor === p.nomor);
  Modal.open({ title: 'Riwayat — ' + p.nama, size: 'lg', body: rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Kejadian</th><th>Keterangan</th><th>Oleh</th></tr></thead><tbody>${rows.map(x => `<tr><td class="mono sm">${tglJam(x.waktu)}</td><td>${esc(x.jenis)}</td><td>${esc(x.keterangan)}</td><td>${esc(x.oleh)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Tidak ada kejadian.</div>' }); };
Actions.monAksi = async el => {
  const id = el.dataset.id, a = el.dataset.a; Modal.closeAll();
  const judul = { buka: 'Buka kunci PIN', pin: 'Buat PIN baru', hentikan: 'Hentikan ujian peserta', bukaKembali: 'Buka kembali ujian' }[a];
  const extra = a === 'bukaKembali' ? `<div class="field"><label class="lbl">Tambahan waktu kompensasi (menit, maks 60)</label><input class="inp" id="cf-tambah" type="number" min="0" max="60" value="0"></div>` : '';
  const r = await Modal.confirm({ title: judul, msg: a === 'hentikan' ? 'Peserta tidak dapat lagi menjawab. Jawaban tersimpan akan dinilai.' : '', extra, reason: true, reasonPh: 'Wajib diisi — tercatat di log audit', danger: a === 'hentikan', okText: 'Proses' }); if (!r.ok) return;
  const tambah = a === 'bukaKembali' ? Number(($('#cf-tambah', r.ov) || { value: 0 }).value) : 0;
  try {
    if (a === 'buka') await aksi('pinBukaKunci', { id, alasan: r.reason }, { ok: 'PIN dibuka kuncinya.' });
    else if (a === 'pin') { const d = await aksi('pinBuatBaru', { id, alasan: r.reason }); Modal.open({ title: 'PIN baru peserta', persist: true, body: `<p class="muted">Tunjukkan kepada peserta. PIN ini hanya ditampilkan <b>sekali</b>.</p><div class="center mt"><div class="mono" style="font-size:42px;letter-spacing:.2em;font-weight:700;color:var(--primary-c)">${esc(d.pin)}</div><div class="muted">${esc(d.nomor)} · ${esc(d.nama)}</div></div>`, footer: `<button class="btn pri" data-act="modalClose">Selesai</button>` }); }
    else await aksi('sesiUjianKontrol', { idPeserta: id, aksi: a, alasan: r.reason, tambahMenit: tambah }, { ok: 'Berhasil.' });
    D.refresh('mon', 'monitoring', { idRuang: MON.idRuang, idSesi: MON.idSesi }, { noPersist: true });
  } catch (e) { }
};
