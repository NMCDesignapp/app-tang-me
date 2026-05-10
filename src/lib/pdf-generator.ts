import { PDFDocument, rgb, PDFPage, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { FormData, getExamData, EXAM_ITEMS } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const M = 40; // margin
const ML = 50; // left margin (slightly wider like template)

interface DrawCtx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  y: number;
}

function newPage(doc: PDFDocument, font: PDFFont, boldFont: PDFFont): DrawCtx {
  return { doc, page: doc.addPage([PAGE_W, PAGE_H]), font, boldFont, y: PAGE_H - M };
}

function ensureSpace(ctx: DrawCtx, needed: number): DrawCtx {
  if (ctx.y - needed < 50) {
    const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    return { ...ctx, page, y: PAGE_H - M };
  }
  return ctx;
}

export async function generatePDF(
  data: FormData,
  selectedK: string[],
  attachedPdfBuffers: ArrayBuffer[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fontPath = join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf');
  const boldFontPath = join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf');
  const fontBytes = readFileSync(fontPath);
  const boldFontBytes = readFileSync(boldFontPath);
  const font = await doc.embedFont(fontBytes);
  const boldFont = await doc.embedFont(boldFontBytes);

  const { items: examItems, mucKham } = getExamData(selectedK, data.gioi_tinh, data.ngay_sinh);

  // ============ PAGE 1: COVER PAGE ============
  let ctx = newPage(doc, font, boldFont);
  ctx.y -= 10;

  // Company header
  ctx = drawCentered(ctx, 'CÔNG TY: Bảo Việt Nhân thọ An Giang', 11, boldFont);
  ctx = drawCentered(ctx, 'Địa chỉ: 10 Lê Hồng Phong, Mỹ Bình, Long Xuyên, An Giang', 9, font);
  ctx = drawCentered(ctx, 'Điện thoại: 02963.957.177 - 02963.959.717', 9, font);
  ctx.y -= 10;
  drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 1.5);
  ctx.y -= 20;

  // Main title box
  ctx = drawCentered(ctx, 'HỒ SƠ KIỂM TRA SỨC KHỎE', 20, boldFont);
  ctx.y -= 5;
  ctx = drawCentered(ctx, '(Số GYCBH/HĐBH: ……………………)', 11, font);
  ctx.y -= 5;

  // Red/white highlight for "CÓ CÁN BỘ GIÁM SÁT"
  ctx.page.drawRectangle({
    x: ML + 50,
    y: ctx.y - 4,
    width: PAGE_W - ML - M - 100,
    height: 18,
    color: rgb(0.85, 0.1, 0.1),
  });
  ctx = drawCentered(ctx, 'CÓ CÁN BỘ GIÁM SÁT', 12, boldFont, rgb(1, 1, 1));
  ctx.y -= 15;

  // Person info on cover
  ctx = drawText(ctx, 'NGƯỜI ĐƯỢC KIỂM TRA SỨC KHỎE:', 11, boldFont);
  ctx.y -= 5;
  ctx = drawField(ctx, 'Họ và tên:', data.ho_ten, 120);
  ctx = drawFieldInline(ctx, [
    { label: 'Ngày/tháng/năm sinh:', value: formatDate(data.ngay_sinh), width: 200 },
    { label: 'Giới tính:', value: data.gioi_tinh, width: 120 },
  ]);
  ctx = drawFieldInline(ctx, [
    { label: 'SĐT:', value: data.sdt, width: 180 },
    { label: 'Địa chỉ:', value: data.dia_chi, width: 280 },
  ]);
  ctx.y -= 15;

  // CƠ SỞ Y TẾ THỰC HIỆN section
  ctx = drawText(ctx, 'CƠ SỞ Y TẾ THỰC HIỆN:', 11, boldFont);
  ctx.y -= 5;
  ctx = drawField(ctx, 'Tên cơ sở:', '', 100);
  ctx = drawDottedLine(ctx);
  ctx = drawField(ctx, 'Địa chỉ:', '', 80);
  ctx = drawDottedLine(ctx);
  ctx.y -= 10;

  // Year
  ctx = drawCentered(ctx, 'Năm 2026', 12, boldFont);
  ctx.y -= 30;

  // Image placeholder area (logo area)
  const imgBoxX = ML + 60;
  const imgBoxY = ctx.y - 120;
  const imgBoxW = PAGE_W - ML - M - 120;
  const imgBoxH = 130;
  ctx.page.drawRectangle({
    x: imgBoxX, y: imgBoxY, width: imgBoxW, height: imgBoxH,
    borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1,
  });
  ctx.page.drawText('(Logo / Hình ảnh)', {
    x: imgBoxX + imgBoxW / 2 - 60, y: imgBoxY + imgBoxH / 2 - 5,
    size: 10, font, color: rgb(0.7, 0.7, 0.7),
  });
  ctx.y = imgBoxY - 20;

  // Duplicate info at bottom (like template)
  drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.5);
  ctx.y -= 15;
  ctx = drawCentered(ctx, 'CÔNG TY: Bảo Việt Nhân thọ An Giang', 9, boldFont);
  ctx = drawCentered(ctx, 'Địa chỉ: 10 Lê Hồng Phong, Mỹ Bình, Long Xuyên, An Giang', 8, font);
  ctx = drawCentered(ctx, 'Điện thoại: 02963.957.177 - 02963.959.717', 8, font);

  // ============ PAGE 2: REQUEST FORM ============
  ctx = newPage(doc, font, boldFont);
  ctx.y -= 5;

  ctx = drawCentered(ctx, 'GIẤY YÊU CẦU KIỂM TRA SỨC KHỎE', 14, boldFont);
  ctx.y -= 8;

  ctx = drawWrapped(ctx, 'Cơ sở y tế lưu ý kiểm tra thông tin nhân thân của Người được kiểm tra sức khỏe và Người đại diện theo pháp luật của Người được kiểm tra sức khỏe (nếu Người được kiểm tra sức khỏe dưới 18 tuổi), đảm bảo khám đúng người được Bảo Việt Nhân thọ yêu cầu.', 9, font, ML, PAGE_W - M);
  ctx.y -= 8;

  // I. Person info
  ctx = drawText(ctx, 'I. NGƯỜI ĐƯỢC KIỂM TRA SỨC KHỎE:', 10, boldFont);
  ctx = drawField(ctx, 'Họ và tên:', data.ho_ten, 180);
  ctx = drawFieldInline(ctx, [
    { label: 'Ngày/tháng/năm sinh:', value: formatDate(data.ngay_sinh), width: 200 },
    { label: 'Giới tính:', value: data.gioi_tinh, width: 100 },
  ]);
  ctx = drawFieldInline(ctx, [
    { label: 'Số giấy tờ tùy thân (1):', value: data.so_gttt, width: 200 },
    { label: 'Ngày cấp:', value: formatDate(data.ngay_cap), width: 120 },
  ]);
  ctx = drawField(ctx, 'Nơi cấp:', data.noi_cap, 100);
  ctx.y -= 6;

  // II. Representative
  ctx = drawText(ctx, 'II. NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT (2)', 10, boldFont);
  ctx = drawText(ctx, '(Trường hợp người được KTSK dưới 18 tuổi):', 9, font);
  ctx = drawField(ctx, '1. Họ và tên:', data.nguoi_dai_dien, 130);
  ctx = drawFieldInline(ctx, [
    { label: '2. Ngày/tháng/năm sinh:', value: formatDate(data.ngay_sinh_dd), width: 200 },
    { label: 'Giới tính:', value: data.gioi_tinh_dd, width: 100 },
  ]);
  ctx = drawFieldInline(ctx, [
    { label: '3. Số giấy tờ tùy thân (1):', value: data.so_gttt_dd, width: 200 },
    { label: 'Ngày cấp:', value: formatDate(data.ngay_cap_dd), width: 120 },
  ]);
  ctx = drawField(ctx, 'Nơi cấp:', data.noi_cap_dd, 100);
  ctx = drawField(ctx, '4. Quan hệ với Người được KTSK:', data.quan_he, 280);
  ctx.y -= 6;

  // III. Exam content
  ctx = drawText(ctx, 'III. NỘI DUNG YÊU CẦU KIỂM TRA:', 10, boldFont);
  ctx = drawWrapped(ctx, 'Ghi nhận thông tin về tiền sử liên quan đến Người được yêu cầu kiểm tra sức khỏe. Thực hiện kiểm tra theo các nội dung đánh dấu "X" trong cột yêu cầu dưới đây.', 9, font, ML, PAGE_W - M);
  ctx.y -= 3;
  ctx = drawText(ctx, `Mức khám: ${mucKham}`, 10, boldFont);
  ctx.y -= 6;

  // Exam items table
  ctx = drawExamTable(ctx, examItems);
  ctx.y -= 6;

  // Notes
  ctx = drawText(ctx, '(*) Lưu ý:', 9, boldFont);
  const notes = [
    '- Khám huyết áp: đo huyết áp đối với khách hàng trên 15 tuổi.',
    '- Siêu âm ổ bụng: bao gồm siêu âm tử cung, phần phụ đối với khách hàng nữ, tiền liệt tuyến đối với khách hàng nam.',
    '- Siêu âm tuyến vú: chỉ thực hiện đối với khách hàng nữ từ 18 tuổi trở lên hoặc nghi ngờ có bệnh lý.',
    '- Xét nghiệm HBeAg: chỉ thực hiện khi kết quả xét nghiệm HBsAg dương tính.',
    '- Xét nghiệm HIV: chỉ thực hiện đối với khách hàng từ 18 đến 50 tuổi hoặc khách hàng có nguy cơ lây nhiễm.',
  ];
  for (const note of notes) {
    ctx = ensureSpace(ctx, 14);
    ctx = drawText(ctx, note, 8, font);
  }
  ctx.y -= 3;
  ctx = drawField(ctx, 'Nội dung cần kiểm tra bổ sung:', data.ghi_chu, 260);
  ctx.y -= 10;

  // Signature
  ctx = ensureSpace(ctx, 60);
  ctx = drawCentered(ctx, 'An Giang, ngày ... tháng ... năm ......', 10, font);
  ctx.y -= 15;
  ctx = drawCentered(ctx, 'Người lập', 10, boldFont);
  ctx.y -= 5;
  ctx = drawCentered(ctx, 'Huỳnh Ngọc Phương Thy', 10, font);

  // ============ PAGE 3: RESULTS - QUESTIONS ============
  ctx = newPage(doc, font, boldFont);
  ctx.y -= 5;

  ctx = drawCentered(ctx, 'KẾT QUẢ VÀ KẾT LUẬN KIỂM TRA SỨC KHỎE', 14, boldFont);
  ctx.y -= 10;

  ctx = drawText(ctx, 'I. TIỀN SỬ LIÊN QUAN ĐẾN NGƯỜI ĐƯỢC KIỂM TRA SỨC KHỎE:', 10, boldFont);
  ctx = drawWrapped(ctx, 'Người được kiểm tra sức khỏe hoặc Người đại diện theo pháp luật (2) (nếu Người được kiểm tra sức khỏe dưới 18 tuổi) cung cấp thông tin về Người được kiểm tra sức khỏe theo các câu hỏi dưới đây.', 9, font, ML, PAGE_W - M);
  ctx.y -= 2;
  ctx = drawWrapped(ctx, '(Đánh dấu "X" vào cột trả lời "Không" hoặc "Có" và ghi nhận thông tin chi tiết nếu trả lời "Có")', 8, font, ML, PAGE_W - M);
  ctx.y -= 4;

  const qColW = [25, 270, 40, 40, 90];
  drawTableRow(ctx, ['TT', 'Câu hỏi', 'Không', 'Có', 'Thông tin chi tiết'], qColW, 8, boldFont, true);
  drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.5);

  const questions = [
    'Có hút thuốc lá, thuốc lá điện tử, thuốc lào không? Xin cho biết số điếu thuốc/số lượt hút trung bình mỗi ngày?',
    'Có sử dụng rượu, bia không? Xin cho biết lượng rượu, bia sử dụng trung bình mỗi ngày?',
    'Đã từng hoặc đang sử dụng bất kỳ loại chất ma túy, chất kích thích hoặc chất gây nghiện nào không?',
    'Đã từng kiểm tra huyết áp bao giờ chưa? Nếu có, xin cho biết chỉ số huyết áp cao nhất?',
    'Đã từng có bất kỳ triệu chứng/dấu hiệu sau: đau ngực, ngất, khó thở không? Nếu có, xin cho biết tên triệu chứng/dấu hiệu, thời gian xuất hiện và tần suất tái phát?',
    'Đã từng bị xuất huyết bất thường (xuất huyết dưới da, ho ra máu, nôn ra máu, đi ngoài ra máu hoặc phân đen, tiểu ra máu) không? Nếu có, xin cho biết tên triệu chứng/dấu hiệu và thời gian xuất hiện?',
    'Đã bao giờ nổi hạch hoặc có u, nang, polyp, nhân, bướu ở đâu không? Nếu có, xin cho biết tên và vị trí?',
    'Đã từng làm xét nghiệm về bệnh lậu, giang mai, HIV/AIDS chưa? Nếu có, xin cho biết loại xét nghiệm và kết quả?',
    'Có dị tật/khuyết tật/bệnh bẩm sinh không? Xin cho biết tên bệnh/dị tật/khuyết tật?',
    'Đã bao giờ bị tai nạn chưa? Nếu có, xin cho biết thời gian xảy ra tai nạn? Cơ quan bị tổn thương, phương pháp điều trị, hậu quả và di chứng?',
  ];

  for (let i = 0; i < questions.length; i++) {
    ctx = ensureSpace(ctx, 28);
    drawTableRow(ctx, [String(i + 1), questions[i], '', '', ''], qColW, 7.5, font, false);
    drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.3);
  }

  // ============ PAGE 4: MORE QUESTIONS + COMMITMENT + PHYSICAL EXAM START ============
  ctx = newPage(doc, font, boldFont);
  ctx.y -= 5;

  // Continue questions 11-12
  const moreQuestions = [
    'Đã từng phát hiện/điều trị bất kỳ bệnh lý nào chưa? Nếu có, xin cho biết tên bệnh? Thời gian phát hiện/điều trị? Phương pháp điều trị?',
    'Có ai trong gia đình bị mắc bệnh hay chết do bệnh: Tim mạch, đái tháo đường, lao, viêm gan, ung thư, rối loạn tâm thần, động kinh, các bệnh di truyền, bệnh liên quan đến HIV/AIDS không?',
  ];

  for (let i = 0; i < moreQuestions.length; i++) {
    ctx = ensureSpace(ctx, 28);
    drawTableRow(ctx, [String(11 + i), moreQuestions[i], '', '', ''], qColW, 7.5, font, false);
    drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.3);
  }

  ctx.y -= 4;
  ctx = drawText(ctx, 'Phần câu hỏi bổ sung khi Người được KTSK là trẻ em (dưới 16 tuổi):', 9, boldFont);
  ctx.y -= 2;
  const childQ = [
    'Trẻ có sinh non không? Nếu có, xin cho biết trẻ có biến chứng nào về hô hấp, tim mạch, tiêu hóa, mắt do sinh non không? Tình trạng hiện tại?',
    'Trẻ đã từng có bất kỳ biểu hiện nào của sự chậm phát triển về tâm thần/vận động, chậm nói, tự kỷ, tăng động/giảm chú ý không? Nếu có, xin cho biết biểu hiện cụ thể?',
  ];
  for (let i = 0; i < childQ.length; i++) {
    ctx = ensureSpace(ctx, 28);
    drawTableRow(ctx, [String(13 + i), childQ[i], '', '', ''], qColW, 7.5, font, false);
    drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.3);
  }

  ctx.y -= 8;

  // Commitment
  ctx = drawText(ctx, '* Tôi cam kết:', 9, boldFont);
  const commits = [
    'Thông tin Tôi đã cung cấp cho Cơ sở y tế theo yêu cầu của Bảo Việt Nhân thọ là đầy đủ và đúng sự thật.',
    'Đồng ý cho phép Cơ sở y tế kiểm tra sức khỏe bao gồm xét nghiệm HIV (nếu có) theo yêu cầu của Bảo Việt Nhân thọ với điều kiện kết quả kiểm tra sức khỏe được bảo mật, sử dụng cho mục đích giao kết và thực hiện hợp đồng bảo hiểm.',
    'Đồng ý khấu trừ chi phí kiểm tra sức khỏe trong trường hợp hồ sơ yêu cầu bảo hiểm chấm dứt hiệu lực do yêu cầu của Tôi hoặc do sự chậm trễ của Tôi trong việc bổ sung thông tin và trong hồ sơ khôi phục/thay đổi điều kiện bảo hiểm. Các thông tin này được coi là thông tin bổ sung cho GYCBH liên quan.',
  ];
  for (const c of commits) {
    ctx = ensureSpace(ctx, 20);
    ctx = drawWrapped(ctx, '- ' + c, 8, font, ML + 10, PAGE_W - M);
  }
  ctx.y -= 6;
  ctx = ensureSpace(ctx, 40);
  ctx = drawCentered(ctx, 'Ngày ............ tháng ............ năm ..................', 9, font);
  ctx.y -= 14;
  ctx = drawCentered(ctx, 'Người được KTSK hoặc Người đại diện theo pháp luật (2)', 9, boldFont);
  ctx.y -= 6;
  ctx = drawCentered(ctx, '(Ký và ghi rõ họ tên)', 8, font);

  // ============ PAGE 5: PHYSICAL EXAM ============
  ctx = newPage(doc, font, boldFont);
  ctx.y -= 5;

  ctx = drawText(ctx, 'II. KHÁM THỂ LỰC:', 11, boldFont);
  ctx.y -= 6;
  const physicalItems = [
    '1. Chiều cao: ............... cm;',
    '2. Cân nặng: ............... kg;',
    '3. Mạch: ............... lần/phút;',
    '4. Huyết áp: ........ / ........ mmHg;',
  ];
  for (const item of physicalItems) {
    ctx = drawText(ctx, item, 9, font);
  }
  ctx.y -= 2;
  ctx = drawWrapped(ctx, 'Lưu ý: Nếu khách hàng có tiền sử tăng huyết áp hoặc huyết áp tâm thu ≥ 140 mmHg và/hoặc huyết áp tâm trương ≥ 90 mmHg, vui lòng đo thêm ít nhất 2 lần, mỗi lần cách nhau 3-5 phút.', 8, font, ML, PAGE_W - M);
  ctx.y -= 2;
  ctx = drawText(ctx, 'Huyết áp lần 2: ........ / ........ mmHg', 9, font);
  ctx = drawText(ctx, 'Huyết áp lần 3: ........ / ........ mmHg', 9, font);
  ctx.y -= 8;

  ctx = drawText(ctx, 'III. KHÁM LÂM SÀNG:', 11, boldFont);
  ctx = drawWrapped(ctx, '(Bác sỹ khám và ghi nhận đầy đủ các bất thường về sức khỏe của người được kiểm tra sức khỏe)', 8, font, ML, PAGE_W - M);
  ctx.y -= 4;

  const clinicalSections = [
    'Tim mạch:',
    'Hô hấp:',
    'Tiêu hóa:',
    'Thận - tiết niệu:',
    'Cơ xương khớp:',
    'Thần kinh:',
    'Tâm thần:',
    'Nội tiết:',
    'Da liễu:',
    'Mắt:',
    'Tai mũi họng:',
    'Sản phụ khoa:',
    'Các bộ phận khác:',
  ];
  for (const section of clinicalSections) {
    ctx = ensureSpace(ctx, 35);
    ctx = drawText(ctx, section, 9, boldFont);
    // Draw 2 dotted lines for writing
    drawLine(ctx, ML + 10, ctx.y - 2, PAGE_W - M, ctx.y - 2, 0.3, [2, 2]);
    ctx.y -= 14;
    drawLine(ctx, ML + 10, ctx.y - 2, PAGE_W - M, ctx.y - 2, 0.3, [2, 2]);
    ctx.y -= 12;
  }

  ctx.y -= 6;

  // IV. Lab results
  ctx = ensureSpace(ctx, 80);
  ctx = drawText(ctx, 'IV. KẾT QUẢ XÉT NGHIỆM VÀ CÁC KỸ THUẬT CHẨN ĐOÁN KHÁC:', 10, boldFont);
  ctx.y -= 6;
  for (let i = 0; i < 6; i++) {
    drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.3, [2, 2]);
    ctx.y -= 18;
  }

  ctx.y -= 6;
  ctx = ensureSpace(ctx, 80);
  ctx = drawText(ctx, 'V. KẾT LUẬN:', 10, boldFont);
  ctx.y -= 6;
  for (let i = 0; i < 5; i++) {
    drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.3, [2, 2]);
    ctx.y -= 18;
  }

  ctx = ensureSpace(ctx, 30);
  ctx = drawText(ctx, 'VI. TỔNG CHI PHÍ KIỂM TRA SỨC KHỎE: ...............................................', 10, boldFont);
  ctx.y -= 20;

  // Signatures
  ctx = ensureSpace(ctx, 80);
  const signY = ctx.y;
  ctx.page.drawText('Ngày ...... tháng ...... năm ......', { x: ML, y: signY, size: 9, font });
  ctx.page.drawText('Nhân viên giám sát', { x: ML + 20, y: signY - 14, size: 9, font: boldFont });
  ctx.page.drawText('(Ký và ghi rõ họ tên, vị trí công việc)', { x: ML, y: signY - 26, size: 8, font });

  ctx.page.drawText('Ngày ...... tháng ...... năm ......', { x: PAGE_W - M - 180, y: signY, size: 9, font });
  ctx.page.drawText('Cơ sở y tế', { x: PAGE_W - M - 130, y: signY - 14, size: 9, font: boldFont });
  ctx.page.drawText('(Ký, ghi rõ họ tên và đóng dấu)', { x: PAGE_W - M - 190, y: signY - 26, size: 8, font });

  ctx.y = signY - 50;

  // Footnote
  ctx = ensureSpace(ctx, 40);
  drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.5);
  ctx.y -= 10;
  ctx = drawWrapped(ctx, '(1) Số giấy tờ tùy thân: Mã định danh cá nhân, số thẻ căn cước công dân, số chứng minh nhân dân, số hộ chiếu, số giấy khai sinh.', 7, font, ML, PAGE_W - M);
  ctx.y -= 2;
  ctx = drawWrapped(ctx, '(2) Người đại diện theo pháp luật của Người được KTSK: là Cha, Mẹ hoặc Người giám hộ của Người được KTSK.', 7, font, ML, PAGE_W - M);

  // ============ Merge attached PDFs ============
  for (const pdfBuf of attachedPdfBuffers) {
    try {
      const srcDoc = await PDFDocument.load(pdfBuf);
      const pages = await doc.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of pages) {
        doc.addPage(page);
      }
    } catch (e) {
      console.error('Failed to merge PDF:', e);
    }
  }

  return doc.save();
}

