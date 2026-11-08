/* views-peserta.js — dashboard, jadwal, briefing, hasil, profil, selesai (peserta) */
'use strict';
const Poll = { t: null, start(fn, ms) { this.stop(); this.t = setInterval(() => { if (!document.hidden && Api.net.online) fn(); }, ms); }, stop() { clearInterval(this.t); this.t = null; } };
const pb = () => D.peek('boot') || null;
const skelPeserta = () => `<div class="stack"><div class="skel" style="height:170px;border-radius:24px"></div><div class="kpis">${'<div class="skel" style="height:96px"></div>'.repeat(4)}</div></div>`;
const WAKTU = s => s ? (s.tanggal ? tglIndo(s.tanggal, true) : '') + (s.mulai ? ' · ' + String(s.mulai).slice(0, 5) + (s.selesai ? '–' + String(s.selesai).slice(0, 5) : '') + ' WIB' : '') : '–';
const refreshPeserta = () => D.refresh('boot', 'pesertaBootstrap', {});

function komponenKartu(b) {
  const h = b.hasil || {}, a = b.ambang || { NT: 60, NK: 60, NW: 60 }, w = b.bobot || { NT: 60, NK: 25, NW: 15 };
  const daftar = [['NT', 'Tes Tertulis (CAT)', h.nt, a.NT, w.NT, 'laptop'], ['NK', 'Praktik Kerja', h.nk, a.NK, w.NK, 'edit'], ['NW', 'Wawancara', h.nw, a.NW, w.NW, 'headset']];
  const kart = daftar.map(([k, n, v, amb, bo, i]) => {
    const ada = h.tampilNilai && v != null;
    const lolos = ada ? v >= amb : null;
    return `<div class="kpi"><div class="row sp"><div class="k">${n}</div><div class="ico">${ic(i)}</div></div><div class="v mono">${h.tampilNilai ? fmtN(v) : '••'}</div>
      <div class="bar ${lolos === true ? 'ok' : lolos === false ? 'warn' : ''} mt-s"><i style="width:${ada ? Math.min(100, v) : 0}%"></i><span class="mark" style="left:${amb}%"></span></div>
      <div class="s mt-s">Bobot ${bo}% · batas ${amb} ${ada ? (lolos ? '· <b style="color:var(--ok)">memenuhi</b>' : '· <b style="color:var(--error)">belum memenuhi</b>') : (v == null && h.tampilNilai ? '· menunggu' : '')}</div></div>`;
  }).join('');
  const na = `<div class="kpi" style="background:var(--primary-c);color:#fff"><div class="k" style="color:#b9c8ff">Nilai Akhir (NA)</div><div class="v mono" style="color:#fff">${h.tampilNilai && h.lengkap ? fmtN(h.na) : '••'}</div><div class="s" style="color:#c9d6ff">= NT×${w.NT}% + NK×${w.NK}% + NW×${w.NW}%</div><div class="mt-s">${h.statusAkhir ? sBadge(h.statusAkhir) : badge(h.sementara === false ? 'Final' : 'Sementara', 'warn')}</div></div>`;
  return `<div class="kpis">${kart}${na}</div>`;
}

