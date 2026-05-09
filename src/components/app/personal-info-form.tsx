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
import { Separator } from '@/components/ui/separator';
import { User, Users } from 'lucide-react';

export function PersonalInfoForm() {
  const { formData, setFormData } = useAppStore();

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
            <Input
              type="date"
              value={formData.ngay_sinh}
              onChange={(e) => update('ngay_sinh', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
            />
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Giới tính</Label>
            <Select value={formData.gioi_tinh} onValueChange={(v) => update('gioi_tinh', v)}>
              <SelectTrigger className="mt-1 rounded-xl border-rose-200 focus:border-rose-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
            <Input
              type="date"
              value={formData.ngay_cap}
              onChange={(e) => update('ngay_cap', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
            />
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Nơi cấp</Label>
            <Input
              value={formData.noi_cap}
              onChange={(e) => update('noi_cap', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
              placeholder="Nơi cấp GTTT"
            />
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

      <Separator className="bg-rose-100" />

      {/* Representative section */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 px-6 py-4 border-b border-rose-100">
        <h3 className="flex items-center gap-2 text-rose-700 font-bold text-base">
          <Users className="h-5 w-5" />
          Người đại diện theo pháp luật
        </h3>
        <p className="text-xs text-rose-400 mt-0.5">Nếu người được KTSK dưới 18 tuổi</p>
      </div>
      <div className="p-6 space-y-4">
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
            <Input
              type="date"
              value={formData.ngay_sinh_dd}
              onChange={(e) => update('ngay_sinh_dd', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
            />
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Giới tính</Label>
            <Select value={formData.gioi_tinh_dd} onValueChange={(v) => update('gioi_tinh_dd', v)}>
              <SelectTrigger className="mt-1 rounded-xl border-rose-200 focus:border-rose-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
            <Input
              type="date"
              value={formData.ngay_cap_dd}
              onChange={(e) => update('ngay_cap_dd', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
            />
          </div>

          <div>
            <Label className="text-rose-600 font-semibold text-sm">Nơi cấp</Label>
            <Input
              value={formData.noi_cap_dd}
              onChange={(e) => update('noi_cap_dd', e.target.value)}
              className="mt-1 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-200"
              placeholder="Nơi cấp GTTT"
            />
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
    </Card>
  );
}
