import { PDFDocument, rgb, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { FormData, getExamData, EXAM_ITEMS } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

// A4 page dimensions (points)
const PW = 595.28;
const PH = 841.89;

// Field positions extracted from template DOCX → PDF analysis
// These are the (page, x, y) coordinates where text should be drawn
// x = left edge of text, y = pdf-lib coordinate (bottom-left origin)

interface FieldPos {
  page: number;  // 1-based
  x: number;     // left edge
  y: number;     // pdf-lib y (bottom-left origin)
  size: number;  // font size
}

// Cover page (page 1) field positions
const PAGE1_FIELDS: Record<string, FieldPos> = {
  ho_ten:   { page: 1, x: 98.7,  y: 509.5, size: 10 },
  ngay_sinh:{ page: 1, x: 167.4, y: 485.2, size: 9 },
  gioi_tinh:{ page: 1, x: 397.2, y: 484.5, size: 9 },
  sdt:      { page: 1, x: 72.7,  y: 459.6, size: 9 },
  dia_chi:  { page: 1, x: 296.4, y: 459.5, size: 9 },
};

// Giấy yêu cầu (page 2) field positions
const PAGE2_FIELDS: Record<string, FieldPos> = {
  ho_ten:       { page: 2, x: 123.0, y: 721.1, size: 10 },
  ngay_sinh:    { page: 2, x: 182.4, y: 703.2, size: 9 },
  gioi_tinh:    { page: 2, x: 406.9, y: 703.2, size: 9 },
  so_gttt:      { page: 2, x: 175.5, y: 685.2, size: 9 },
  ngay_cap:     { page: 2, x: 385.8, y: 685.2, size: 9 },
  noi_cap:      { page: 2, x: 114.4, y: 667.3, size: 9 },
  nguoi_dd:     { page: 2, x: 99.0,  y: 632.5, size: 9 },
  ngay_sinh_dd: { page: 2, x: 161.3, y: 614.6, size: 9 },
  gioi_tinh_dd: { page: 2, x: 407.8, y: 614.6, size: 9 },
  so_gttt_dd:   { page: 2, x: 152.9, y: 596.6, size: 9 },
  ngay_cap_dd:  { page: 2, x: 385.8, y: 596.6, size: 9 },  // approx same x as ngay_cap
  noi_cap_dd:   { page: 2, x: 78.4,  y: 578.7, size: 9 },
  quan_he:      { page: 2, x: 266.9, y: 557.7, size: 9 },
  muc_kham:     { page: 2, x: 124.7, y: 479.6, size: 10 },
  ghi_chu:      { page: 2, x: 190.1, y: 211.3, size: 9 },
};

// Exam table X positions on page 2
// Left column X = 271.2, Right column X = 508.6
// Each row has a specific y position (pdf-lib coordinates)
const LEFT_X_COL = 271.2;
const RIGHT_X_COL = 508.6;

// Map exam item IDs to their row Y positions (pdf-lib y, from analysis)
// Items 1-6 are in the left column, items 7-9 are in the right column
const EXAM_X_POSITIONS: Record<string, { col: 'left' | 'right'; y: number }> = {
  '1':   { col: 'left',  y: 431.5 },
  '2':   { col: 'left',  y: 417.2 },
  '3':   { col: 'left',  y: 402.9 },
  '4':   { col: 'left',  y: 388.6 },
  '4_1': { col: 'left',  y: 374.3 },
  '4_2': { col: 'left',  y: 360.0 },
  '4_3': { col: 'left',  y: 345.7 },
  '4_4': { col: 'left',  y: 331.4 },
  '5':   { col: 'left',  y: 317.1 },
  '6':   { col: 'left',  y: 302.8 },
  '7':   { col: 'right', y: 431.5 },
  '7_1': { col: 'right', y: 417.2 },
  '7_2': { col: 'right', y: 402.9 },
  '7_3': { col: 'right', y: 388.6 },
  '7_4': { col: 'right', y: 374.3 },
  '7_5': { col: 'right', y: 360.0 },
  '8':   { col: 'right', y: 347.4 },
  '8_1': { col: 'right', y: 333.1 },
  '9':   { col: 'right', y: 304.5 },
};

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

export async function generatePDF(
  data: FormData,
  selectedK: string[],
  attachedPdfBuffers: ArrayBuffer[]
): Promise<Uint8Array> {
  // Load the blank template PDF
  const templatePath = join(process.cwd(), 'public', 'blank_spaces.pdf');
  const templateBytes = readFileSync(templatePath);
  const doc = await PDFDocument.load(templateBytes);
  doc.registerFontkit(fontkit);

  // Embed DejaVu Sans font (supports Vietnamese)
  const fontPath = join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf');
  const boldFontPath = join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf');
  const fontBytes = readFileSync(fontPath);
  const boldFontBytes = readFileSync(boldFontPath);
  const font = await doc.embedFont(fontBytes);
  const boldFont = await doc.embedFont(boldFontBytes);

  const pages = doc.getPages();
  const blackColor = rgb(0, 0, 0);

  // Helper to draw text on a specific page
  const drawText = (pageNum: number, text: string, x: number, y: number, size: number, f: PDFFont = font) => {
    if (pageNum < 1 || pageNum > pages.length) return;
    const page = pages[pageNum - 1];
    try {
      page.drawText(text, { x, y, size, font: f, color: blackColor });
    } catch (e) {
      // If font can't render a character, skip
      console.warn(`Text render warning: ${e}`);
    }
  };

  // ============ PAGE 1: COVER ============
  // Fill cover page fields
  drawText(1, data.ho_ten, PAGE1_FIELDS.ho_ten.x, PAGE1_FIELDS.ho_ten.y, PAGE1_FIELDS.ho_ten.size, boldFont);
  drawText(1, fmtDate(data.ngay_sinh), PAGE1_FIELDS.ngay_sinh.x, PAGE1_FIELDS.ngay_sinh.y, PAGE1_FIELDS.ngay_sinh.size);
  drawText(1, data.gioi_tinh, PAGE1_FIELDS.gioi_tinh.x, PAGE1_FIELDS.gioi_tinh.y, PAGE1_FIELDS.gioi_tinh.size);
  drawText(1, data.sdt, PAGE1_FIELDS.sdt.x, PAGE1_FIELDS.sdt.y, PAGE1_FIELDS.sdt.size);
  drawText(1, data.dia_chi, PAGE1_FIELDS.dia_chi.x, PAGE1_FIELDS.dia_chi.y, PAGE1_FIELDS.dia_chi.size);

  // ============ PAGE 2: GIẤY YÊU CẦU ============
  // Fill person info
  drawText(2, data.ho_ten, PAGE2_FIELDS.ho_ten.x, PAGE2_FIELDS.ho_ten.y, PAGE2_FIELDS.ho_ten.size, boldFont);
  drawText(2, fmtDate(data.ngay_sinh), PAGE2_FIELDS.ngay_sinh.x, PAGE2_FIELDS.ngay_sinh.y, PAGE2_FIELDS.ngay_sinh.size);
  drawText(2, data.gioi_tinh, PAGE2_FIELDS.gioi_tinh.x, PAGE2_FIELDS.gioi_tinh.y, PAGE2_FIELDS.gioi_tinh.size);
  drawText(2, data.so_gttt, PAGE2_FIELDS.so_gttt.x, PAGE2_FIELDS.so_gttt.y, PAGE2_FIELDS.so_gttt.size);
  drawText(2, fmtDate(data.ngay_cap), PAGE2_FIELDS.ngay_cap.x, PAGE2_FIELDS.ngay_cap.y, PAGE2_FIELDS.ngay_cap.size);
  drawText(2, data.noi_cap, PAGE2_FIELDS.noi_cap.x, PAGE2_FIELDS.noi_cap.y, PAGE2_FIELDS.noi_cap.size);

  // Fill representative info
  drawText(2, data.nguoi_dai_dien, PAGE2_FIELDS.nguoi_dd.x, PAGE2_FIELDS.nguoi_dd.y, PAGE2_FIELDS.nguoi_dd.size);
  drawText(2, fmtDate(data.ngay_sinh_dd), PAGE2_FIELDS.ngay_sinh_dd.x, PAGE2_FIELDS.ngay_sinh_dd.y, PAGE2_FIELDS.ngay_sinh_dd.size);
  drawText(2, data.gioi_tinh_dd, PAGE2_FIELDS.gioi_tinh_dd.x, PAGE2_FIELDS.gioi_tinh_dd.y, PAGE2_FIELDS.gioi_tinh_dd.size);
  drawText(2, data.so_gttt_dd, PAGE2_FIELDS.so_gttt_dd.x, PAGE2_FIELDS.so_gttt_dd.y, PAGE2_FIELDS.so_gttt_dd.size);
  drawText(2, fmtDate(data.ngay_cap_dd), PAGE2_FIELDS.ngay_cap_dd.x, PAGE2_FIELDS.ngay_cap_dd.y, PAGE2_FIELDS.ngay_cap_dd.size);
  drawText(2, data.noi_cap_dd, PAGE2_FIELDS.noi_cap_dd.x, PAGE2_FIELDS.noi_cap_dd.y, PAGE2_FIELDS.noi_cap_dd.size);
  drawText(2, data.quan_he, PAGE2_FIELDS.quan_he.x, PAGE2_FIELDS.quan_he.y, PAGE2_FIELDS.quan_he.size);

  // Fill exam level
  const { items: examItems, mucKham } = getExamData(selectedK, data.gioi_tinh, data.ngay_sinh);
  drawText(2, mucKham, PAGE2_FIELDS.muc_kham.x, PAGE2_FIELDS.muc_kham.y, PAGE2_FIELDS.muc_kham.size, boldFont);

  // Fill exam table X marks
  for (const [id, pos] of Object.entries(EXAM_X_POSITIONS)) {
    if (examItems.has(id)) {
      const x = pos.col === 'left' ? LEFT_X_COL : RIGHT_X_COL;
      drawText(2, 'X', x, pos.y, 10, boldFont);
    }
  }

  // Fill ghi_chu
  if (data.ghi_chu) {
    drawText(2, data.ghi_chu, PAGE2_FIELDS.ghi_chu.x, PAGE2_FIELDS.ghi_chu.y, PAGE2_FIELDS.ghi_chu.size);
  }

  // ============ MERGE ATTACHED PDFs ============
  for (const pdfBuf of attachedPdfBuffers) {
    try {
      const srcDoc = await PDFDocument.load(pdfBuf);
      const copiedPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of copiedPages) {
        doc.addPage(page);
      }
    } catch (e) {
      console.error('Failed to merge PDF:', e);
    }
  }

  return doc.save();
}