Router.routes.dashboard = {
  title: 'Dasbor', keys: ['boot'],
  render() {
    const u = Session.user;
    if (u.kind !== 'p') return Router.routes.dashStaf.render();
    const b = D.use('boot', 'pesertaBootstrap', {}, { ttl: 8 }); if (!b) return skelPeserta();
    const p = b.peserta, uj = b.ujian || {}, h = b.hasil || {};
    let cta;
    if (uj.status === 'Selesai') cta = `<div class="row gap-s">${ic('checkc')}<b>Ujian tertulis sudah dikirim</b></div><div class="sm muted mt-s">${h.tampilNilai ? 'Lihat rincian pada menu Hasil.' : 'Hasil akan diumumkan oleh panitia.'}</div><a class="btn pri block mt" href="#/hasil">${ic('chart')} Lihat Hasil</a>`;
    else if (uj.status === 'Berjalan') cta = `<div class="row gap-s">${ic('clock')}<b>Ujian sedang berjalan</b></div><a class="btn ok block mt" href="#/mulai">${ic('play')} Lanjutkan Ujian</a>`;
    else if (uj.bisaMulai) cta = `<div class="row gap-s">${ic('checkc')}<b>Sesi sudah dibuka</b></div><a class="btn ok block mt" href="#/mulai">${ic('play')} Mulai Ujian</a>`;
    else cta = `<div class="row gap-s">${ic('clock')}<b>Belum bisa mulai</b></div><div class="sm muted mt-s">${esc(uj.alasanTunda || 'Menunggu pengawas.')}</div><a class="btn ghost block mt" href="#/mulai">${ic('help')} Petunjuk Ujian</a>`;
    const peng = (b.pengumuman || []).map(x => `<div class="step mb"><div class="n">${ic('mega', 'sm')}</div><div><b>${esc(x.judul)}</b><div class="sm muted">${esc(x.isi || '')}</div></div></div>`).join('') || '<div class="muted sm">Belum ada pengumuman.</div>';
    const per = h.perSubtes ? `<div class="card"><div class="card-h"><h3>Capaian per Subtes</h3><span class="muted sm">persentase benar</span></div><div class="chartwrap">${Chart.bars(h.perSubtes.map(s => s.persen), h.perSubtes.map(s => singkatSubtes(s.nama)), { ambang: b.ambang ? b.ambang.NT : 60, aria: 'Capaian per subtes' })}</div></div>` : '';
    return `<div class="stack">
      <section class="hero"><div class="left"><span class="chip">${ic('idcard', 'sm')} ${esc(p.nomor)}</span><h1 class="mt-s">Halo, ${esc(p.nama.split(' ').filter(x => !/\.$/.test(x))[0] || p.nama)}</h1>
        <p>${esc(b.kegiatan.nama)}</p><div class="row wrap mt" style="gap:.5rem"><span class="chip">${esc(b.formasi.jabatan)}</span><span class="chip">${esc(b.formasi.desa)}</span><span class="chip">${esc(b.ruang.nama)}</span></div>
        <p class="sm mt">${ic('calendar', 'sm')} ${WAKTU(b.sesi)}</p></div>
        <div class="right-col"><div class="float">${cta}</div></div></section>
      ${komponenKartu(b)}
      <div class="cols"><div class="stack">${per}
        <div class="card"><div class="card-h"><h3>Cara Penilaian</h3></div><p class="muted">Nilai Akhir dihitung dari tiga komponen. Peserta harus memenuhi batas nilai minimum pada <b>setiap</b> komponen.</p>
        <div class="sumgrid mt"><div class="box"><b>${b.bobot.NT}%</b><span class="sm muted">Tertulis</span></div><div class="box"><b>${b.bobot.NK}%</b><span class="sm muted">Praktik</span></div><div class="box"><b>${b.bobot.NW}%</b><span class="sm muted">Wawancara</span></div></div></div></div>
        <div class="stack"><div class="card"><div class="card-h"><h3>Pengumuman</h3></div>${peng}</div>
        <div class="card"><div class="card-h"><h3>Jadwal Lain</h3></div><div class="step mb"><div class="n">1</div><div><b>Praktik Kerja</b><div class="sm muted">${esc(b.jadwal.praktik || 'Menunggu jadwal panitia')}</div></div></div><div class="step"><div class="n">2</div><div><b>Wawancara</b><div class="sm muted">${esc(b.jadwal.wawancara || 'Menunggu jadwal panitia')}</div></div></div></div></div></div></div>`;
  },
  mount() { Poll.start(refreshPeserta, 15000); },
  cleanup() { Poll.stop(); }
};

