import { PDFDocument, rgb, PDFPage, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { FormData, getExamData, EXAM_ITEMS } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

// A4 dimensions in points
const PW = 595.28;
const PH = 841.89;
const ML = 50;   // left margin
const MR = 40;   // right margin  
const MT = 40;   // top margin
const MB = 40;   // bottom margin
const CW = PW - ML - MR; // content width

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  f: PDFFont;   // regular font
  fb: PDFFont;  // bold font
  y: number;
}

function newPage(doc: PDFDocument, f: PDFFont, fb: PDFFont): Ctx {
  const page = doc.addPage([PW, PH]);
  return { doc, page, f, fb, y: PH - MT };
}

function checkPage(ctx: Ctx, need: number): Ctx {
  if (ctx.y - need < MB) {
    return newPage(ctx.doc, ctx.f, ctx.fb);
  }
  return ctx;
}

// ==================== DRAWING HELPERS ====================

function centerText(ctx: Ctx, text: string, size: number, font: PDFFont, color = rgb(0, 0, 0)): Ctx {
  const w = font.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, { x: (PW - w) / 2, y: ctx.y, size, font, color });
  ctx.y -= size + 3;
  return ctx;
}

function leftText(ctx: Ctx, text: string, size: number, font: PDFFont, x = ML): Ctx {
  ctx.page.drawText(text, { x, y: ctx.y, size, font, color: rgb(0, 0, 0) });
  ctx.y -= size + 3;
  return ctx;
}

function wrapText(ctx: Ctx, text: string, size: number, font: PDFFont, x = ML, maxX = PW - MR): Ctx {
  const maxW = maxX - x;
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      ctx.page.drawText(line, { x, y: ctx.y, size, font, color: rgb(0, 0, 0) });
      ctx.y -= size + 1.5;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.page.drawText(line, { x, y: ctx.y, size, font, color: rgb(0, 0, 0) });
    ctx.y -= size + 1.5;
  }
  return ctx;
}

function fieldRow(ctx: Ctx, label: string, value: string, labelW: number): Ctx {
  ctx.page.drawText(label, { x: ML, y: ctx.y, size: 9, font: ctx.fb, color: rgb(0, 0, 0) });
  ctx.page.drawText(value || '................................', { x: ML + labelW, y: ctx.y, size: 9, font: ctx.f, color: rgb(0, 0, 0) });
  ctx.y -= 13;
  return ctx;
}

interface InlineField { label: string; value: string; w: number }

function inlineFields(ctx: Ctx, fields: InlineField[]): Ctx {
  let x = ML;
  for (const fd of fields) {
    ctx.page.drawText(fd.label, { x, y: ctx.y, size: 9, font: ctx.fb, color: rgb(0, 0, 0) });
    const lw = ctx.fb.widthOfTextAtSize(fd.label, 9) + 3;
    ctx.page.drawText(fd.value || '................', { x: x + lw, y: ctx.y, size: 9, font: ctx.f, color: rgb(0, 0, 0) });
    x += fd.w;
  }
  ctx.y -= 13;
  return ctx;
}

function hline(ctx: Ctx, x1: number, y: number, x2: number, thick = 0.5, dash?: number[]): void {
  ctx.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: thick, color: rgb(0, 0, 0), dashArray: dash });
}

function dottedLine(ctx: Ctx, x1 = ML + 10, x2 = PW - MR): Ctx {
  hline(ctx, x1, ctx.y, x2, 0.3, [2, 2]);
  ctx.y -= 8;
  return ctx;
}

function gap(ctx: Ctx, px: number): Ctx {
  ctx.y -= px;
  return ctx;
}

