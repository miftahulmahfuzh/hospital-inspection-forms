# Inspeksi K3RS

Website pemeriksaan K3RS untuk **RSUD dr. Achmad Darwis**. Tiga formulir
diisi dari ponsel saat ronde, tersimpan di Neon Postgres, dan direkap di
`/admin` dengan unduhan Excel.

Menggantikan tiga Google Form yang sebelumnya dipakai. Pertanyaan, pilihan
jawaban, dan status wajib-isi disalin apa adanya dari form asli.

| Formulir | Rute | Jumlah pertanyaan |
| --- | --- | --- |
| Inspeksi Lingkungan K3RS | `/forms/inspeksi-lingkungan` | 36 dalam 8 bagian |
| Pemeriksaan Kondisi APAR | `/forms/kondisi-apar` | 10 |
| Tanggap Darurat & Kebakaran | `/forms/tanggap-darurat` | 19 dalam 2 bagian |

## Menjalankan secara lokal

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev
```

Buka <http://localhost:3000>.

## Variabel lingkungan

| Nama | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | ya | Connection string Neon Postgres. `DATABASE_URL_UNPOOLED` dipakai bila `DATABASE_URL` kosong. |
| `ADMIN_USERNAME` | ya | Nama pengguna untuk `/admin`. |
| `ADMIN_PASSWORD` | ya | Kata sandi untuk `/admin`. |
| `SESSION_SECRET` | ya | Penanda tangan cookie sesi. Minimal 32 karakter acak. |

Membuat `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"
```

## Basis data

Tabel dibuat otomatis saat permintaan pertama — tidak ada langkah migrasi
terpisah. Semua jawaban disimpan di satu tabel:

```
submissions(id, form_slug, area, inspection_date, answers jsonb, findings, created_at)
```

`answers` memakai id pertanyaan asli dari Google Form (`q<entry-id>`), sehingga
kolom tetap cocok meskipun teks pertanyaan diubah di kemudian hari.
`findings` menghitung jawaban `Tidak` dan `Rusak` — angka inilah yang
ditampilkan di rekap admin.

## Halaman admin

`/admin` meminta login, lalu menampilkan:

- jumlah temuan dan pemeriksaan pada rentang tanggal yang dipilih,
- ringkasan per formulir,
- 50 pemeriksaan terakhir,
- tombol **Unduh Excel**.

Berkas `.xlsx` berisi tiga lembar, satu per formulir. Satu baris = satu
pemeriksaan, satu kolom = satu pertanyaan, ditambah kolom `Jumlah temuan`.
Jawaban `Tidak`/`Rusak` diwarnai merah. Rentang tanggal di halaman admin ikut
diterapkan pada unduhan.

## Mengubah pertanyaan

`src/lib/forms.ts` dibuat otomatis dari HTML Google Form asli. Untuk
menyesuaikan pertanyaan, sunting berkas itu langsung — strukturnya sudah
tidak bergantung pada Google Form lagi. Tambahkan pertanyaan baru dengan id
yang belum pernah dipakai; jangan mengubah id lama, karena id itulah yang
mengikat data lama ke kolomnya.

## Deploy

Deploy ke Vercel. Setel keempat variabel lingkungan di **Project Settings →
Environment Variables** sebelum deploy pertama.