Router.routes.jadwal = {
  title: 'Jadwal & Ujian', keys: ['boot'],
  render() {
    const b = D.use('boot', 'pesertaBootstrap', {}, { ttl: 8 }); if (!b) return skelPeserta();
    const uj = b.ujian || {};
    const aturan = ['Datang minimal 30 menit sebelum sesi dimulai dan bawa kartu peserta serta identitas asli.', 'Satu soal ditampilkan per layar; jawaban tersimpan otomatis. Anda dapat menandai soal ragu-ragu dan kembali kapan saja.', `Waktu ${b.durasiMenit} menit berlaku untuk seluruh ${b.subtes.reduce((a, s) => a + s.jumlah, 0)} soal dalam ${b.subtes.length} subtes. Timer mengikuti jam server dan tidak berhenti walau layar ditutup.`, 'Jangan membuka tab/aplikasi lain atau keluar layar penuh. Setiap pelanggaran tercatat dan dilihat pengawas.', 'Bila internet putus, tetap jawab — jawaban disimpan di perangkat dan dikirim ulang otomatis saat tersambung.', 'Satu PIN hanya untuk satu perangkat. Masuk dari perangkat lain akan menghentikan sesi yang pertama.'];
    return `<div class="stack">${pageHead('Jadwal & Ujian', 'Informasi pelaksanaan ujian tertulis, praktik, dan wawancara.')}
      <div class="cols"><div class="stack"><div class="card"><div class="card-h"><h3>Sesi Ujian Tertulis (CAT)</h3>${sBadge(b.sesi.status || 'Terjadwal')}</div>
        <table class="tbl" style="min-width:0"><tbody><tr><td class="muted">Sesi</td><td>${esc(b.sesi.nama)}</td></tr><tr><td class="muted">Waktu</td><td>${WAKTU(b.sesi)}</td></tr><tr><td class="muted">Ruang</td><td>${esc(b.ruang.nama)} <span class="muted sm">${esc(b.ruang.lokasi)}</span></td></tr><tr><td class="muted">Durasi</td><td>${b.durasiMenit} menit</td></tr><tr><td class="muted">Kehadiran</td><td>${sBadge(b.peserta.kehadiran || 'Belum Hadir')}</td></tr></tbody></table>
        <div class="mt">${uj.status === 'Selesai' ? `<div class="alert ok">${ic('checkc')}<div>Ujian tertulis Anda sudah selesai.</div></div>` : `<a class="btn ${uj.bisaMulai || uj.status === 'Berjalan' ? 'ok' : 'pri'} lg" href="#/mulai">${ic('play')} ${uj.status === 'Berjalan' ? 'Lanjutkan Ujian' : 'Petunjuk & Mulai Ujian'}</a>`}</div></div>
        <div class="card"><div class="card-h"><h3>Tata Tertib</h3></div>${aturan.map((t, i) => `<div class="step mb"><div class="n">${i + 1}</div><div>${esc(t)}</div></div>`).join('')}</div></div>
      <div class="stack"><div class="card"><div class="card-h"><h3>Praktik Kerja</h3></div><p>${esc(b.jadwal.praktik || 'Jadwal akan diumumkan panitia.')}</p></div><div class="card"><div class="card-h"><h3>Wawancara</h3></div><p>${esc(b.jadwal.wawancara || 'Jadwal akan diumumkan panitia.')}</p></div>
      <div class="card"><div class="card-h"><h3>Bantuan</h3></div><p class="sm muted">${esc(b.instansi.nama)}<br>${esc(b.instansi.alamat || '')}<br>${esc(b.instansi.kontak || '')}</p></div></div></div></div>`;
  },
  mount() { Poll.start(refreshPeserta, 15000); }, cleanup() { Poll.stop(); }
};

