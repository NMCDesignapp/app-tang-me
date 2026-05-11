import { FormData, getExamData } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * PDF Generator using pdf-lib + pre-converted blank template PDF.
 *
 * Coordinates derived from template_1.docx (converted 2026-05-11).
 * Analyzed with PyMuPDF — labels and fill positions computed from exact span positions.
 *
 * Key findings from new template:
 * - Page 1: so_giay_yeu_cau is inside "(Số GYCBH/HĐBH: ...)" — limited to ~100pt before ")"
 * - Page 2: so_gttt has ~138pt before "Ngày cấp:" (which visually starts at x≈316.4)
 * - Page 2: so_gttt_dd has ~172pt before "Ngày cấp:" (which visually starts at x≈339.2)
 * - Page 2: ghi_chu supports 2 lines after "Nội dung cần kiểm tra bổ sung:"
 * - Right column exam items: kham_8 (viêm gan B), kham_8_1 (HBsAg), kham_8_2 (HBeAg)
 *
 * Y formula: pdf_lib_y = PAGE_HEIGHT - y_baseline
 * PAGE_HEIGHT = 841.89 (A4)
 */

const PAGE_HEIGHT = 841.89;

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

interface FieldDef {
  key: string;
  x: number;
  y: number;
  size: number;
  maxW: number;
}

// =============================================================================
// Page 1 (Cover page) — template_1.docx coordinates
// "(Số GYCBH/HĐBH:" ends at x=298.5, ")" at x=401.2
// "Họ và tên:" x1=95.4, "Ngày/tháng/năm sinh:" x1=159.7
// "Giới tính:" x1=350.9, "SĐT:" x1=69.4, "Địa chỉ:" x1=249.3
// =============================================================================
const PAGE1_FIELDS: FieldDef[] = [
  // After "(Số GYCBH/HĐBH:" x2=298.5, y_baseline=282.1 — ")" at x=401.2 limits space
  // Size 11 allows ~16 chars (e.g. "GYCBH/2026/00123") to fit in ~100pt
  { key: 'so_giay_yeu_cau', x: 300.5, y: 560.7, size: 11, maxW: 100 },
  // After "Họ và tên:" x1=95.4, y_baseline=345.2
  { key: 'ho_ten',          x:  98.4, y: 496.7, size: 13, maxW: 460 },
  // After "Ngày/tháng/năm sinh:" x1=159.7, y_baseline=369.3, before "Giới tính:" at x=300.4
  { key: 'ngay_sinh',       x: 162.7, y: 472.6, size: 11, maxW: 131 },
  // After "Giới tính:" x1=350.9, y_baseline=369.3
  { key: 'gioi_tinh',       x: 353.9, y: 472.6, size: 13, maxW: 240 },
  // After "SĐT:" x1=69.4, y_baseline=393.8, before "Địa chỉ:" at x=207.8
  { key: 'sdt',             x:  72.4, y: 448.1, size: 13, maxW: 132 },
  // After "Địa chỉ:" x1=249.3, y_baseline=393.8
  { key: 'dia_chi',         x: 252.3, y: 448.1, size: 13, maxW: 340 },
];

