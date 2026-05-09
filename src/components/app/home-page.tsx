'use client';

import { useAppStore } from '@/lib/store';
import { KSelectionModal } from './k-selection-modal';
import { FileUploadModal } from './file-upload-modal';
import { SettingsModal } from './settings-modal';
import { PersonalInfoForm } from './personal-info-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Stethoscope, FileUp } from 'lucide-react';
import { toast } from 'sonner';

export default function HomePage() {
  const { formData, selectedK, uploadedPdfs, selectedAttachments, isGenerating, setIsGenerating } =
    useAppStore();

  const handleExport = async () => {
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

      toast.success('Xuất PDF thành công!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      toast.error(`Lỗi: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50">
      {/* Header */}
      <header className="relative bg-gradient-to-r from-rose-400 via-pink-400 to-rose-500 px-4 py-8 text-center shadow-lg">
        <div className="absolute top-4 right-4">
          <SettingsModal />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-md">
          Tặng Mẹ Sen
        </h1>
        <p className="text-rose-100 mt-1 text-sm tracking-wider font-medium">
          design by NMC
        </p>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Action Buttons - K Selection & File Upload */}
        <div className="flex gap-3 justify-center flex-wrap">
          <KSelectionModal />
          <FileUploadModal />
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge
            variant={selectedK.length > 0 ? 'default' : 'secondary'}
            className={`rounded-full px-3 py-1 text-xs ${
              selectedK.length > 0
                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Stethoscope className="h-3 w-3 mr-1" />
            {selectedK.length > 0 ? selectedK.join(', ') : 'Chưa chọn K'}
          </Badge>
          <Badge
            variant={uploadedPdfs.size > 0 ? 'default' : 'secondary'}
            className={`rounded-full px-3 py-1 text-xs ${
              uploadedPdfs.size > 0
                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <FileUp className="h-3 w-3 mr-1" />
            {uploadedPdfs.size} file MS
          </Badge>
          <Badge
            variant={selectedAttachments.length > 0 ? 'default' : 'secondary'}
            className={`rounded-full px-3 py-1 text-xs ${
              selectedAttachments.length > 0
                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            📎 {selectedAttachments.length} đính kèm
          </Badge>
        </div>

        {/* Personal Info Form */}
        <PersonalInfoForm />

        {/* Export Button */}
        <div className="pt-2 pb-8">
          <Button
            onClick={handleExport}
            disabled={isGenerating}
            className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-200 hover:shadow-rose-300 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Đang tạo PDF...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Xuất file PDF
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
