import { FormData, getExamData } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * PDF Generator using pdf-lib + pre-converted blank template PDF.
 *
 * Coordinates are taken directly from the original DOCX template's
 * placeholder positions (converted to pdf-lib bottom-left origin).
 * Font size 13 matches the original template placeholders.
 * Liberation Serif is the same font used by the template.
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
// Page 1 (Cover page) - positions from original template
// =============================================================================
const PAGE1_FIELDS: FieldDef[] = [
  // Y values from original +3pt offset (pdf-lib baseline adjustment)
  { key: 'ho_ten',    x: 99,  y: 499.5, size: 13, maxW: 440 },
  { key: 'ngay_sinh', x: 167, y: 474.2, size: 13, maxW: 130 },
  { key: 'gioi_tinh', x: 355, y: 474.2, size: 13, maxW: 200 },
  { key: 'sdt',       x: 73,  y: 448.6, size: 13, maxW: 140 },
  { key: 'dia_chi',   x: 216, y: 449.5, size: 13, maxW: 340 },
];

// =============================================================================
// Page 2 (Request form) - positions from original template placeholders
// All placeholders use size=13 in the original template
// =============================================================================
const PAGE2_FIELDS: FieldDef[] = [
  // ---- Section I: Person info ----
  // Y values +3pt offset for pdf-lib baseline alignment
  { key: 'ho_ten_p2',      x: 123, y: 711.1, size: 13, maxW: 440 },
  { key: 'ngay_sinh_p2',   x: 182, y: 693.2, size: 13, maxW: 122 },
  { key: 'gioi_tinh_p2',   x: 360, y: 693.2, size: 13, maxW: 200 },
  // so_gttt: use size 10 so CCCD numbers fit in the narrow space (48pt)
  { key: 'so_gttt',        x: 176, y: 675.2, size: 10, maxW: 48 },
  { key: 'ngay_cap',       x: 338, y: 675.2, size: 13, maxW: 220 },
  { key: 'noi_cap',        x: 114, y: 657.3, size: 13, maxW: 440 },

  // ---- Section II: Representative ----
  { key: 'nguoi_dai_dien', x: 99,  y: 622.5, size: 13, maxW: 460 },
  { key: 'ngay_sinh_dd',   x: 161, y: 604.6, size: 13, maxW: 158 },
  { key: 'gioi_tinh_dd',   x: 372, y: 604.6, size: 13, maxW: 188 },
  // so_gttt_dd: more space here, keep size 13
  { key: 'so_gttt_dd',     x: 153, y: 586.6, size: 13, maxW: 170 },
  { key: 'noi_cap_dd',     x: 379, y: 586.6, size: 13, maxW: 180 },
  { key: 'noi_cap_dd_l2',  x: 78,  y: 568.7, size: 13, maxW: 480 },
  { key: 'quan_he',        x: 267, y: 547.7, size: 13, maxW: 290 },

  // ---- Section III: Exam content ----
  { key: 'muc_kham',       x: 125, y: 469.6, size: 13, maxW: 430 },
  { key: 'ghi_chu',        x: 190, y: 165.5, size: 12, maxW: 370 },

  // ---- Exam X marks - Left column ----
  { key: 'kham_1',   x: 271, y: 424.2, size: 10, maxW: 25 },
  { key: 'kham_2',   x: 271, y: 405.3, size: 10, maxW: 25 },
  { key: 'kham_3',   x: 271, y: 386.4, size: 10, maxW: 25 },
  { key: 'kham_4',   x: 271, y: 367.5, size: 10, maxW: 25 },
  { key: 'kham_4_1', x: 271, y: 348.6, size: 10, maxW: 25 },
  { key: 'kham_4_2', x: 271, y: 329.7, size: 10, maxW: 25 },
  { key: 'kham_4_3', x: 271, y: 313.1, size: 10, maxW: 25 },
  { key: 'kham_4_4', x: 271, y: 296.5, size: 10, maxW: 25 },
  { key: 'kham_5',   x: 271, y: 279.9, size: 10, maxW: 25 },
  { key: 'kham_6',   x: 271, y: 263.3, size: 10, maxW: 25 },

  // ---- Exam X marks - Right column ----
  { key: 'kham_7',   x: 509, y: 428.8, size: 10, maxW: 25 },
  { key: 'kham_7_1', x: 509, y: 409.9, size: 10, maxW: 25 },
  { key: 'kham_7_2', x: 509, y: 391.0, size: 10, maxW: 25 },
  { key: 'kham_7_3', x: 509, y: 372.1, size: 10, maxW: 25 },
  { key: 'kham_7_4', x: 509, y: 353.2, size: 10, maxW: 25 },
  { key: 'kham_7_5', x: 509, y: 334.3, size: 10, maxW: 25 },
  { key: 'kham_8',   x: 509, y: 301.1, size: 10, maxW: 25 },
  { key: 'kham_9',   x: 509, y: 267.9, size: 10, maxW: 25 },
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