// =============================================================================
// Page 2 (Request form) — template_1.docx coordinates
// Key positions (from PyMuPDF search):
//   "Ngày cấp:" visual text starts at x=316.4 (Section I), x=339.2 (Section II)
//   "Nội dung cần kiểm tra bổ sung:" ends at x=185.3
// =============================================================================
const PAGE2_FIELDS: FieldDef[] = [
  // ---- Section I: Person info ----
  // After "Họ và tên:" x1=120.1, y_baseline=133.5
  { key: 'ho_ten_p2',      x: 123.1, y: 708.4, size: 12, maxW: 470 },
  // After "Ngày/tháng/năm sinh:" x1=176.3, y_baseline=151.5, before "Giới tính:" at x=313.3
  { key: 'ngay_sinh_p2',   x: 179.3, y: 690.4, size: 11, maxW: 126 },
  // After "Giới tính:" x1=359.9, y_baseline=151.5
  { key: 'gioi_tinh_p2',   x: 362.9, y: 690.4, size: 12, maxW: 230 },
  // After ":" x2=175.5, y_baseline=169.4 — "Ngày cấp:" visual at x=316.4 → ~138pt gap!
  { key: 'so_gttt',        x: 178.5, y: 672.5, size: 12, maxW: 138 },
  // After "Ngày cấp:" x1=365.3 (search), placeholder starts at x=371.3, y_baseline=169.7
  { key: 'ngay_cap',       x: 373.3, y: 672.2, size: 11, maxW: 220 },
  // After "Nơi cấp:" x1=114.4, y_baseline=187.4
  { key: 'noi_cap',        x: 117.4, y: 654.5, size: 12, maxW: 478 },

  // ---- Section II: Representative ----
  // After "1. Họ và tên:" x1=108.1 (search), y_baseline=222.4
  { key: 'nguoi_dai_dien', x: 113.1, y: 619.5, size: 12, maxW: 482 },
  // After "2. Ngày/tháng/năm sinh:" x1=164.3, y_baseline=240.3, before "Giới tính:" at x=331.5
  { key: 'ngay_sinh_dd',   x: 175.3, y: 601.6, size: 11, maxW: 156 },
  // After "Giới tính:" x1=378.1, y_baseline=240.3
  { key: 'gioi_tinh_dd',   x: 381.1, y: 601.6, size: 12, maxW: 214 },
  // After ":" x2=160.5, y_baseline=258.3 — "Ngày cấp:" at x=339.2 → ~172pt gap!
  { key: 'so_gttt_dd',     x: 166.9, y: 583.6, size: 12, maxW: 172 },
  // After "Ngày cấp:" x1=388.1 (search), placeholder at x=391.1, y_baseline=258.3
  { key: 'ngay_cap_dd',    x: 393.1, y: 583.6, size: 11, maxW: 200 },
  // After "Nơi cấp:" x1=108.4, y_baseline=276.2
  { key: 'noi_cap_dd',     x: 113.4, y: 565.7, size: 12, maxW: 482 },
  // After "4. Quan hệ..." x1=278.7, y_baseline=297.2
  { key: 'quan_he',        x: 280.9, y: 544.7, size: 12, maxW: 314 },

  // ---- Section III: Exam content ----
  // After "Mức khám:" x1=121.7, y_baseline=375.3
  { key: 'muc_kham',       x: 126.7, y: 466.6, size: 12, maxW: 468 },

  // ---- Ghi chú — 2-line support ----
  // "Nội dung cần kiểm tra bổ sung:" ends at x=185.3, y_baseline=679.3
  // Line 1: next to label, limited width
  { key: 'ghi_chu_l1',     x: 188.3, y: 162.6, size: 12, maxW: 380 },
  // Line 2: under label, extends to right
  { key: 'ghi_chu_l2',     x: 188.3, y: 144.6, size: 12, maxW: 400 },

  // ---- Dotted lines for handwriting ----
  { key: 'dots_bosung',    x: 188.3, y: 136.6, size: 12, maxW: 400 },

  // ---- Exam X marks - Left column (centered at x≈288) ----
  // y from placeholder y_base: kham_1=420.7, kham_2=439.6, etc.
  { key: 'kham_1',   x: 288, y: 421.2, size: 12, maxW: 20 },
  { key: 'kham_2',   x: 288, y: 402.3, size: 12, maxW: 20 },
  { key: 'kham_3',   x: 288, y: 383.4, size: 12, maxW: 20 },
  { key: 'kham_4',   x: 288, y: 364.5, size: 12, maxW: 20 },
  { key: 'kham_4_1', x: 288, y: 345.6, size: 12, maxW: 20 },
  { key: 'kham_4_2', x: 288, y: 326.7, size: 12, maxW: 20 },
  { key: 'kham_4_3', x: 288, y: 310.1, size: 12, maxW: 20 },
  { key: 'kham_4_4', x: 288, y: 293.5, size: 12, maxW: 20 },
  { key: 'kham_5',   x: 288, y: 276.9, size: 12, maxW: 20 },
  { key: 'kham_6',   x: 288, y: 260.3, size: 12, maxW: 20 },

  // ---- Exam X marks - Right column (centered at x≈523) ----
  // y matches left column rows: 7=1, 7.1=2, 7.2=3, 7.3=4, 7.4=4.1, 7.5=4.2,
  // 8=4.3, 8.1=4.4, 8.2=5, 9=6
  { key: 'kham_7',   x: 523, y: 421.2, size: 12, maxW: 20 },
  { key: 'kham_7_1', x: 523, y: 402.3, size: 12, maxW: 20 },
  { key: 'kham_7_2', x: 523, y: 383.4, size: 12, maxW: 20 },
  { key: 'kham_7_3', x: 523, y: 364.5, size: 12, maxW: 20 },
  { key: 'kham_7_4', x: 523, y: 345.6, size: 12, maxW: 20 },
  { key: 'kham_7_5', x: 523, y: 326.7, size: 12, maxW: 20 },
  { key: 'kham_8',   x: 523, y: 310.1, size: 12, maxW: 20 },
  { key: 'kham_8_1', x: 523, y: 293.5, size: 12, maxW: 20 },
  { key: 'kham_8_2', x: 523, y: 276.9, size: 12, maxW: 20 },
  { key: 'kham_9',   x: 523, y: 260.3, size: 12, maxW: 20 },
];