/* Briefing sebelum ujian: cek koneksi, layar penuh, tombol mulai */
Router.routes.mulai = {
  title: 'Mulai Ujian', keys: ['boot'],
  render() {
    const b = D.use('boot', 'pesertaBootstrap', {}, { ttl: 5 }); if (!b) return skelPeserta();
    const uj = b.ujian, jml = b.subtes.reduce((a, s) => a + s.jumlah, 0);
    const bisa = uj.bisaMulai || uj.status === 'Berjalan';
    return `<div class="stack">${pageHead('Persiapan Ujian', 'Periksa ringkasan berikut sebelum memulai. Setelah dimulai, waktu berjalan terus.')}
      <div class="card"><div class="sumgrid"><div class="box"><b>${jml}</b><span class="sm muted">Soal</span></div><div class="box"><b>${b.subtes.length}</b><span class="sm muted">Subtes</span></div><div class="box"><b>${b.durasiMenit}'</b><span class="sm muted">Menit total</span></div></div>
      <div class="mt">${b.subtes.map(s => `<div class="row sp mb"><span>${s.urutan}. ${esc(s.nama)}</span><span class="mono muted">${s.jumlah} soal</span></div>`).join('')}</div></div>
      <div class="card"><div class="card-h"><h3>Cek Perangkat</h3></div><div class="row gap-s mb">${ic('wifioff')}<span id="cek-net">Memeriksa koneksi…</span></div><div class="row gap-s mb">${ic('maximize')}<span>Layar penuh akan diaktifkan saat ujian dimulai (disarankan).</span></div><div class="row gap-s">${ic('clock')}<span id="cek-jam"></span></div></div>
      ${bisa ? '' : `<div class="alert">${ic('info')}<div><b>Belum dapat dimulai.</b> ${esc(uj.alasanTunda)}</div></div>`}
      <label class="chk"><input type="checkbox" id="setuju"><span>Saya memahami tata tertib dan menyatakan mengerjakan ujian ini secara mandiri dan jujur.</span></label>
      <div class="row wrap"><a class="btn ghost" href="#/dashboard">${ic('left')} Kembali</a><button class="btn ok lg" id="btn-mulai" ${bisa ? '' : 'disabled'}>${ic('play')} ${uj.status === 'Berjalan' ? 'Lanjutkan Ujian' : 'Mulai Ujian Sekarang'}</button></div></div>`;
  },
  mount() {
    const t0 = Date.now(); Api.call('ping', {}, { noAuth: true, retries: 0, timeout: 8000 }).then(() => { const e = $('#cek-net'); if (e) e.innerHTML = `Koneksi baik (${Date.now() - t0} ms)`; }).catch(() => { const e = $('#cek-net'); if (e) e.innerHTML = '<b style="color:var(--error)">Koneksi bermasalah</b>'; });
    const j = $('#cek-jam'); if (j) j.textContent = 'Waktu server ' + jamWib(Clock.now()) + ' WIB';
    const btn = $('#btn-mulai'), cb = $('#setuju'); if (!btn) return;
    const sudah = (pb() && pb().ujian.status === 'Berjalan'); if (sudah) cb.checked = true;
    btn.onclick = async () => {
      if (!cb.checked) { Toast.warn('Centang pernyataan terlebih dahulu.'); return; }
      try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { }
      btn.disabled = true; btn.innerHTML = ic('refresh', 'spin') + ' Menyiapkan soal…';
      try { const d = await aksi('ujianMulai', {}); if (d.selesai) { D.invalidate('boot'); refreshPeserta(); Router.go('selesai'); return; } Exam.siapkan(d); Router.go('ujian'); }
      catch (e) { btn.disabled = false; btn.innerHTML = ic('play') + ' Mulai Ujian Sekarang'; refreshPeserta(); }
    };
  },
  cleanup() { }
};

Router.routes.selesai = {
  title: 'Ujian Terkirim',
  render() {
    const r = Store.sess.get('hasil_kirim') || {}; const b = pb();
    return `<div class="stack" style="max-width:640px;margin:2rem auto"><div class="card center"><div class="avatar" style="width:64px;height:64px;margin:0 auto 1rem;background:var(--ok)">${ic('checkc', 'lg')}</div><h1>Jawaban Anda sudah terkirim</h1><p class="muted mt-s">Terima kasih. ${r.terjawab != null ? `Tercatat <b>${r.terjawab}</b> soal terjawab.` : ''} Anda dapat menutup halaman ini. Hasil akan diumumkan sesuai jadwal panitia.</p>
      ${r.nt != null ? `<div class="alert ok mt" style="text-align:left">${ic('award')}<div>Nilai tes tertulis: <b class="mono">${fmtN(r.nt)}</b> (sementara)</div></div>` : ''}
      <div class="row wrap mt" style="justify-content:center"><a class="btn pri" href="#/dashboard">${ic('grid')} Ke Dasbor</a><button class="btn ghost" data-act="logout">${ic('logout')} Keluar</button></div></div></div>`;
  }
};

