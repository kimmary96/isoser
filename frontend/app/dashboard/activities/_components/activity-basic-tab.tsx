import type { ChangeEvent, KeyboardEvent } from "react";

import type { Activity } from "@/lib/types";

type ActivityBasicTabProps = {
  activity: Activity;
  isNewActivity: boolean;
  typeDraft: string;
  onTypeDraftChange: (value: string) => void;
  organization: string;
  onOrganizationChange: (value: string) => void;
  periodStart: string;
  onPeriodStartChange: (value: string) => void;
  periodEnd: string;
  onPeriodEndChange: (value: string) => void;
  teamSize: number;
  onTeamSizeChange: (value: number) => void;
  teamComposition: string;
  onTeamCompositionChange: (value: string) => void;
  myRole: string;
  onMyRoleChange: (value: string) => void;
  skillsDraft: string[];
  skillInput: string;
  onSkillInputChange: (value: string) => void;
  skillSuggestions: string[];
  skillSuggestionRoleLabel: string | null;
  skillSuggestionLoading: boolean;
  skillSuggestionError: string | null;
  isSkillSelected: (value: string) => boolean;
  onSkillAdd: () => Promise<void>;
  onSkillRemove: (index: number) => void;
  onSuggestedSkillToggle: (skill: string) => void;
  contributions: string[];
  onContributionChange: (index: number, value: string) => void;
  onContributionAdd: () => void;
  onContributionRemove: (index: number) => void;
  descriptionDraft: string;
  onDescriptionDraftChange: (value: string) => void;
  hasContributionContent: boolean;
  introGenerateLoading: boolean;
  introGenerateError: string | null;
  introCandidates: string[];
  onGenerateIntroCandidates: () => Promise<void>;
  imageUrls: string[];
  imageUploading: boolean;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onImageRemove: (index: number) => void;
  basicSaving: boolean;
  onSaveBasicInfo: () => Promise<void>;
};

