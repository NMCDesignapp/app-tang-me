import { FormData, getExamData } from './types';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

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
  // Dynamic imports for server-side only
  const PizZip = (await import('pizzip')).default;
  const Docxtemplater = (await import('docxtemplater')).default;
  const { PDFDocument } = await import('pdf-lib');

  // Read template DOCX
  const templatePath = join(process.cwd(), 'public', 'template.docx');
  const templateContent = readFileSync(templatePath, 'binary');

  // Fill template with docxtemplater
  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Build exam data
  const { items: examItems, mucKham } = getExamData(selectedK, data.gioi_tinh, data.ngay_sinh);

  // Exam keys that exist as placeholders in the template DOCX
  // Note: kham_8_1 does NOT have its own placeholder (shares with kham_8)
  const templateExamKeys = [
    '1', '2', '3', '4', '4_1', '4_2', '4_3', '4_4',
    '5', '6', '7', '7_1', '7_2', '7_3', '7_4', '7_5',
    '8', '9'
  ];

  // Build render data - only include fields that exist in the template
  const renderData: Record<string, string> = {
    ho_ten: data.ho_ten,
    ngay_sinh: fmtDate(data.ngay_sinh),
    gioi_tinh: data.gioi_tinh,
    sdt: data.sdt,
    dia_chi: data.dia_chi,
    so_gttt: data.so_gttt,
    ngay_cap: fmtDate(data.ngay_cap),
    noi_cap: data.noi_cap,
    nguoi_dai_dien: data.nguoi_dai_dien,
    ngay_sinh_dd: fmtDate(data.ngay_sinh_dd),
    gioi_tinh_dd: data.gioi_tinh_dd,
    so_gttt_dd: data.so_gttt_dd,
    // Note: ngay_cap_dd does NOT have placeholder in template
    // It appears together with so_gttt_dd on the same line
    noi_cap_dd: data.noi_cap_dd,
    quan_he: data.quan_he,
    muc_kham: mucKham,
    ghi_chu: data.ghi_chu,
  };

  // Add exam X marks
  for (const key of templateExamKeys) {
    renderData[`kham_${key}`] = examItems.has(key) ? 'X' : '';
  }

  doc.render(renderData);

  // Generate filled DOCX
  const filledDocx = doc.getZip().generate({ type: 'nodebuffer' });

  // Convert DOCX to PDF using LibreOffice
  const workDir = join(tmpdir(), `tangme-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });

  const docxPath = join(workDir, 'filled.docx');
  const pdfPath = join(workDir, 'filled.pdf');

  writeFileSync(docxPath, filledDocx);

  try {
    // Run LibreOffice headless conversion
    execSync(
      `HOME=${workDir} soffice --headless --norestore --nolockcheck --convert-to pdf:writer_pdf_Export "${docxPath}" --outdir "${workDir}"`,
      { timeout: 30000, stdio: 'pipe' }
    );
  } catch (e) {
    console.error('LibreOffice conversion error:', e);
    throw new Error('Không thể chuyển đổi DOCX sang PDF. Đảm bảo LibreOffice đã được cài đặt trên server.');
  }

  // Read generated PDF
  if (!existsSync(pdfPath)) {
    throw new Error('LibreOffice không tạo được file PDF.');
  }

  const pdfBytes = readFileSync(pdfPath);

  // If no attachments, return directly
  if (attachedPdfBuffers.length === 0) {
    return new Uint8Array(pdfBytes);
  }

  // Merge attached PDFs
  const mainDoc = await PDFDocument.load(pdfBytes);
  for (const buf of attachedPdfBuffers) {
    try {
      const srcDoc = await PDFDocument.load(buf);
      const pages = await mainDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of pages) {
        mainDoc.addPage(page);
      }
    } catch (e) {
      console.error('Failed to merge attached PDF:', e);
    }
  }

  return mainDoc.save();
}
