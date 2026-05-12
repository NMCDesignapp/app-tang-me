import { FormData, getExamData } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * PDF Generator using pdf-lib + pre-converted blank template PDF.
 *
 * Coordinates derived from template.pdf (converted from DOCX 2026-05-11).
 * All positions extracted with PyMuPDF search_for() for exact placeholder bounding boxes.
 *
 * Coordinate system:
 *   PyMuPDF: y increases downward (0 = top)
 *   pdf-lib: y increases upward (0 = bottom)
 *   Conversion: pdf_lib_y = PAGE_HEIGHT - pymupdf_y2 + descent * size
 *   PAGE_HEIGHT = 841.89 (A4)
 *
 * Descent correction:
 *   Liberation Serif Regular: descent = 0.205078125
 *   The bbox y2 in PyMuPDF includes the descender space below the baseline.
 *   pdf-lib's y coordinate is the text baseline, so we must subtract the descent
 *   from the bottom of the bbox to get the true baseline position.
 *   pdf_y = PAGE_HEIGHT - (pymupdf_y2 - descent * size)
 *        = PAGE_HEIGHT - pymupdf_y2 + descent * size
 *
 * Key layout constraints:
 *   Page 1: so_giay_yeu_cau inside "(Số GYCBH/HĐBH: ...)" — ~100pt before ")"
 *   Page 2: so_gttt has ~138pt before visible "Ngày cấp:" text (size 11 fits 12 digits)
 *   Page 2: so_gttt_dd has ~184pt before "Ngày cấp:" (plenty of space)
 *   Page 2: ghi_chu line 1 on same baseline as label, line 2 just above "An Giang"
 */

const PAGE_HEIGHT = 841.89;
const DESCENT = 0.205078125; // Liberation Serif Regular descent factor

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
// Page 1 (Cover page) — coordinates corrected with descent factor
// All Y values: pdf_y = PAGE_HEIGHT - pymupdf_y2 + DESCENT * fill_size
// Fill size chosen to match visual weight of labels (all labels are size 13)
// =============================================================================
const PAGE1_FIELDS: FieldDef[] = [
  // so_giay_yeu_cau: inside "(Số GYCBH/HĐBH: ...........)" on page 1
  // Label "(Số GYCBH/HĐBH:" baseline = 562.4, same line, fill at size 11
  // Dots area: x=302 to x=394, closing ")" at x≈398
  // Fill starts at x=302 (where dots start), maxW = 394 - 302 = 92pt
  { key: 'so_giay_yeu_cau', x: 302, y: 562.4, size: 11, maxW: 90 },
  // ho_ten: after "Họ và tên:" label, same baseline
  { key: 'ho_ten',          x:  98.7, y: 499.4, size: 13, maxW: 460 },
  // ngay_sinh: after "Ngày/tháng/năm sinh:", before "Giới tính:"
  { key: 'ngay_sinh',       x: 166.4, y: 475.3, size: 11, maxW: 131 },
  // gioi_tinh: after "Giới tính:" label
  { key: 'gioi_tinh',       x: 354.2, y: 475.3, size: 13, maxW: 230 },
  // sdt: after "SĐT:", before "Địa chỉ:"
  { key: 'sdt',             x:  72.7, y: 450.8, size: 13, maxW: 132 },
  // dia_chi: after "Địa chỉ:" label
  { key: 'dia_chi',         x: 252.5, y: 450.8, size: 13, maxW: 340 },
];

