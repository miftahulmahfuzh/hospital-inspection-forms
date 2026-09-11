// AUTO-GENERATED from the three source Google Forms. Edit via scripts, not by hand.
// Question ids are the original Google `entry.<id>` numbers, which keeps them stable
// even if a label is reworded later. Ids prefixed `q_` have no Google-form source —
// they were added directly on this site when the forms diverged (2026-09-11 sync).

export type QuestionType = "text" | "textarea" | "radio" | "select" | "date";

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
};

export type Section = {
  title: string | null;
  questions: Question[];
};

export type FormDef = {
  slug: string;
  title: string;
  description: string;
  /** Question holding the ward/area being inspected. Always required. */
  areaQuestionId: string;
  /** Question holding the inspection date. Always required. */
  dateQuestionId: string;
  /** Excel sheet name; must stay <= 31 chars and free of []:*?/\\ */
  sheetName: string;
  sections: Section[];
};

const LOKASI_OPTIONS = [
  "Kantor",
  "IGD",
  "NICU",
  "ICU",
  "Apotek/Farmasi",
  "Radiologi",
  "Laboratorium",
  "Unit Transfusi Darah",
  "Ruang Operasi",
  "Poliklinik",
  "Rawat Inap Anggrek",
  "Rawat Inap Kenanga",
  "Rawat Inap Azalea",
  "Rawat Inap Nusa Indah",
  "Rawat Inap Bugenvile",
  "Rawat Inap Asoka",
  "Fisioterapis",
  "Laundry",
  "Gizi",
  "Instalasi Pemeliharaan Rumah Sakit",
  "Central Sterile Supply Departement (CSSD)",
  "Poli Paru",
  "Mushala",
];

