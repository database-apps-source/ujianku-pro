/* views-auth.js — Login peserta, login panitia, ganti sandi sementara, setup URL backend, verifikasi dokumen publik */
'use strict';
const infoPublik = () => D.peek('info') || {};
const namaInstansi = () => { const i = infoPublik(); return (i.instansi && i.instansi.nama) || 'Panitia Seleksi Perangkat Desa'; };

function loginLayout(inner, o) {
  o = o || {}; const i = infoPublik(); const kg = i.kegiatan;
  return `<div class="login-bg">
    <div class="srvchip" id="srvchip"><span class="d"></span>${Api.net.online ? 'SERVER TERHUBUNG' : 'OFFLINE'} · SSL</div>
    <div class="login-card"><div class="login-in">
      <div class="logo">${ic('landmark', 'lg')}</div>
      <div class="badge info mono">${esc((i.instansi && i.instansi.pemerintah) || 'PEMERINTAH KABUPATEN')}</div>
      <h1>${o.judul || 'Sistem Ujian Perangkat Desa'}</h1>
      <p class="muted">${esc(kg ? kg.nama : 'Seleksi & Ujian Kompetensi Perangkat Desa')}</p>
      ${inner}
    </div>
    <div class="login-f"><span>${i.mode === 'DEMO' ? '⚠ MODE DEMO' : 'TERENKRIPSI SSL'}</span><span>v${esc((window.UJK_CONFIG || {}).VERSI || '1.0')}</span></div></div>
    <div class="login-foot">${o.foot || ''}<div class="mt-s sm">${ic('shield', 'sm')} Data pribadi Anda (NIK, nama, tanggal lahir) diproses sesuai <b>UU No. 27 Tahun 2022</b> tentang Pelindungan Data Pribadi, hanya untuk keperluan seleksi/ujian ini.</div></div>
  </div>`;
}

Router.routes.login = {
  title: 'Masuk Peserta', noRefresh: false, refreshWhileTyping: false,
  render() {
    D.use('info', 'info', {}, { ttl: 120 });
    return loginLayout(`<form id="f-login" autocomplete="off" novalidate>
      <div class="field"><label class="lbl" for="l-nomor">Nomor Peserta</label><div class="searchbox">${ic('idcard')}<input class="inp mono" id="l-nomor" name="nomor" placeholder="Contoh: P-2026-0001" autocapitalize="characters" autocomplete="username" inputmode="text" required></div></div>
      <div class="field"><label class="lbl" for="l-pin">PIN Ujian</label><div class="searchbox">${ic('key')}<input class="inp mono" id="l-pin" name="pin" type="password" placeholder="6 digit PIN pada kartu peserta" inputmode="numeric" autocomplete="current-password" maxlength="12" required></div>
        <div class="hint">PIN tertera pada kartu peserta Anda. <a href="javascript:void 0" data-act="togglePin">Tampilkan PIN</a></div></div>
      <div class="alert err hidden" id="l-err" role="alert">${ic('alert')}<div></div></div>
      <button class="btn pri lg block mt-s" id="l-btn" type="submit">${ic('play')} Masuk ke Ujian</button>
      <div class="switch-link center muted">Panitia / Pengawas / Penguji? <a href="#/staf">Masuk sebagai petugas</a></div>
    </form>`, { foot: 'Kesulitan masuk? Hubungi <b>Pengawas Ruang</b> di lokasi ujian.' });
  },
  mount() {
    warmup(); const f = $('#f-login'); setTimeout(() => $('#l-nomor') && $('#l-nomor').focus(), 50);
    f.onsubmit = async e => {
      e.preventDefault(); const v = Form.read(f); const err = $('#l-err'); err.classList.add('hidden');
      if (!v.nomor.trim() || !v.pin.trim()) { showErr(err, 'Nomor Peserta dan PIN wajib diisi.'); return; }
      const b = $('#l-btn'); b.disabled = true; b.innerHTML = ic('refresh', 'spin') + ' Memeriksa…';
      try {
        const d = await Api.call('loginPeserta', { nomor: v.nomor, pin: v.pin }, { noAuth: true, retries: 1 });
        await App.masuk(d, 'dashboard');
      } catch (e2) { showErr(err, e2.message); b.disabled = false; b.innerHTML = ic('play') + ' Masuk ke Ujian'; $('#l-pin').select(); }
    };
  }
};
const showErr = (el, m) => { el.lastElementChild.textContent = m; el.classList.remove('hidden'); };
Actions.togglePin = el => { const i = $('#l-pin') || $('#s-pass'); i.type = i.type === 'password' ? 'text' : 'password'; el.textContent = i.type === 'text' ? 'Sembunyikan PIN' : 'Tampilkan PIN'; };
let _warm = 0; function warmup() { if (Date.now() - _warm < 60000 || !Api.url()) return; _warm = Date.now(); Api.call('ping', {}, { noAuth: true, retries: 0, timeout: 15000 }).catch(() => { }); }

