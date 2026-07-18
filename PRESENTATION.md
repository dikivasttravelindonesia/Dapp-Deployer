# StellarBin — Bahan Presentasi untuk Dewan Juri

> Dokumen ini adalah panduan lengkap untuk mempresentasikan platform StellarBin kepada dewan juri.
> Setiap bagian mencakup fungsi halaman, cara penggunaan langkah-demi-langkah, dan penjelasan istilah teknis dalam bahasa yang mudah dipahami.

---

## Tentang StellarBin

**StellarBin** adalah protokol keuangan terdesentralisasi (*DeFi*) yang dibangun di atas jaringan blockchain **Stellar**, menggunakan smart contract **Soroban**. Platform ini memungkinkan siapa saja untuk:

- **Menukar token** secara langsung antara dua aset kripto tanpa perantara (bank, broker, atau bursa terpusat)
- **Menyediakan likuiditas** — menitipkan aset ke dalam pool agar bisa digunakan oleh pengguna lain yang ingin bertukar, dan mendapatkan bagian dari biaya transaksi sebagai imbal hasil
- **Membuat pool sendiri** secara permissionless — tanpa perlu izin dari siapapun, cukup tanda tangan wallet

StellarBin menggunakan mekanisme **DLMM (Dynamic Liquidity Market Maker)** — sebuah pendekatan inovatif di mana likuiditas dikelompokkan ke dalam "bin" harga diskrit, bukan tersebar merata seperti AMM konvensional. Ini membuat modal lebih efisien dan LP mendapatkan lebih banyak fee dari volume yang sama.

> ⚠️ **Status saat ini: Testnet Stellar** — Semua transaksi, token, dan saldo adalah aset uji coba tanpa nilai nyata. Kontrak sudah live dan terverifikasi di jaringan testnet Stellar.

---

## Daftar Halaman

| Halaman | URL | Fungsi Utama |
|---|---|---|
| Swap | `/swap` | Tukar token XLM ↔ TESTUSD secara on-chain |
| Pools | `/pools` | Lihat semua pool likuiditas (DLMM + AMM Stellar DEX) |
| Create | `/create` | Buat pool DLMM baru secara permissionless |
| Positions | `/positions` | Lihat dan kelola posisi LP milik wallet yang terhubung |

---

---

## 1. Halaman Swap (`/swap`)

### Fungsi Halaman

Halaman Swap adalah antarmuka utama untuk **menukar satu token dengan token lain**. Pengguna memasukkan jumlah token yang ingin dikirim, sistem langsung mengambil kuotasi harga secara *real-time* dari smart contract di blockchain, lalu pengguna menandatangani transaksi melalui wallet mereka.

Yang membuat StellarBin berbeda: **kuotasi tidak dihitung di server kami** — melainkan langsung dari smart contract di Stellar testnet menggunakan fungsi `simulate_swap`, sehingga harga yang ditampilkan adalah harga yang benar-benar akan dieksekusi on-chain.

---

### Cara Menggunakan (Langkah-demi-Langkah)

1. **Hubungkan wallet** — Klik tombol "Connect Wallet to Swap" dan pilih Freighter atau Albedo
2. **Pilih pasangan token** — Di kolom "You pay", pilih token yang akan dikirim (misal: XLM). Di kolom "You receive", pilih token tujuan (misal: TESTUSD)
3. **Masukkan jumlah** — Ketik jumlah token yang ingin ditukar, atau klik **MAX** untuk memakai seluruh saldo
4. **Tunggu kuotasi** — Sistem otomatis mengambil kuotasi dari blockchain (terlihat dari spinner). Hasilnya muncul di kolom "You receive" beserta rincian biaya
5. **Atur Slippage** (opsional) — Klik ikon ⚙️ untuk membuka panel pengaturan dan pilih toleransi slippage
6. **Konfirmasi Swap** — Klik "Confirm Swap", tanda tangani transaksi di wallet, tunggu konfirmasi dari jaringan Stellar

---

### Penjelasan Istilah di Halaman Ini

