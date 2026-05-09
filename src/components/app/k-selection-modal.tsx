'use client';

import { useAppStore } from '@/lib/store';
import { K_BASE, getExamData, EXAM_ITEMS } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Stethoscope, FileUp, Settings, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function KSelectionModal() {
  const { selectedK, setSelectedK, formData } = useAppStore();
  const [open, setOpen] = useState(false);
  const [tempK, setTempK] = useState<string[]>(selectedK);

  const handleOpen = () => {
    setTempK([...selectedK]);
    setOpen(true);
  };

  const handleSave = () => {
    setSelectedK(tempK);
    setOpen(false);
    if (tempK.length > 0) {
      toast.success(`Đã chọn: ${tempK.join(', ')}`);
    }
  };

  const toggleK = (k: string) => {
    setTempK((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
  };

  const { items: examItems } = getExamData(tempK, formData.gioi_tinh, formData.ngay_sinh);

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpen}
        className={`h-auto py-3 px-4 flex items-center gap-2 rounded-xl border-2 transition-all ${
          selectedK.length > 0
            ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'border-dashed border-rose-200 text-rose-400 hover:border-rose-300 hover:text-rose-500'
        }`}
      >
        <Stethoscope className="h-5 w-5" />
        <div className="text-left">
          <div className="font-semibold text-sm">Gói khám</div>
          <div className="text-xs opacity-70">
            {selectedK.length > 0 ? selectedK.join(', ') : 'Chưa chọn'}
          </div>
        </div>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Stethoscope className="h-5 w-5" />
              Chọn gói khám
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 justify-center">
              {Object.keys(K_BASE).map((k) => (
                <label
                  key={k}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                    tempK.includes(k)
                      ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-rose-200'
                  }`}
                >
                  <Checkbox
                    checked={tempK.includes(k)}
                    onCheckedChange={() => toggleK(k)}
                  />
                  <span className="font-bold text-sm">{k}</span>
                </label>
              ))}
            </div>

            {tempK.length > 0 && (
              <>
                <Separator />
                <div className="text-center">
                  <span className="text-sm font-semibold text-rose-600">
                    Mục khám: {tempK.join(', ')}
                  </span>
                </div>
                <ScrollArea className="max-h-48 rounded-xl border p-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-1">
                    {EXAM_ITEMS.filter((item) => examItems.has(item.id)).map((item) => (
                      <div key={item.id} className="flex items-center gap-1.5 text-xs">
                        <span className="text-rose-500 font-bold">✓</span>
                        <span className={item.parent ? 'font-semibold' : 'text-gray-600'}>
                          {item.id}. {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              className="bg-rose-500 hover:bg-rose-600 text-white"
              disabled={tempK.length === 0}
            >
              Xác nhận ({tempK.length} gói)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
