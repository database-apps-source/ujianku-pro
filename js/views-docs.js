/* views-docs.js — Doc Engine di frontend: cetak dokumen dari template Google Docs + pengelola template (autoscan) */
'use strict';
const DOC_PARAM = { kartu: ['sesi', 'ruang'], hadir: ['sesi', 'ruang'], ba_pelaksanaan: [], ba_hasil: ['formasi'], lampiran_nilai: ['formasi'] };
const DOC_IKON = { kartu: 'idcard', hadir: 'list', ba_pelaksanaan: 'file', ba_hasil: 'award', lampiran_nilai: 'clip' };
const tipeInput = t => ({ tanggal: 'date', angka: 'number', teksPanjang: 'textarea' }[t] || 'text');
const bukaPdf = (r, unduh) => { const bl = b64Blob(r.b64, 'application/pdf'); if (unduh) unduhBlob(bl, r.nama); else { const u = URL.createObjectURL(bl); const w = window.open(u, '_blank'); if (!w) unduhBlob(bl, r.nama); setTimeout(() => URL.revokeObjectURL(u), 60000); } };

Router.routes.dokumen = {
  title: 'Cetak Dokumen', keys: ['boot', 'de:t', 'de:d'],
  render() {
    const b = D.use('boot', 'adminBootstrap', {}, { ttl: 60 }); if (!b) return skelStaf();
    const T = D.use('de:t', 'deDaftar', {}, { ttl: 60 }), kam = D.use('de:k', 'deKamus', {}, { ttl: 600 });
    if (!T || !kam) return `<div class="stack">${pageHead('Cetak Dokumen')}<div class="skel" style="height:260px"></div></div>`;
    const peran = Session.user.peran, canTerbit = ['Super Admin', 'Ketua Panitia'].includes(peran);
    const mods = Object.keys(kam.modul).filter(k => kam.modul[k].peran.includes(peran) || peran === 'Pimpinan');
    const kartu = mods.map(k => { const m = kam.modul[k], t = T.rows.find(x => x.modul === k && x.aktif);
      return `<div class="card"><div class="row sp"><div class="avatar" style="background:var(--primary-fix);color:var(--primary-c)">${ic(DOC_IKON[k] || 'file')}</div>${m.nomor ? badge('Bernomor resmi', 'info') : badge('Cetak langsung')}</div><h3 class="mt-s">${esc(m.nama)}</h3><p class="sm muted">${esc(m.param)}${m.final ? ' · terbit setelah finalisasi' : ''}</p>
      <div class="row wrap mt">${t ? `<button class="btn pri" data-act="docBuka" data-m="${k}" data-t="${t.id}">${ic('print')} Siapkan</button>` : badge('Template belum tersedia', 'warn')}</div></div>`; }).join('');
    const lst = peran !== 'Pengawas' ? docTerbit() : '';
    return `<div class="stack">${pageHead('Cetak Dokumen', 'Dokumen dibuat dari template Google Docs yang dapat diubah admin. Pratinjau tidak bernomor; dokumen resmi bernomor dan ber-QR verifikasi.')}<div class="kpis" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${kartu || '<div class="empty">Tidak ada dokumen untuk peran Anda.</div>'}</div>${lst}</div>`;
  },
  mount() { }
};
function docTerbit() {
  const L = D.use('de:d', 'deDokumenList', {}, { ttl: 15 });
  return `<div class="card"><div class="card-h"><h3>Dokumen Resmi Terbit</h3></div>${!L ? '<div class="skel" style="height:90px"></div>' : Table.html('dk', { rows: L.rows, searchKeys: ['nomor', 'judul', 'kodeVerifikasi'], empty: 'Belum ada dokumen resmi diterbitkan.', cols: [{ k: 'nomor', label: 'Nomor', cls: 'mono' }, { k: 'judul', label: 'Judul' }, { k: 'terbit', label: 'Terbit', fmt: v => tglJam(v) }, { k: 'kodeVerifikasi', label: 'Kode verifikasi', cls: 'mono sm' }, { k: 'status', label: 'Status', fmt: v => sBadge(v) }], actions: r => `<button class="btn sm ghost" data-act="dokUnduh" data-id="${r.id}">${ic('download', 'sm')} PDF</button><a class="btn sm ghost" target="_blank" href="#/verifikasi/${r.kodeVerifikasi.replace(/-/g, '')}">${ic('shield', 'sm')}</a>${r.status === 'TERBIT' && Session.user.peran !== 'Pimpinan' ? `<button class="btn sm ghost" data-act="dokTarik" data-id="${r.id}">${ic('x', 'sm')} Tarik</button>` : ''}` })}</div>`;
}
Actions.docBuka = async el => {
  const b = boot(), kam = D.peek('de:k'), m = kam.modul[el.dataset.m], t = D.peek('de:t').rows.find(x => x.id === el.dataset.t);
  const peran = Session.user.peran, canTerbit = m.nomor && ['Super Admin', 'Ketua Panitia'].includes(peran);
  const ps = DOC_PARAM[el.dataset.m] || [], opt = [];
  if (ps.includes('sesi')) opt.push({ name: 'idSesi', label: 'Sesi', type: 'select', placeholder: '(semua sesi)', options: b.sesi.map(s => [s.id, s.nama + ' · ' + tglIndo(s.tanggal) + ' · ' + ((b.ruang.find(r => r.id === s.idRuang) || {}).nama || '')]) });
  if (ps.includes('ruang')) opt.push({ name: 'idRuang', label: 'Atau ruang', type: 'select', placeholder: '(semua ruang)', options: b.ruang.map(r => [r.id, r.nama]) });
  if (ps.includes('formasi')) opt.push({ name: 'idFormasi', label: 'Formasi', type: 'select', placeholder: 'Semua formasi', options: b.formasi.filter(f => f.idKegiatan === b.kegiatanAktif).map(f => [f.id, f.jabatan + ' — ' + f.desa]) });
  const isian = (t.bidang || []).filter(x => !x.otomatis).map(x => ({ name: 'i_' + x.kunci, label: x.label, req: x.wajib, type: tipeInput(x.tipe), rows: 3, hint: '<span class="mono sm">{{' + x.kunci + '}}</span>' }));
  const body = `<form id="dk-f"><div class="alert info mb">${ic('info')}<div>Template: <b>${esc(t.nama)}</b> (v${t.versi}). ${m.nomor ? '' : 'PIN peserta baru dibuat saat kartu dicetak.'}</div></div>${opt.length ? Form.fields(opt) : ''}${isian.length ? `<div class="card-h mt"><h3>Isian Dokumen</h3><span class="sm muted">dibentuk otomatis dari template</span></div>${Form.fields(isian)}` : ''}<div class="errtxt hidden" id="dk-err"></div></form>`;
  const ov = Modal.open({ title: m.nama, size: 'lg', persist: true, body, footer: `<button class="btn ghost" data-act="modalClose">Batal</button><button class="btn ${canTerbit ? 'ghost' : 'pri'}" id="dk-pv">${ic('eye')} ${m.nomor ? 'Pratinjau' : 'Buat PDF'}</button>${canTerbit ? `<button class="btn ok" id="dk-tb">${ic('shield')} Terbitkan Resmi</button>` : ''}` });
  const jalan = async terbit => {
    const v = Form.read($('#dk-f', ov)), params = {}, isi = {}; Object.keys(v).forEach(k => { if (k.startsWith('i_')) isi[k.slice(2)] = v[k]; else if (v[k]) params[k] = v[k]; });
    const er = $('#dk-err', ov); er.classList.add('hidden');
    if (terbit) { const c = await Modal.confirm({ title: 'Terbitkan dokumen resmi?', msg: 'Nomor surat diberikan dan dokumen dicatat dengan kode verifikasi. Pastikan data sudah benar.', okText: 'Terbitkan' }); if (!c.ok) return; }
    const bt = [$('#dk-pv', ov), $('#dk-tb', ov)].filter(Boolean); bt.forEach(x => x.disabled = true); const lbl = (terbit ? $('#dk-tb', ov) : $('#dk-pv', ov)); const asal = lbl.innerHTML; lbl.innerHTML = ic('refresh', 'spin') + ' Memproses (±10–30 dtk)…';
    try { const r = await Api.call('deRender', { templateId: t.id, params, isian: isi, terbit }, { write: true, retries: 0, timeout: 120000 }); bukaPdf(r, false);
      if (terbit) { Toast.ok('Terbit: ' + r.nomor); D.refresh('de:d', 'deDokumenList', {}); Modal.close(ov); } else Toast.ok('PDF dibuat. Bila tidak terbuka, cek pemblokir popup.'); }
    catch (e) { er.textContent = e.message; er.classList.remove('hidden'); }
    bt.forEach(x => x.disabled = false); lbl.innerHTML = asal;
  };
  $('#dk-pv', ov).onclick = () => jalan(false); const tb = $('#dk-tb', ov); if (tb) tb.onclick = () => jalan(true);
};
Actions.dokUnduh = async el => { Progress.start(); try { const r = await Api.call('deUnduh', { id: el.dataset.id }); bukaPdf(r, true); } catch (e) { Toast.err(e.message); } finally { Progress.done(); } };
Actions.dokTarik = async el => { const r = await Modal.confirm({ title: 'Tarik dokumen?', msg: 'Dokumen akan ditandai <b>DITARIK</b> pada halaman verifikasi publik.', danger: true, reason: true, okText: 'Tarik' }); if (!r.ok) return; await aksi('deTarik', { id: el.dataset.id, alasan: r.reason }, { ok: 'Dokumen ditarik.' }); D.refresh('de:d', 'deDokumenList', {}); };

