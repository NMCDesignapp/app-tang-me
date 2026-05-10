'use client';

import { useAppStore, hydrateStore } from '@/lib/store';
import { KSelectionModal } from './k-selection-modal';
import { SettingsModal } from './settings-modal';
import { PersonalInfoForm } from './personal-info-form';
import { PwaInstallPrompt } from './pwa-install-prompt';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';

export default function HomePage() {
  const { formData, selectedK, uploadedPdfs, selectedAttachments, isGenerating, setIsGenerating, resetForm } =
    useAppStore();
  const [hydrated, setHydrated] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Hydrate store from localStorage + IndexedDB on mount
  useEffect(() => {
    hydrateStore().then(() => setHydrated(true));
  }, []);

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (selectedK.length === 0) {
      toast.error('Vui lòng chọn ít nhất một gói khám');
      return;
    }
    if (!formData.ho_ten.trim()) {
      toast.error('Vui lòng nhập họ tên người được KTSK');
      return;
    }

    setIsGenerating(true);

    try {
      const fd = new FormData();

      // Add form data
      Object.entries(formData).forEach(([key, value]) => {
        fd.append(key, value as string);
      });

      // Add selected K
      fd.append('selected_K', selectedK.join(','));

      // Add attachment list
      fd.append('attach_list', selectedAttachments.join(','));

      // Add PDF files
      for (const num of selectedAttachments) {
        const pdf = uploadedPdfs.get(num);
        if (pdf) {
          fd.append(`attach_${num}`, pdf.file);
        }
      }

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        body: fd,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Lỗi tạo PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Ket_qua.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show success animation then reset form
      setShowSuccess(true);
      toast.success('Xuất PDF thành công!', { description: 'Đã tự động xóa dữ liệu mẫu' });

      // Wait a moment then clear form
      setTimeout(() => {
        resetForm();
        setShowSuccess(false);
      }, 1800);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      toast.error(`Lỗi: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [formData, selectedK, selectedAttachments, uploadedPdfs, setIsGenerating, resetForm]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
          <div className="text-rose-400 text-sm font-medium">Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-rose-400 via-pink-400 to-rose-500 px-4 py-4 text-center shadow-lg backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex-1" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-md tracking-tight">
              Tặng Mẹ Sen
            </h1>
            <p className="text-rose-100 mt-0.5 text-xs tracking-wider font-medium">
              design by NMC
            </p>
          </div>
          <div className="flex-1 flex justify-end">
            <SettingsModal />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Personal Info Form */}
        <PersonalInfoForm />

        {/* K Selection + File Selection popup buttons - right above Export */}
        <div className="flex gap-3 justify-center">
          <KSelectionModal />
          <PopupFileSelect />
        </div>

        {/* Export Button with glow effect */}
        <div className="pt-2 pb-8">
          {showSuccess ? (
            <div className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 flex items-center justify-center gap-2 text-white font-bold text-lg shadow-lg shadow-green-200 animate-in fade-in zoom-in-95 duration-500">
              <Sparkles className="h-5 w-5 animate-pulse" />
              Xuất PDF thành công!
            </div>
          ) : (
            <Button
              onClick={handleExport}
              disabled={isGenerating}
              className="group w-full h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-200/60 hover:shadow-xl hover:shadow-rose-300/60 transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] relative overflow-hidden"
            >
              {/* Glow pulse ring */}
              <span className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse bg-gradient-to-r from-rose-400/30 via-pink-400/30 to-rose-400/30" />
              {/* Shimmer sweep */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
              <span className="relative flex items-center gap-2">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang tạo PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 transition-transform duration-200 group-hover:translate-y-0.5" />
                    Xuất file PDF
                  </>
                )}
              </span>
            </Button>
          )}
        </div>
      </main>

      {/* PWA Install Prompt */}
      <PwaInstallPrompt />
    </div>
  );
}

/**
 * Small popup button for quick file attachment selection
 * (Full file management is in Settings modal)
 */
function PopupFileSelect() {
  const { uploadedPdfs, selectedAttachments, setSelectedAttachments } = useAppStore();
  const [open, setOpen] = useState(false);

  const toggleAttach = (index: number) => {
    if (selectedAttachments.includes(index)) {
      setSelectedAttachments(selectedAttachments.filter((n) => n !== index));
    } else {
      setSelectedAttachments([...selectedAttachments, index]);
    }
  };

  const uploadedEntries = Array.from(uploadedPdfs.entries());

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={`h-auto py-2.5 px-4 flex items-center gap-2 rounded-xl border-2 transition-all duration-200 text-sm ${
          selectedAttachments.length > 0
            ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : uploadedPdfs.size > 0
            ? 'border-rose-200 bg-white text-rose-500 hover:bg-rose-50'
            : 'border-dashed border-rose-200 text-rose-400 hover:border-rose-300 hover:text-rose-500'
        }`}
      >
        <FileUp className="h-4 w-4" />
        <span className="font-semibold">
          {uploadedPdfs.size > 0
            ? `Đính kèm (${selectedAttachments.length}/${uploadedPdfs.size})`
            : 'Chưa có file'}
        </span>
      </Button>

      {/* Small popup for selecting which files to attach */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-5 w-[90vw] max-w-sm mx-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-rose-700 flex items-center gap-2">
                <FileUp className="h-4 w-4" />
                Chọn file đính kèm
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                ✕
              </button>
            </div>

            {uploadedEntries.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {uploadedEntries.map(([index, pdf]) => {
                  const isSelected = selectedAttachments.includes(index);
                  return (
                    <label
                      key={index}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'border-rose-400 bg-rose-50'
                          : 'border-gray-100 hover:border-rose-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAttach(index)}
                        className="h-4 w-4 rounded border-rose-300 text-rose-500 focus:ring-rose-200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-700">
                          MS{String(index).padStart(2, '0')}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{pdf.name}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <FileUp className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Chưa có file nào</p>
                <p className="text-xs text-gray-300 mt-1">
                  Thêm file tại phần Cài đặt
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {uploadedEntries.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    const allIndices = uploadedEntries.map(([i]) => i);
                    if (selectedAttachments.length === allIndices.length) {
                      setSelectedAttachments([]);
                    } else {
                      setSelectedAttachments(allIndices);
                    }
                  }}
                >
                  {selectedAttachments.length === uploadedEntries.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </Button>
              )}
              <Button
                size="sm"
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs"
                onClick={() => setOpen(false)}
              >
                Xong
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