| Istilah | Penjelasan |
|---|---|
| **You pay** | Token yang akan kamu kirim/jual |
| **You receive** | Token yang akan kamu terima/beli |
| **MAX** | Gunakan seluruh saldo token yang tersedia di wallet |
| **Slippage Tolerance** | Batas maksimum perbedaan harga yang bisa diterima antara kuotasi dan eksekusi sesungguhnya. Misal: 0,5% artinya kamu masih mau menerima hasil 0,5% lebih rendah dari kuotasi karena harga bisa bergerak saat transaksi diproses |
| **Minimum received** | Jumlah minimum token yang akan diterima, sudah memperhitungkan slippage. Transaksi akan dibatalkan otomatis jika harga jatuh di bawah angka ini |
| **Swap fee** | Biaya yang dibayarkan ke pool. Sebagian besar (80%) masuk ke para LP (penyedia likuiditas), sisanya (20%) ke treasury protokol |
| **Bins crossed** | Berapa banyak "rentang harga" yang dilalui oleh transaksi swap ini. Semakin besar swap, semakin banyak bin yang dilewati |
| **Final bin** | ID bin harga terakhir yang menjadi titik berhenti setelah swap selesai. Ini merepresentasikan harga pasar terkini di pool tersebut |
| **Recent Swaps** | Riwayat transaksi swap terbaru yang sudah dikonfirmasi di blockchain untuk pool ini |
| **Connect Wallet** | Menghubungkan dompet kripto (Freighter/Albedo) agar bisa menandatangani transaksi |

---

---

## 2. Halaman Pools (`/pools`)

### Fungsi Halaman

Halaman Pools adalah **direktori semua pool likuiditas** yang tersedia. Pool dibagi menjadi dua kategori berbeda:

- **DLMM Pools** — Pool yang dijalankan oleh smart contract StellarBin kami di Stellar testnet. TVL dan harga dibaca *langsung* dari blockchain secara real-time.
- **AMM from Stellar DEX** — Pool likuiditas native dari Stellar DEX (bursa terdesentralisasi bawaan Stellar). Data diambil dari Horizon API secara live.

Halaman ini juga menampilkan tombol **Create** untuk membuat pool baru, serta filter kategori dan pencarian.

---

### Cara Menggunakan (Langkah-demi-Langkah)

1. **Filter kategori** — Gunakan tombol **All / DLMM / AMM** untuk memfilter jenis pool yang ditampilkan
2. **Cari pool** — Ketik nama token atau pasangan (misal: "XLM") di kolom pencarian
3. **Lihat statistik** — Setiap baris menampilkan pasangan token, harga terkini, TVL, volume 24 jam, dan APR
4. **Kelola DLMM Pool** — Klik tombol **Manage** pada pool DLMM untuk masuk ke halaman detail (tambah/hapus likuiditas)
5. **Lihat AMM Pool** — Klik tombol **View** pada pool AMM untuk membuka halaman pool di stellar.expert (explorer eksternal)
6. **Buat pool baru** — Klik tombol **+ Create** di sudut kanan atas

---

### Penjelasan Istilah di Halaman Ini

| Istilah | Penjelasan |
|---|---|
| **DLMM** | Dynamic Liquidity Market Maker — mekanisme pool milik StellarBin yang menggunakan sistem "bin" harga diskrit untuk efisiensi modal yang lebih tinggi |
| **AMM** | Automated Market Maker — mekanisme pool konvensional yang menggunakan formula matematika tetap (x × y = k) untuk menentukan harga secara otomatis tanpa order book |
| **TVL** | Total Value Locked — total nilai aset (dalam USD) yang saat ini tersimpan/dikunci di dalam sebuah pool. Ini adalah ukuran seberapa "dalam" pool tersebut |
| **24h Vol** | Volume transaksi dalam 24 jam terakhir. Ditampilkan sebagai `—` untuk DLMM di testnet karena data ini membutuhkan sistem pengindeksan khusus yang belum diaktifkan di testnet |
| **APR** | Annual Percentage Rate — perkiraan imbal hasil tahunan bagi penyedia likuiditas, dihitung dari fee yang terkumpul dibagi TVL. Ditampilkan `—` karena bergantung pada volume yang belum diindeks |
| **Fee** | Persentase biaya yang dikenakan ke setiap swap. Ditampilkan sebagai badge kecil di setiap pool (misal: `0.30% fee`) |
| **Bin step** | Jarak antar bin harga dalam basis poin (bps). Misal: `25 bps` = setiap bin berjarak 0,25% dari bin sebelumnya |
| **Launch** | Badge kuning yang menandakan pool ini adalah **Launch Pool** — swap masih dikunci hingga waktu aktivasi yang ditentukan pembuatnya |
| **Manage** | Tombol untuk masuk ke halaman detail pool DLMM, tempat kamu bisa menambah/menghapus likuiditas |
| **View** | Tombol untuk melihat detail pool AMM Stellar DEX di explorer eksternal (stellar.expert) |
| **On-chain** | Data atau aksi yang langsung berasal dari/ke blockchain, bukan dari server terpusat |
| **Aggregated** | Pool yang datanya dikumpulkan dan ditampilkan dari sumber lain (dalam hal ini: Stellar Horizon API) |

