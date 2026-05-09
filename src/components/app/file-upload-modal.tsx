'use client';

import { useAppStore } from '@/lib/store';
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
import { FileUp, X, FileText, Check } from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

export function FileUploadModal() {
  const { uploadedPdfs, addPdf, removePdf, selectedAttachments, setSelectedAttachments } =
    useAppStore();
  const [open, setOpen] = useState(false);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [activeUpload, setActiveUpload] = useState<number | null>(null);

  const uploadedCount = uploadedPdfs.size;

  const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Vui lòng chọn file PDF');
      return;
    }
    addPdf(index, file);
    toast.success(`Đã tải MS${String(index).padStart(2, '0')}: ${file.name}`);
    setActiveUpload(null);
  };

  const handleRemove = (index: number) => {
    removePdf(index);
    setSelectedAttachments(selectedAttachments.filter((n) => n !== index));
    toast.success(`Đã xóa MS${String(index).padStart(2, '0')}`);
  };

  const toggleAttach = (index: number) => {
    if (selectedAttachments.includes(index)) {
      setSelectedAttachments(selectedAttachments.filter((n) => n !== index));
    } else {
      setSelectedAttachments([...selectedAttachments, index]);
    }
  };

  const handleSelectAll = () => {
    const allIndices = Array.from(uploadedPdfs.keys());
    if (selectedAttachments.length === allIndices.length) {
      setSelectedAttachments([]);
    } else {
      setSelectedAttachments(allIndices);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={`h-auto py-3 px-4 flex items-center gap-2 rounded-xl border-2 transition-all ${
          uploadedCount > 0
            ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'border-dashed border-rose-200 text-rose-400 hover:border-rose-300 hover:text-rose-500'
        }`}
      >
        <FileUp className="h-5 w-5" />
        <div className="text-left">
          <div className="font-semibold text-sm">File đính kèm</div>
          <div className="text-xs opacity-70">
            {uploadedCount > 0
              ? `${uploadedCount} file · ${selectedAttachments.length} chọn`
              : 'Chưa có file'}
          </div>
        </div>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <FileUp className="h-5 w-5" />
              Quản lý file đính kèm
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Upload Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((index) => {
                const uploaded = uploadedPdfs.get(index);
                const isSelected = selectedAttachments.includes(index);

                return (
                  <div
                    key={index}
                    className={`relative rounded-xl border-2 p-2 text-center transition-all ${
                      uploaded
                        ? isSelected
                          ? 'border-rose-400 bg-rose-50'
                          : 'border-gray-200 bg-gray-50'
                        : 'border-dashed border-gray-200 hover:border-rose-200 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!uploaded) {
                        setActiveUpload(index);
                        fileRefs.current[index]?.click();
                      }
                    }}
                  >
                    {uploaded ? (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-rose-500">
                            MS{String(index).padStart(2, '0')}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(index);
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <FileText className="h-6 w-6 mx-auto text-rose-400 mb-1" />
                        <p className="text-[9px] text-gray-600 truncate" title={uploaded.name}>
                          {uploaded.name}
                        </p>
                        <div className="mt-1">
                          <label
                            className="flex items-center justify-center gap-1 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleAttach(index)}
                              className="h-3 w-3"
                            />
                            <span className="text-[9px] text-gray-500">Đính kèm</span>
                          </label>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] font-bold text-gray-400 mb-1">
                          MS{String(index).padStart(2, '0')}
                        </div>
                        <FileUp className="h-6 w-6 mx-auto text-gray-300 mb-1" />
                        <p className="text-[9px] text-gray-400">Bấm chọn PDF</p>
                      </>
                    )}

                    <input
                      ref={(el) => { fileRefs.current[index] = el; }}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => handleFileSelect(index, e)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Select all */}
            {uploadedCount > 0 && (
              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={
                      selectedAttachments.length === uploadedCount &&
                      uploadedCount > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-gray-600">Chọn tất cả</span>
                </label>
                <span className="text-xs text-gray-400">
                  {selectedAttachments.length}/{uploadedCount} file được chọn
                </span>
              </div>
            )}

            {uploadedCount === 0 && (
              <p className="text-center text-sm text-gray-400 py-4">
                Chưa có file nào được tải lên. Bấm vào ô MS để chọn file PDF.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                toast.success(`Đã lưu ${selectedAttachments.length} file đính kèm`);
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              <Check className="h-4 w-4 mr-1" />
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