Router.routes.staf = {
  title: 'Masuk Petugas',
  render() {
    D.use('info', 'info', {}, { ttl: 120 });
    return loginLayout(`<form id="f-staf" novalidate>
      <div class="field"><label class="lbl" for="s-user">Username</label><div class="searchbox">${ic('user')}<input class="inp" id="s-user" name="username" autocomplete="username" autocapitalize="none" required></div></div>
      <div class="field"><label class="lbl" for="s-pass">Kata Sandi</label><div class="searchbox">${ic('lock')}<input class="inp" id="s-pass" name="password" type="password" autocomplete="current-password" required></div><div class="hint"><a href="javascript:void 0" data-act="togglePin">Tampilkan PIN</a></div></div>
      <div class="alert err hidden" id="l-err" role="alert">${ic('alert')}<div></div></div>
      <button class="btn dark lg block mt-s" id="l-btn" type="submit">${ic('shield')} Masuk Petugas</button>
      <div class="switch-link center muted">Peserta ujian? <a href="#/login">Masuk dengan Nomor Peserta</a></div>
    </form>`, { judul: 'Masuk Panitia & Petugas', foot: 'Lupa kata sandi Super Admin? Reset lewat editor Apps Script: jalankan <b>resetPasswordSuperAdmin()</b>.' });
  },
  mount() {
    warmup(); const f = $('#f-staf'); setTimeout(() => $('#s-user') && $('#s-user').focus(), 50);
    f.onsubmit = async e => {
      e.preventDefault(); const v = Form.read(f); const err = $('#l-err'); err.classList.add('hidden');
      if (!v.username.trim() || !v.password) { showErr(err, 'Username dan kata sandi wajib diisi.'); return; }
      const b = $('#l-btn'); b.disabled = true; b.innerHTML = ic('refresh', 'spin') + ' Memeriksa…';
      try { const d = await Api.call('loginStaf', v, { noAuth: true, retries: 1 }); await App.masuk(d, d.user.wajibGanti ? 'ganti' : 'dashboard'); }
      catch (e2) { showErr(err, e2.message); b.disabled = false; b.innerHTML = ic('shield') + ' Masuk Petugas'; }
    };
  }
};

Router.routes.ganti = {
  title: 'Ganti Kata Sandi',
  render() {
    return loginLayout(`<div class="alert info mt" style="text-align:left">${ic('info')}<div>Demi keamanan, ganti kata sandi sementara Anda sebelum melanjutkan.</div></div>
    <form id="f-gp" novalidate>
      <div class="field"><label class="lbl">Kata sandi sementara / lama</label><input class="inp" name="lama" type="password" autocomplete="current-password" required></div>
      <div class="field"><label class="lbl">Kata sandi baru</label><input class="inp" name="baru" type="password" autocomplete="new-password" required><div class="hint">Minimal 8 karakter, memuat huruf dan angka.</div></div>
      <div class="field"><label class="lbl">Ulangi kata sandi baru</label><input class="inp" name="ulang" type="password" autocomplete="new-password" required></div>
      <div class="alert err hidden" id="l-err" role="alert">${ic('alert')}<div></div></div>
      <button class="btn pri lg block mt-s" id="l-btn" type="submit">${ic('save')} Simpan & Lanjutkan</button>
      <div class="switch-link center"><a href="javascript:void 0" data-act="logout">Batal & keluar</a></div></form>`, { judul: 'Ganti Kata Sandi' });
  },
  mount() {
    const f = $('#f-gp'); f.onsubmit = async e => {
      e.preventDefault(); const v = Form.read(f), err = $('#l-err'); err.classList.add('hidden');
      if (v.baru !== v.ulang) { showErr(err, 'Konfirmasi kata sandi tidak sama.'); return; }
      const b = $('#l-btn'); b.disabled = true;
      try { const d = await Api.call('gantiPassword', { lama: v.lama, baru: v.baru }, { write: true }); Toast.ok('Kata sandi diperbarui.'); await App.masuk(d, 'dashboard'); }
      catch (e2) { showErr(err, e2.message); b.disabled = false; }
    };
  }
};

