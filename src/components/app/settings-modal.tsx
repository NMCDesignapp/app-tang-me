'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Upload, X, FileUp, Settings } from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

export function SettingsModal() {
  const {
    templateFile,
    setTemplateFile,
    uploadedPdfs,
    addPdf,
    removePdf,
    selectedAttachments,
    setSelectedAttachments,
  } = useAppStore();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'template' | 'files'>('files');
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Template handlers
  const handleTemplateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      toast.error('Vui lòng chọn file .docx');
      return;
    }
    setTemplateFile(file);
    toast.success(`Đã tải template: ${file.name}`);
  };

  const handleRemoveTemplate = () => {
    setTemplateFile(null);
    toast.success('Đã xóa template');
  };

  // PDF file handlers
  const handlePdfSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Vui lòng chọn file PDF');
      return;
    }
    addPdf(index, file);
    toast.success(`Đã tải MS${String(index).padStart(2, '0')}: ${file.name}`);
  };

  const handleRemovePdf = (index: number) => {
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

  const uploadedCount = uploadedPdfs.size;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { setOpen(true); setTab('files'); }}
        className="h-9 w-9 rounded-full text-rose-200 hover:text-white hover:bg-white/20 transition-all"
        title="Cài đặt"
      >
        <Settings className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Settings className="h-5 w-5" />
              Cài đặt
            </DialogTitle>
          </DialogHeader>

          {/* Tab Switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTab('files')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'files'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileUp className="h-4 w-4" />
              File đính kèm
              {uploadedCount > 0 && (
                <span className="bg-rose-100 text-rose-600 text-xs px-1.5 py-0.5 rounded-full">
                  {uploadedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('template')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'template'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-4 w-4" />
              Template
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {tab === 'files' && (
              <div className="space-y-3">
                {/* Upload Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                            pdfRefs.current[index]?.click();
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
                                  handleRemovePdf(index);
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <FileText className="h-5 w-5 mx-auto text-rose-400 mb-1" />
                            <p className="text-[8px] text-gray-600 truncate leading-tight" title={uploaded.name}>
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
                                <span className="text-[8px] text-gray-500">Đính kèm</span>
                              </label>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-[10px] font-bold text-gray-400 mb-1">
                              MS{String(index).padStart(2, '0')}
                            </div>
                            <FileUp className="h-5 w-5 mx-auto text-gray-300 mb-1" />
                            <p className="text-[8px] text-gray-400">Bấm chọn PDF</p>
                          </>
                        )}

                        <input
                          ref={(el) => { pdfRefs.current[index] = el; }}
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => handlePdfSelect(index, e)}
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
                    Chưa có file nào. Bấm vào ô MS để chọn file PDF.
                  </p>
                )}
              </div>
            )}

            {tab === 'template' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    File Word gốc (Template .docx)
                  </h3>
                  {templateFile ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200">
                      <FileText className="h-8 w-8 text-rose-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {templateFile.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(templateFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveTemplate}
                        className="text-red-400 hover:text-red-600"
                      >
                        Xóa
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="border-2 border-dashed border-rose-200 rounded-xl p-6 text-center cursor-pointer hover:bg-rose-50 hover:border-rose-300 transition-all"
                    >
                      <Upload className="h-8 w-8 mx-auto text-rose-300 mb-2" />
                      <p className="text-sm text-gray-500">Bấm để chọn file .docx</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Sử dụng template mặc định nếu không chọn
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={handleTemplateSelect}
                  />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
