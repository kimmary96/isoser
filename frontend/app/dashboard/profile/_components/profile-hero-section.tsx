import Image from "next/image";

import { resolveProfileTargetJob } from "@/lib/normalizers/profile";
import type { Profile } from "@/lib/types";
import { getSkillLevelPercent, parseSkillLine } from "../_lib/profile-page";

type ProfileWithExtras = Profile & {
  avatar_url?: string | null;
  portfolio_url?: string | null;
};

type ProfileHeroSectionProps = {
  profile: ProfileWithExtras;
  skillItems: string[];
  onOpenProfileModal: () => void;
  onEditSelfIntro: () => void;
  onEditSkills: () => void;
};

function IconButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
      aria-label={label}
      title={label}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z"
        />
      </svg>
    </button>
  );
}

export function ProfileHeroSection({
  profile,
  skillItems,
  onOpenProfileModal,
  onEditSelfIntro,
  onEditSkills,
}: ProfileHeroSectionProps) {
  const targetJob = resolveProfileTargetJob(profile);
  const parsedSkillItems = skillItems.map(parseSkillLine).filter((skill) => skill.name);

  return (
    <div className="mb-4 grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_18rem] xl:items-start">
      <div className="w-56 flex-shrink-0 xl:w-auto">
        <div
          className="relative h-[228px] cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
          onClick={onOpenProfileModal}
        >
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt="profile"
              fill
              sizes="224px"
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gray-600" />
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-4">
            <p className="text-lg font-bold leading-tight text-white">
              {profile.name || "사용자"}
            </p>
            <p className="text-sm text-gray-300">{targetJob || "직무를 입력해주세요"}</p>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-3 flex h-[228px] min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">자기소개</p>
            <IconButton onClick={onEditSelfIntro} label="자기소개 수정" />
          </div>
          {profile.self_intro ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {profile.self_intro}
              </p>
            </div>
          ) : (
            <div className="mt-auto rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
              <p className="mb-2 text-sm text-slate-400">자기소개 생성하기</p>
              <button
                type="button"
                onClick={onEditSelfIntro}
                className="rounded-xl border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-white"
              >
                작성 시작
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 px-1 text-sm text-slate-500">
          {profile.phone && <span>📞 {profile.phone}</span>}
          {profile.email && <span>✉️ {profile.email}</span>}
          {profile.region && (
            <span>
              📍 {profile.region}
              {profile.region_detail ? ` ${profile.region_detail}` : ""}
            </span>
          )}
          {profile.portfolio_url && (
            <a
              href={profile.portfolio_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline underline-offset-2"
            >
              포트폴리오 링크
            </a>
          )}
        </div>
      </div>

      <div className="flex w-56 min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] xl:h-[228px] xl:w-auto">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold tracking-tight text-slate-950">Skills</p>
          <IconButton onClick={onEditSkills} label="스킬 수정" />
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]">
          {parsedSkillItems.map((skill, index) => (
            <div
              key={`${skill.name}-${index}`}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-3"
            >
              <div className="min-w-0">
                <span className="line-clamp-2 block break-words text-xs font-medium leading-snug text-slate-700">
                  {skill.name}
                </span>
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex justify-end">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {skill.level}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-slate-900 transition-all"
                    style={{ width: `${getSkillLevelPercent(skill.level)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {parsedSkillItems.length === 0 && (
            <div className="flex h-full min-h-[140px] items-center justify-center rounded-2xl bg-slate-50 text-xs text-slate-400">
              스킬을 추가해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