// ==================== COVER PAGE (BÌA) ====================
function drawCoverPage(ctx: Ctx, data: FormData): Ctx {
  ctx.y -= 10;

  // Company header at top
  ctx = centerText(ctx, 'CÔNG TY: Bảo Việt Nhân thọ An Giang', 10, ctx.fb);
  ctx = centerText(ctx, 'Địa chỉ: 10 Lê Hồng Phong, Mỹ Bình, Long Xuyên, An Giang', 8, ctx.f);
  ctx = centerText(ctx, 'Điện thoại: 02963.957.177 - 02963.959.717', 8, ctx.f);
  ctx.y -= 8;
  hline(ctx, ML, ctx.y, PW - MR, 1);
  ctx.y -= 15;

  // Title
  ctx = centerText(ctx, 'HỒ SƠ KIỂM TRA SỨC KHỎE', 20, ctx.fb);
  ctx.y -= 2;
  ctx = centerText(ctx, '(Số GYCBH/HĐBH: ……………………)', 11, ctx.f);
  ctx.y -= 5;

  // Red banner
  const bannerY = ctx.y - 3;
  ctx.page.drawRectangle({
    x: ML + 40, y: bannerY - 2, width: CW - 80, height: 22,
    color: rgb(0.85, 0.1, 0.1),
  });
  const bannerText = 'CÓ CÁN BỘ GIÁM SÁT';
  const btw = ctx.fb.widthOfTextAtSize(bannerText, 12);
  ctx.page.drawText(bannerText, { x: (PW - btw) / 2, y: bannerY + 3, size: 12, font: ctx.fb, color: rgb(1, 1, 1) });
  ctx.y = bannerY - 15;

  // Person info
  ctx = leftText(ctx, 'NGƯỜI ĐƯỢC KIỂM TRA SỨC KHỎE:', 11, ctx.fb);
  ctx.y -= 2;
  ctx = fieldRow(ctx, 'Họ và tên:', data.ho_ten, 100);
  ctx = inlineFields(ctx, [
    { label: 'Ngày/tháng/năm sinh:', value: fmtDate(data.ngay_sinh), w: 200 },
    { label: 'Giới tính:', value: data.gioi_tinh, w: 120 },
  ]);
  ctx = inlineFields(ctx, [
    { label: 'SĐT:', value: data.sdt, w: 170 },
    { label: 'Địa chỉ:', value: data.dia_chi, w: 290 },
  ]);
  ctx.y -= 12;

  // Medical facility
  ctx = leftText(ctx, 'CƠ SỞ Y TẾ THỰC HIỆN:', 11, ctx.fb);
  ctx.y -= 2;
  ctx = fieldRow(ctx, 'Tên cơ sở:', '', 90);
  ctx = dottedLine(ctx);
  ctx = fieldRow(ctx, 'Địa chỉ:', '', 70);
  ctx = dottedLine(ctx);
  ctx.y -= 10;

  // Year
  ctx = centerText(ctx, 'Năm 2026', 13, ctx.fb);
  ctx.y -= 10;

  // Image placeholder
  const imgH = 130;
  const imgW = CW - 100;
  const imgX = ML + 50;
  const imgY = ctx.y - imgH;
  ctx.page.drawRectangle({
    x: imgX, y: imgY, width: imgW, height: imgH,
    borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 1,
  });
  const placeholderText = '(Logo / Hình ảnh)';
  const ptw = ctx.f.widthOfTextAtSize(placeholderText, 10);
  ctx.page.drawText(placeholderText, {
    x: imgX + (imgW - ptw) / 2, y: imgY + imgH / 2 - 5,
    size: 10, font: ctx.f, color: rgb(0.7, 0.7, 0.7),
  });
  ctx.y = imgY - 15;

  // Footer line
  hline(ctx, ML, ctx.y, PW - MR, 1);
  ctx.y -= 12;
  ctx = centerText(ctx, 'CÔNG TY: Bảo Việt Nhân thọ An Giang', 9, ctx.fb);
  ctx = centerText(ctx, 'Địa chỉ: 10 Lê Hồng Phong, Mỹ Bình, Long Xuyên, An Giang', 8, ctx.f);
  ctx = centerText(ctx, 'Điện thoại: 02963.957.177 - 02963.959.717', 8, ctx.f);

  return ctx;
}

