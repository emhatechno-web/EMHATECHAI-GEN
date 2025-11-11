import React, { useState, useEffect } from 'react';
import { XIcon } from './Icons';

interface ApiKeyModalProps {
  isOpen: boolean;
  currentApiKey: string;
  onClose: () => void;
  onSave: (newKey: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, currentApiKey, onClose, onSave }) => {
  const [apiKeyInput, setApiKeyInput] = useState(currentApiKey);

  useEffect(() => {
    setApiKeyInput(currentApiKey);
  }, [currentApiKey, isOpen]);

  const handleSave = () => {
    if (apiKeyInput.trim()) {
      onSave(apiKeyInput.trim());
    }
  };
  
  const handleKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleSave();
    }
  }

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in"
        aria-modal="true"
        role="dialog"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md m-4 transition-colors duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Ganti Kunci API Gemini</h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Masukkan kunci API Gemini Anda. Kunci Anda akan disimpan dengan aman di browser Anda.
        </p>
        <div>
          <label htmlFor="api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kunci API
          </label>
          <input
            id="api-key"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onKeyDown={handleKeydown}
            className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-400 dark:placeholder-slate-500 transition-colors duration-300"
            placeholder="Masukkan kunci API baru Anda di sini"
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Simpan Kunci
          </button>
        </div>
      </div>
    </div>
  );
};