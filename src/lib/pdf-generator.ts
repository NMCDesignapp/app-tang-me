import { FormData, getExamData } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * PDF Generator using pdf-lib + pre-converted blank template PDF.
 *
 * Coordinates derived from the NEW template (template.docx converted 2026-05-10).
 * Analyzed with PyMuPDF — labels and fill positions computed from exact span positions.
 *
 * Page 1 labels at size 13, fill at size 13 (date at size 11).
 * Page 2 labels at size 12, fill at size 12 (date at size 11).
 * Liberation Serif Regular matches the template's font family.
 *
 * Y formula: pdf_lib_y = PAGE_HEIGHT - y_baseline + ASCENT_FACTOR * (label_size - fill_size)
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
// Page 1 (Cover page) — NEW template coordinates
// Label "Họ và tên:" x2=98.7, "Ngày/tháng/năm sinh:" x2=162.9,
// "Giới tính:" x2=354.2, "SĐT:" x2=72.7, "Địa chỉ:" x2=252.5
// =============================================================================
const PAGE1_FIELDS: FieldDef[] = [
  // After "Họ và tên:" x2=98.7, y_baseline=342.4
  { key: 'ho_ten',    x: 101.7, y: 499.5, size: 13, maxW: 450 },
  // After "Ngày/tháng/năm sinh:" x2=162.9, y_baseline=366.5, before "Giới tính:" at x=300.4
  { key: 'ngay_sinh', x: 165.9, y: 477.2, size: 11, maxW: 130 },
  // After "Giới tính:" x2=354.2, y_baseline=366.5
  { key: 'gioi_tinh', x: 357.2, y: 475.4, size: 13, maxW: 250 },
  // After "SĐT:" x2=72.7, y_baseline=391.0, before "Địa chỉ:" at x=207.8
  { key: 'sdt',       x:  75.7, y: 450.9, size: 13, maxW: 130 },
  // After "Địa chỉ:" x2=252.5, y_baseline=391.0
  { key: 'dia_chi',   x: 255.5, y: 450.9, size: 13, maxW: 320 },
];

