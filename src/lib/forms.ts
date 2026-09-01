// AUTO-GENERATED from the three source Google Forms. Edit via scripts, not by hand.
// Question ids are the original Google `entry.<id>` numbers, which keeps them stable
// even if a label is reworded later.

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

export const FORMS: FormDef[] = [
  {
    slug: "inspeksi-lingkungan",
    title: "Inspeksi Lingkungan K3RS",
    description: "Inspeksi kondisi lingkungan kerja: tangga, koridor, pencahayaan, kelistrikan, dan penanganan B3.",
    areaQuestionId: "q908163747",
    dateQuestionId: "q1749108742",
    sheetName: "Inspeksi Lingkungan K3RS",
    sections: [
      {
        title: null,
        questions: [
          { id: "q908163747", label: "Area", type: "text", required: true },
          { id: "q1749108742", label: "Tanggal Inspeksi", type: "date", required: true },
        ],
      },
      {
        title: "TANGGA",
        questions: [
          { id: "q2031050529", label: "Bebas hambatan", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q562357592", label: "Permukaan tangga tidak licin", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1298245201", label: "Tangga dan handrail dalam keadaan baik", type: "radio", required: false, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Koridor dan lantai",
        questions: [
          { id: "q1258528558", label: "Bebas dari gangguan dan penghalang", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1790750342", label: "Lantai utuh / tidak rusak", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1446038168", label: "Dalam kondisi baik", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1642915292", label: "Basah, Tergenang air, Licin", type: "radio", required: false, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Pencahayaan",
        questions: [
          { id: "q2065591207", label: "Pencahayaan mencukupi", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1313071294", label: "Lampu menyala dan berfungsi dengan baik", type: "radio", required: false, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Jendela",
        questions: [
          { id: "q668986726", label: "Dapat berfungsi dengan baik", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q315209038", label: "Daun jendela tidak berdebu", type: "radio", required: false, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Rak Penyimpanan",
        questions: [
          { id: "q469083543", label: "Tempat penyimpanan barang mencukupi", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q2090343218", label: "Barang-barang tersimpan rapi", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q2058239526", label: "Akses memadai", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q517946577", label: "Tersedia tangga atau alat bantu lainnya untuk mengambil barang ditempat yg tinggi", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q662222213", label: "Rak-rak penyimpanan tidak berdebu dan kotor", type: "radio", required: false, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Ruang Kantor",
        questions: [
          { id: "q251278726", label: "Kursi kantor Ergonomis", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1417164459", label: "Terdapat ruang untuk kaki", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q999466994", label: "Tinggi kursi bisa diubah/disesuaikan", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1681394688", label: "Ruang kerja mencukupi bagi semua staff", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1143260210", label: "Pintu lemari penyimpanan dokumen tertutup", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1745791542", label: "Pencahayaan mencukupi (>100 lux)", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q862112828", label: "Terdapat ventilasi udara", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q18596012", label: "Suhu ruangan mencukupi (24 C - 27 C)", type: "radio", required: false, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Kelistrikan",
        questions: [
          { id: "q553821516", label: "Stop kontak layak digunakan (tidak rusak)", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q244592559", label: "Perkabelan tertata (tidak kusut)", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q999554155", label: "Terdapat tray untuk kabel", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1231055613", label: "Alat-alat dalam perbaikan diberi label/dikunci", type: "radio", required: false, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Penanganan B3",
        questions: [
          { id: "q1920643355", label: "Tersedia Tempat penyimpanan B3", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1404195789", label: "Wadah penyimpanan bahan dalam kondisi baik (tidak bocor/rusak)", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q1920382825", label: "Wadah penyimpanan bahan memiliki label yang jelas", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q674815949", label: "Tempat penyimpanan bahan bersih dari ceceran / spill bahan", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q875061353", label: "MSDS tersedia di ruang penyimpanan bahan", type: "radio", required: false, options: ["Ya", "Tidak"] },
          { id: "q445808133", label: "Catatan temuan lain", type: "textarea", required: false },
        ],
      },
    ],
  },
  {
    slug: "kondisi-apar",
    title: "Pemeriksaan Kondisi APAR",
    description: "Observasi kondisi APAR pada setiap area kerja di RSUD dr. Achmad Darwis.",
    areaQuestionId: "q877086558",
    dateQuestionId: "q1519942906",
    sheetName: "Pemeriksaan Kondisi APAR",
    sections: [
      {
        title: null,
        questions: [
          { id: "q1519942906", label: "Tanggal pengecekan", type: "date", required: true },
          { id: "q877086558", label: "Lokasi", type: "select", required: true, options: ["Kantor", "IGD", "NICU", "ICU", "Apotek/Farmasi", "Radiologi", "Laboratorium", "Unit Transfusi Darah", "Ruang Operasi", "Poliklinik", "Rawat Inap Anggrek", "Rawat Inap Kenanga", "Rawat Inap Azalea", "Rawat Inap Nusa Indah", "Rawat Inap Bugenvile", "Rawat Inap Asoka", "Fisioterapis", "Laundry", "Gizi", "Instalasi Pemeliharaan Rumah Sakit", "Central Sterile Supply Departement (CSSD)", "Poli Paru", "Mushala"] },
          { id: "q1424661284", label: "Nomor Registrasi", type: "radio", required: true, options: ["Baik", "Rusak"] },
          { id: "q2606285", label: "Selang/Nozzle", type: "radio", required: true, options: ["Baik", "Rusak"] },
          { id: "q2082256505", label: "Class APAR", type: "radio", required: true, options: ["Baik", "Rusak"] },
          { id: "q398823413", label: "Segel", type: "radio", required: true, options: ["Baik", "Rusak"] },
          { id: "q456403765", label: "Segi Tiga APAR", type: "radio", required: true, options: ["Baik", "Rusak"] },
          { id: "q238599563", label: "Petunjuk Penggunaan", type: "radio", required: true, options: ["Baik", "Rusak"] },
          { id: "q1703312826", label: "Kartu Kontrol Pemeriksaan", type: "radio", required: true, options: ["Baik", "Rusak"] },
          { id: "q1109164454", label: "Catatan Tambahan", type: "textarea", required: true },
        ],
      },
    ],
  },
  {
    slug: "tanggap-darurat",
    title: "Tanggap Darurat & Kebakaran",
    description: "Checklist sarana prasarana tanggap darurat dan keselamatan kebakaran.",
    areaQuestionId: "q62346334",
    dateQuestionId: "q409004017",
    sheetName: "Tanggap Darurat & Kebakaran",
    sections: [
      {
        title: null,
        questions: [
          { id: "q409004017", label: "Waktu Pemeriksaan", type: "date", required: true },
          { id: "q62346334", label: "Area", type: "text", required: true },
        ],
      },
      {
        title: "Sarana Prasarana Tanggap Darurat",
        questions: [
          { id: "q1876211526", label: "Denah rute evakuasi ruangan dapat dibaca dan dilihat dengan jelas", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q62464848", label: "Terdapat dokumen risk register", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1126741817", label: "Terdapat dokumen prosedur tanggap darurat", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q267215949", label: "Terdapat rute evakuasi yang terpasang pada lantai/dinding ruangan", type: "radio", required: false, options: ["Ya", "Tidak"] },
        ],
      },
      {
        title: "Keselamatan Kebakaran",
        questions: [
          { id: "q701809248", label: "Terdapat APAR dengan jenis dan klasifikasi sesuai dengan jenis kebakaran", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1288201751", label: "Terdapat Label sebagai informasi tentang APAR", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q154858078", label: "APAR harus dalam kondisi penuh dan dapat dioperasikan yang ditunjukkan oleh jarum penunjuk ada pada posisi ―isi atau berwarna hijau", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1796310903", label: "Segel harus dalam kondisi baik dan tutup tabung terpasang kuat", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1318810376", label: "APAR yang terletak dilemari tidak boleh dikunci atau disediakan alat pemecah kaca bila diletakkan dilemari kaca", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1411062599", label: "Intruksi pengoperasian APAR harus diletakkan didepan APAR dan harus terlihat dengan jelas", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q169836343", label: "APAR harus diletakkan menyolok mata, mudah dijangkau dan diletakkan disepanjang jalur lintasan normal termasuk exit", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1173284162", label: "APAR harus tampak jelas dan tidak terhalangi oleh benda lain", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1772709878", label: "APAR harus diletakkan di temperatur sesuai dengan ditetapkan di Alat Pemadam", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q68898977", label: "APAR harus diberi tanda penempatan APAR. Tanda harus terlihat jelas dan mudah dimengerti", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q1740095087", label: "APAR harus dipasang dengan jarak bagian bawah APAR dengan lantai kurang dari 102 cm", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q656381962", label: "Interval pemeriksaan APAR tidak melebihi 31 hari", type: "radio", required: true, options: ["Ya", "Tidak"] },
          { id: "q735799239", label: "APAR dilengkapi log book pemeriksaan yang diisi setiap bulan", type: "radio", required: true, options: ["Ya", "Tidak"] },
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