// =============================================================================
// Page 2 (Request form) — coordinates corrected with descent factor
// All Y values aligned with label baselines on the same line
//
// Label baselines (from PyMuPDF extraction with descent correction):
//   "Họ và tên:"         → pdf_y = 710.8
//   "Ngày/tháng/năm sinh:" → pdf_y = 692.9
//   "Giới tính:" (Sec I) → pdf_y = 692.9
//   "Số giấy tờ tùy thân" → pdf_y = 674.9
//   "Ngày cấp:" (Sec I)  → pdf_y = 674.9
//   "Nơi cấp:" (Sec I)   → pdf_y = 657.0
//   "Họ và tên:" (Sec II) → pdf_y = 622.2
//   "Ngày/tháng/năm sinh:" (Sec II) → pdf_y = 604.3
//   "Giới tính:" (Sec II) → pdf_y = 604.3
//   "Số giấy tờ tùy thân" (Sec II) → pdf_y = 586.3
//   "Ngày cấp:" (Sec II) → pdf_y = 586.3
//   "Nơi cấp:" (Sec II)  → pdf_y = 568.4
//   "Quan hệ…"            → pdf_y = 547.4
//   "Mức khám:"           → pdf_y = 469.3
//   "Nội dung cần KTBS:"  → pdf_y = 165.0
//   "An Giang, ngày…"     → pdf_y = 145.2
// =============================================================================
const PAGE2_FIELDS: FieldDef[] = [
  // ---- Section I: Person info ----
  { key: 'ho_ten_p2',      x: 123.1, y: 710.8, size: 12, maxW: 470 },
  { key: 'ngay_sinh_p2',   x: 182.4, y: 692.9, size: 11, maxW: 126 },
  { key: 'gioi_tinh_p2',   x: 363.0, y: 692.9, size: 12, maxW: 230 },
  // so_gttt: "Ngày cấp:" visible text starts at x≈316 → ~138pt available
  // Size 11 fits 12 CCCD digits (~79pt) comfortably
  { key: 'so_gttt',        x: 175.5, y: 674.9, size: 11, maxW: 138 },
  // ngay_cap: after "Ngày cấp:" label
  { key: 'ngay_cap',       x: 371.3, y: 674.9, size: 11, maxW: 170 },
  // noi_cap: after "Nơi cấp:" label
  { key: 'noi_cap',        x: 114.4, y: 657.0, size: 12, maxW: 478 },

  // ---- Section II: Representative ----
  { key: 'nguoi_dai_dien', x: 111.1, y: 622.2, size: 12, maxW: 482 },
  { key: 'ngay_sinh_dd',   x: 173.3, y: 604.3, size: 11, maxW: 156 },
  { key: 'gioi_tinh_dd',   x: 381.2, y: 604.3, size: 12, maxW: 214 },
  { key: 'so_gttt_dd',     x: 165.0, y: 586.3, size: 12, maxW: 172 },
  { key: 'ngay_cap_dd',    x: 391.2, y: 586.3, size: 11, maxW: 180 },
  { key: 'noi_cap_dd',     x: 111.4, y: 568.4, size: 12, maxW: 482 },
  { key: 'quan_he',        x: 278.9, y: 547.4, size: 12, maxW: 314 },

  // ---- Section III: Exam content ----
  { key: 'muc_kham',       x: 124.7, y: 469.3, size: 12, maxW: 468 },

  // ---- Ghi chú — 2-line support ----
  // Line 1: SAME baseline as "Nội dung cần kiểm tra bổ sung:" label (pdf_y=165.0)
  // Label ends at x≈185.3, fill starts right after at x=188
  // Line 2: just above "An Giang, ngày…" (y=149.0, 3.8pt above An Giang baseline)
  // Line 2 starts at x=34.1 (below "Nội dung" label)
  { key: 'ghi_chu_line1',  x: 188.0, y: 165.0, size: 11, maxW: 382 },
  { key: 'ghi_chu_line2',  x:  34.1, y: 149.0, size: 11, maxW: 535 },

  // ---- Exam X marks - Left column (centered in "Yêu cầu" column) ----
  // Left Yêu cầu column: x from 265.8 to 318.2, center ≈ 292
  // X character width at size 12 ≈ 8pt, so x = 292 - 4 = 288
  // Y: vertically centered in each cell row
  // Row boundaries (pymupdf y): 378.6, 406.7, 425.6, 444.5, 463.4, 482.3, 501.2, 520.1, 534.4, 553.3, 567.6, 586.5
  // Cell center (pdf) = PAGE_HEIGHT - (y_top + y_bottom) / 2
  // Baseline = cell_center - ascent * size / 2 (for visual centering)
  // ascent ≈ 0.891, size=12 → offset ≈ 5.35
  { key: 'kham_1',   x: 288, y: 420.4, size: 12, maxW: 20 },
  { key: 'kham_2',   x: 288, y: 401.5, size: 12, maxW: 20 },
  { key: 'kham_3',   x: 288, y: 382.6, size: 12, maxW: 20 },
  { key: 'kham_4',   x: 288, y: 363.7, size: 12, maxW: 20 },
  { key: 'kham_4_1', x: 288, y: 344.8, size: 12, maxW: 20 },
  { key: 'kham_4_2', x: 288, y: 325.9, size: 12, maxW: 20 },
  { key: 'kham_4_3', x: 288, y: 309.3, size: 12, maxW: 20 },
  { key: 'kham_4_4', x: 288, y: 292.7, size: 12, maxW: 20 },
  { key: 'kham_5',   x: 288, y: 276.1, size: 12, maxW: 20 },
  { key: 'kham_6',   x: 288, y: 259.5, size: 12, maxW: 20 },

  // ---- Exam X marks - Right column (centered in "Yêu cầu" column) ----
  // Right Yêu cầu column: x from 503.1 to 544.9, center ≈ 524
  // X at size 12 ≈ 8pt wide → x = 524 - 4 = 520
  { key: 'kham_7',   x: 520, y: 420.4, size: 12, maxW: 20 },
  { key: 'kham_7_1', x: 520, y: 401.5, size: 12, maxW: 20 },
  { key: 'kham_7_2', x: 520, y: 382.6, size: 12, maxW: 20 },
  { key: 'kham_7_3', x: 520, y: 363.7, size: 12, maxW: 20 },
  { key: 'kham_7_4', x: 520, y: 344.8, size: 12, maxW: 20 },
  { key: 'kham_7_5', x: 520, y: 325.9, size: 12, maxW: 20 },
  { key: 'kham_8',   x: 520, y: 309.3, size: 12, maxW: 20 },
  { key: 'kham_8_1', x: 520, y: 292.7, size: 12, maxW: 20 },
  { key: 'kham_8_2', x: 520, y: 276.1, size: 12, maxW: 20 },
  { key: 'kham_9',   x: 520, y: 259.5, size: 12, maxW: 20 },
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

  // Split ghi_chu into 2 lines if needed
  const ghiChuFull = data.ghi_chu || '';
  let ghiChuLine1 = '';
  let ghiChuLine2 = '';
  if (ghiChuFull) {
    const ghiChuSize = 11;
    const ghiChuMaxW1 = 382; // Line 1 max width (from label end to right margin)
    const fullWidth = font.widthOfTextAtSize(ghiChuFull, ghiChuSize);
    if (fullWidth <= ghiChuMaxW1) {
      // Fits on one line
      ghiChuLine1 = ghiChuFull;
    } else {
      // Need to split into 2 lines
      // Find a good break point that fits line 1
      let breakIdx = ghiChuFull.length;
      while (breakIdx > 0) {
        const testText = ghiChuFull.substring(0, breakIdx);
        if (font.widthOfTextAtSize(testText, ghiChuSize) <= ghiChuMaxW1) {
          break;
        }
        breakIdx--;
      }
      // Try to break at a space
      const lastSpace = ghiChuFull.lastIndexOf(' ', breakIdx);
      if (lastSpace > 0) {
        ghiChuLine1 = ghiChuFull.substring(0, lastSpace);
        ghiChuLine2 = ghiChuFull.substring(lastSpace + 1);
      } else {
        ghiChuLine1 = ghiChuFull.substring(0, breakIdx);
        ghiChuLine2 = ghiChuFull.substring(breakIdx);
      }
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

    // Ghi chú — 2-line support
    ghi_chu_line1: ghiChuLine1,
    ghi_chu_line2: ghiChuLine2,

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
