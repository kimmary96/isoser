import Image from "next/image";
import type { ChangeEvent, RefObject } from "react";

type ProfileEditModalProps = {
  open: boolean;
  avatarPreviewUrl: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAvatarFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  profileNameInput: string;
  onProfileNameInputChange: (value: string) => void;
  profileBioInput: string;
  onProfileBioInputChange: (value: string) => void;
  profileEmailInput: string;
  onProfileEmailInputChange: (value: string) => void;
  profilePhoneInput: string;
  onProfilePhoneInputChange: (value: string) => void;
  profilePortfolioUrlInput: string;
  onProfilePortfolioUrlInputChange: (value: string) => void;
  profileModalSaving: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
};

export function ProfileEditModal({
  open,
  avatarPreviewUrl,
  fileInputRef,
  onAvatarFileChange,
  profileNameInput,
  onProfileNameInputChange,
  profileBioInput,
  onProfileBioInputChange,
  profileEmailInput,
  onProfileEmailInputChange,
  profilePhoneInput,
  onProfilePhoneInputChange,
  profilePortfolioUrlInput,
  onProfilePortfolioUrlInputChange,
  profileModalSaving,
  onClose,
  onSave,
}: ProfileEditModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">프로필 편집</h3>

        <div className="mb-4 rounded-xl border border-gray-200 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">프로필 사진 변경</p>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-100">
              {avatarPreviewUrl ? (
                <Image
                  src={avatarPreviewUrl}
                  alt="avatar preview"
                  width={80}
                  height={80}
                  sizes="80px"
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl text-gray-400">👤</span>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                사진 선택
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">기본 정보</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">이름 (필수)</label>
              <input
                value={profileNameInput}
                onChange={(e) => onProfileNameInputChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">희망 직무 (선택)</label>
              <input
                value={profileBioInput}
                onChange={(e) => onProfileBioInputChange(e.target.value)}
                placeholder="5년차 마케터 | 브랜드 기획 전문"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">이메일</label>
                <input
                  value={profileEmailInput}
                  onChange={(e) => onProfileEmailInputChange(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">전화번호</label>
                <input
                  value={profilePhoneInput}
                  onChange={(e) => onProfilePhoneInputChange(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">포트폴리오 링크</label>
              <input
                value={profilePortfolioUrlInput}
                onChange={(e) => onProfilePortfolioUrlInputChange(e.target.value)}
                placeholder="portfolio.example.com 또는 https://portfolio.example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={profileModalSaving}
            onClick={() => void onSave()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {profileModalSaving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
