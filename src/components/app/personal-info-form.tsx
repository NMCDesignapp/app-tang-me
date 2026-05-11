'use client';

import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { User, Users, ChevronDown, ChevronRight, CalendarIcon, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

// Nơi cấp options
const NOI_CAP_OPTIONS = [
  { value: 'Bộ Công An', label: 'Bộ Công An' },
  { value: 'CCSQLHCVTTXH', label: 'CCSQLHCVTTXH' },
];

// Compact date picker with direct input
function DatePickerField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const d = new Date(value);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse value to display string (dd/mm/yyyy)
  const displayValue = value
    ? (() => {
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      })()
    : '';

  // Handle direct text input
  const [inputText, setInputText] = useState(displayValue);
  useEffect(() => {
    setInputText(displayValue);
  }, [value]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    // Try to parse dd/mm/yyyy
    const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      if (year >= 1900 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const d = new Date(year, month, day);
        const isoStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        onChange(isoStr);
      }
    }
  };

  const handleDayClick = (year: number, month: number, day: number) => {
    const isoStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    onChange(isoStr);
    setIsOpen(false);
  };

  // Calendar navigation
  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Generate calendar days
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const selectedDate = value ? new Date(value) : null;

  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-1.5">
        <Input
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="dd/mm/yyyy"
          className={`rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200 ${className || ''}`}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 rounded-xl border-rose-200 hover:bg-rose-50 hover:border-rose-300 h-9 w-9"
          onClick={() => setIsOpen(!isOpen)}
        >
          <CalendarIcon className="h-4 w-4 text-rose-500" />
        </Button>
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white rounded-2xl shadow-xl border border-rose-100 p-3 w-[260px] animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="h-7 w-7 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-400 hover:text-rose-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
            <span className="text-sm font-semibold text-rose-700">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="h-7 w-7 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-400 hover:text-rose-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {dayNames.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-rose-300 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-7" />;
              }
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = selectedDate && day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(year, month, day)}
                  className={`
                    h-7 w-full text-xs rounded-lg flex items-center justify-center transition-colors
                    ${isSelected ? 'bg-rose-500 text-white font-bold shadow-sm' : ''}
                    ${isToday && !isSelected ? 'bg-rose-100 text-rose-600 font-semibold' : ''}
                    ${!isSelected && !isToday ? 'hover:bg-rose-50 text-rose-700' : ''}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function PersonalInfoForm() {
  const { formData, setFormData } = useAppStore();
  const [showRepresentative, setShowRepresentative] = useState(false);

  const update = (field: string, value: string) => {
    setFormData({ [field]: value });
  };

  return (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
      {/* Personal info section */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 px-6 py-4 border-b border-rose-100">
        <h3 className="flex items-center gap-2 text-rose-700 font-bold text-base">
          <User className="h-5 w-5" />
          Thông tin người được kiểm tra sức khỏe
        </h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="text-rose-600 font-semibold text-sm">Họ và tên <span className="text-red-400">*</span></Label>
            <Input
              value={formData.ho_ten}
              onChange={(e) => update('ho_ten', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
              placeholder="Nhập họ và tên"
            />
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Ngày sinh</Label>
            <div className="mt-1">
              <DatePickerField
                value={formData.ngay_sinh}
                onChange={(v) => update('ngay_sinh', v)}
              />
            </div>
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Giới tính</Label>
            <Select value={formData.gioi_tinh} onValueChange={(v) => update('gioi_tinh', v)}>
              <SelectTrigger className="mt-1 rounded-xl border-rose-200 focus:border-rose-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="Nam">Nam</SelectItem>
                <SelectItem value="Nữ">Nữ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Số GTTT</Label>
            <Input
              value={formData.so_gttt}
              onChange={(e) => update('so_gttt', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
              placeholder="CCCD/CMND"
            />
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Ngày cấp</Label>
            <div className="mt-1">
              <DatePickerField
                value={formData.ngay_cap}
                onChange={(v) => update('ngay_cap', v)}
              />
            </div>
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Nơi cấp</Label>
            <Select value={formData.noi_cap} onValueChange={(v) => update('noi_cap', v)}>
              <SelectTrigger className="mt-1 rounded-xl border-rose-200 focus:border-rose-400">
                <SelectValue placeholder="Chọn nơi cấp" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {NOI_CAP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Số điện thoại</Label>
            <Input
              type="tel"
              value={formData.sdt}
              onChange={(e) => update('sdt', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
              placeholder="Số điện thoại"
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="text-rose-600 font-semibold text-sm">Địa chỉ</Label>
            <Input
              value={formData.dia_chi}
              onChange={(e) => update('dia_chi', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
              placeholder="Địa chỉ liên hệ"
            />
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Số GYCBH/HĐBH</Label>
            <Input
              value={formData.so_giay_yeu_cau}
              onChange={(e) => update('so_giay_yeu_cau', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
              placeholder="Số giấy yêu cầu BH / Hợp đồng BH"
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="text-rose-600 font-semibold text-sm">Ghi chú / Nội dung kiểm tra bổ sung</Label>
            <Textarea
              value={formData.ghi_chu}
              onChange={(e) => update('ghi_chu', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
              rows={2}
              placeholder="Ghi chú thêm..."
            />
          </div>
        </div>
      </div>

      {/* Representative section - collapsible, hidden by default */}
      <button
        type="button"
        onClick={() => setShowRepresentative(!showRepresentative)}
        className="w-full bg-gradient-to-r from-pink-50 to-rose-50 px-6 py-3 border-t border-rose-100 flex items-center justify-between hover:from-pink-100 hover:to-rose-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-rose-500" />
          <span className="text-rose-700 font-semibold text-sm">Người đại diện theo pháp luật</span>
          <span className="text-xs text-rose-400">(dưới 18 tuổi)</span>
        </div>
        {showRepresentative ? (
          <ChevronDown className="h-4 w-4 text-rose-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-rose-400" />
        )}
      </button>

      {showRepresentative && (
        <div className="p-6 space-y-4 border-t border-rose-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-rose-600 font-semibold text-sm">Họ tên người đại diện</Label>
              <Input
                value={formData.nguoi_dai_dien}
                onChange={(e) => update('nguoi_dai_dien', e.target.value)}
                className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
                placeholder="Họ và tên người đại diện"
              />
            </div>

            <div>
              <Label className="text-rose-600 font-semibold text-sm">Ngày sinh</Label>
              <div className="mt-1">
                <DatePickerField
                  value={formData.ngay_sinh_dd}
                  onChange={(v) => update('ngay_sinh_dd', v)}
                />
              </div>
            </div>

            <div>
              <Label className="text-rose-600 font-semibold text-sm">Giới tính</Label>
              <Select value={formData.gioi_tinh_dd} onValueChange={(v) => update('gioi_tinh_dd', v)}>
                <SelectTrigger className="mt-1 rounded-xl border-rose-200 focus:border-rose-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Nam">Nam</SelectItem>
                  <SelectItem value="Nữ">Nữ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-rose-600 font-semibold text-sm">Số GTTT</Label>
              <Input
                value={formData.so_gttt_dd}
                onChange={(e) => update('so_gttt_dd', e.target.value)}
                className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
                placeholder="CCCD/CMND"
              />
            </div>

            <div>
              <Label className="text-rose-600 font-semibold text-sm">Ngày cấp</Label>
              <div className="mt-1">
                <DatePickerField
                  value={formData.ngay_cap_dd}
                  onChange={(v) => update('ngay_cap_dd', v)}
                />
              </div>
            </div>

            <div>
              <Label className="text-rose-600 font-semibold text-sm">Nơi cấp</Label>
              <Select value={formData.noi_cap_dd} onValueChange={(v) => update('noi_cap_dd', v)}>
                <SelectTrigger className="mt-1 rounded-xl border-rose-200 focus:border-rose-400">
                  <SelectValue placeholder="Chọn nơi cấp" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {NOI_CAP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label className="text-rose-600 font-semibold text-sm">Quan hệ với người được KTSK</Label>
              <Input
                value={formData.quan_he}
                onChange={(e) => update('quan_he', e.target.value)}
                className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
                placeholder="Ví dụ: Cha, Mẹ, Người giám hộ..."
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
