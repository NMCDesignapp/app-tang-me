import { NextRequest, NextResponse } from 'next/server';
import { generatePDF } from '@/lib/pdf-generator';
import { FormData, getExamData } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract personal info
    const data: FormData = {
      ho_ten: (formData.get('ho_ten') as string) || '',
      ngay_sinh: (formData.get('ngay_sinh') as string) || '',
      gioi_tinh: (formData.get('gioi_tinh') as string) || '',
      so_gttt: (formData.get('so_gttt') as string) || '',
      ngay_cap: (formData.get('ngay_cap') as string) || '',
      noi_cap: (formData.get('noi_cap') as string) || '',
      sdt: (formData.get('sdt') as string) || '',
      dia_chi: (formData.get('dia_chi') as string) || '',
      so_giay_yeu_cau: (formData.get('so_giay_yeu_cau') as string) || '',
      ghi_chu: (formData.get('ghi_chu') as string) || '',
      nguoi_dai_dien: (formData.get('nguoi_dai_dien') as string) || '',
      ngay_sinh_dd: (formData.get('ngay_sinh_dd') as string) || '',
      gioi_tinh_dd: (formData.get('gioi_tinh_dd') as string) || '',
      so_gttt_dd: (formData.get('so_gttt_dd') as string) || '',
      ngay_cap_dd: (formData.get('ngay_cap_dd') as string) || '',
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

    // Generate PDF using pdf-lib (no LibreOffice needed!)
    const pdfBytes = await generatePDF(data, selectedK, attachedPdfs);

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