// ==================== PAGE 2: COVER RIGHT + GIẤY YÊU CẦU ====================
function drawPage2(ctx: Ctx, data: FormData, examItems: Set<string>, mucKham: string): Ctx {
  ctx.y -= 5;

  // Duplicate cover info (compact)
  ctx = centerText(ctx, 'HỒ SƠ KIỂM TRA SỨC KHỎE', 14, ctx.fb);
  ctx.y -= 1;
  ctx = centerText(ctx, '(Số GYCBH/HĐBH: ……………………)', 9, ctx.f);
  ctx.y -= 2;

  // Red banner (smaller)
  const bannerY = ctx.y - 2;
  ctx.page.drawRectangle({
    x: ML + 50, y: bannerY - 1, width: CW - 100, height: 16,
    color: rgb(0.85, 0.1, 0.1),
  });
  const bt = 'CÓ CÁN BỘ GIÁM SÁT';
  const btw = ctx.fb.widthOfTextAtSize(bt, 9);
  ctx.page.drawText(bt, { x: (PW - btw) / 2, y: bannerY + 2, size: 9, font: ctx.fb, color: rgb(1, 1, 1) });
  ctx.y = bannerY - 10;

  ctx = leftText(ctx, 'NGƯỜI ĐƯỢC KTSK:', 8, ctx.fb);
  ctx.page.drawText(data.ho_ten || '............', { x: ML + 105, y: ctx.y + 8 + 3, size: 8, font: ctx.f });
  ctx.page.drawText(`- ${fmtDate(data.ngay_sinh)}`, { x: ML + 250, y: ctx.y + 8 + 3, size: 8, font: ctx.f });
  ctx.page.drawText(`- ${data.gioi_tinh}`, { x: ML + 350, y: ctx.y + 8 + 3, size: 8, font: ctx.f });
  ctx.y -= 8;

  ctx = leftText(ctx, 'CƠ SỞ Y TẾ:', 8, ctx.fb);
  ctx.y -= 3;

  // Separator
  hline(ctx, ML, ctx.y, PW - MR, 1.5);
  ctx.y -= 8;

  // GIẤY YÊU CẦU
  ctx = centerText(ctx, 'GIẤY YÊU CẦU KIỂM TRA SỨC KHỎE', 13, ctx.fb);
  ctx.y -= 4;

  ctx = wrapText(ctx, 'Cơ sở y tế lưu ý kiểm tra thông tin nhân thân của Người được kiểm tra sức khỏe và Người đại diện theo pháp luật của Người được kiểm tra sức khỏe (nếu Người được kiểm tra sức khỏe dưới 18 tuổi), đảm bảo khám đúng người được Bảo Việt Nhân thọ yêu cầu.', 9, ctx.f, ML, PW - MR);
  ctx.y -= 5;

  // I. Person info
  ctx = leftText(ctx, 'I. NGƯỜI ĐƯỢC KIỂM TRA SỨC KHỎE:', 10, ctx.fb);
  ctx = fieldRow(ctx, 'Họ và tên:', data.ho_ten, 80);
  ctx = inlineFields(ctx, [
    { label: 'Ngày/tháng/năm sinh:', value: fmtDate(data.ngay_sinh), w: 200 },
    { label: 'Giới tính:', value: data.gioi_tinh, w: 100 },
  ]);
  ctx = inlineFields(ctx, [
    { label: 'Số giấy tờ tùy thân (1):', value: data.so_gttt, w: 200 },
    { label: 'Ngày cấp:', value: fmtDate(data.ngay_cap), w: 120 },
  ]);
  ctx = fieldRow(ctx, 'Nơi cấp:', data.noi_cap, 80);
  ctx.y -= 3;

  // II. Representative
  ctx = leftText(ctx, 'II. NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT (2)', 10, ctx.fb);
  ctx = leftText(ctx, '(Trường hợp người được KTSK dưới 18 tuổi):', 8, ctx.f);
  ctx = fieldRow(ctx, '1. Họ và tên:', data.nguoi_dai_dien, 110);
  ctx = inlineFields(ctx, [
    { label: '2. Ngày/tháng/năm sinh:', value: fmtDate(data.ngay_sinh_dd), w: 200 },
    { label: 'Giới tính:', value: data.gioi_tinh_dd, w: 100 },
  ]);
  ctx = inlineFields(ctx, [
    { label: '3. Số giấy tờ tùy thân (1):', value: data.so_gttt_dd, w: 200 },
    { label: 'Ngày cấp:', value: fmtDate(data.ngay_cap_dd), w: 120 },
  ]);
  ctx = fieldRow(ctx, 'Nơi cấp:', data.noi_cap_dd, 80);
  ctx = fieldRow(ctx, '4. Quan hệ với Người được KTSK:', data.quan_he, 220);
  ctx.y -= 3;

  // III. Exam content
  ctx = leftText(ctx, 'III. NỘI DUNG YÊU CẦU KIỂM TRA:', 10, ctx.fb);
  ctx = wrapText(ctx, 'Ghi nhận thông tin về tiền sử liên quan đến Người được yêu cầu kiểm tra sức khỏe. Thực hiện kiểm tra theo các nội dung đánh dấu "X" trong cột yêu cầu dưới đây.', 8, ctx.f, ML, PW - MR);
  ctx.y -= 2;
  ctx = leftText(ctx, `Mức khám: ${mucKham}`, 10, ctx.fb);
  ctx.y -= 3;

  // Exam table
  ctx = drawExamTable(ctx, examItems);
  ctx.y -= 3;

  // Notes
  ctx = leftText(ctx, '(*) Lưu ý:', 8, ctx.fb);
  const notes = [
    '- Khám huyết áp: đo huyết áp đối với khách hàng trên 15 tuổi.',
    '- Siêu âm ổ bụng: bao gồm siêu âm tử cung, phần phụ đối với khách hàng nữ, tiền liệt tuyến đối với khách hàng nam.',
    '- Siêu âm tuyến vú: chỉ thực hiện đối với khách hàng nữ từ 18 tuổi trở lên hoặc nghi ngờ có bệnh lý.',
    '- Xét nghiệm HBeAg: chỉ thực hiện khi kết quả xét nghiệm HBsAg dương tính.',
    '- Xét nghiệm HIV: chỉ thực hiện đối với khách hàng từ 18 đến 50 tuổi hoặc khách hàng có nguy cơ lây nhiễm.',
  ];
  for (const note of notes) {
    ctx = checkPage(ctx, 12);
    ctx = leftText(ctx, note, 7, ctx.f, ML + 5);
  }
  ctx.y -= 2;
  ctx = fieldRow(ctx, 'Nội dung cần kiểm tra bổ sung:', data.ghi_chu, 210);
  ctx.y -= 8;

  // Signature
  ctx = checkPage(ctx, 45);
  ctx = centerText(ctx, 'An Giang, ngày ... tháng ... năm ......', 9, ctx.f);
  ctx.y -= 8;
  ctx = centerText(ctx, 'Người lập', 10, ctx.fb);
  ctx.y -= 3;
  ctx = centerText(ctx, 'Huỳnh Ngọc Phương Thy', 9, ctx.f);

  return ctx;
}