// ============ Drawing helpers ============

function drawCentered(ctx: DrawCtx, text: string, size: number, font: PDFFont, color?: { red: number; green: number; blue: number }): DrawCtx {
  const tw = font.widthOfTextAtSize(text, size);
  const c = color ? rgb(color.red, color.green, color.blue) : rgb(0, 0, 0);
  ctx.page.drawText(text, {
    x: (PAGE_W - tw) / 2,
    y: ctx.y,
    size,
    font,
    color: c,
  });
  ctx.y -= size + 4;
  return ctx;
}

function drawText(ctx: DrawCtx, text: string, size: number, font: PDFFont): DrawCtx {
  ctx.page.drawText(text, {
    x: ML,
    y: ctx.y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
  ctx.y -= size + 4;
  return ctx;
}

function drawWrapped(
  ctx: DrawCtx,
  text: string,
  size: number,
  font: PDFFont,
  left: number,
  right: number
): DrawCtx {
  const maxW = right - left;
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      ctx.page.drawText(line, { x: left, y: ctx.y, size, font, color: rgb(0, 0, 0) });
      ctx.y -= size + 2;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.page.drawText(line, { x: left, y: ctx.y, size, font, color: rgb(0, 0, 0) });
    ctx.y -= size + 2;
  }
  return ctx;
}

function drawField(ctx: DrawCtx, label: string, value: string, labelWidth: number): DrawCtx {
  ctx.page.drawText(label, { x: ML, y: ctx.y, size: 9, font: ctx.boldFont, color: rgb(0, 0, 0) });
  ctx.page.drawText(value || '................................', {
    x: ML + labelWidth,
    y: ctx.y,
    size: 9,
    font: ctx.font,
    color: rgb(0, 0, 0),
  });
  ctx.y -= 14;
  return ctx;
}

interface FieldInline {
  label: string;
  value: string;
  width: number;
}

function drawFieldInline(ctx: DrawCtx, fields: FieldInline[]): DrawCtx {
  let x = ML;
  for (const f of fields) {
    ctx.page.drawText(f.label, { x, y: ctx.y, size: 9, font: ctx.boldFont, color: rgb(0, 0, 0) });
    const labelW = ctx.boldFont.widthOfTextAtSize(f.label, 9) + 4;
    ctx.page.drawText(f.value || '................', {
      x: x + labelW,
      y: ctx.y,
      size: 9,
      font: ctx.font,
      color: rgb(0, 0, 0),
    });
    x += f.width;
  }
  ctx.y -= 14;
  return ctx;
}

function drawDottedLine(ctx: DrawCtx): DrawCtx {
  drawLine(ctx, ML + 10, ctx.y, PAGE_W - M, ctx.y, 0.3, [2, 2]);
  ctx.y -= 10;
  return ctx;
}

function drawLine(
  ctx: DrawCtx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  dash?: number[]
) {
  ctx.page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: rgb(0, 0, 0),
    dashArray: dash,
  });
}