---

---

## 3. Halaman Create Pool (`/create`)

### Fungsi Halaman

Halaman Create adalah **antarmuka untuk membuat pool likuiditas baru** secara permissionless. Siapa saja — tanpa perlu izin dari tim StellarBin — bisa mendeploy pool baru langsung ke smart contract DLMM di Stellar testnet hanya dengan menandatangani satu transaksi.

Ada dua jenis pool yang bisa dibuat:

- **DLMM Standard Pool** — Aktif seketika. Begitu dibuat, siapa saja langsung bisa swap dan menyediakan likuiditas.
- **DLMM Launch Pool** — Khusus untuk peluncuran token baru. LP bisa menyetor likuiditas sejak awal, tetapi swap dikunci hingga waktu aktivasi yang ditentukan. Ini mencegah "sniping" — aksi bot yang membeli token segera setelah pool aktif sebelum LPs lain sempat bereaksi.

---

### Cara Menggunakan (Langkah-demi-Langkah)

1. **Pilih tipe pool** — Klik kartu **DLMM Standard Pool** atau **DLMM Launch Pool**
2. **Isi alamat token** — Masukkan alamat kontrak Token X (base token) dan Token Y (quote token)
3. **Pilih Bin Step** — Pilih jarak antar bin harga: 0,10% / 0,25% / 0,50% / 1,00%
4. **Pilih Base Fee** — Pilih biaya dasar per swap: 0,10% / 0,30% / 1,00%
5. **Atur Initial Active Bin** — Tentukan bin ID awal yang mewakili harga pasar saat pool dibuat
6. **(Khusus Launch Pool)** — Masukkan berapa menit sebelum swap diaktifkan
7. **Lihat Pool Preview** — Kartu pratinjau menampilkan ringkasan konfigurasi dan pembagian fee (80% LP / 20% Treasury)
8. **Buat Pool** — Klik tombol "Create Standard Pool" atau "Create Launch Pool", tanda tangani di wallet, tunggu konfirmasi on-chain
9. **Selesai** — Setelah pool terbuat, kamu diarahkan otomatis ke halaman detail pool baru tersebut

---

### Penjelasan Istilah di Halaman Ini

| Istilah | Penjelasan |
|---|---|
| **Permissionless** | Siapa saja bisa melakukan ini tanpa izin dari pihak manapun — cukup punya wallet dan sedikit XLM untuk biaya transaksi |
| **Token X (Base token)** | Token "dasar" dalam pasangan — biasanya token yang ingin diperdagangkan atau diluncurkan. Contoh: XLM |
| **Token Y (Quote token)** | Token "kuotasi" atau pembanding — biasanya stablecoin atau token referensi. Contoh: TESTUSD |
| **Bin Step** | Jarak persentase antar bin harga. Bin step kecil (0,10%) = lebih banyak bin, lebih presisi. Bin step besar (1,00%) = lebih sedikit bin, cocok untuk aset yang fluktuatif |
| **Base Fee** | Persentase biaya minimum yang dikenakan ke setiap swap di pool ini. Fee sesungguhnya bisa lebih tinggi saat volatilitas tinggi (dynamic fee) |
| **Dynamic Fee** | Fitur StellarBin di mana biaya swap otomatis naik saat aktivitas trading tinggi (volatilitas), lalu turun kembali ke base fee saat pasar tenang. Ini melindungi LP dari arbitrase yang merugikan |
| **Initial Active Bin** | Bin ID yang mewakili harga pasar pertama saat pool dibuat. Ini adalah "titik tengah" pool — bins di atasnya menyimpan Token X, bins di bawahnya menyimpan Token Y |
| **Activation Time** | Waktu (dalam menit dari sekarang) hingga swap diizinkan di Launch Pool. Sebelum waktu ini tercapai, hanya penambahan likuiditas yang diperbolehkan |
| **Anti-snipe** | Mekanisme perlindungan di Launch Pool — karena swap dikunci sementara, bot tidak bisa langsung membeli token begitu pool aktif. LP punya waktu untuk menyetor likuiditas terlebih dahulu secara setara |
| **Pool Preview** | Kartu pratinjau yang menampilkan ringkasan konfigurasi pool sebelum transaksi ditandatangani |
| **LP Fee Split** | Pembagian fee: 80% dari setiap biaya swap masuk ke kantong para LP (penyedia likuiditas), 20% ke treasury protokol StellarBin |
| **Protocol Treasury** | Dana cadangan protokol yang dikumpulkan dari 20% setiap fee swap. Dikelola oleh admin kontrak dan digunakan untuk pengembangan dan keberlangsungan platform |
| **create_pool** | Nama fungsi smart contract yang dipanggil saat membuat pool baru. Ini adalah transaksi on-chain nyata yang tersimpan permanen di blockchain |

