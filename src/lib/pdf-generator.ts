import { FormData, getExamData } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * PDF Generator using pdf-lib + pre-converted blank template PDF.
 *
 * Coordinates derived from template_1.pdf (converted from DOCX 2026-05-11).
 * All positions extracted with PyMuPDF search_for() for exact placeholder bounding boxes.
 *
 * Coordinate system:
 *   PyMuPDF: y increases downward (0 = top)
 *   pdf-lib: y increases upward (0 = bottom)
 *   Conversion: pdf_lib_y = PAGE_HEIGHT - pymupdf_y2
 *   PAGE_HEIGHT = 841.89 (A4)
 *
 * Key layout constraints:
 *   Page 1: so_giay_yeu_cau inside "(Số GYCBH/HĐBH: ...)" — ~100pt before ")"
 *   Page 2: so_gttt has ~50pt before "Ngày cấp:" (tight — size 9 for max digits)
 *   Page 2: so_gttt_dd has ~172pt before "Ngày cấp:" (plenty of space)
 *   Page 2: ghi_chu single line only (line 2 would overlap "An Giang, ngày …")
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
// Page 1 (Cover page) — coordinates from template_1.pdf PyMuPDF search
// All x/y values from exact placeholder bounding boxes:
//   {so_giay_yeu_cau} Rect(298.55, 267.72, 401.18, 282.11)
//   {ho_ten}          Rect(98.67,  330.77, 146.48, 345.16)
//   {ngay_sinh}       Rect(166.45, 353.98, 237.40, 369.47)
//   {gioi_tinh}       Rect(354.20, 354.87, 413.57, 369.26)
//   {sdt}             Rect(72.70,  378.48, 102.45, 393.97)
//   {dia_chi}         Rect(252.52, 379.37, 303.22, 393.76)
// =============================================================================
const PAGE1_FIELDS: FieldDef[] = [
  // so_giay_yeu_cau: between "(Số GYCBH/HĐBH:" and ")"
  // x=298.55, y2=282.11 → pdf_y=559.8; maxW before ")" at x≈401.2 → 102pt
  { key: 'so_giay_yeu_cau', x: 298.5, y: 559.8, size: 11, maxW: 100 },
  // ho_ten: after "Họ và ten:" label
  // x=98.67, y2=345.16 → pdf_y=496.7; extends to page right → maxW=460
  { key: 'ho_ten',          x:  98.7, y: 496.7, size: 13, maxW: 460 },
  // ngay_sinh: after "Ngày/tháng/năm sinh:", before "Giới tính:" at x≈300.4
  // x=166.45, y2=369.47 → pdf_y=472.4; maxW=300.4-166.4=134 → 131
  { key: 'ngay_sinh',       x: 166.4, y: 472.4, size: 11, maxW: 131 },
  // gioi_tinh: after "Giới tính:" label
  // x=354.20, y2=369.26 → pdf_y=472.6; extends to page right → maxW=230
  { key: 'gioi_tinh',       x: 354.2, y: 472.6, size: 13, maxW: 230 },
  // sdt: after "SĐT:", before "Địa chỉ:" at x≈207.8
  // x=72.70, y2=393.97 → pdf_y=447.9; maxW=207.8-72.7=135 → 132
  { key: 'sdt',             x:  72.7, y: 447.9, size: 13, maxW: 132 },
  // dia_chi: after "Địa chỉ:" label
  // x=252.52, y2=393.76 → pdf_y=448.1; extends to page right → maxW=340
  { key: 'dia_chi',         x: 252.5, y: 448.1, size: 13, maxW: 340 },
];

