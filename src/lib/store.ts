'use client';

import { create } from 'zustand';
import { FormData } from '@/lib/types';

interface UploadedPdf {
  index: number;
  file: File;
  name: string;
}

interface AppState {
  // Form data
  formData: FormData;
  setFormData: (data: Partial<FormData>) => void;

  // Selected K packages
  selectedK: string[];
  setSelectedK: (k: string[]) => void;

  // Uploaded template
  templateFile: File | null;
  setTemplateFile: (file: File | null) => void;

  // Uploaded PDFs (1-10)
  uploadedPdfs: Map<number, UploadedPdf>;
  addPdf: (index: number, file: File) => void;
  removePdf: (index: number) => void;

  // Selected attachments
  selectedAttachments: number[];
  setSelectedAttachments: (nums: number[]) => void;

  // Loading
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  formData: {
    ho_ten: '',
    ngay_sinh: '',
    gioi_tinh: 'Nam',
    so_gttt: '',
    ngay_cap: '',
    noi_cap: '',
    sdt: '',
    dia_chi: '',
    ghi_chu: '',
    nguoi_dai_dien: '',
    ngay_sinh_dd: '',
    gioi_tinh_dd: 'Nam',
    so_gttt_dd: '',
    ngay_cap_dd: '',
    noi_cap_dd: '',
    quan_he: '',
  },
  setFormData: (data) =>
    set((state) => ({ formData: { ...state.formData, ...data } })),

  selectedK: [],
  setSelectedK: (k) => set({ selectedK: k }),

  templateFile: null,
  setTemplateFile: (file) => set({ templateFile: file }),

  uploadedPdfs: new Map(),
  addPdf: (index, file) =>
    set((state) => {
      const map = new Map(state.uploadedPdfs);
      map.set(index, { index, file, name: file.name });
      return { uploadedPdfs: map };
    }),
  removePdf: (index) =>
    set((state) => {
      const map = new Map(state.uploadedPdfs);
      map.delete(index);
      return { uploadedPdfs: map };
    }),

  selectedAttachments: [],
  setSelectedAttachments: (nums) => set({ selectedAttachments: nums }),

  isGenerating: false,
  setIsGenerating: (val) => set({ isGenerating: val }),
}));