---

---

## 4. Halaman Positions (`/positions`)

### Fungsi Halaman

Halaman Positions menampilkan **semua posisi likuiditas aktif milik wallet yang terhubung**, dibaca secara langsung (*real-time*) dari smart contract DLMM di blockchain. Tidak ada data simulasi atau perkiraan di sini — semua angka berasal langsung dari on-chain.

Setiap "posisi" mewakili likuiditas yang sudah kamu titipkan ke satu bin harga tertentu. Jika kamu menambahkan likuiditas ke 5 bin berbeda, kamu akan melihat 5 kartu posisi.

> **Penting:** Halaman ini membutuhkan wallet yang terhubung. Tanpa wallet, tidak ada data yang bisa ditampilkan karena data dibaca berdasarkan alamat wallet spesifik dari kontrak.

---

### Cara Menggunakan (Langkah-demi-Langkah)

1. **Hubungkan wallet** — Klik tombol "Connect Wallet". Data posisi langsung dimuat dari blockchain
2. **Lihat ringkasan** — Di bagian atas (setelah terhubung), tampil tiga angka: Total Value (USD), jumlah Bins aktif, dan Total Shares yang kamu miliki
3. **Periksa setiap posisi** — Setiap kartu menampilkan: pasangan token, nomor bin, nilai USD, jumlah shares, dan cadangan token X dan Y di bin tersebut
4. **Hapus likuiditas** — Klik tombol "Remove Liquidity" pada kartu posisi yang ingin ditarik. Tanda tangani transaksi di wallet — token akan kembali ke walletmu
5. **Tambah posisi baru** — Klik tombol "Explore Pools" untuk ke halaman Pools, lalu pilih pool dan tambahkan likuiditas melalui tombol Manage → Add Liquidity

---

### Penjelasan Istilah di Halaman Ini

| Istilah | Penjelasan |
|---|---|
| **Position** | Satu unit kepemilikan likuiditas di satu bin harga tertentu. Ini seperti "sertifikat kepemilikan" atas sebagian aset yang kamu titipkan ke pool |
| **Bin ID** | Nomor identifikasi bin harga tempat posisimu berada. Angka ini merepresentasikan rentang harga spesifik di dalam pool |
| **LP Shares** | "Saham likuiditas" — unit yang menunjukkan berapa besar bagianmu dari total likuiditas di bin tersebut. Semakin besar shares-mu, semakin besar proporsi fee yang kamu terima dari setiap swap yang melewati bin ini |
| **Token Reserves** | Jumlah Token X dan Token Y yang saat ini tersimpan di posisimu dalam bin tersebut. Komposisinya bisa berubah seiring aktivitas swap di pool |
| **USD Value** | Estimasi nilai total posisimu dalam dolar AS, dihitung dari cadangan token dikalikan harga pasar terkini |
| **Total Shares** | Total seluruh LP shares yang kamu miliki di semua posisi yang terbuka |
| **Remove Liquidity** | Proses menarik kembali aset yang kamu titipkan dari pool. Setelah dikonfirmasi on-chain, token langsung masuk kembali ke walletmu |
| **Per-bin position** | Setiap posisi terikat pada satu bin spesifik. Ini berbeda dari AMM konvensional di mana satu posisi mencakup seluruh rentang harga pool |
| **On-chain read** | Data yang dibaca langsung dari blockchain, bukan dari database server kami — sehingga selalu akurat dan tidak bisa dimanipulasi |

---

---

## 5. Halaman Pool Detail (`/pools/:id`)

### Fungsi Halaman

Halaman Pool Detail adalah **pusat manajemen untuk satu pool DLMM tertentu**. Di sini kamu bisa melihat distribusi likuiditas secara visual, statistik pool, dan melakukan aksi Add/Remove Liquidity.

---

### Elemen Utama dan Penjelasannya

