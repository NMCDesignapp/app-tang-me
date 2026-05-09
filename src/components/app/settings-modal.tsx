'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Upload } from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

export function SettingsModal() {
  const { templateFile, setTemplateFile } = useAppStore();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      toast.error('Vui lòng chọn file .docx');
      return;
    }
    setTemplateFile(file);
    toast.success(`Đã tải template: ${file.name}`);
  };

  const handleRemove = () => {
    setTemplateFile(null);
    toast.success('Đã xóa template');
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-9 w-9 rounded-full text-rose-200 hover:text-white hover:bg-white/20 transition-all"
        title="Cài đặt"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Cài đặt
            </DialogTitle>
          </DialogHeader>

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
                    onClick={handleRemove}
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
                onChange={handleFileSelect}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
