# AI Control Center — Simple

1. Buka **AI Control Center → Simple**.
2. Pilih **Google Gemini Direct** dan model, misalnya `gemini-2.5-flash`.
3. Jika key sudah tersimpan, biarkan kolom API key kosong. Untuk menggantinya, isi key baru.
4. Gunakan **Tes koneksi** atau **Muat model** bila perlu. Untuk provider baru, simpan key dahulu.
5. Tekan **Aktifkan AI tanpa budget aplikasi**.

Simple memakai satu model dari provider yang dipilih untuk semua task yang ON. Tidak ada eskalasi, consensus, atau fallback ke provider lain. Kill switch provider/model dan task tetap berlaku. Pengaturan task Advanced tetap disimpan dan digunakan kembali saat menekan **Aktifkan routing dan budget Advanced**.

Simple mengikuti kuota, rate limit, serta tagihan akun provider. Tidak perlu mengisi budget global, budget provider, harga token, atau mengaktifkan `AI_ALLOW_PAID_PROVIDERS`. Mode ini bukan jaminan gratis dan bukan batas pengeluaran. Jangan aktifkan billing di akun provider jika Anda hanya ingin menggunakan kuota gratis provider.

Credential tetap terenkripsi server-side. Token, latency, status, dan estimasi biaya dicatat. Jika provider tidak mengirim biaya dan harga model belum diketahui, ledger menyimpan NULL dan UI menampilkan biaya belum tersedia, bukan $0. Advanced menolak pengeluaran berbudget jika riwayat bulan berjalan memiliki biaya yang belum diketahui; rekonsiliasi harga/pemakaian diperlukan agar batas dapat ditegakkan.

Administrator server dapat memblokir mode ini dengan `AI_DISABLE_PROVIDER_QUOTA_MODE=true`. Defaultnya Simple belum aktif sampai administrator workspace menekan tombol aktivasi. Hak aktivasi hanya untuk owner/admin.

Deploy harus menerapkan migrasi `ai_simple_nullable_usage_cost` sebelum memperbarui web dan worker. Tidak ada tabel baru atau perubahan RLS. Sync model mempertahankan harga manual ketika provider tidak mengirim harga.