| Elemen | Penjelasan |
|---|---|
| **Liquidity Distribution Chart** | Grafik batang yang menunjukkan sebaran likuiditas di setiap bin harga. Bin yang lebih tinggi = lebih banyak likuiditas di rentang harga tersebut. Token X (XLM) ditampilkan dengan warna berbeda dari Token Y (TESTUSD) |
| **Fee Split Bar** | Bar horizontal yang menunjukkan pembagian fee: bagian biru = porsi LP, bagian kuning = porsi protokol |
| **Launch Countdown** | Banner hitungan mundur berwarna kuning untuk Launch Pool yang belum aktif. Menampilkan sisa waktu hingga swap diizinkan |
| **Add Liquidity** | Tombol untuk menyetor token ke pool. Membuka modal dengan pilihan strategi dan rentang bin |
| **Remove Liquidity** | Tombol untuk menarik kembali token dari pool. Hanya bisa dieksekusi untuk posisi yang kamu miliki |
| **Spot Strategy** | Strategi distribusi likuiditas merata ke semua bin dalam rentang yang dipilih |
| **Curve Strategy** | Strategi distribusi terkonsentrasi di sekitar bin aktif (tengah) — cocok untuk trader yang yakin harga tidak akan bergerak terlalu jauh |
| **Bid-Ask Strategy** | Strategi distribusi terkonsentrasi di ujung-ujung rentang — cocok untuk market maker yang ingin menangkap pergerakan harga besar di kedua arah |
| **Bin Range (±)** | Slider untuk memilih berapa banyak bin di kiri dan kanan bin aktif yang akan diberi likuiditas. Misal: ±3 = 7 bin total |

---

---

---

## 6. Cara Kerja DLMM — Mekanisme & Contoh Perhitungan

### Apa Itu Bin?

Bayangkan harga sebuah aset seperti tangga. Setiap anak tangga adalah sebuah **bin** — rentang harga yang sempit dan tetap. Di dalam setiap bin, harga tidak berubah. Swap yang terjadi di satu bin menggunakan harga yang konsisten, sama seperti jual-beli di kurs tetap.

Di StellarBin (pool XLM/TESTUSD dengan `bin_step = 25 bps = 0,25%`):

```
Bin ID │ Harga (TESTUSD per XLM) │ Isi Awal (setelah seeding)
───────┼─────────────────────────┼────────────────────────────
  +2   │ 1,0050                  │ 100 XLM  +   0 TESTUSD
  +1   │ 1,0025                  │ 100 XLM  +   0 TESTUSD
   0   │ 1,0000  ← ACTIVE BIN   │  50 XLM  +  50 TESTUSD
  -1   │ 0,9975                  │   0 XLM  + 100 TESTUSD
  -2   │ 0,9950                  │   0 XLM  + 100 TESTUSD
```

**Aturan bin:**
- Bin **di atas** active bin → hanya menyimpan **Token X (XLM)** — siap dijual saat harga naik
- Bin **di bawah** active bin → hanya menyimpan **Token Y (TESTUSD)** — siap dijual saat harga turun
- **Active bin** → bisa menyimpan kedua token sekaligus

**Rumus harga:**
```
Harga bin N = (1 + bin_step)^N
Bin  0 = (1,0025)^0  = 1,0000 TESTUSD per XLM
Bin +1 = (1,0025)^1  = 1,0025 TESTUSD per XLM
Bin -1 = (1,0025)^-1 = 0,9975 TESTUSD per XLM
```

---

### Contoh Perhitungan 1 — Swap XLM → TESTUSD

> **Skenario:** Pengguna ingin menukar **120 XLM** menjadi TESTUSD.
> Pool state: bin 0 (50 TESTUSD), bin -1 (100 TESTUSD), bin -2 (100 TESTUSD).
> Base fee = 10 bps = **0,10%**.

Ketika menjual XLM (membeli TESTUSD), kontrak menelusuri bin dari aktif ke bawah.

**Tahap 1 — Bin 0 (harga 1,0000):**
```
Cadangan TESTUSD di bin 0 = 50 TESTUSD
XLM yang dibutuhkan       = 50 / 1,0000 = 50 XLM
Fee 0,10% dari 50 XLM    = 0,05 XLM
  → LP portion (80%)      = 0,04 XLM  (tinggal di bin, menambah reserves)
  → Protocol (20%)        = 0,01 XLM  (masuk treasury)
Total XLM dipakai user    = 50 + 0,05 = 50,05 XLM
TESTUSD diterima          = 50 TESTUSD
XLM sisa untuk dilanjutkan = 120 - 50,05 = 69,95 XLM
```

