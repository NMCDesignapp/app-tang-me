import { FormData, getExamData } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * PDF Generator using pdf-lib + pre-converted blank template PDF.
 *
 * Strategy:
 * 1. A blank PDF template was pre-converted from the original DOCX using LibreOffice
 *    on the dev server (preserving 100% of the original layout).
 * 2. pdf-lib loads this template and overlays user data at exact coordinates.
 * 3. This runs entirely in Node.js — NO LibreOffice needed, works on Vercel!
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

// =============================================================================
// Field definitions: exact coordinates on the blank PDF template
// Coordinates use pdf-lib's bottom-left origin system
// =============================================================================

// Page 1 (Cover page) - personal info
const PAGE1_FIELDS: FieldDef[] = [
  // After "Họ và tên:" label ends at x=98.7
  { key: 'ho_ten',    x: 100, y: 496, size: 13, maxW: 420 },
  // After "Ngày/tháng/năm sinh:" label ends at x=162.9
  { key: 'ngay_sinh', x: 165, y: 473, size: 13, maxW: 100 },
  // After "Giới tính:" label at x=234..288
  { key: 'gioi_tinh', x: 290, y: 473, size: 13, maxW: 80  },
  // After "SĐT:" label ends at x=72.7
  { key: 'sdt',       x: 75,  y: 450, size: 13, maxW: 100 },
  // After "Địa chỉ:" label ends at x=224.4
  { key: 'dia_chi',   x: 226, y: 450, size: 13, maxW: 310 },
];

// Page 2 (Request form) - personal + representative + exam details
const PAGE2_FIELDS: FieldDef[] = [
  // ---- Section I: Person info ----
  // "1. Họ và tên:" ends at x=123.1
  { key: 'ho_ten_p2',      x: 125, y: 708, size: 12, maxW: 300 },
  // "2. Ngày/tháng/năm sinh:" at x=182.4 (dot leftover)
  { key: 'ngay_sinh_p2',   x: 185, y: 690, size: 12, maxW: 100 },
  // "Giới tính:" ends at x=293.5
  { key: 'gioi_tinh_p2',   x: 296, y: 690, size: 12, maxW: 80  },
  // "3. Số giấy tờ tùy thân" ends at x=161, ":" at x=169.2
  { key: 'so_gttt',        x: 172, y: 673, size: 12, maxW: 110 },
  // "Ngày cấp:" at x=287.5
  { key: 'ngay_cap',       x: 290, y: 673, size: 12, maxW: 120 },
  // "Nơi cấp:" ends at x=114.4
  { key: 'noi_cap',        x: 117, y: 656, size: 12, maxW: 400 },

  // ---- Section II: Representative ----
  // "1. Họ và tên:" ends at x=99.1
  { key: 'nguoi_dai_dien', x: 101, y: 623, size: 12, maxW: 360 },
  // "2. Ngày/tháng/năm sinh:" ends at x=152.3
  { key: 'ngay_sinh_dd',   x: 155, y: 606, size: 12, maxW: 120 },
  // "Giới tính:" ends at x=263.8
  { key: 'gioi_tinh_dd',   x: 266, y: 606, size: 12, maxW: 80  },
  // "3. Số giấy tờ tùy thân" ends at x=137, ":" at x=145.2
  { key: 'so_gttt_dd',     x: 148, y: 589, size: 12, maxW: 100 },
  // "Ngày cấp:" ends at x=306.5
  { key: 'noi_cap_dd',     x: 309, y: 589, size: 12, maxW: 120 },
  // Second "Nơi cấp:" ends at x=78.4 (representative's noi_cap)
  { key: 'noi_cap_dd_l2',  x: 81,  y: 572, size: 12, maxW: 400 },
  // "4. Quan hệ với Người được kiểm tra sức khỏe:" ends at x=266.7
  { key: 'quan_he',        x: 269, y: 552, size: 12, maxW: 200 },

  // ---- Section III: Exam content ----
  // "Mức khám:" ends at x=124.7
  { key: 'muc_kham',       x: 127, y: 475, size: 12, maxW: 200 },
  // "Nội dung cần kiểm tra bổ sung:" ends at x=188.5
  { key: 'ghi_chu',        x: 191, y: 208, size: 12, maxW: 310 },

  // ---- Exam X marks - Left column (Yêu cầu column at ~x=275-310) ----
  { key: 'kham_1',   x: 280, y: 430, size: 11, maxW: 25 },
  { key: 'kham_2',   x: 280, y: 416, size: 11, maxW: 25 },
  { key: 'kham_3',   x: 280, y: 401, size: 11, maxW: 25 },
  { key: 'kham_4',   x: 280, y: 387, size: 11, maxW: 25 },
  { key: 'kham_4_1', x: 280, y: 373, size: 11, maxW: 25 },
  { key: 'kham_4_2', x: 280, y: 358, size: 11, maxW: 25 },
  { key: 'kham_4_3', x: 280, y: 344, size: 11, maxW: 25 },
  { key: 'kham_4_4', x: 280, y: 330, size: 11, maxW: 25 },
  { key: 'kham_5',   x: 280, y: 316, size: 11, maxW: 25 },
  { key: 'kham_6',   x: 280, y: 301, size: 11, maxW: 25 },

  // ---- Exam X marks - Right column (Yêu cầu column at ~x=515-550) ----
  { key: 'kham_7',   x: 518, y: 430, size: 11, maxW: 25 },
  { key: 'kham_7_1', x: 518, y: 416, size: 11, maxW: 25 },
  { key: 'kham_7_2', x: 518, y: 401, size: 11, maxW: 25 },
  { key: 'kham_7_3', x: 518, y: 387, size: 11, maxW: 25 },
  { key: 'kham_7_4', x: 518, y: 373, size: 11, maxW: 25 },
  { key: 'kham_7_5', x: 518, y: 358, size: 11, maxW: 25 },
  { key: 'kham_8',   x: 518, y: 330, size: 11, maxW: 25 },
  { key: 'kham_9',   x: 518, y: 301, size: 11, maxW: 25 },
];

interface FieldDef {
  key: string;
  x: number;
  y: number;
  size: number;
  maxW: number;
}

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

  // Read DejaVu Sans font for Vietnamese character support
  const fontPath = join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf');
  const fontBytes = readFileSync(fontPath);

  // Load template and embed font
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
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
    // First "Ngày cấp" for representative - combine ngay_cap_dd and noi_cap_dd
    noi_cap_dd:     data.noi_cap_dd ? `${fmtDate(data.ngay_cap_dd)} - ${data.noi_cap_dd}` : fmtDate(data.ngay_cap_dd),
    noi_cap_dd_l2:  '', // Leave blank since we combined above
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
    kham_9:   examItems.has('9')   ? 'X' : '',
  };

  // Fill Page 1
  const pages = pdfDoc.getPages();
  fillPage(pages[0], PAGE1_FIELDS, values, font);

  // Fill Page 2
  fillPage(pages[1], PAGE2_FIELDS, values, font);

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

/**
 * Fill a PDF page with field values at specified coordinates
 */
function fillPage(
  page: import('pdf-lib').PDFPage,
  fields: FieldDef[],
  values: Record<string, string>,
  font: import('pdf-lib').PDFFont
) {
  const { rgb } = require('pdf-lib');

  for (const field of fields) {
    const value = values[field.key];
    if (!value) continue;

    // Truncate text if it exceeds maxWidth
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