// ==================== PAGE 3: KẾT QUẢ - CÂU HỎI TIỀN SỬ 1-12 ====================
function drawPage3(ctx: Ctx): Ctx {
  ctx.y -= 5;

  ctx = centerText(ctx, 'KẾT QUẢ VÀ KẾT LUẬN KIỂM TRA SỨC KHỎE', 13, ctx.fb);
  ctx.y -= 6;

  ctx = leftText(ctx, 'I. TIỀN SỬ LIÊN QUAN ĐẾN NGƯỜI ĐƯỢC KIỂM TRA SỨC KHỎE:', 10, ctx.fb);
  ctx = wrapText(ctx, 'Người được kiểm tra sức khỏe hoặc Người đại diện theo pháp luật (2) (nếu Người được kiểm tra sức khỏe dưới 18 tuổi) cung cấp thông tin về Người được kiểm tra sức khỏe theo các câu hỏi dưới đây.', 8, ctx.f, ML, PW - MR);
  ctx.y -= 1;
  ctx = wrapText(ctx, '(Đánh dấu "X" vào cột trả lời "Không" hoặc "Có" và ghi nhận thông tin chi tiết nếu trả lời "Có")', 8, ctx.f, ML, PW - MR);
  ctx.y -= 3;

  // Table header
  const colW = [25, 255, 35, 35, 110];
  const tableX = ML;
  const headers = ['TT', 'Câu hỏi', 'Không', 'Có', 'Thông tin chi tiết'];

  // Header row
  hline(ctx, tableX, ctx.y + 2, PW - MR, 0.8);
  let hx = tableX;
  for (let i = 0; i < headers.length; i++) {
    ctx.page.drawText(headers[i], { x: hx + 3, y: ctx.y - 8, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
    hx += colW[i];
  }
  ctx.y -= 14;
  hline(ctx, tableX, ctx.y, PW - MR, 0.5);

  // Questions 1-12
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
    'Đã từng phát hiện/điều trị bất kỳ bệnh lý nào chưa? Nếu có, xin cho biết tên bệnh? Thời gian phát hiện/điều trị? Phương pháp điều trị?',
    'Có ai trong gia đình bị mắc bệnh hay chết do bệnh: Tim mạch, đái tháo đường, lao, viêm gan, ung thư, rối loạn tâm thần, động kinh, các bệnh di truyền, bệnh liên quan đến HIV/AIDS không?',
  ];

  for (let i = 0; i < questions.length; i++) {
    // Calculate question height
    const qText = questions[i];
    const qMaxW = colW[1] - 6;
    const lines = estimateLines(ctx, qText, 7, ctx.f, qMaxW);
    const rowH = Math.max(16, lines * 9 + 4);

    ctx = checkPage(ctx, rowH + 5);
    const rowY = ctx.y;

    // Draw number
    ctx.page.drawText(String(i + 1), { x: tableX + 5, y: rowY - 10, size: 8, font: ctx.f, color: rgb(0, 0, 0) });

    // Draw wrapped question text in column
    drawWrappedInBox(ctx, qText, 7, ctx.f, tableX + colW[0] + 3, rowY - 10, qMaxW);

    ctx.y = rowY - rowH;
    hline(ctx, tableX, ctx.y, PW - MR, 0.3);
  }

  return ctx;
}

// ==================== PAGE 4: CÂU HỎI 13-14 + CAM KẾT ====================
function drawPage4(ctx: Ctx): Ctx {
  ctx.y -= 5;

  // Continue question table header
  ctx = leftText(ctx, 'Phần câu hỏi bổ sung khi Người được KTSK là trẻ em (dưới 16 tuổi):', 9, ctx.fb);
  ctx.y -= 3;

  const colW = [25, 255, 35, 35, 110];
  const tableX = ML;

  // Table header
  hline(ctx, tableX, ctx.y + 2, PW - MR, 0.8);
  let hx = tableX;
  const headers = ['TT', 'Câu hỏi', 'Không', 'Có', 'Thông tin chi tiết'];
  for (let i = 0; i < headers.length; i++) {
    ctx.page.drawText(headers[i], { x: hx + 3, y: ctx.y - 8, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
    hx += colW[i];
  }
  ctx.y -= 14;
  hline(ctx, tableX, ctx.y, PW - MR, 0.5);

  // Questions 13-14
  const childQ = [
    'Trẻ có sinh non không? Nếu có, xin cho biết trẻ có biến chứng nào về hô hấp, tim mạch, tiêu hóa, mắt do sinh non không? Tình trạng hiện tại?',
    'Trẻ đã từng có bất kỳ biểu hiện nào của sự chậm phát triển về tâm thần/vận động, chậm nói, tự kỷ, tăng động/giảm chú ý không? Nếu có, xin cho biết biểu hiện cụ thể?',
  ];

  for (let i = 0; i < childQ.length; i++) {
    const qText = childQ[i];
    const qMaxW = colW[1] - 6;
    const lines = estimateLines(ctx, qText, 7, ctx.f, qMaxW);
    const rowH = Math.max(16, lines * 9 + 4);

    ctx = checkPage(ctx, rowH + 5);
    const rowY = ctx.y;

    ctx.page.drawText(String(13 + i), { x: tableX + 5, y: rowY - 10, size: 8, font: ctx.f, color: rgb(0, 0, 0) });
    drawWrappedInBox(ctx, qText, 7, ctx.f, tableX + colW[0] + 3, rowY - 10, qMaxW);

    ctx.y = rowY - rowH;
    hline(ctx, tableX, ctx.y, PW - MR, 0.3);
  }

  // Commitment section
  ctx.y -= 10;
  ctx = leftText(ctx, '* Tôi cam kết:', 9, ctx.fb);
  const commits = [
    'Thông tin Tôi đã cung cấp cho Cơ sở y tế theo yêu cầu của Bảo Việt Nhân thọ là đầy đủ và đúng sự thật.',
    'Đồng ý cho phép Cơ sở y tế kiểm tra sức khỏe bao gồm xét nghiệm HIV (nếu có) theo yêu cầu của Bảo Việt Nhân thọ với điều kiện kết quả kiểm tra sức khỏe được bảo mật, sử dụng cho mục đích giao kết và thực hiện hợp đồng bảo hiểm.',
    'Đồng ý khấu trừ chi phí kiểm tra sức khỏe trong trường hợp hồ sơ yêu cầu bảo hiểm chấm dứt hiệu lực do yêu cầu của Tôi hoặc do sự chậm trễ của Tôi trong việc bổ sung thông tin và trong hồ sơ khôi phục/thay đổi điều kiện bảo hiểm. Các thông tin này được coi là thông tin bổ sung cho GYCBH liên quan.',
  ];
  for (const c of commits) {
    ctx = checkPage(ctx, 20);
    ctx = wrapText(ctx, '- ' + c, 8, ctx.f, ML + 10, PW - MR);
  }

  ctx.y -= 8;
  ctx = checkPage(ctx, 40);
  ctx = centerText(ctx, 'Ngày ............ tháng ............ năm ..................', 9, ctx.f);
  ctx.y -= 15;
  ctx = centerText(ctx, 'Người được kiểm tra sức khỏe hoặc', 9, ctx.fb);
  ctx = centerText(ctx, 'Người đại diện theo pháp luật (2)', 9, ctx.fb);
  ctx.y -= 3;
  ctx = centerText(ctx, '(Ký và ghi rõ họ tên)', 8, ctx.f);

  return ctx;
}

// ==================== PAGE 5: KHÁM THỂ LỰC + LÂM SÀNG ====================
function drawPage5(ctx: Ctx): Ctx {
  ctx.y -= 5;

  ctx = leftText(ctx, 'II. KHÁM THỂ LỰC', 11, ctx.fb);
  ctx.y -= 4;
  const physicalItems = [
    '1. Chiều cao: ............... cm;',
    '2. Cân nặng: ............... kg;',
    '3. Mạch: ............... lần/phút;',
    '4. Huyết áp: ........ / ........ mmHg;',
  ];
  for (const item of physicalItems) {
    ctx = leftText(ctx, item, 9, ctx.f);
  }
  ctx.y -= 2;
  ctx = wrapText(ctx, 'Lưu ý: Nếu khách hàng có tiền sử tăng huyết áp hoặc huyết áp tâm thu ≥ 140 mmHg và/hoặc huyết áp tâm trương ≥ 90 mmHg, vui lòng đo thêm ít nhất 2 lần, mỗi lần cách nhau 3-5 phút.', 8, ctx.f, ML, PW - MR);
  ctx.y -= 2;
  ctx = leftText(ctx, 'Huyết áp lần 2: ........ / ........ mmHg', 9, ctx.f);
  ctx = leftText(ctx, 'Huyết áp lần 3: ........ / ........ mmHg', 9, ctx.f);
  ctx.y -= 10;

  ctx = leftText(ctx, 'III. KHÁM LÂM SÀNG', 11, ctx.fb);
  ctx = wrapText(ctx, '(Bác sỹ khám và ghi nhận đầy đủ các bất thường về sức khỏe của người được kiểm tra sức khỏe)', 8, ctx.f, ML, PW - MR);
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
  ];

  for (const section of clinicalSections) {
    ctx = checkPage(ctx, 45);
    ctx = leftText(ctx, section, 9, ctx.fb);
    for (let i = 0; i < 3; i++) {
      hline(ctx, ML + 10, ctx.y - 2, PW - MR, 0.3, [2, 2]);
      ctx.y -= 9;
    }
    ctx.y -= 2;
  }

  return ctx;
}

// ==================== PAGE 6: LÂM SÀNG (tiếp) + KẾT LUẬN ====================
function drawPage6(ctx: Ctx): Ctx {
  ctx.y -= 5;

  // Mắt
  ctx = leftText(ctx, 'Mắt:', 9, ctx.fb);
  ctx.y -= 2;
  ctx = leftText(ctx, 'Kết quả khám thị lực:', 9, ctx.f);
  ctx = inlineFields(ctx, [
    { label: 'Không kính: Mắt phải', value: '.............', w: 200 },
    { label: 'Mắt trái:', value: '.............', w: 160 },
  ]);
  ctx = inlineFields(ctx, [
    { label: 'Có kính:    Mắt phải', value: '.............', w: 200 },
    { label: 'Mắt trái:', value: '.............', w: 160 },
  ]);
  ctx = fieldRow(ctx, 'Các bệnh lý về mắt (nếu có):', '', 180);
  ctx = dottedLine(ctx);
  ctx = dottedLine(ctx);
  ctx.y -= 4;

  // Tai mũi họng
  ctx = leftText(ctx, 'Tai mũi họng:', 9, ctx.fb);
  for (let i = 0; i < 3; i++) {
    hline(ctx, ML + 10, ctx.y - 2, PW - MR, 0.3, [2, 2]);
    ctx.y -= 9;
  }
  ctx.y -= 4;

  // Sản phụ khoa
  ctx = leftText(ctx, 'Sản phụ khoa:', 9, ctx.fb);
  for (let i = 0; i < 3; i++) {
    hline(ctx, ML + 10, ctx.y - 2, PW - MR, 0.3, [2, 2]);
    ctx.y -= 9;
  }
  ctx.y -= 4;

  // Các bộ phận khác
  ctx = leftText(ctx, 'Các bộ phận khác: (Răng hàm mặt, Truyền nhiễm, Sinh dục, ...)', 9, ctx.fb);
  for (let i = 0; i < 3; i++) {
    hline(ctx, ML + 10, ctx.y - 2, PW - MR, 0.3, [2, 2]);
    ctx.y -= 9;
  }
  ctx.y -= 10;

  // IV. Kết quả xét nghiệm
  ctx = leftText(ctx, 'IV. KẾT QUẢ XÉT NGHIỆM VÀ CÁC KỸ THUẬT CHẨN ĐOÁN KHÁC', 10, ctx.fb);
  ctx.y -= 4;
  for (let i = 0; i < 7; i++) {
    hline(ctx, ML, ctx.y, PW - MR, 0.3, [2, 2]);
    ctx.y -= 11;
  }
  ctx.y -= 6;

  // V. Kết luận
  ctx = leftText(ctx, 'V. KẾT LUẬN', 10, ctx.fb);
  ctx.y -= 4;
  for (let i = 0; i < 5; i++) {
    hline(ctx, ML, ctx.y, PW - MR, 0.3, [2, 2]);
    ctx.y -= 11;
  }
  ctx.y -= 6;

  // VI. Tổng chi phí
  ctx = leftText(ctx, 'VI. TỔNG CHI PHÍ KIỂM TRA SỨC KHỎE: ...............................................', 10, ctx.fb);
  ctx.y -= 15;

  // Signatures
  ctx = checkPage(ctx, 60);
  const signY = ctx.y;
  ctx.page.drawText('Ngày.......tháng........năm ...........', { x: ML, y: signY, size: 9, font: ctx.f, color: rgb(0, 0, 0) });
  ctx.page.drawText('Xác nhận của nhân viên giám sát', { x: ML + 5, y: signY - 14, size: 9, font: ctx.fb, color: rgb(0, 0, 0) });
  ctx.page.drawText('(Ký và ghi rõ họ tên, vị trí công việc)', { x: ML + 3, y: signY - 26, size: 8, font: ctx.f, color: rgb(0, 0, 0) });

  ctx.page.drawText('Ngày.......tháng........năm ...........', { x: PW - MR - 200, y: signY, size: 9, font: ctx.f, color: rgb(0, 0, 0) });
  ctx.page.drawText('Xác nhận của Cơ sở y tế', { x: PW - MR - 165, y: signY - 14, size: 9, font: ctx.fb, color: rgb(0, 0, 0) });
  ctx.page.drawText('(Ký, ghi rõ họ tên và đóng dấu)', { x: PW - MR - 200, y: signY - 26, size: 8, font: ctx.f, color: rgb(0, 0, 0) });

  ctx.y = signY - 45;

  // Footnotes
  ctx = checkPage(ctx, 40);
  hline(ctx, ML, ctx.y, PW - MR, 0.5);
  ctx.y -= 10;
  ctx = wrapText(ctx, 'Ghi chú: Số giấy tờ tùy thân: Mã định danh cá nhân, số thẻ căn cước công dân, số chứng minh nhân dân, số hộ chiếu, số giấy khai sinh.', 7, ctx.f, ML, PW - MR);
  ctx.y -= 2;
  ctx = wrapText(ctx, 'Người đại diện theo pháp luật của Người được kiểm tra sức khỏe (gọi tắt là Người đại diện theo pháp luật): là Cha, Mẹ hoặc Người giám hộ của Người được kiểm tra sức khỏe.', 7, ctx.f, ML, PW - MR);

  return ctx;
}

// ==================== EXAM TABLE ====================
function drawExamTable(ctx: Ctx, examItems: Set<string>): Ctx {
  const colW = [28, 205, 45, 28, 205, 45];
  const rightColX = colW[0] + colW[1] + colW[2];

  ctx = checkPage(ctx, 20);
  hline(ctx, ML, ctx.y + 2, PW - MR, 1);

  // Header
  const hy = ctx.y;
  ctx.page.drawText('TT', { x: ML + 3, y: hy - 10, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
  ctx.page.drawText('Nội dung khám, xét nghiệm', { x: ML + colW[0] + 3, y: hy - 10, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
  ctx.page.drawText('Y/C', { x: ML + colW[0] + colW[1] + 8, y: hy - 10, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
  ctx.page.drawText('TT', { x: ML + rightColX + 3, y: hy - 10, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
  ctx.page.drawText('Nội dung khám, xét nghiệm', { x: ML + rightColX + colW[3] + 3, y: hy - 10, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
  ctx.page.drawText('Y/C', { x: ML + rightColX + colW[3] + colW[4] + 8, y: hy - 10, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
  ctx.y = hy - 16;
  hline(ctx, ML, ctx.y, PW - MR, 0.5);

  const leftItems = EXAM_ITEMS.filter((_, i) => i < Math.ceil(EXAM_ITEMS.length / 2));
  const rightItems = EXAM_ITEMS.filter((_, i) => i >= Math.ceil(EXAM_ITEMS.length / 2));
  const maxRows = Math.max(leftItems.length, rightItems.length);

  for (let r = 0; r < maxRows; r++) {
    ctx = checkPage(ctx, 16);
    const rowY = ctx.y;
    const rowH = 13;

    if (r < leftItems.length) {
      const item = leftItems[r];
      const fnt = item.parent ? ctx.fb : ctx.f;
      ctx.page.drawText(item.id, { x: ML + 4, y: rowY - 10, size: 7.5, font: fnt, color: rgb(0, 0, 0) });
      ctx.page.drawText(item.label, { x: ML + colW[0] + 4, y: rowY - 10, size: 7.5, font: fnt, color: rgb(0, 0, 0) });
      if (examItems.has(item.id)) {
        ctx.page.drawText('X', { x: ML + colW[0] + colW[1] + 18, y: rowY - 10, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
      }
    }

    if (r < rightItems.length) {
      const item = rightItems[r];
      const fnt = item.parent ? ctx.fb : ctx.f;
      ctx.page.drawText(item.id, { x: ML + rightColX + 4, y: rowY - 10, size: 7.5, font: fnt, color: rgb(0, 0, 0) });
      ctx.page.drawText(item.label, { x: ML + rightColX + colW[3] + 4, y: rowY - 10, size: 7.5, font: fnt, color: rgb(0, 0, 0) });
      if (examItems.has(item.id)) {
        ctx.page.drawText('X', { x: ML + rightColX + colW[3] + colW[4] + 18, y: rowY - 10, size: 8, font: ctx.fb, color: rgb(0, 0, 0) });
      }
    }

    ctx.y = rowY - rowH;
    hline(ctx, ML, ctx.y, PW - MR, 0.3);
  }

  return ctx;
}

// ==================== UTILITIES ====================

function estimateLines(ctx: Ctx, text: string, size: number, font: PDFFont, maxW: number): number {
  const words = text.split(' ');
  let line = '';
  let count = 1;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      count++;
      line = word;
    } else {
      line = test;
    }
  }
  return count;
}

function drawWrappedInBox(ctx: Ctx, text: string, size: number, font: PDFFont, x: number, startY: number, maxW: number): void {
  const words = text.split(' ');
  let line = '';
  let curY = startY;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      ctx.page.drawText(line, { x, y: curY, size, font, color: rgb(0, 0, 0) });
      curY -= size + 1.5;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.page.drawText(line, { x, y: curY, size, font, color: rgb(0, 0, 0) });
  }
}

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

// ==================== MAIN GENERATOR ====================
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
  const f = await doc.embedFont(fontBytes);
  const fb = await doc.embedFont(boldFontBytes);

  const { items: examItems, mucKham } = getExamData(selectedK, data.gioi_tinh, data.ngay_sinh);

  // PAGE 1: BÌA (Cover)
  drawCoverPage(newPage(doc, f, fb), data);

  // PAGE 2: BÌA PHẢI + GIẤY YÊU CẦU KTSK
  drawPage2(newPage(doc, f, fb), data, examItems, mucKham);

  // PAGE 3: KẾT QUẢ - Câu hỏi tiền sử 1-12
  drawPage3(newPage(doc, f, fb));

  // PAGE 4: Câu hỏi 13-14 + Cam kết
  drawPage4(newPage(doc, f, fb));

  // PAGE 5: KHÁM THỂ LỰC + LÂM SÀNG
  drawPage5(newPage(doc, f, fb));

  // PAGE 6: LÂM SÀNG (tiếp) + KẾT QUẢ XÉT NGHIỆM + KẾT LUẬN
  drawPage6(newPage(doc, f, fb));

  // Merge attached PDFs
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