**Tahap 2 — Bin -1 (harga 0,9975):**
```
Sisa XLM user             = 69,95 XLM
Fee 0,10% dari 69,95      = 0,07 XLM
XLM bersih (setelah fee)  = 69,95 - 0,07 = 69,88 XLM
TESTUSD diterima          = 69,88 × 0,9975 = 69,70 TESTUSD
  → LP portion (80%)      = 0,056 XLM tinggal di bin -1
  → Protocol (20%)        = 0,014 XLM ke treasury
```

**Hasil akhir swap 120 XLM:**
```
┌─────────────────────────────────────────────────┐
│  TESTUSD diterima  :  50 + 69,70  =  119,70     │
│  Total fee dibayar :  0,05 + 0,07 =    0,12 XLM │
│  Bins yang dilalui :  2 bins                    │
│  Active bin akhir  :  -1                        │
└─────────────────────────────────────────────────┘
Effective price: 119,70 / 120 = 0,9975 TESTUSD per XLM
```

---

### Contoh Perhitungan 2 — Menyediakan Likuiditas & Klaim Fee

> **Skenario:** Alice dan Bob sama-sama menyetor TESTUSD ke **bin -1** (harga 0,9975).

**Langkah 1 — Alice menyetor 100 TESTUSD:**
```
LP shares Alice  = 1.000.000 shares
Total shares bin = 1.000.000
Kepemilikan Alice = 100%
```

**Langkah 2 — Bob menyetor 100 TESTUSD:**
```
LP shares Bob    = 1.000.000 shares (sama, karena harga per share tetap)
Total shares bin = 2.000.000
Kepemilikan Alice = 1.000.000 / 2.000.000 = 50%
Kepemilikan Bob   = 50%
```

**Langkah 3 — Swap terjadi: pengguna menukar 200 XLM lewat bin -1**
```
Fee dari 200 XLM = 200 × 0,10% = 0,20 XLM total fee
LP portion (80%) = 0,16 XLM → masuk ke reserves bin -1
Protocol (20%)   = 0,04 XLM → treasury
```

Setelah swap, bin -1 berisi:
```
Sebelum: 200 TESTUSD + 0 XLM
Setelah: 0 TESTUSD + (XLM dari swap) + 0,16 XLM (fee LP)
```

**Langkah 4 — Alice melakukan Remove Liquidity (klaim fee):**
```
Alice punya 50% dari total shares
Alice mendapat 50% dari semua reserves bin -1

Contoh jika bin -1 akhirnya berisi 198 XLM (dari swap) + 0,16 XLM (fee):
  → Alice menerima: 50% × 198,16 XLM = 99,08 XLM
  
Dibandingkan deposit awal Alice (100 TESTUSD ≈ 99,75 XLM di harga 0,9975):
  → Perubahan nilai mencerminkan aktivitas swap + fee earned
```

**Kesimpulan:** Fee tidak pernah dibayarkan secara terpisah. Setiap swap yang melewati sebuah bin langsung **menambah nilai reserves** bin tersebut, sehingga LP shares menjadi lebih berharga. Cara "klaim" adalah dengan menarik likuiditas — kamu otomatis mendapat bagian dari seluruh reserves termasuk fee.

---

### Dynamic Fee — Perlindungan LP dari Volatilitas

StellarBin menggunakan **dynamic fee** yang naik otomatis saat pasar sedang volatile:

```
Fee efektif = base_fee × (1 + volatility_multiplier)

Contoh:
  - Base fee: 0,10%
  - Swap normal (pasar tenang): fee = 0,10%
  - Swap saat volatilitas tinggi: fee bisa naik ke 0,30% – 0,50%
  - Fee kembali turun ke base seiring waktu (decay function)
```

**Mengapa ini penting?**
- Saat harga bergerak cepat, **arbitrageur** (bot yang memanfaatkan selisih harga) biasanya "memangsa" LP
- Dynamic fee membuat biaya lebih mahal bagi arbitrageur saat volatilitas tinggi
- LP mendapat fee lebih besar justru di momen paling berisiko
- Trader normal tidak terkena dampak karena mereka jarang swap saat volatilitas ekstrem

---

### Perbandingan DLMM vs AMM Konvensional

