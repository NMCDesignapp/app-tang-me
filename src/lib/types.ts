export interface FormData {
  ho_ten: string;
  ngay_sinh: string;
  gioi_tinh: string;
  so_gttt: string;
  ngay_cap: string;
  noi_cap: string;
  sdt: string;
  dia_chi: string;
  ghi_chu: string;
  nguoi_dai_dien: string;
  ngay_sinh_dd: string;
  gioi_tinh_dd: string;
  so_gttt_dd: string;
  ngay_cap_dd: string;
  noi_cap_dd: string;
  quan_he: string;
}

export const K_BASE: Record<string, string[]> = {
  K1: ['1', '4_1', '4_2'],
  K2: ['1', '2', '3', '4_2', '7_1', '7_2', '7_3', '7_4', '8_1'],
  K3: ['1', '2', '3', '4_1', '4_2', '4_4', '5', '6', '7_1', '7_2', '7_3', '7_4', '8_1'],
  K4: ['1', '2', '3', '4_1', '4_2', '4_4', '5', '6', '7_1', '7_2', '7_3', '7_4', '7_5', '8_1'],
};

export const EXAM_ITEMS = [
  { id: '1', label: 'Khám Y khoa', parent: true },
  { id: '2', label: 'Điện tim', parent: false },
  { id: '3', label: 'Xét nghiệm nước tiểu', parent: false },
  { id: '4', label: 'Siêu âm:', parent: true },
  { id: '4_1', label: '- Siêu âm tim', parent: false },
  { id: '4_2', label: '- Siêu âm ổ bụng(*)', parent: false },
  { id: '4_3', label: '- Siêu âm tuyến vú(*)', parent: false },
  { id: '4_4', label: '- Siêu âm tuyến giáp', parent: false },
  { id: '5', label: 'X-quang tim phổi', parent: false },
  { id: '6', label: 'Xét nghiệm công thức máu', parent: false },
  { id: '7', label: 'Xét nghiệm sinh hoá máu:', parent: true },
  { id: '7_1', label: '- Cholesterol, Triglycerid', parent: false },
  { id: '7_2', label: '- SGOT, SGPT, GGT', parent: false },
  { id: '7_3', label: '- Creatinine', parent: false },
  { id: '7_4', label: '- Glucose', parent: false },
  { id: '7_5', label: '- HbA1c', parent: false },
  { id: '8', label: 'Xét nghiệm viêm gan B:', parent: true },
  { id: '8_1', label: '- HBsAg', parent: false },
  { id: '9', label: 'HIV(*)', parent: false },
];

export function getExamData(
  selectedKList: string[],
  gender: string,
  birthStr: string
): { items: Set<string>; mucKham: string } {
  const allItems = new Set<string>();
  const age = getAge(birthStr);

  for (const k of selectedKList) {
    if (k in K_BASE) {
      const items = [...K_BASE[k]];
      if ((k === 'K3' || k === 'K4') && age !== null && age < 50) {
        items.push('9');
      }
      if (k === 'K4' && gender.trim().toLowerCase() === 'nữ') {
        items.push('4_3');
      }
      items.forEach((i) => allItems.add(i));
    }
  }

  return {
    items: allItems,
    mucKham: selectedKList.join(', '),
  };
}

function getAge(birthStr: string): number | null {
  if (!birthStr) return null;
  try {
    const birth = new Date(birthStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
}