/* ================= PENGELOLA TEMPLATE ================= */
Router.routes.template = {
  title: 'Template Dokumen', keys: ['de:t', 'de:k'],
  render() {
    const T = D.use('de:t', 'deDaftar', {}, { ttl: 20 }), kam = D.use('de:k', 'deKamus', {}, { ttl: 600 });
    if (!T || !kam) return `<div class="stack">${pageHead('Template Dokumen')}<div class="skel" style="height:260px"></div></div>`;
    return `<div class="stack">${pageHead('Template Dokumen', 'Ubah tampilan dokumen langsung di Google Docs. Tulis penanda <span class="mono">{{NAMA}}</span>; sistem memindai dan membentuk formulir otomatis.', `<button class="btn ghost" data-act="kamus">${ic('help')} Kamus Penanda</button><button class="btn pri" data-act="tplForm">${ic('plus')} Template</button>`)}
      <div class="alert info">${ic('bulb')}<div><b>Cara pakai:</b> klik <b>Buka di Docs</b> → ubah teks/kop/tabel → kembali ke sini → <b>Pindai Ulang</b>. Baris tabel berulang diawali penanda <span class="mono">{{#PESERTA}}</span> dengan kolom <span class="mono">{{r.nama}}</span>. Pastikan Docs dibagikan ke akun pemilik script.</div></div>
      ${T.rows.map(t => { const m = kam.modul[t.modul] || {}; const aut = (t.bidang || []).filter(x => x.otomatis).length, isi = (t.bidang || []).filter(x => !x.otomatis).length;
        return `<div class="card"><div class="row sp wrap"><div class="row"><div class="avatar" style="background:var(--primary-fix);color:var(--primary-c)">${ic(DOC_IKON[t.modul] || 'file')}</div><div><b>${esc(t.nama)}</b><div class="sm muted">${esc(m.nama || t.modul)} · v${t.versi} · ${t.aktif ? 'aktif' : 'nonaktif'}</div></div></div>
        <div class="row wrap gap-s">${t.urlDoc ? `<a class="btn sm pri" target="_blank" rel="noopener" href="${esc(t.urlDoc)}">${ic('link', 'sm')} Buka di Docs</a>` : ''}<button class="btn sm ghost" data-act="tplScan" data-id="${t.id}">${ic('scan', 'sm')} Pindai Ulang</button><button class="btn sm ghost" data-act="tplForm" data-id="${t.id}">${ic('edit', 'sm')} Ganti Dokumen</button><button class="btn sm ghost" data-act="tplReset" data-id="${t.id}">${ic('history', 'sm')} Pulihkan Bawaan</button></div></div>
        <div class="legend mt"><span>${aut} penanda otomatis</span><span>${isi} isian operator</span>${Object.keys(t.blok || {}).map(k => `<span>tabel {{#${k}}}</span>`).join('')}</div>
        ${isi ? `<div class="mt sm muted">Isian: ${(t.bidang || []).filter(x => !x.otomatis).map(x => `<span class="tpl-token">${esc(x.kunci)}</span>`).join(' ')}</div>` : ''}</div>`; }).join('') || `<div class="empty">${ic('inbox')}<div>Belum ada template. Jalankan <span class="mono">siapkanTemplateDokumen()</span> di Apps Script atau tambahkan manual.</div></div>`}</div>`;
  }
};
const tampilPindai = r => Modal.open({ title: 'Hasil Pemindaian', size: 'lg', body: `<div class="alert ok mb">${ic('checkc')}<div><b>${r.jumlahToken}</b> penanda ditemukan. ${r.skema.filter(x => !x.otomatis).length} isian operator terbentuk.</div></div>${r.peringatan.length ? `<div class="alert mb">${ic('alert')}<div><b>Perhatian:</b><ul style="margin:.3rem 0 0 1rem">${r.peringatan.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div></div>` : ''}<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Penanda</th><th>Tipe</th><th>Sumber</th></tr></thead><tbody>${r.skema.map(x => `<tr><td class="mono">{{${esc(x.kunci)}}}</td><td>${esc(x.tipe)}</td><td>${x.otomatis ? badge('Otomatis sistem', 'ok') : badge('Isian operator' + (x.wajib ? ' *' : ''), 'info')}</td></tr>`).join('')}</tbody></table></div>`, footer: `<button class="btn pri" data-act="modalClose">Tutup</button>` });
Actions.tplScan = async el => { const r = await aksi('dePindai', { id: el.dataset.id }); D.refresh('de:t', 'deDaftar', {}); tampilPindai(r); };
Actions.tplReset = async el => { const c = await Modal.confirm({ title: 'Pulihkan template bawaan?', msg: 'Dibuat Google Docs baru dari desain bawaan; perubahan Anda pada Docs lama tidak dipakai lagi (berkas lama tetap ada di Drive).', okText: 'Pulihkan' }); if (!c.ok) return; const r = await aksi('deSimpanTemplate', { id: el.dataset.id, pulihkan: true }, { ok: 'Template dipulihkan.' }); D.refresh('de:t', 'deDaftar', {}); tampilPindai(r); };
Actions.tplForm = el => { const kam = D.peek('de:k'), T = el.dataset.id ? D.peek('de:t').rows.find(x => x.id === el.dataset.id) : null;
  formModal({ title: T ? 'Ganti Dokumen Template' : 'Tambah Template', row: T || {}, fields: [{ name: 'nama', label: 'Nama template', req: 1 }, { name: 'modul', label: 'Jenis dokumen', type: 'select', dis: !!T, options: Object.keys(kam.modul).map(k => [k, kam.modul[k].nama]) }, { name: 'doc', label: 'Tautan Google Docs', req: !T, placeholder: 'https://docs.google.com/document/d/…/edit', hint: 'Bagikan Docs ke akun pemilik script (Editor/Viewer).' }, { name: 'aktif', type: 'checkbox', label: 'Aktif', def: true }],
    onSave: async v => { const r = await aksi('deSimpanTemplate', Object.assign({}, T ? { id: T.id, modul: T.modul } : {}, v), { ok: 'Template disimpan.' }); D.refresh('de:t', 'deDaftar', {}); setTimeout(() => tampilPindai(r), 250); } }); };
Actions.kamus = () => { const k = D.peek('de:k'); Modal.open({ title: 'Kamus Penanda', size: 'lg', body: `<p class="muted mb">Salin penanda ke Google Docs. Modifier: <span class="mono">{{NAMA|kapital}}</span>, <span class="mono">|kecil</span>, <span class="mono">|judul</span>, <span class="mono">|tanggal:dd MMMM yyyy</span>, <span class="mono">|terbilang</span>, <span class="mono">|rupiah</span>, <span class="mono">|ribuan</span>, <span class="mono">|bawaan:teks</span>.</p>
  <div class="card-h"><h3>Umum (semua dokumen)</h3></div><div class="legend mb">${k.umum.map(x => `<span class="mono">{{${x}}}</span>`).join('')}</div>
  ${Object.keys(k.modul).map(id => { const m = k.modul[id]; return `<div class="card-h mt"><h3>${esc(m.nama)}</h3></div><div class="legend">${m.fields.map(x => `<span class="mono">{{${x}}}</span>`).join('')}</div>${Object.keys(m.blok).map(n => `<div class="mt-s sm"><b class="mono">{{#${n}}}</b> … ${m.blok[n].map(c => `<span class="tpl-token">{{r.${c}}}</span>`).join(' ')} <b class="mono">{{/${n}}}</b></div>`).join('')}`; }).join('')}`, footer: `<button class="btn pri" data-act="modalClose">Tutup</button>` }); };