| Aspek | AMM Konvensional (x·y=k) | DLMM StellarBin |
|---|---|---|
| Distribusi likuiditas | Tersebar merata di semua harga (0 hingga ∞) | Terkonsentrasi di rentang bin yang dipilih LP |
| Efisiensi modal | Rendah — 99% likuiditas "tidur" | Tinggi — semua modal berada di harga aktif |
| Fee | Tetap (flat) | Dinamis, naik saat volatile |
| Presisi harga | Kontinu (infinite precision) | Diskrit (per bin, sangat sempit) |
| Kompleksitas LP | Sederhana (satu transaksi) | Lebih fleksibel (pilih strategi & range) |
| Anti-snipe | Tidak ada | Ya (Launch Pool dengan activation_ts) |

---

### Strategi Likuiditas (Pilihan LP)

Saat menambah likuiditas di StellarBin, LP memilih **distribusi** token ke dalam beberapa bin sekaligus:

```
SPOT Strategy (merata):
Bin: [-2][-1][ 0][+1][+2]
Berat: [1] [1] [1] [1] [1]  ← sama rata

CURVE Strategy (terkonsentrasi di tengah):
Bin: [-2][-1][ 0][+1][+2]
Berat: [1] [2] [3] [2] [1]  ← terbanyak di active bin

BID-ASK Strategy (terkonsentrasi di ujung):
Bin: [-2][-1][ 0][+1][+2]
Berat: [3] [2] [1] [2] [3]  ← terbanyak di ujung range
```

Setiap strategi cocok untuk kondisi pasar yang berbeda — Spot untuk LP pasif, Curve untuk LP yang yakin harga stabil, Bid-Ask untuk yang ingin menangkap pergerakan besar.

---

---

## Glosarium Lengkap (A–Z)

Kumpulan semua istilah teknis yang muncul di platform StellarBin, diurutkan alfabetis sebagai referensi cepat.

| Istilah | Definisi Singkat |
|---|---|
| **Active Bin** | Bin harga yang saat ini menjadi titik transaksi aktif di pool. Harga pasar terkini |
| **Albedo** | Salah satu aplikasi wallet Stellar berbasis web yang bisa digunakan untuk menandatangani transaksi di StellarBin |
| **AMM** | Automated Market Maker — sistem pool yang menentukan harga secara otomatis menggunakan formula matematika, tanpa order book |
| **Anti-snipe** | Mekanisme di Launch Pool yang mencegah bot membeli token lebih awal sebelum LP lain punya kesempatan menyetor |
| **APR** | Annual Percentage Rate — estimasi imbal hasil tahunan penyedia likuiditas dari fee yang terkumpul |
| **Base Fee** | Biaya swap minimum yang ditetapkan saat pembuatan pool, sebelum penyesuaian dinamis |
| **Bin** | Rentang harga diskrit (tetap) dalam pool DLMM. Setiap bin memiliki harga tetap dan cadangan token sendiri |
| **Bin ID** | Nomor identitas unik sebuah bin dalam pool. Angka positif = harga lebih tinggi, negatif = harga lebih rendah dari bin 0 |
| **Bin Step** | Jarak persentase antar bin yang berdekatan. Dinyatakan dalam basis poin (bps); 25 bps = 0,25% |
| **bps (basis poin)** | Satuan pengukuran persentase kecil. 1 bps = 0,01%; 100 bps = 1%; 10000 bps = 100% |
| **DeFi** | Decentralized Finance — sistem keuangan yang beroperasi di blockchain tanpa perantara tradisional seperti bank |
| **DLMM** | Dynamic Liquidity Market Maker — mekanisme pool StellarBin menggunakan bin harga diskrit dan dynamic fee |
| **Dynamic Fee** | Biaya swap yang otomatis naik saat volatilitas tinggi dan turun saat pasar tenang |
| **Fee Split** | Pembagian biaya swap: 80% untuk LP, 20% untuk treasury protokol |
| **Freighter** | Ekstensi browser wallet Stellar paling populer, digunakan untuk menandatangani transaksi di StellarBin |
| **Horizon API** | API resmi Stellar Foundation untuk mengakses data blockchain Stellar secara publik |
| **Launch Pool** | Tipe pool DLMM dengan fitur anti-snipe: swap dikunci hingga waktu aktivasi, LP bisa menyetor lebih awal |
| **Liquidity** | Aset yang disimpan ke dalam pool agar bisa digunakan untuk proses swap. Semakin dalam likuiditas, semakin stabil harga |
| **LP** | Liquidity Provider — pengguna yang menyetor aset ke pool dan mendapatkan bagian dari fee swap sebagai imbal hasil |
| **LP Shares** | Bukti kepemilikan proporsi likuiditas di sebuah bin. Digunakan untuk menghitung bagian fee dan nilai yang bisa ditarik |
| **Min Received** | Jumlah minimum token yang diterima dari swap, sudah memperhitungkan slippage tolerance |
| **On-chain** | Terjadi langsung di blockchain — tidak bisa diubah, dapat diverifikasi oleh siapa saja |
| **Permissionless** | Bisa dilakukan siapa saja tanpa perlu izin dari pihak manapun |
| **Pool** | Kumpulan dua token yang disimpan bersama untuk memfasilitasi pertukaran antar keduanya |
| **Pool Preview** | Kartu ringkasan konfigurasi pool sebelum transaksi pembuatan ditandatangani |
| **Protocol Treasury** | Kas protokol yang terkumpul dari 20% setiap fee swap, dikelola oleh admin kontrak |
| **Slippage** | Perbedaan antara harga yang diharapkan dan harga yang benar-benar terjadi saat transaksi dieksekusi |
| **Soroban** | Platform smart contract milik Stellar, digunakan untuk menjalankan logika kontrak DLMM StellarBin |
| **Standard Pool** | Tipe pool DLMM yang aktif seketika — swap dan penambahan likuiditas langsung bisa dilakukan setelah dibuat |
| **Stellar** | Jaringan blockchain publik yang dirancang untuk transfer aset dan keuangan terdesentralisasi dengan biaya sangat rendah |
| **Stellar DEX** | Bursa terdesentralisasi bawaan jaringan Stellar yang memungkinkan penukaran token tanpa smart contract |
| **Stellar Testnet** | Jaringan uji coba Stellar yang terpisah dari mainnet. Token tidak bernilai nyata, digunakan untuk development dan demo |
| **Swap** | Proses menukar satu token dengan token lain secara langsung melalui pool |
| **Swap Fee** | Biaya yang dikenakan untuk setiap transaksi swap, dibagi antara LP dan treasury protokol |
| **Token X** | Token "dasar" (base token) dalam sebuah pasangan pool. Contoh: XLM |
| **Token Y** | Token "kuotasi" (quote token) dalam sebuah pasangan pool. Contoh: TESTUSD |
| **Trustline** | Izin eksplisit di Stellar yang harus dibuat sebelum wallet bisa menyimpan token selain XLM native |
| **TVL** | Total Value Locked — total nilai (USD) semua aset yang tersimpan di dalam suatu pool atau protokol |
| **Wallet** | Aplikasi dompet kripto yang menyimpan kunci privat dan digunakan untuk menandatangani transaksi |
| **XLM** | Lumen — token native jaringan Stellar, digunakan untuk biaya transaksi dan sebagai aset dalam pool |