Router.routes.setup = {
  title: 'Pengaturan Awal',
  render() {
    return `<div class="login-bg"><div class="login-card"><div class="login-in"><div class="logo">${ic('settings', 'lg')}</div><h1>Hubungkan ke Backend</h1>
    <p class="muted">Backend (Google Apps Script) belum diisi. Tempel URL Web App berakhiran <span class="mono">/exec</span>. Untuk produksi, isi di <span class="mono">js/config.js</span> agar berlaku bagi semua peserta.</p>
    <form id="f-setup" class="mt" style="text-align:left"><div class="field"><label class="lbl">URL Web App</label><input class="inp mono" name="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(Store.get('gas_url') || '')}"></div>
    <div class="alert err hidden" id="l-err">${ic('alert')}<div></div></div><button class="btn pri block lg" id="l-btn" type="submit">${ic('link')} Uji & Simpan Koneksi</button></form>
    <p class="hint mt">Belum punya? Ikuti <b>PANDUAN.md</b>: jalankan <span class="mono">setupAppEnvironment()</span> lalu Deploy sebagai Web App (Execute as: Me, akses: Anyone).</p></div></div></div>`;
  },
  mount() {
    $('#f-setup').onsubmit = async e => {
      e.preventDefault(); const u = Form.read(e.target).url.trim(), err = $('#l-err'); err.classList.add('hidden');
      if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec/.test(u)) { showErr(err, 'URL tidak valid. Harus berupa https://script.google.com/macros/s/…/exec'); return; }
      const b = $('#l-btn'); b.disabled = true; b.innerHTML = ic('refresh', 'spin') + ' Menguji…';
      try { await Api.call('ping', {}, { url: u, noAuth: true, retries: 0, timeout: 30000 }); Store.set('gas_url', u); Toast.ok('Terhubung.'); D.reset(); location.hash = '#/login'; }
      catch (e2) { showErr(err, 'Gagal terhubung: ' + e2.message); b.disabled = false; b.innerHTML = ic('link') + ' Uji & Simpan Koneksi'; }
    };
  }
};

/* Verifikasi publik dokumen resmi */
Router.routes.verifikasi = {
  title: 'Verifikasi Dokumen',
  render(ctx) {
    const kode = ctx.args[0] || '';
    return `<div class="verify"><div class="card"><div class="center"><div class="logo avatar" style="width:56px;height:56px;margin:0 auto .6rem">${ic('shield', 'lg')}</div><h2>Verifikasi Keaslian Dokumen</h2><p class="muted">Masukkan kode verifikasi yang tercetak pada dokumen (di bawah kode QR).</p></div>
    <form id="f-v" class="mt"><div class="row"><input class="inp mono grow" id="v-kode" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" value="${esc(kode)}" autocapitalize="characters"><button class="btn pri" type="submit">${ic('search')} Periksa</button></div></form><div id="v-out" class="mt"></div></div></div>`;
  },
  mount(el, ctx) {
    const cek = async () => {
      const kode = $('#v-kode').value.trim(); const out = $('#v-out'); if (!kode) return;
      out.innerHTML = `<div class="skel" style="height:90px"></div>`;
      try {
        const r = await Api.call('deVerifikasi', { kode }, { noAuth: true, retries: 2 });
        if (!r.ditemukan) { out.innerHTML = `<div class="alert err">${ic('alert')}<div><b>Dokumen tidak ditemukan.</b><br>Kode tidak terdaftar. Dokumen ini mungkin tidak asli.</div></div>`; return; }
        const aktif = r.status === 'TERBIT';
        out.innerHTML = `<div class="alert ${aktif ? 'ok' : 'err'}">${ic(aktif ? 'checkc' : 'alert')}<div><b>${aktif ? 'DOKUMEN ASLI — terdaftar & masih berlaku' : 'DOKUMEN DITARIK — tidak berlaku lagi'}</b></div></div>
        <table class="tbl mt" style="min-width:0"><tbody><tr><td class="muted">Judul</td><td>${esc(r.judul)}</td></tr><tr><td class="muted">Nomor</td><td class="mono">${esc(r.nomor)}</td></tr><tr><td class="muted">Diterbitkan</td><td>${tglJam(r.terbit)} WIB</td></tr><tr><td class="muted">Penerbit</td><td>${esc(r.instansi)}<br><span class="sm muted">${esc(r.pemerintah)} · ${esc(r.kecamatan)}</span></td></tr><tr><td class="muted">Sidik jari (SHA-256)</td><td class="mono sm" style="word-break:break-all">${esc(r.hash)}</td></tr></tbody></table>
        <div class="mt"><label class="lbl">Cocokkan berkas PDF yang Anda pegang (opsional)</label><input type="file" id="v-file" accept="application/pdf" class="inp"><div id="v-hash" class="mt-s"></div></div>`;
        $('#v-file').onchange = async e => { const f = e.target.files[0]; if (!f) return; const buf = await f.arrayBuffer(); const h = await crypto.subtle.digest('SHA-256', buf); const hex = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''); const same = hex === r.hash; $('#v-hash').innerHTML = `<div class="alert ${same ? 'ok' : 'err'}">${ic(same ? 'checkc' : 'alert')}<div>${same ? '<b>Berkas identik</b> dengan dokumen terbitan resmi.' : '<b>Berkas BERBEDA</b> dari dokumen terbitan resmi (mungkin sudah diubah atau hasil cetak ulang).'}</div></div>`; };
      } catch (e) { out.innerHTML = `<div class="alert err">${ic('alert')}<div>${esc(e.message)}</div></div>`; }
    };
    $('#f-v').onsubmit = e => { e.preventDefault(); cek(); };
    if (ctx.args[0]) cek();
  }
};