// =============================================================================
// Page 2 (Request form) — NEW template coordinates
// Key change: "Ngày cấp:" now at x=316.4 (was 235.5), so so_gttt has ~138pt space!
// =============================================================================
const PAGE2_FIELDS: FieldDef[] = [
  // ---- Section I: Person info ----
  // After "Họ và tên:" x2=123.0, y_baseline=131.0
  { key: 'ho_ten_p2',      x: 126.0, y: 710.9, size: 12, maxW: 420 },
  // After "Ngày/tháng/năm sinh:" x2=182.3, y_baseline=148.9, before "Giới tính:" at x=313.3
  { key: 'ngay_sinh_p2',   x: 185.3, y: 693.9, size: 11, maxW: 125 },
  // After "Giới tính:" x2=362.9, y_baseline=148.9
  { key: 'gioi_tinh_p2',   x: 365.9, y: 693.0, size: 12, maxW: 200 },
  // After ":" x2=175.5, y_baseline=166.9 — "Ngày cấp:" TEXT starts at x=316.4 → ~138pt gap!
  { key: 'so_gttt',        x: 178.5, y: 675.0, size: 12, maxW: 138 },
  // After "Ngày cấp:" x2=362.0, y_baseline=166.9
  { key: 'ngay_cap',       x: 365.0, y: 675.0, size: 12, maxW: 240 },
  // After "Nơi cấp:" x2=114.4, y_baseline=184.8
  { key: 'noi_cap',        x: 117.4, y: 657.1, size: 12, maxW: 430 },

  // ---- Section II: Representative ----
  // After "1. Họ và tên:" x2=99.0, y_baseline=219.6
  { key: 'nguoi_dai_dien', x: 102.0, y: 622.3, size: 12, maxW: 445 },
  // After "2. Ngày/tháng/năm sinh:" x2=152.3, y_baseline=237.5, before "Giới tính:" at x=331.5
  { key: 'ngay_sinh_dd',   x: 155.3, y: 605.3, size: 11, maxW: 175 },
  // After "Giới tính:" x2=381.1, y_baseline=237.5
  { key: 'gioi_tinh_dd',   x: 384.1, y: 604.4, size: 12, maxW: 170 },
  // After ":" x2=148.5, y_baseline=255.5 — "Ngày cấp:" at x=339.2 → ~188pt gap!
  { key: 'so_gttt_dd',     x: 151.5, y: 586.4, size: 12, maxW: 188 },
  // After "Ngày cấp:" x2=384.8, y_baseline=255.5
  { key: 'ngay_cap_dd',    x: 387.8, y: 586.4, size: 12, maxW: 215 },
  // After "Nơi cấp:" x2=78.4, y_baseline=273.4
  { key: 'noi_cap_dd',     x:  81.4, y: 568.5, size: 12, maxW: 470 },
  // After "4. Quan hệ..." x2=266.7, y_baseline=294.4
  { key: 'quan_he',        x: 269.7, y: 547.5, size: 12, maxW: 280 },

  // ---- Section III: Exam content ----
  // After "Mức khám:" x2=124.7, y_baseline=372.5
  { key: 'muc_kham',       x: 127.7, y: 469.4, size: 12, maxW: 420 },
  // After "Nội dung cần kiểm tra bổ sung:" x2=191.3, y_baseline=676.8
  { key: 'ghi_chu',        x: 194.3, y: 165.1, size: 12, maxW: 360 },

  // ---- Dotted lines for handwriting ----
  // After "Nội dung cần kiểm tra bổ sung:" — moved down per user request
  { key: 'dots_bosung',    x: 194.3, y: 161.1, size: 12, maxW: 380 },

  // ---- Exam X marks - Left column (centered at x≈288) ----
  { key: 'kham_1',   x: 288, y: 421.5, size: 12, maxW: 20 },
  { key: 'kham_2',   x: 288, y: 402.6, size: 12, maxW: 20 },
  { key: 'kham_3',   x: 288, y: 383.7, size: 12, maxW: 20 },
  { key: 'kham_4',   x: 288, y: 364.8, size: 12, maxW: 20 },
  { key: 'kham_4_1', x: 288, y: 345.9, size: 12, maxW: 20 },
  { key: 'kham_4_2', x: 288, y: 327.0, size: 12, maxW: 20 },
  { key: 'kham_4_3', x: 288, y: 310.4, size: 12, maxW: 20 },
  { key: 'kham_4_4', x: 288, y: 293.8, size: 12, maxW: 20 },
  { key: 'kham_5',   x: 288, y: 277.2, size: 12, maxW: 20 },
  { key: 'kham_6',   x: 288, y: 260.6, size: 12, maxW: 20 },

  // ---- Exam X marks - Right column (centered at x≈520) ----
  { key: 'kham_7',   x: 520, y: 421.5, size: 12, maxW: 20 },
  { key: 'kham_7_1', x: 520, y: 402.6, size: 12, maxW: 20 },
  { key: 'kham_7_2', x: 520, y: 383.7, size: 12, maxW: 20 },
  { key: 'kham_7_3', x: 520, y: 364.8, size: 12, maxW: 20 },
  { key: 'kham_7_4', x: 520, y: 345.9, size: 12, maxW: 20 },
  { key: 'kham_7_5', x: 520, y: 327.0, size: 12, maxW: 20 },
  { key: 'kham_8',   x: 520, y: 310.4, size: 12, maxW: 20 },
  { key: 'kham_8_1', x: 520, y: 293.8, size: 12, maxW: 20 },
  { key: 'kham_8_2', x: 520, y: 277.2, size: 12, maxW: 20 },
  { key: 'kham_9',   x: 520, y: 260.6, size: 12, maxW: 20 },
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

    // Dotted lines (always visible)
    dots_bosung:    '.'.repeat(126),

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