---

## Informasi Teknis untuk Juri

### Smart Contract yang Sudah Live di Stellar Testnet

| Kontrak | Alamat |
|---|---|
| **DLMM (utama)** | `CCW5MVYJFJPBJNJY7GN6BHC5BQR47RXVIM2T2X4F3YSQC7MQ7J4GNESH` |
| **Vault** | `CCDVBRMT3BI65JV2C7AQJOSIGT76MNNTXSVYDKGXKPBSOKVWQRGKU7VI` |
| **Math Library** | `CB7U2EL6L4AR2IWANOSXDYVHWL3D3PD3XOZU6PUA4MDAVWCOT3AAVX4Z` |
| **XLM SAC** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| **TESTUSD SAC** | `CCA733ILFGI7SESYWNBYTKHUJTJTSU2ORRT6SFNSDZWHYSE4WDLLDUND` |

### Yang Sudah Diuji On-chain

Semua fungsi kontrak berikut sudah diuji langsung di Stellar testnet dengan transaksi nyata:
- `create_pool` — membuat pool baru (permissionless)
- `add_liquidity_bin` — menambah likuiditas ke bin tertentu
- `remove_liquidity_bin` — menarik kembali likuiditas
- `swap_exact_in_bin` — eksekusi swap
- `simulate_swap` — kuotasi harga (read-only)
- `get_bin_reserves` — baca cadangan token per bin
- `list_pools` — daftar semua pool yang terdaftar
- `set_protocol_fee_bps` / `withdraw_protocol_fees` — manajemen fee oleh admin

### Stack Teknologi

- **Frontend**: React + Vite, TailwindCSS, shadcn/ui, Recharts
- **Backend API**: Express 5 (Node.js 24, TypeScript)
- **Smart Contract**: Rust + Soroban (Stellar)
- **Matematika Kontrak**: Fixed-point i128 (presisi 10^18) untuk menghindari floating-point error
- **Wallet Integration**: Freighter & Albedo (browser extensions)