Router.routes.hasil = {
  title: 'Hasil Saya', keys: ['boot'],
  render() {
    const b = D.use('boot', 'pesertaBootstrap', {}, { ttl: 10 }); if (!b) return skelPeserta();
    const h = b.hasil, ambang = b.ambang;
    if (!h.tampilNilai) return `<div class="stack">${pageHead('Hasil Saya')}<div class="card center"><div class="avatar" style="width:56px;height:56px;margin:0 auto 1rem">${ic('lock', 'lg')}</div><h2>Nilai belum diumumkan</h2><p class="muted mt-s">${h.selesaiCBT ? 'Ujian tertulis Anda sudah diterima.' : ''} Panitia akan membuka nilai secara bertahap. Halaman ini diperbarui otomatis.</p>${h.statusAkhir ? `<div class="mt">${sBadge(h.statusAkhir)}</div>` : ''}</div></div>`;
    const mem = h.memenuhi || {}; const ok = v => v === null ? '<span class="muted">menunggu</span>' : v ? '<b style="color:var(--ok)">Memenuhi</b>' : '<b style="color:var(--error)">Belum memenuhi</b>';
    const sub = (h.perSubtes || []).map(s => `<tr><td>${esc(s.nama)}</td><td class="num mono">${s.benar}/${s.total}</td><td class="num mono">${s.terjawab}</td><td style="width:34%"><div class="bar ${s.persen >= ambang.NT ? 'ok' : 'warn'}"><i style="width:${s.persen}%"></i></div></td><td class="num mono">${s.persen}%</td></tr>`).join('');
    return `<div class="stack">${pageHead('Hasil Saya', h.sementara ? 'Hasil <b>sementara</b> — dapat berubah sampai finalisasi panitia.' : 'Hasil <b>final</b> yang telah ditetapkan panitia.', sBadge(h.sementara ? 'Sementara' : 'Final'))}
      ${komponenKartu(b)}
      ${h.statusAkhir ? `<div class="alert ${h.statusAkhir === 'Terpilih' || h.statusAkhir === 'Lulus' ? 'ok' : 'info'}">${ic('award')}<div><b>Status akhir: ${esc(h.statusAkhir)}</b>${h.peringkat ? ` · Peringkat ${h.peringkat}` : ''}</div></div>` : ''}
      <div class="card"><div class="card-h"><h3>Pemenuhan Batas Nilai</h3></div><table class="tbl" style="min-width:0"><tbody><tr><td>Tertulis (≥ ${ambang.NT})</td><td>${ok(mem.NT)}</td></tr><tr><td>Praktik (≥ ${ambang.NK})</td><td>${ok(mem.NK)}</td></tr><tr><td>Wawancara (≥ ${ambang.NW})</td><td>${ok(mem.NW)}</td></tr></tbody></table></div>
      ${sub ? `<div class="card"><div class="card-h"><h3>Rincian Tes Tertulis per Subtes</h3>${h.ringkas ? `<span class="muted sm">${h.ringkas.benar}/${h.ringkas.total} benar · ${h.ringkas.terjawab} terjawab</span>` : ''}</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Subtes</th><th class="num">Benar</th><th class="num">Terjawab</th><th></th><th class="num">%</th></tr></thead><tbody>${sub}</tbody></table></div></div>` : ''}</div>`;
  },
  mount() { Poll.start(refreshPeserta, 20000); }, cleanup() { Poll.stop(); }
};

Router.routes.profil = {
  title: 'Profil', keys: ['boot'],
  render() {
    const b = D.use('boot', 'pesertaBootstrap', {}, { ttl: 60 }); if (!b) return skelPeserta(); const p = b.peserta;
    const row = (k, v) => `<tr><td class="muted" style="width:40%">${k}</td><td>${v}</td></tr>`;
    return `<div class="stack">${pageHead('Profil Peserta', 'Data berikut berasal dari berkas pendaftaran. Hubungi panitia bila ada yang keliru.')}
      <div class="cols"><div class="card"><table class="tbl" style="min-width:0"><tbody>${row('Nomor Peserta', `<span class="mono">${esc(p.nomor)}</span>`)}${row('Nama', esc(p.nama))}${row('NIK', `<span class="mono">${esc(p.nik)}</span>`)}${row('Tempat, Tgl Lahir', esc(p.tempatLahir) + ', ' + tglIndo(p.tglLahir))}${row('Jabatan', esc(b.formasi.jabatan))}${row('Desa', esc(b.formasi.desa))}${row('Status Berkas', sBadge(p.statusBerkas || 'Belum'))}${row('Ruang / Sesi', esc(b.ruang.nama) + ' · ' + esc(b.sesi.nama))}</tbody></table></div>
      <div class="card"><div class="card-h"><h3>Privasi</h3></div><p class="sm muted">NIK disamarkan. Data Anda dipakai hanya untuk penyelenggaraan seleksi sesuai UU No. 27 Tahun 2022.</p><button class="btn ghost block mt" data-act="logout">${ic('logout')} Keluar</button></div></div></div>`;
  }
};
