import { FormData, getExamData } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * PDF Generator using pdf-lib + pre-converted blank template PDF.
 *
 * Coordinates derived from exact label positions in the template PDF
 * (analyzed with PyMuPDF, verified visually).
 *
 * Page 1 labels use size 13 → fill text also size 13.
 * Page 2 labels use size 12 → fill text uses size 12 (or smaller for tight fields).
 * Date fields (ngay_sinh, ngay_sinh_dd) use size 11 for wider spacing.
 * Liberation Serif Regular matches the template's font family.
 *
 * Y conversion: pdf_lib_y = PAGE_HEIGHT - (label_y_top + ASCENT_FACTOR * label_size)
 * ASCENT_FACTOR = 0.89111328125 (Liberation Serif)
 * PAGE_HEIGHT = 841.89
 */

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
// Page 1 (Cover page) - labels at size 13, fill at size 13
// X = label_x2 + 3pt gap
// Y = 841.89 - (label_y_top + 11.58)  [ascent at size 13 = 11.58]
// =============================================================================
const PAGE1_FIELDS: FieldDef[] = [
  // After "Họ và tên:" x2=98.7
  { key: 'ho_ten',    x: 101.7, y: 499.3, size: 13, maxW: 450 },
  // After "Ngày/tháng/năm sinh:" x2=162.9, before "Giới tính:" at x=234.1
  { key: 'ngay_sinh', x: 165.9, y: 476.2, size: 13, maxW: 65 },
  // After "Giới tính:" x2=288.0
  { key: 'gioi_tinh', x: 291.0, y: 476.2, size: 13, maxW: 260 },
  // After "SĐT:" x2=72.7, before "Địa chỉ:" at x=179.6
  { key: 'sdt',       x:  75.7, y: 452.8, size: 13, maxW: 100 },
  // After "Địa chỉ:" x2=224.4
  { key: 'dia_chi',   x: 227.4, y: 452.8, size: 13, maxW: 320 },
];

