"use client";

type JobPostingInputPanelProps = {
  text: string;
  onTextChange: (value: string) => void;
  extracting: boolean;
  imageFiles: File[];
  onAddImageFiles: (files: FileList | null) => void;
  onRemoveImageFile: (file: File) => void;
  onClearImageFiles: () => void;
  onExtractImages: () => Promise<void>;
  pdfFile: File | null;
  onPdfFileChange: (file: File | null) => void;
  onExtractPdf: () => Promise<void>;
  url?: string;
  onUrlChange?: (value: string) => void;
  onExtractUrl?: () => Promise<void>;
  variant?: "modal" | "sidebar";
  textPlacement?: "top" | "bottom";
  textRows?: number;
  textPlaceholder?: string;
};

const modalFieldClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#094cb2] focus:ring-2 focus:ring-[#bfdbfe]";
const compactFieldClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#094cb2]";
const modalFileInputClassName =
  "block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-[#eef6ff] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#094cb2] hover:file:bg-[#dbeafe]";
const compactFileInputClassName =
  "block w-full text-[11px] text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef6ff] file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-[#094cb2]";
const modalButtonClassName =
  "w-full rounded-xl border border-[#bfdbfe] bg-white px-4 py-2.5 text-sm font-semibold text-[#094cb2] transition hover:bg-[#eef6ff] disabled:opacity-50";
const compactButtonClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-orange-200 hover:bg-[#fff7ed] disabled:opacity-50";

function getFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function JobPostingInputPanel({
  text,
  onTextChange,
  extracting,
  imageFiles,
  onAddImageFiles,
  onRemoveImageFile,
  onClearImageFiles,
  onExtractImages,
  pdfFile,
  onPdfFileChange,
  onExtractPdf,
  url = "",
  onUrlChange,
  onExtractUrl,
  variant = "modal",
  textPlacement = "bottom",
  textRows = variant === "sidebar" ? 5 : 12,
  textPlaceholder = "채용 공고 전문을 붙여넣어 주세요.",
}: JobPostingInputPanelProps) {
  const isCompact = variant === "sidebar";
  const fieldClassName = isCompact ? compactFieldClassName : modalFieldClassName;
  const fileInputClassName = isCompact ? compactFileInputClassName : modalFileInputClassName;
  const buttonClassName = isCompact ? compactButtonClassName : modalButtonClassName;
  const uploadGridClassName = isCompact
    ? "space-y-2"
    : "grid grid-cols-1 gap-3 md:grid-cols-2";
  const uploadCardClassName = isCompact
    ? "rounded-xl border border-slate-100 bg-slate-50 p-2"
    : "rounded-2xl border border-slate-200 bg-[#f8fbff] p-3";
  const titleClassName = isCompact
    ? "text-[11px] font-semibold text-slate-700"
    : "text-sm font-semibold text-slate-900";
  const descriptionClassName = isCompact
    ? "mt-1 text-[11px] leading-4 text-slate-400"
    : "mt-1 text-xs leading-5 text-slate-500";
  const showUrlInput = Boolean(onUrlChange && onExtractUrl);

  const textInput = (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">공고 본문</span>
      <textarea
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={textPlaceholder}
        rows={textRows}
        className={`${fieldClassName} ${isCompact ? "resize-none" : "min-h-[220px] resize-y"} leading-6`}
      />
    </label>
  );

  return (
    <div className={isCompact ? "space-y-2" : "space-y-3"}>
      {textPlacement === "top" && textInput}

      {showUrlInput && (
        <div className={isCompact ? "space-y-2" : "rounded-2xl border border-slate-200 bg-[#f8fbff] p-3"}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">공고 URL</span>
            <input
              type="url"
              value={url}
              onChange={(event) => onUrlChange?.(event.target.value)}
              placeholder="공고 URL 입력"
              className={fieldClassName}
            />
          </label>
          <button
            type="button"
            onClick={() => void onExtractUrl?.()}
            disabled={extracting || !url.trim()}
            className={`${buttonClassName} ${isCompact ? "" : "mt-3"}`}
          >
            {extracting ? "추출 중..." : "URL에서 공고 추출"}
          </button>
        </div>
      )}

      <div className={uploadGridClassName}>
        <div className={uploadCardClassName}>
          <div className={isCompact ? "mb-2" : "mb-3"}>
            <p className={titleClassName}>이미지 공고</p>
            <p className={descriptionClassName}>캡처 이미지를 여러 장 올려 공고 텍스트를 추출합니다.</p>
          </div>
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={(event) => onAddImageFiles(event.target.files)}
            className={fileInputClassName}
          />
          {imageFiles.length > 0 && (
            <div className={isCompact ? "mt-2 rounded-xl border border-slate-100 bg-white p-2" : "mt-3 rounded-xl border border-slate-200 bg-white p-3"}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-600">
                  이미지 {imageFiles.length}개
                </p>
                <button
                  type="button"
                  onClick={onClearImageFiles}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  비우기
                </button>
              </div>
              <ul className="max-h-28 space-y-1 overflow-y-auto pr-1">
                {imageFiles.map((file) => (
                  <li key={getFileKey(file)} className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-600">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveImageFile(file)}
                      className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => void onExtractImages()}
            disabled={extracting || imageFiles.length === 0}
            className={`${buttonClassName} ${isCompact ? "mt-2" : "mt-3"}`}
          >
            {extracting ? "이미지 공고 추출 중..." : "이미지 공고 텍스트 추출"}
          </button>
        </div>

        <div className={uploadCardClassName}>
          <div className={isCompact ? "mb-2" : "mb-3"}>
            <p className={titleClassName}>PDF 공고</p>
            <p className={descriptionClassName}>채용 공고 PDF가 있으면 바로 텍스트로 변환합니다.</p>
          </div>
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) => onPdfFileChange(event.target.files?.[0] ?? null)}
            className={fileInputClassName}
          />
          {pdfFile && (
            <div className={isCompact ? "mt-2 rounded-xl border border-slate-100 bg-white px-2 py-1.5" : "mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2"}>
              <p className="truncate text-xs font-medium text-slate-600">{pdfFile.name}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void onExtractPdf()}
            disabled={extracting || !pdfFile}
            className={`${buttonClassName} ${isCompact ? "mt-2" : "mt-3"}`}
          >
            {extracting ? "PDF 공고 추출 중..." : "PDF 공고 텍스트 추출"}
          </button>
        </div>
      </div>

      {textPlacement === "bottom" && textInput}
    </div>
  );
}
