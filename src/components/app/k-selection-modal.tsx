'use client';

import { useAppStore } from '@/lib/store';
import { K_BASE, getExamData, EXAM_ITEMS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Stethoscope } from 'lucide-react';
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
        className={`h-auto py-2.5 px-4 flex items-center gap-2 rounded-xl border-2 transition-all text-sm ${
          selectedK.length > 0
            ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'border-dashed border-rose-200 text-rose-400 hover:border-rose-300 hover:text-rose-500'
        }`}
      >
        <Stethoscope className="h-4 w-4" />
        <span className="font-semibold">
          {selectedK.length > 0 ? `Gói khám: ${selectedK.join(', ')}` : 'Chọn gói khám'}
        </span>
      </Button>

      {/* Small popup modal */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-5 w-[90vw] max-w-md mx-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-rose-700 flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Chọn gói khám
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* K Selection Chips */}
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

              {/* Exam preview */}
              {tempK.length > 0 && (
                <>
                  <Separator />
                  <div className="text-center">
                    <span className="text-sm font-semibold text-rose-600">
                      Mục khám: {tempK.join(', ')}
                    </span>
                  </div>
                  <ScrollArea className="max-h-40 rounded-xl border p-3 bg-gray-50">
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

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setOpen(false)}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs"
                onClick={handleSave}
                disabled={tempK.length === 0}
              >
                Xác nhận ({tempK.length} gói)
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