// =============================================================================
// Page 2 (Request form) - labels at size 12
// Y = 841.89 - (label_y_top + 10.69)  [ascent at size 12 = 10.69]
// Date fields use size 11 for wider spacing in tight spaces
// =============================================================================
const PAGE2_FIELDS: FieldDef[] = [
  // ---- Section I: Person info ----
  // After "Họ và tên:" x2=123.1
  { key: 'ho_ten_p2',      x: 126.1, y: 710.9, size: 12, maxW: 420 },
  // After "Ngày/tháng/năm sinh:" x2=182.3, before "Giới tính:" at x=240.9
  // Size 11 for wider spacing (date "dd/mm/yyyy" = 50pt at size 11, fits in 55pt)
  { key: 'ngay_sinh_p2',   x: 185.4, y: 693.0, size: 11, maxW: 53 },
  // After "Giới tính:" x2=293.5
  { key: 'gioi_tinh_p2',   x: 296.5, y: 693.0, size: 12, maxW: 255 },
  // After ":" at x≈172.5, before "Ngày cấp:" starts at x≈235.5
  // Size 11 so CCCD numbers fit comfortably (9 digits = 49.5pt at size 11, space = 63pt)
  { key: 'so_gttt',        x: 175.0, y: 676.0, size: 11, maxW: 58 },
  // After "Ngày cấp:" colon x2≈284.5 — size 13 matching other fields
  { key: 'ngay_cap',       x: 287.5, y: 676.0, size: 13, maxW: 265 },
  // After "Nơi cấp:" x2=114.4 — wider spacing for place name
  { key: 'noi_cap',        x: 117.4, y: 659.2, size: 12, maxW: 430 },

  // ---- Section II: Representative ----
  // After "1. Họ và tên:" x2=99.1
  { key: 'nguoi_dai_dien', x: 102.1, y: 625.6, size: 12, maxW: 445 },
  // After "2. Ngày/tháng/năm sinh:" x2=152.3, before "Giới tính:" at x=214.1
  // Size 11 for wider spacing
  { key: 'ngay_sinh_dd',   x: 155.3, y: 608.8, size: 11, maxW: 55 },
  // After "Giới tính:" x2=263.8
  { key: 'gioi_tinh_dd',   x: 266.8, y: 608.8, size: 12, maxW: 285 },
  // After ":" x2=148.5, before "Ngày cấp:" at x=254.6 — size 12 fits well (space = 106pt)
  { key: 'so_gttt_dd',     x: 151.5, y: 592.0, size: 12, maxW: 100 },
  // After "Ngày cấp:" colon x2≈303.5 — size 13 matching other fields
  { key: 'ngay_cap_dd',    x: 306.5, y: 592.0, size: 13, maxW: 245 },
  // After "Nơi cấp:" x2=78.4 — wider spacing for place name
  { key: 'noi_cap_dd',     x:  81.4, y: 575.2, size: 12, maxW: 470 },
  // After "4. Quan hệ với Người được kiểm tra sức khỏe:" x2=266.7
  { key: 'quan_he',        x: 269.7, y: 555.4, size: 12, maxW: 280 },

  // ---- Section III: Exam content ----
  // After "Mức khám:" x2=124.7
  { key: 'muc_kham',       x: 127.7, y: 478.4, size: 12, maxW: 420 },
  // After "Nội dung cần kiểm tra bổ sung:" x2=188.3
  { key: 'ghi_chu',        x: 191.3, y: 211.1, size: 12, maxW: 360 },

  // ---- Exam X marks - Left column (centered at x≈292) ----
  { key: 'kham_1',   x: 288, y: 433.0, size: 12, maxW: 20 },
  { key: 'kham_2',   x: 288, y: 418.7, size: 12, maxW: 20 },
  { key: 'kham_3',   x: 288, y: 404.4, size: 12, maxW: 20 },
  { key: 'kham_4',   x: 288, y: 390.1, size: 12, maxW: 20 },
  { key: 'kham_4_1', x: 288, y: 375.8, size: 12, maxW: 20 },
  { key: 'kham_4_2', x: 288, y: 361.5, size: 12, maxW: 20 },
  { key: 'kham_4_3', x: 288, y: 347.2, size: 12, maxW: 20 },
  { key: 'kham_4_4', x: 288, y: 332.9, size: 12, maxW: 20 },
  { key: 'kham_5',   x: 288, y: 318.6, size: 12, maxW: 20 },
  { key: 'kham_6',   x: 288, y: 304.3, size: 12, maxW: 20 },

  // ---- Exam X marks - Right column (centered at x≈524) ----
  { key: 'kham_7',   x: 520, y: 433.0, size: 12, maxW: 20 },
  { key: 'kham_7_1', x: 520, y: 418.7, size: 12, maxW: 20 },
  { key: 'kham_7_2', x: 520, y: 404.4, size: 12, maxW: 20 },
  { key: 'kham_7_3', x: 520, y: 390.1, size: 12, maxW: 20 },
  { key: 'kham_7_4', x: 520, y: 375.8, size: 12, maxW: 20 },
  { key: 'kham_7_5', x: 520, y: 361.5, size: 12, maxW: 20 },
  { key: 'kham_8',   x: 520, y: 347.2, size: 12, maxW: 20 },
  { key: 'kham_8_1', x: 520, y: 332.9, size: 12, maxW: 20 },
  { key: 'kham_8_2', x: 520, y: 318.6, size: 12, maxW: 20 },
  { key: 'kham_9',   x: 520, y: 304.3, size: 12, maxW: 20 },
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
    ho_ten:    data.ho_ten,
    ngay_sinh: fmtDate(data.ngay_sinh),
    gioi_tinh: data.gioi_tinh,
    sdt:       data.sdt,
    dia_chi:   data.dia_chi,

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
    ghi_chu:  data.ghi_chu,

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
