import { NextRequest, NextResponse } from 'next/server';
import { getExamData } from '@/lib/types';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract personal info
    const data: Record<string, string> = {
      ho_ten: (formData.get('ho_ten') as string) || '',
      ngay_sinh: formatDate(formData.get('ngay_sinh') as string),
      gioi_tinh: (formData.get('gioi_tinh') as string) || '',
      so_gttt: (formData.get('so_gttt') as string) || '',
      ngay_cap: formatDate(formData.get('ngay_cap') as string),
      noi_cap: (formData.get('noi_cap') as string) || '',
      sdt: (formData.get('sdt') as string) || '',
      dia_chi: (formData.get('dia_chi') as string) || '',
      ghi_chu: (formData.get('ghi_chu') as string) || '',
      nguoi_dai_dien: (formData.get('nguoi_dai_dien') as string) || '',
      ngay_sinh_dd: formatDate(formData.get('ngay_sinh_dd') as string),
      gioi_tinh_dd: (formData.get('gioi_tinh_dd') as string) || '',
      so_gttt_dd: (formData.get('so_gttt_dd') as string) || '',
      ngay_cap_dd: formatDate(formData.get('ngay_cap_dd') as string),
      noi_cap_dd: (formData.get('noi_cap_dd') as string) || '',
      quan_he: (formData.get('quan_he') as string) || '',
    };

    // Get selected K packages
    const selectedKStr = (formData.get('selected_K') as string) || '';
    const selectedK = selectedKStr.split(',').filter((k) => k.trim());

    if (selectedK.length === 0) {
      return NextResponse.json(
        { error: 'Vui lòng chọn ít nhất một gói khám' },
        { status: 400 }
      );
    }

    const { items: examItems, mucKham } = getExamData(
      selectedK,
      data.gioi_tinh,
      (formData.get('ngay_sinh') as string) || ''
    );

    data.muc_kham = mucKham;

    // Build exam data placeholders (X or empty)
    const allExamKeys = [
      '1', '2', '3', '4', '4_1', '4_2', '4_3', '4_4',
      '5', '6', '7', '7_1', '7_2', '7_3', '7_4', '7_5',
      '8', '8_1', '9'
    ];
    for (const key of allExamKeys) {
      data[`kham_${key}`] = examItems.has(key) ? 'X' : '';
    }

    // Get attached PDF files
    const attachedPdfs: ArrayBuffer[] = [];
    const attachListStr = (formData.get('attach_list') as string) || '';
    const attachList = attachListStr.split(',').filter((n) => n.trim());

    for (const num of attachList) {
      const file = formData.get(`attach_${num}`) as File | null;
      if (file) {
        const buf = await file.arrayBuffer();
        attachedPdfs.push(buf);
      }
    }

    // Generate PDF using template
    const pdfBytes = await generatePDFFromTemplate(data, attachedPdfs);

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Ket_qua.pdf"',
      },
    });
  } catch (error: unknown) {
    console.error('PDF generation error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi tạo PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generatePDFFromTemplate(
  data: Record<string, string>,
  attachedPdfs: ArrayBuffer[]
): Promise<Uint8Array> {
  // Dynamic imports for server-side only
  const PizZip = (await import('pizzip')).default;
  const Docxtemplater = (await import('docxtemplater')).default;
  const libre = await import('libreoffice-convert');
  const { PDFDocument } = await import('pdf-lib');

  // Read template
  const templatePath = join(process.cwd(), 'public', 'template.docx');
  const templateContent = readFileSync(templatePath, 'binary');

  // Fill template
  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(data);

  const filledDocx = doc.getZip().generate({ type: 'nodebuffer' });

  // Convert DOCX to PDF using LibreOffice
  const pdfBuf: Buffer = await new Promise((resolve, reject) => {
    libre.convert(filledDocx, '.pdf', undefined, (err: Error | null, result: Buffer) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  // If no attachments, return directly
  if (attachedPdfs.length === 0) {
    return new Uint8Array(pdfBuf);
  }

  // Merge attached PDFs
  const mainDoc = await PDFDocument.load(pdfBuf);
  for (const pdfBuf of attachedPdfs) {
    try {
      const srcDoc = await PDFDocument.load(pdfBuf);
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}
