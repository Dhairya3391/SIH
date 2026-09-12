'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileCheck, AlertCircle, X, CheckCircle2, RefreshCw } from 'lucide-react';

interface FileUploaderProps {
  accept?: string;
  maxSizeBytes?: number; // default 10MB
  title?: string;
  description?: string;
  onFileSelected: (file: File) => void;
  allowedExtensions?: string[];
  disabled?: boolean;
}

export function FileUploader({
  accept = '.pdf,application/pdf',
  maxSizeBytes = 10 * 1024 * 1024, // 10 MB
  title = 'Upload Proposal PDF',
  description = 'Drag & drop proposal document, or browse local files (up to 10MB)',
  onFileSelected,
  allowedExtensions = ['.pdf'],
  disabled = false,
}: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validateAndProcessFile = (file: File) => {
    setErrorMessage(null);

    // Extension check
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
      setErrorMessage(`Invalid file format: ${ext}. Please upload a ${allowedExtensions.join(' or ')} file.`);
      return;
    }

    // Size check
    if (file.size > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
      setErrorMessage(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is ${maxMb} MB.`);
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate steady progress for UX feedback
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          onFileSelected(file);
          return 100;
        }
        return prev + 25;
      });
    }, 150);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setErrorMessage(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-[#2E7180] bg-[#2E7180]/10 scale-[1.01]'
            : 'border-[#CCD1C7] hover:border-gray-400 bg-gray-50/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={disabled || isUploading}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="p-3 bg-white rounded-full shadow-2xs text-[#2E7180] border border-[#CCD1C7]">
            <Upload className="w-5 h-5" />
          </div>

          <div>
            <span className="font-bold text-sm text-[#102027]">{title}</span>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>

          <div className="text-[11px] font-mono text-gray-400">
            Accepts: {allowedExtensions.join(', ')} · Max {Math.round(maxSizeBytes / (1024 * 1024))}MB
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-[#A8332A] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#D94F45] shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Selected File & Progress bar */}
      {selectedFile && (
        <div className="p-3 rounded-lg border border-[#CCD1C7] bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="truncate">
                <span className="text-xs font-bold text-[#102027] truncate block">
                  {selectedFile.name}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {uploadProgress >= 100 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                </span>
              ) : (
                <span className="text-xs font-mono text-gray-500">{uploadProgress}%</span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                uploadProgress >= 100 ? 'bg-emerald-600' : 'bg-[#2E7180]'
              }`}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