// =============================================================================
// Page 2 (Request form) — coordinates from template_1.pdf PyMuPDF search
//
// Section I (NGƯỜI ĐƯỢC KIỂM TRA SỨC KHỎE):
//   {ho_ten}     Rect(123.05, 119.37, 170.86, 133.76)
//   {ngay_sinh}  Rect(182.40, 137.32, 248.26, 151.71)
//   {gioi_tinh}  Rect(362.95, 137.32, 422.32, 151.71)
//   {so_gttt}    Rect(175.50, 155.27, 223.31, 169.66)
//   {ngay_cap}   Rect(371.30, 155.27, 433.50, 169.66)
//   {noi_cap}    Rect(114.40, 173.22, 167.96, 187.61)
//
// Section II (NGƯỜI ĐẠI DIỆN):
//   {nguoi_dai_dien} Rect(111.05, 207.97, 204.35, 222.36)
//   {ngay_sinh_dd}   Rect(173.30, 225.92, 258.66, 240.31)
//   {gioi_tinh_dd}   Rect(381.20, 225.92, 460.07, 240.31)
//   {so_gttt_dd}     Rect(164.95, 243.87, 232.26, 258.26)
//   {ngay_cap_dd}    Rect(391.15, 243.87, 472.85, 258.26)
//   {noi_cap_dd}     Rect(111.40, 261.82, 184.48, 276.21)
//   {quan_he}        Rect(278.90, 282.77, 335.36, 297.16)
//
// Section III:
//   {muc_kham}       Rect(124.70, 360.87, 194.90, 375.26)
//
// Ghi chú:
//   {ghi_chu}        Rect(191.32, 666.06, 241.46, 679.34)
//   "An Giang, ngày …" at y=695.1 → pdf_y=146.8 (only ~16pt gap below ghi_chu)
//   → Single line only to avoid overlapping "An Giang"
//
// Exam X marks — centered in "Yêu cầu" columns:
//   Left column center ≈ x=290, Right column center ≈ x=522
//   Y positions from row text y2 values (baseline of size-12 text)
// =============================================================================
const PAGE2_FIELDS: FieldDef[] = [
  // ---- Section I: Person info ----
  // ho_ten_p2: x=123.05, y2=133.76 → pdf_y=708.1
  { key: 'ho_ten_p2',      x: 123.1, y: 708.1, size: 12, maxW: 470 },
  // ngay_sinh_p2: x=182.40, y2=151.71 → pdf_y=690.2; before "Giới tính:" at x≈313.3
  { key: 'ngay_sinh_p2',   x: 182.4, y: 690.2, size: 11, maxW: 126 },
  // gioi_tinh_p2: x=362.95, y2=151.71 → pdf_y=690.2
  { key: 'gioi_tinh_p2',   x: 363.0, y: 690.2, size: 12, maxW: 230 },
  // so_gttt: x=175.50, y2=169.66 → pdf_y=672.2
  // CRITICAL: "Ngày cấp:" starts at x≈226.4 → only ~50pt gap!
  // Using size 8 to fit all 12 CCCD digits in 50pt
  { key: 'so_gttt',        x: 175.5, y: 671.0, size: 8,  maxW: 50 },
  // ngay_cap: x=371.30, y2=169.66 → pdf_y=672.2; after "Ngày cấp:" label
  { key: 'ngay_cap',       x: 371.3, y: 672.2, size: 11, maxW: 200 },
  // noi_cap: x=114.40, y2=187.61 → pdf_y=654.3
  { key: 'noi_cap',        x: 114.4, y: 654.3, size: 12, maxW: 478 },

  // ---- Section II: Representative ----
  // nguoi_dai_dien: x=111.05, y2=222.36 → pdf_y=619.5
  { key: 'nguoi_dai_dien', x: 111.1, y: 619.5, size: 12, maxW: 482 },
  // ngay_sinh_dd: x=173.30, y2=240.31 → pdf_y=601.6; before "Giới tính:" at x≈331.5
  { key: 'ngay_sinh_dd',   x: 173.3, y: 601.6, size: 11, maxW: 156 },
  // gioi_tinh_dd: x=381.20, y2=240.31 → pdf_y=601.6
  { key: 'gioi_tinh_dd',   x: 381.2, y: 601.6, size: 12, maxW: 214 },
  // so_gttt_dd: x=164.95, y2=258.26 → pdf_y=583.6; "Ngày cấp:" at x≈339.2 → ~172pt
  { key: 'so_gttt_dd',     x: 165.0, y: 583.6, size: 12, maxW: 172 },
  // ngay_cap_dd: x=391.15, y2=258.26 → pdf_y=583.6
  { key: 'ngay_cap_dd',    x: 391.2, y: 583.6, size: 11, maxW: 200 },
  // noi_cap_dd: x=111.40, y2=276.21 → pdf_y=565.7
  { key: 'noi_cap_dd',     x: 111.4, y: 565.7, size: 12, maxW: 482 },
  // quan_he: x=278.90, y2=297.16 → pdf_y=544.7
  { key: 'quan_he',        x: 278.9, y: 544.7, size: 12, maxW: 314 },

  // ---- Section III: Exam content ----
  // muc_kham: x=124.70, y2=375.26 → pdf_y=466.6
  { key: 'muc_kham',       x: 124.7, y: 466.6, size: 12, maxW: 468 },

  // ---- Ghi chú — single line only ----
  // "Nội dung cần kiểm tra bổ sung:" label ends at x≈188.3
  // {ghi_chu} starts at x=191.32, y2=679.34 → pdf_y=162.6
  // "An Giang, ngày …" at pdf_y≈146.8 — only ~16pt gap, no room for line 2
  { key: 'ghi_chu',        x: 191.3, y: 162.6, size: 12, maxW: 378 },

  // ---- Exam X marks - Left column (centered in "Yêu cầu" at x≈290) ----
  // Y from row text baselines: y2 values → pdf_y = PAGE_HEIGHT - y2
  { key: 'kham_1',   x: 290, y: 419.0, size: 12, maxW: 20 },
  { key: 'kham_2',   x: 290, y: 400.1, size: 12, maxW: 20 },
  { key: 'kham_3',   x: 290, y: 381.2, size: 12, maxW: 20 },
  { key: 'kham_4',   x: 290, y: 362.3, size: 12, maxW: 20 },
  { key: 'kham_4_1', x: 290, y: 343.4, size: 12, maxW: 20 },
  { key: 'kham_4_2', x: 290, y: 324.5, size: 12, maxW: 20 },
  { key: 'kham_4_3', x: 290, y: 307.9, size: 12, maxW: 20 },
  { key: 'kham_4_4', x: 290, y: 291.3, size: 12, maxW: 20 },
  { key: 'kham_5',   x: 290, y: 274.7, size: 12, maxW: 20 },
  { key: 'kham_6',   x: 290, y: 258.1, size: 12, maxW: 20 },

  // ---- Exam X marks - Right column (centered at x≈522) ----
  { key: 'kham_7',   x: 522, y: 419.0, size: 12, maxW: 20 },
  { key: 'kham_7_1', x: 522, y: 400.1, size: 12, maxW: 20 },
  { key: 'kham_7_2', x: 522, y: 381.2, size: 12, maxW: 20 },
  { key: 'kham_7_3', x: 522, y: 362.3, size: 12, maxW: 20 },
  { key: 'kham_7_4', x: 522, y: 343.4, size: 12, maxW: 20 },
  { key: 'kham_7_5', x: 522, y: 324.5, size: 12, maxW: 20 },
  { key: 'kham_8',   x: 522, y: 307.9, size: 12, maxW: 20 },
  { key: 'kham_8_1', x: 522, y: 291.3, size: 12, maxW: 20 },
  { key: 'kham_8_2', x: 522, y: 274.7, size: 12, maxW: 20 },
  { key: 'kham_9',   x: 522, y: 258.1, size: 12, maxW: 20 },
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

    // Ghi chú — single line (no second line, no dots to avoid overlapping "An Giang")
    ghi_chu: data.ghi_chu || '',

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