function drawTableRow(
  ctx: DrawCtx,
  cells: string[],
  colWidths: number[],
  size: number,
  font: PDFFont,
  _isHeader: boolean
) {
  let x = ML;
  for (let i = 0; i < cells.length; i++) {
    const cellText = cells[i];
    if (cellText) {
      ctx.page.drawText(cellText, {
        x: x + 3,
        y: ctx.y - size - 1,
        size,
        font,
        color: rgb(0, 0, 0),
      });
    }
    x += colWidths[i];
  }
  ctx.y -= size + 6;
}

function drawExamTable(ctx: DrawCtx, examItems: Set<string>): DrawCtx {
  const colW = [30, 210, 50, 30, 210, 50];
  ctx = ensureSpace(ctx, 20);
  drawLine(ctx, ML, ctx.y + 2, PAGE_W - M, ctx.y + 2, 1);

  const headerY = ctx.y;
  ctx.page.drawText('TT', { x: ML + 3, y: headerY - 10, size: 9, font: ctx.boldFont });
  ctx.page.drawText('Nội dung khám, xét nghiệm', { x: ML + colW[0] + 3, y: headerY - 10, size: 9, font: ctx.boldFont });
  ctx.page.drawText('Y/C', { x: ML + colW[0] + colW[1] + 15, y: headerY - 10, size: 9, font: ctx.boldFont });
  ctx.page.drawText('TT', { x: ML + colW[0] + colW[1] + colW[2] + 3, y: headerY - 10, size: 9, font: ctx.boldFont });
  ctx.page.drawText('Nội dung khám, xét nghiệm', { x: ML + colW[0] + colW[1] + colW[2] + colW[3] + 3, y: headerY - 10, size: 9, font: ctx.boldFont });
  ctx.page.drawText('Y/C', { x: ML + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + 15, y: headerY - 10, size: 9, font: ctx.boldFont });

  ctx.y = headerY - 18;
  drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.5);

  const leftItems = EXAM_ITEMS.filter((_, i) => i < Math.ceil(EXAM_ITEMS.length / 2));
  const rightItems = EXAM_ITEMS.filter((_, i) => i >= Math.ceil(EXAM_ITEMS.length / 2));
  const maxRows = Math.max(leftItems.length, rightItems.length);

  for (let r = 0; r < maxRows; r++) {
    ctx = ensureSpace(ctx, 16);
    const rowY = ctx.y;
    const rowH = 14;

    if (r < leftItems.length) {
      const item = leftItems[r];
      const isParent = item.parent;
      const f = isParent ? ctx.boldFont : ctx.font;
      ctx.page.drawText(item.id, { x: ML + 5, y: rowY - 11, size: 8, font: f });
      ctx.page.drawText(item.label, { x: ML + colW[0] + 5, y: rowY - 11, size: 8, font: f });
      if (examItems.has(item.id)) {
        ctx.page.drawText('X', { x: ML + colW[0] + colW[1] + 20, y: rowY - 11, size: 9, font: ctx.boldFont });
      }
    }

    if (r < rightItems.length) {
      const item = rightItems[r];
      const isParent = item.parent;
      const f = isParent ? ctx.boldFont : ctx.font;
      const rightX = ML + colW[0] + colW[1] + colW[2];
      ctx.page.drawText(item.id, { x: rightX + 5, y: rowY - 11, size: 8, font: f });
      ctx.page.drawText(item.label, { x: rightX + colW[3] + 5, y: rowY - 11, size: 8, font: f });
      if (examItems.has(item.id)) {
        ctx.page.drawText('X', { x: rightX + colW[3] + colW[4] + 20, y: rowY - 11, size: 9, font: ctx.boldFont });
      }
    }

    ctx.y = rowY - rowH;
    drawLine(ctx, ML, ctx.y, PAGE_W - M, ctx.y, 0.3);
  }

  return ctx;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}