export function ActivityBasicTab({
  isNewActivity,
  typeDraft,
  onTypeDraftChange,
  organization,
  onOrganizationChange,
  periodStart,
  onPeriodStartChange,
  periodEnd,
  onPeriodEndChange,
  teamSize,
  onTeamSizeChange,
  teamComposition,
  onTeamCompositionChange,
  myRole,
  onMyRoleChange,
  skillsDraft,
  skillInput,
  onSkillInputChange,
  skillSuggestions,
  skillSuggestionRoleLabel,
  skillSuggestionLoading,
  skillSuggestionError,
  isSkillSelected,
  onSkillAdd,
  onSkillRemove,
  onSuggestedSkillToggle,
  contributions,
  onContributionChange,
  onContributionAdd,
  onContributionRemove,
  descriptionDraft,
  onDescriptionDraftChange,
  hasContributionContent,
  introGenerateLoading,
  introGenerateError,
  introCandidates,
  onGenerateIntroCandidates,
  imageUrls,
  imageUploading,
  onImageUpload,
  onImageRemove,
  basicSaving,
  onSaveBasicInfo,
}: ActivityBasicTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">활동 유형</label>
          <div className="flex gap-2 flex-wrap">
            {["회사경력", "프로젝트", "대외활동", "학생활동"].map((type) => (
              <button
                key={type}
                onClick={() => onTypeDraftChange(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  typeDraft === type
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">소속 조직</label>
          <input
            value={organization}
            onChange={(e) => onOrganizationChange(e.target.value)}
            placeholder="활동 소속 조직을 입력해주세요."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">
          활동 기간 <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            value={periodStart}
            onChange={(e) => onPeriodStartChange(e.target.value)}
            placeholder="예) 2025.03"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm w-32 focus:outline-none focus:border-blue-400"
          />
          <span className="text-gray-400">~</span>
          <input
            value={periodEnd}
            onChange={(e) => onPeriodEndChange(e.target.value)}
            placeholder="예) 2025.07"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm w-32 focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">인원</label>
          <input
            type="number"
            value={teamSize || ""}
            onChange={(e) => onTeamSizeChange(Number(e.target.value))}
            placeholder="예) 5"
            min={1}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">팀 구성</label>
          <input
            value={teamComposition}
            onChange={(e) => onTeamCompositionChange(e.target.value)}
            placeholder="예) PM 1 / 백엔드 2 / 프론트엔드 1"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">
          어떤 역할을 담당하셨나요? <span className="text-red-400">*</span>
        </label>
        <input
          value={myRole}
          onChange={(e) => onMyRoleChange(e.target.value)}
          placeholder="예) 백엔드 개발자로 참여"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">
          사용 기술 ({skillsDraft.length}/10)
        </label>

        <div className="flex flex-wrap gap-2 mb-3">
          {skillsDraft.map((skill, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
            >
              {skill}
              <button
                onClick={() => onSkillRemove(i)}
                className="text-gray-400 hover:text-red-400 transition-all"
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        {skillsDraft.length < 10 && (
          <div className="flex gap-2">
            <input
              value={skillInput}
              onChange={(e) => onSkillInputChange(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSkillAdd();
                }
              }}
              placeholder="기술을 직접 입력하거나, 비워둔 뒤 추가 버튼으로 추천을 불러오세요."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={() => void onSkillAdd()}
              disabled={skillSuggestionLoading}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {skillSuggestionLoading ? "불러오는 중..." : "추가"}
            </button>
          </div>
        )}

        {skillsDraft.length < 10 && (
          <>
            <p className="mt-2 text-[11px] text-gray-400">
              역할을 입력한 뒤 입력칸을 비우고 추가 버튼을 누르면 기술 태그를 추천합니다.
            </p>

            {skillSuggestionError && (
              <p className="mt-2 text-xs text-red-500">{skillSuggestionError}</p>
            )}

            {skillSuggestions.length > 0 && (
              <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs font-semibold text-blue-700">역할 기반 추천</p>
                  {skillSuggestionRoleLabel && (
                    <span className="text-[11px] text-blue-500">
                      기준 역할: {skillSuggestionRoleLabel}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {skillSuggestions.map((skill) => {
                    const selected = isSkillSelected(skill);
                    const disabled = !selected && skillsDraft.length >= 10;

                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => onSuggestedSkillToggle(skill)}
                        disabled={disabled}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                          selected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {selected && (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 20 20"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M5 10.5L8.5 14L15 7.5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        <span>{skill}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-500">기여 내용</label>
          {contributions.length < 6 && (
            <button
              onClick={onContributionAdd}
              className="text-xs text-blue-500 hover:underline"
            >
              + 항목 추가
            </button>
          )}
        </div>
        <div className="space-y-2">
          {contributions.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-gray-400 text-sm">-</span>
              <input
                value={c}
                onChange={(e) => onContributionChange(i, e.target.value)}
                placeholder={`기여 내용 ${i + 1}`}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
              {contributions.length > 1 && (
                <button
                  onClick={() => onContributionRemove(i)}
                  className="text-gray-300 hover:text-red-400 text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-500">
            어떤 활동이었는지 간단한 소개를 적어주세요. <span className="text-red-400">*</span>
          </label>
          {isNewActivity && (
            <button
              type="button"
              onClick={() => void onGenerateIntroCandidates()}
              disabled={!hasContributionContent || introGenerateLoading}
              title={
                hasContributionContent
                  ? "기여 내용을 바탕으로 소개글 후보를 생성합니다."
                  : "기여내용을 먼저 작성해주세요"
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <span aria-hidden="true">AI</span>
              <span>{introGenerateLoading ? "소개글 생성 중..." : "소개글 생성"}</span>
            </button>
          )}
        </div>
        <textarea
          value={descriptionDraft}
          onChange={(e) => onDescriptionDraftChange(e.target.value)}
          placeholder="활동에 대한 간단한 소개를 작성해주세요."
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
          rows={5}
        />

        {isNewActivity && (
          <>
            <p className="mt-2 text-[11px] text-gray-400">
              기여 내용을 먼저 작성한 뒤 소개글 생성 버튼을 누르면 AI가 후보 1~3개를 제안합니다.
            </p>

            {introGenerateError && (
              <p className="mt-2 text-xs text-red-500">{introGenerateError}</p>
            )}

            {introCandidates.length > 0 && (
              <div className="mt-3 space-y-2">
                {introCandidates.map((candidate, index) => {
                  const selected = descriptionDraft.trim() === candidate.trim();

                  return (
                    <button
                      key={`${index}-${candidate}`}
                      type="button"
                      onClick={() => onDescriptionDraftChange(candidate)}
                      className={`w-full rounded-2xl border p-3 text-left transition-all ${
                        selected
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500">
                            소개글 후보 {index + 1}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-gray-700">{candidate}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                            selected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {selected ? "선택됨" : "선택"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">
          활동 이미지 추가하기 <span className="text-blue-500">{imageUrls.length}/5</span>
        </label>
        <p className="text-xs text-gray-400 mb-3">
          대표 이미지가 성과저장소 카드에 표시됩니다. 최대 5개까지 첨부 가능합니다.
        </p>

        {imageUrls.length > 0 && (
          <div className="flex gap-3 flex-wrap mb-3">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative w-24 h-24">
                <img
                  src={url}
                  alt={`activity-${i}`}
                  className="w-24 h-24 object-cover rounded-xl border border-gray-200"
                />
                <button
                  onClick={() => onImageRemove(i)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {imageUrls.length < 5 && (
          <label
            title="이미지를 선택해 추가합니다"
            className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 transition-all hover:bg-gray-50"
          >
            <span>🖼</span>
            <span>{imageUploading ? "업로드 중..." : "이미지 선택"}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => void onImageUpload(event)}
              disabled={imageUploading}
            />
          </label>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => void onSaveBasicInfo()}
          disabled={basicSaving}
          className="px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-all"
        >
          {basicSaving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
