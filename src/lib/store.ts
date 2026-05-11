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
  setUploadedPdfs: (map: Map<number, UploadedPdf>) => void;

  // Selected attachments
  selectedAttachments: number[];
  setSelectedAttachments: (nums: number[]) => void;

  // Reset all form data
  resetForm: () => void;

  // Loading
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;

  // Hydration flag
  _hydrated: boolean;
}

// --- IndexedDB helpers for File persistence ---
const IDB_NAME = 'tangmeDB';
const IDB_STORE = 'pdfFiles';
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFileToIDB(index: number, file: File): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(file, `pdf_${index}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeFileFromIDB(index: number): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.delete(`pdf_${index}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadAllFilesFromIDB(): Promise<Map<number, UploadedPdf>> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAllKeys();
    const map = new Map<number, UploadedPdf>();

    req.onsuccess = async () => {
      const keys = req.result as string[];
      for (const key of keys) {
        if (key.startsWith('pdf_')) {
          const index = parseInt(key.replace('pdf_', ''), 10);
          const fileReq = store.get(key);
          await new Promise<void>((res) => {
            fileReq.onsuccess = () => {
              const file = fileReq.result as File;
              if (file) {
                map.set(index, { index, file, name: file.name });
              }
              res();
            };
            fileReq.onerror = () => res();
          });
        }
      }
      resolve(map);
    };
    req.onerror = () => reject(req.error);
  });
}

// --- localStorage helpers ---
const LS_KEY_FORM = 'tangme_formData';
const LS_KEY_K = 'tangme_selectedK';
const LS_KEY_ATTACH = 'tangme_selectedAttachments';

function loadFromLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToLS(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  formData: {
    ho_ten: '',
    ngay_sinh: '',
    gioi_tinh: 'Nam',
    so_gttt: '',
    ngay_cap: '',
    noi_cap: '',
    sdt: '',
    dia_chi: '',
    so_giay_yeu_cau: '',
    ghi_chu: '',
    nguoi_dai_dien: '',
    ngay_sinh_dd: '',
    gioi_tinh_dd: 'Nam',
    so_gttt_dd: '',
    ngay_cap_dd: '',
    noi_cap_dd: '',
    quan_he: '',
  },
  setFormData: (data) => {
    set((state) => ({ formData: { ...state.formData, ...data } }));
    // Persist to localStorage
    const updated = { ...get().formData, ...data };
    saveToLS(LS_KEY_FORM, updated);
  },

  selectedK: [],
  setSelectedK: (k) => {
    set({ selectedK: k });
    saveToLS(LS_KEY_K, k);
  },

  templateFile: null,
  setTemplateFile: (file) => set({ templateFile: file }),

  uploadedPdfs: new Map(),
  addPdf: (index, file) => {
    set((state) => {
      const map = new Map(state.uploadedPdfs);
      map.set(index, { index, file, name: file.name });
      return { uploadedPdfs: map };
    });
    // Persist file to IndexedDB
    saveFileToIDB(index, file).catch(console.error);
  },
  removePdf: (index) => {
    set((state) => {
      const map = new Map(state.uploadedPdfs);
      map.delete(index);
      return { uploadedPdfs: map };
    });
    // Remove from IndexedDB
    removeFileFromIDB(index).catch(console.error);
  },
  setUploadedPdfs: (map) => set({ uploadedPdfs: map }),

  selectedAttachments: [],
  setSelectedAttachments: (nums) => {
    set({ selectedAttachments: nums });
    saveToLS(LS_KEY_ATTACH, nums);
  },

  resetForm: () => {
    const emptyForm: FormData = {
      ho_ten: '',
      ngay_sinh: '',
      gioi_tinh: 'Nam',
      so_gttt: '',
      ngay_cap: '',
      noi_cap: '',
      sdt: '',
      dia_chi: '',
      so_giay_yeu_cau: '',
      ghi_chu: '',
      nguoi_dai_dien: '',
      ngay_sinh_dd: '',
      gioi_tinh_dd: 'Nam',
      so_gttt_dd: '',
      ngay_cap_dd: '',
      noi_cap_dd: '',
      quan_he: '',
    };
    set({ formData: emptyForm, selectedK: [], selectedAttachments: [] });
    saveToLS(LS_KEY_FORM, emptyForm);
    saveToLS(LS_KEY_K, []);
    saveToLS(LS_KEY_ATTACH, []);
  },

  isGenerating: false,
  setIsGenerating: (val) => set({ isGenerating: val }),

  _hydrated: false,
}));

// --- Hydration: call once on app mount ---
export async function hydrateStore(): Promise<void> {
  const formData = loadFromLS<FormData>(LS_KEY_FORM, get().formData);
  const selectedK = loadFromLS<string[]>(LS_KEY_K, []);
  const selectedAttachments = loadFromLS<number[]>(LS_KEY_ATTACH, []);

  let uploadedPdfs = new Map<number, UploadedPdf>();
  try {
    uploadedPdfs = await loadAllFilesFromIDB();
  } catch (e) {
    console.error('Failed to load files from IndexedDB:', e);
  }

  useAppStore.setState({
    formData,
    selectedK,
    selectedAttachments,
    uploadedPdfs,
    _hydrated: true,
  });
}

// Helper to get current state outside React
function get() {
  return useAppStore.getState();
}