export async function generatePDF(
  data: FormData,
  selectedK: string[],
  attachedPdfBuffers: ArrayBuffer[]
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const fontkit = (await import('@pdf-lib/fontkit')).default;

  // Read the blank template PDF (pre-converted from DOCX)
  const templatePath = join(process.cwd(), 'public', 'templates', 'template-blank.pdf');
  const templateBytes = readFileSync(templatePath);

  // Load template
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  // Embed Liberation Serif font (same font as the template)
  const fontPath = join(process.cwd(), 'public', 'fonts', 'LiberationSerif-Regular.ttf');
  const fontBytes = readFileSync(fontPath);
  const font = await pdfDoc.embedFont(fontBytes);

  // Build exam data
  const { items: examItems, mucKham } = getExamData(selectedK, data.gioi_tinh, data.ngay_sinh);

  // ---- Split ghi_chu into 2 lines ----
  let ghiChuL1 = data.ghi_chu || '';
  let ghiChuL2 = '';
  if (ghiChuL1) {
    const line1MaxW = 380;
    const textWidth = font.widthOfTextAtSize(ghiChuL1, 12);
    if (textWidth > line1MaxW) {
      let splitIdx = ghiChuL1.length;
      while (splitIdx > 0 && font.widthOfTextAtSize(ghiChuL1.substring(0, splitIdx), 12) > line1MaxW) {
        splitIdx--;
      }
      const spaceIdx = ghiChuL1.lastIndexOf(' ', splitIdx);
      if (spaceIdx > 0) {
        splitIdx = spaceIdx + 1;
      }
      ghiChuL2 = ghiChuL1.substring(splitIdx).trim();
      ghiChuL1 = ghiChuL1.substring(0, splitIdx).trimEnd();
    }
  }

  // Build values map for all field keys
  const values: Record<string, string> = {
    // Page 1
    so_giay_yeu_cau: data.so_giay_yeu_cau,
    ho_ten:          data.ho_ten,
    ngay_sinh:       fmtDate(data.ngay_sinh),
    gioi_tinh:       data.gioi_tinh,
    sdt:             data.sdt,
    dia_chi:         data.dia_chi,

    // Page 2 - Section I
    ho_ten_p2:    data.ho_ten,
    ngay_sinh_p2: fmtDate(data.ngay_sinh),
    gioi_tinh_p2: data.gioi_tinh,
    so_gttt:      data.so_gttt,
    ngay_cap:     fmtDate(data.ngay_cap),
    noi_cap:      data.noi_cap,

    // Page 2 - Section II
    nguoi_dai_dien: data.nguoi_dai_dien,
    ngay_sinh_dd:   fmtDate(data.ngay_sinh_dd),
    gioi_tinh_dd:   data.gioi_tinh_dd,
    so_gttt_dd:     data.so_gttt_dd,
    ngay_cap_dd:    fmtDate(data.ngay_cap_dd),
    noi_cap_dd:     data.noi_cap_dd,
    quan_he:        data.quan_he,

    // Page 2 - Section III
    muc_kham: mucKham,

    // Ghi chú — 2 lines
    ghi_chu_l1: ghiChuL1,
    ghi_chu_l2: ghiChuL2,

    // Dotted lines (always visible)
    dots_bosung:    '.'.repeat(130),

    // Exam X marks
    kham_1:   examItems.has('1')   ? 'X' : '',
    kham_2:   examItems.has('2')   ? 'X' : '',
    kham_3:   examItems.has('3')   ? 'X' : '',
    kham_4:   examItems.has('4')   ? 'X' : '',
    kham_4_1: examItems.has('4_1') ? 'X' : '',
    kham_4_2: examItems.has('4_2') ? 'X' : '',
    kham_4_3: examItems.has('4_3') ? 'X' : '',
    kham_4_4: examItems.has('4_4') ? 'X' : '',
    kham_5:   examItems.has('5')   ? 'X' : '',
    kham_6:   examItems.has('6')   ? 'X' : '',
    kham_7:   examItems.has('7')   ? 'X' : '',
    kham_7_1: examItems.has('7_1') ? 'X' : '',
    kham_7_2: examItems.has('7_2') ? 'X' : '',
    kham_7_3: examItems.has('7_3') ? 'X' : '',
    kham_7_4: examItems.has('7_4') ? 'X' : '',
    kham_7_5: examItems.has('7_5') ? 'X' : '',
    kham_8:   examItems.has('8')   ? 'X' : '',
    kham_8_1: examItems.has('8_1') ? 'X' : '',
    kham_8_2: examItems.has('8_2') ? 'X' : '',
    kham_9:   examItems.has('9')   ? 'X' : '',
  };

  // Fill Page 1
  const pages = pdfDoc.getPages();
  fillPage(pages[0], PAGE1_FIELDS, values, font, rgb);

  // Fill Page 2
  fillPage(pages[1], PAGE2_FIELDS, values, font, rgb);

  // Merge attached PDFs if any
  if (attachedPdfBuffers.length > 0) {
    for (const buf of attachedPdfBuffers) {
      try {
        const srcDoc = await PDFDocument.load(buf);
        const copiedPages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        for (const page of copiedPages) {
          pdfDoc.addPage(page);
        }
      } catch (e) {
        console.error('Failed to merge attached PDF:', e);
      }
    }
  }

  return pdfDoc.save();
}

function fillPage(
  page: import('pdf-lib').PDFPage,
  fields: FieldDef[],
  values: Record<string, string>,
  font: import('pdf-lib').PDFFont,
  rgb: (r: number, g: number, b: number) => import('pdf-lib').PDFColor
) {
  for (const field of fields) {
    const value = values[field.key];
    if (!value) continue;

    let displayText = value;
    const textWidth = font.widthOfTextAtSize(displayText, field.size);
    if (textWidth > field.maxW) {
      while (
        displayText.length > 0 &&
        font.widthOfTextAtSize(displayText + '…', field.size) > field.maxW
      ) {
        displayText = displayText.slice(0, -1);
      }
      displayText += '…';
    }

    page.drawText(displayText, {
      x: field.x,
      y: field.y,
      size: field.size,
      font,
      color: rgb(0, 0, 0),
    });
  }
}