export const FORMS: FormDef[] = [
  {
    slug: "inspeksi-lingkungan",
    title: "Inspeksi Lingkungan K3RS",
    description:
      "Inspeksi K3 lingkungan rumah sakit dilakukan secara berkala untuk memastikan kondisi lingkungan kerja memenuhi standar kesehatan, keselamatan, dan kenyamanan bagi pasien, petugas, maupun pengunjung.",
    areaQuestionId: "q908163747",
    dateQuestionId: "q1749108742",
    sheetName: "Inspeksi Lingkungan K3RS",
    sections: [
      {
        title: null,
        questions: [
          { id: "q1749108742", label: "Tanggal Inspeksi", type: "date", required: true },
          { id: "q908163747", label: "Lokasi", type: "text", required: true },
        ],
      },
      {
        title: "TANGGA",
        questions: [
          { id: "q2031050529", label: "Bebas hambatan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q562357592", label: "Permukaan tangga tidak licin", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1298245201", label: "Tangga dan handrail dalam keadaan baik", type: "radio", required: true, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Koridor dan lantai",
        questions: [
          { id: "q1258528558", label: "Bebas dari gangguan dan penghalang", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_plafon_rusak", label: "Plafon tidak rusak/bocor/berlubang", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1790750342", label: "Lantai utuh / tidak rusak", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1642915292", label: "Lantai tidak basah, tergenang air, Licin", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_dinding_retak", label: "Dinding ruangan tidak berlumut/bocor/retak", type: "radio", required: true, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Pencahayaan",
        questions: [
          { id: "q2065591207", label: "Pencahayaan ruangan cukup terang sesuai fungsi ruang", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1313071294", label: "Lampu penerangan berfungsi baik, tidak ada yang mati/berkedip", type: "radio", required: true, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Kualitas Udara",
        questions: [
          { id: "q668986726", label: "Jendela berfungsi dengan baik", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q315209038", label: "Daun jendela tidak berdebu", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_bau_tidak_sedap", label: "Tidak tercium bau tidak sedap yang mengganggu di area pelayanan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_sirkulasi_udara", label: "Sirkulasi udara ruangan berjalan baik (alami/mekanis)", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_ac_exhaust", label: "AC/exhaust fan berfungsi normal dan bersih dari debu", type: "radio", required: true, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Rak Penyimpanan",
        questions: [
          { id: "q469083543", label: "Tempat penyimpanan barang mencukupi", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q2090343218", label: "Barang-barang tersimpan rapi", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q517946577", label: "Tersedia tangga atau alat bantu lainnya untuk mengambil barang ditempat yg tinggi", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q662222213", label: "Rak-rak penyimpanan tidak berdebu dan kotor", type: "radio", required: true, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Area Kerja",
        questions: [
          { id: "q251278726", label: "Kursi kantor Ergonomis", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1417164459", label: "Terdapat ruang untuk kaki", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q999466994", label: "Tinggi kursi bisa diubah/disesuaikan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1681394688", label: "Ruang kerja mencukupi bagi semua staff", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1143260210", label: "Pintu lemari penyimpanan dokumen tertutup", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q862112828", label: "Terdapat ventilasi udara", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q18596012", label: "Suhu ruangan mencukupi (24 C - 27 C)", type: "radio", required: true, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Lingkungan",
        questions: [
          { id: "q_pedagang_asongan", label: "Tidak ada pedagang asongan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_jemuran_pakaian", label: "Tidak ada jemuran pakaian pasien/keluarga pasien", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_bebas_sampah", label: "Lingkungan bebas sampah", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_rambu_k3", label: "Sign/rambu K3 lingkungan (dilarang merokok, dll.) terpasang jelas", type: "radio", required: true, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Kelistrikan",
        questions: [
          { id: "q553821516", label: "Stop kontak layak digunakan (tidak rusak)", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q244592559", label: "Perkabelan tertata (tidak kusut)", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_kabel_getas", label: "Kondisi perkabelan tidak terbuka/getas/korslet", type: "radio", required: true, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Penanganan B3",
        questions: [
          { id: "q1920643355", label: "Tersedia Tempat penyimpanan B3", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1404195789", label: "Wadah penyimpanan bahan dalam kondisi baik (tidak bocor/rusak)", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1920382825", label: "Wadah penyimpanan bahan memiliki label yang jelas", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q674815949", label: "Tempat penyimpanan bahan bersih dari ceceran / spill bahan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q875061353", label: "MSDS B3 tersedia di ruang penyimpanan bahan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_eyewash", label: "Tersedia eyewash di area berisiko", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q445808133", label: "Catatan temuan lain", type: "textarea", required: true },
        ],
      },
    ],
  },
  {
    slug: "kondisi-apar",
    title: "Pemeriksaan Kondisi APAR",
    description:
      "Pemeriksaan Alat Pemadam Api Ringan (APAR) dilakukan secara berkala untuk memastikan setiap unit dalam kondisi siap pakai saat dibutuhkan.",
    areaQuestionId: "q877086558",
    dateQuestionId: "q1519942906",
    sheetName: "Pemeriksaan Kondisi APAR",
    sections: [
      {
        title: null,
        questions: [
          { id: "q1519942906", label: "Tanggal pengecekan", type: "date", required: true },
          { id: "q877086558", label: "Lokasi", type: "select", required: true, options: LOKASI_OPTIONS },
          { id: "q_pressure_gauge", label: "Pressure gauge — Jarum pressure gauge menunjukkan tekanan pada zona hijau (bertekanan normal, tidak kosong/lemah dan tidak overpressure)", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_segel_apar", label: "Segel (seal) — Segel pengaman pada pin/tuas APAR masih utuh dan belum pernah dibuka/rusak", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_hose_apar", label: "Hose (selang APAR) — Selang dalam kondisi baik, tidak retak, tidak tersumbat, dan tidak ada tanda kebocoran", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_cylinder_apar", label: "Cylinder (tabung) — Tabung tidak menunjukkan tanda korosi, penyok, kebocoran, atau kerusakan fisik lainnya", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_head_grip", label: "Head grip (pegangan APAR) — Pegangan/handle terpasang kuat, tidak longgar, retak, atau patah", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_spindle_head", label: "Spindle head — Bagian spindle head berfungsi normal, tidak macet, dan tidak ada kebocoran pada sambungan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_hydrotest", label: "Hydrotest — APAR masih dalam masa berlaku hydrotest (belum melewati jadwal uji tekan ulang sesuai ketentuan)", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1109164454", label: "Catatan Tambahan", type: "textarea", required: true },
        ],
      },
    ],
  },
  {
    slug: "tanggap-darurat",
    title: "Tanggap Darurat & Kebakaran",
    description:
      "Inspeksi sarana prasarana tanggap darurat dilakukan secara berkala untuk memastikan seluruh fasilitas pendukung kondisi darurat di rumah sakit berfungsi baik dan siap digunakan sewaktu-waktu.",
    areaQuestionId: "q62346334",
    dateQuestionId: "q409004017",
    sheetName: "Tanggap Darurat & Kebakaran",
    sections: [
      {
        title: null,
        questions: [
          { id: "q409004017", label: "Waktu Pemeriksaan", type: "date", required: true },
          { id: "q62346334", label: "Lokasi", type: "text", required: true },
        ],
      },
      {
        title: "Sarana Tanggap Darurat",
        questions: [
          { id: "q1126741817", label: "Terdapat dokumen prosedur tanggap darurat", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1876211526", label: "Denah rute evakuasi ruangan dapat dibaca dan dilihat dengan jelas", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_jalur_evakuasi_bebas_hambatan", label: "Jalur evakuasi bebas dari hambatan/barang yang menghalangi", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_jalur_evakuasi_lebar", label: "Jalur evakuasi memiliki lebar yang memadai untuk evakuasi massal", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q_titik_kumpul_tersedia", label: "Titik kumpul (assembly point) tersedia dan mudah diakses", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_titik_kumpul_kapasitas", label: "Titik kumpul memiliki kapasitas cukup dan jarak aman dari bangunan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q267215949", label: "Terdapat petunjuk arah evakuasi yang terpasang pada dinding ruangan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_cctv_berfungsi", label: "CCTV ruangan berfungsi dengan baik", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_pintu_darurat_tidak_terkunci", label: "Pintu darurat tidak terkunci/terhalang saat jam operasional", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q_pintu_darurat_arah_keluar", label: "Pintu darurat membuka ke arah luar (searah evakuasi)", type: "radio", required: false, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Keselamatan Kebakaran",
        questions: [
          { id: "q701809248", label: "Terdapat APAR dengan jenis dan klasifikasi sesuai dengan jenis kebakaran", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1288201751", label: "Terdapat Label sebagai informasi tentang APAR", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1318810376", label: "APAR yang terletak dilemari tidak boleh dikunci atau disediakan alat pemecah kaca bila diletakkan dilemari kaca", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1411062599", label: "Intruksi pengoperasian APAR harus diletakkan didepan APAR dan harus terlihat dengan jelas", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q169836343", label: "APAR harus diletakkan menyolok mata, mudah dijangkau dan diletakkan disepanjang jalur lintasan normal termasuk exit", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1173284162", label: "APAR harus tampak jelas dan tidak terhalangi oleh benda lain", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1772709878", label: "APAR harus diletakkan di temperatur sesuai dengan ditetapkan di Alat Pemadam", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q68898977", label: "APAR harus diberi tanda penempatan APAR. Tanda harus terlihat jelas dan mudah dimengerti", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1740095087", label: "APAR harus dipasang dengan jarak bagian bawah APAR dengan lantai kurang dari 102 cm", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q656381962", label: "Interval pemeriksaan APAR tidak melebihi 31 hari", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q735799239", label: "APAR dilengkapi log book pemeriksaan yang diisi setiap bulan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_papan_jadwal_code_red", label: "Papan tulis jadwal tim code red terisi, lengkap dengan helm petugas", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_tidak_ada_puntung_rokok", label: "Tidak terdapat puntung rokok di ruangan dan sekitar ruangan", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q_temuan_lainnya", label: "Temuan lainnya", type: "textarea", required: true },
        ],
      },
    ],
  },
];

export const FORM_BY_SLUG: Record<string, FormDef> = Object.fromEntries(
  FORMS.map((f) => [f.slug, f]),
);

export function getForm(slug: string): FormDef | undefined {
  return FORM_BY_SLUG[slug];
}

/** Flat question list in display order — the column order used by the Excel export. */
export function allQuestions(form: FormDef): Question[] {
  return form.sections.flatMap((s) => s.questions);
}

/**
 * Answers the source forms treat as something to act on: "Tidak" on a compliance
 * checklist, "Rusak" on an equipment check. These are what the admin dashboard counts.
 */
export const FINDING_VALUES = new Set(["Tidak", "Rusak"]);

export function countFindings(answers: Record<string, string>): number {
  return Object.values(answers).filter((v) => FINDING_VALUES.has(v)).length;
}
