'use client';

import { useAppStore } from '@/lib/store';
import { K_BASE, getExamData, EXAM_ITEMS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

      {/* Small popup modal - fixed height with scroll */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:w-[90vw] sm:max-w-md sm:mx-4 animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - fixed */}
            <div className="flex items-center justify-between p-4 pb-2 shrink-0">
              <h3 className="font-bold text-rose-700 flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Chọn gói khám
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-2">
              <div className="space-y-3">
                {/* K Selection Chips */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {Object.keys(K_BASE).map((k) => (
                    <label
                      key={k}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all ${
                        tempK.includes(k)
                          ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:border-rose-200'
                      }`}
                    >
                      <Checkbox
                        checked={tempK.includes(k)}
                        onCheckedChange={() => toggleK(k)}
                        className="h-3.5 w-3.5"
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
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {EXAM_ITEMS.filter((item) => examItems.has(item.id)).map((item) => (
                          <div key={item.id} className="flex items-center gap-1 text-xs">
                            <span className="text-rose-500 font-bold shrink-0">✓</span>
                            <span className={`${item.parent ? 'font-semibold' : 'text-gray-600'} truncate`} title={`${item.id}. ${item.label}`}>
                              {item.id}. {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions - fixed at bottom */}
            <div className="p-4 pt-2 flex gap-2 shrink-0 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-9"
                onClick={() => setOpen(false)}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs h-9"
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
