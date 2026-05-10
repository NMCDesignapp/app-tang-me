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
 * 3. Uses Liberation Serif font (same as template) for consistent look.
 * 4. Runs entirely in Node.js — NO LibreOffice needed, works on Vercel & Render!
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
// Font: Liberation Serif (same as template) for seamless integration
// =============================================================================

interface FieldDef {
  key: string;
  x: number;
  y: number;
  size: number;
  maxW: number;
}

// Page 1 (Cover page) - personal info
// Label end positions: "Họ và tên:"=98.7, "Ngày/tháng/năm sinh:"=162.9,
// "Giới tính:"=288.0, "SĐT:"=72.7, "Địa chỉ:"=224.4
const PAGE1_FIELDS: FieldDef[] = [
  { key: 'ho_ten',    x: 99,  y: 496.5, size: 13, maxW: 420 },
  { key: 'ngay_sinh', x: 163, y: 473.4, size: 13, maxW: 120 },
  { key: 'gioi_tinh', x: 289, y: 473.4, size: 13, maxW: 80  },
  { key: 'sdt',       x: 73,  y: 450.0, size: 13, maxW: 100 },
  { key: 'dia_chi',   x: 225, y: 450.0, size: 13, maxW: 310 },
];

// Page 2 (Request form) - personal + representative + exam details
const PAGE2_FIELDS: FieldDef[] = [
  // Section I: Person info
  // "1. Họ và tên:" ends at x=123.1, "2. Ngày/tháng/năm sinh:" ends at x=182.3
  // "Giới tính:" ends at x=293.5, "3. Số giấy tờ tùy thân" + ":" ends at x=172
  // "Ngày cấp:" ends at x=287.5, "Nơi cấp:" ends at x=114.4
  { key: 'ho_ten_p2',      x: 124, y: 708.3, size: 12, maxW: 300 },
  { key: 'ngay_sinh_p2',   x: 183, y: 690.4, size: 12, maxW: 100 },
  { key: 'gioi_tinh_p2',   x: 294, y: 690.4, size: 12, maxW: 80  },
  { key: 'so_gttt',        x: 173, y: 673.4, size: 12, maxW: 77  },  // must not overlap "Ngày cấp" at x=254.6
  { key: 'ngay_cap',       x: 288, y: 673.4, size: 12, maxW: 120 },
  { key: 'noi_cap',        x: 115, y: 656.6, size: 12, maxW: 400 },

  // Section II: Representative
  // "1. Họ và tên:" ends at x=99.1, "2. Ngày/tháng/năm sinh:" ends at x=152.3
  // "Giới tính:" ends at x=263.8, "3. Số giấy tờ tùy thân" + ":" ends at x=148
  // "Ngày cấp:" ends at x=306.5, "Nơi cấp:" ends at x=78.4
  // "4. Quan hệ..." ends at x=266.7
  { key: 'nguoi_dai_dien', x: 100, y: 623.0, size: 12, maxW: 360 },
  { key: 'ngay_sinh_dd',   x: 153, y: 606.2, size: 12, maxW: 120 },
  { key: 'gioi_tinh_dd',   x: 264, y: 606.2, size: 12, maxW: 80  },
  { key: 'so_gttt_dd',     x: 149, y: 589.4, size: 12, maxW: 100 },  // must not overlap "Ngày cấp" at x=254.6
  { key: 'noi_cap_dd',     x: 307, y: 589.4, size: 12, maxW: 120 },
  { key: 'noi_cap_dd_l2',  x: 79,  y: 572.6, size: 12, maxW: 400 },
  { key: 'quan_he',        x: 267, y: 552.8, size: 12, maxW: 200 },

  // Section III: Exam content
  // "Mức khám:" ends at x=124.7, "Nội dung cần kiểm tra bổ sung:" ends at x=188.5
  { key: 'muc_kham',       x: 125, y: 475.8, size: 12, maxW: 200 },
  { key: 'ghi_chu',        x: 189, y: 208.5, size: 12, maxW: 310 },

  // Exam X marks - Left column (align with "Yêu cầu" column)
  // Row Y positions match the template text rows exactly
  { key: 'kham_1',   x: 280, y: 430.4, size: 12, maxW: 25 },
  { key: 'kham_2',   x: 280, y: 416.1, size: 12, maxW: 25 },
  { key: 'kham_3',   x: 280, y: 401.8, size: 12, maxW: 25 },
  { key: 'kham_4',   x: 280, y: 387.5, size: 12, maxW: 25 },
  { key: 'kham_4_1', x: 280, y: 373.2, size: 12, maxW: 25 },
  { key: 'kham_4_2', x: 280, y: 358.9, size: 12, maxW: 25 },
  { key: 'kham_4_3', x: 280, y: 344.6, size: 12, maxW: 25 },
  { key: 'kham_4_4', x: 280, y: 330.3, size: 12, maxW: 25 },
  { key: 'kham_5',   x: 280, y: 316.0, size: 12, maxW: 25 },
  { key: 'kham_6',   x: 280, y: 301.7, size: 12, maxW: 25 },

  // Exam X marks - Right column
  { key: 'kham_7',   x: 518, y: 430.4, size: 12, maxW: 25 },
  { key: 'kham_7_1', x: 518, y: 416.1, size: 12, maxW: 25 },
  { key: 'kham_7_2', x: 518, y: 401.8, size: 12, maxW: 25 },
  { key: 'kham_7_3', x: 518, y: 387.5, size: 12, maxW: 25 },
  { key: 'kham_7_4', x: 518, y: 373.2, size: 12, maxW: 25 },
  { key: 'kham_7_5', x: 518, y: 358.9, size: 12, maxW: 25 },
  { key: 'kham_8',   x: 518, y: 330.3, size: 12, maxW: 25 },
  { key: 'kham_9',   x: 518, y: 301.7, size: 12, maxW: 25 },
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

  // Embed Liberation Serif font (same font as the template!)
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
    noi_cap_dd:     data.noi_cap_dd ? `${fmtDate(data.ngay_cap_dd)} - ${data.noi_cap_dd}` : fmtDate(data.ngay_cap_dd),
    noi_cap_dd_l2:  '',
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

/**
 * Fill a PDF page with field values at specified coordinates
 */
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
