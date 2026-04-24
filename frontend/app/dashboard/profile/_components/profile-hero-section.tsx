import Image from "next/image";

import { resolveProfileTargetJob } from "@/lib/normalizers/profile";
import type { Profile } from "@/lib/types";

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

  return (
    <div className="mb-6 grid gap-6 xl:grid-cols-[14rem_minmax(0,42rem)_14rem] xl:items-start xl:justify-between">
      <div className="w-56 flex-shrink-0 xl:w-auto">
        <div
          className="relative h-[220px] cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-slate-700 shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
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
        <div className="mb-4 flex h-[220px] flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">자기소개</p>
            <IconButton onClick={onEditSelfIntro} label="자기소개 수정" />
          </div>
          <p className="mb-3 line-clamp-[6] text-sm leading-6 text-slate-700">
            {profile.self_intro || "자기소개를 생성해보세요."}
          </p>
          {!profile.self_intro && (
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

      <div className="w-56 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] xl:h-[220px] xl:w-auto">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold tracking-tight text-slate-950">Skills</p>
          <IconButton onClick={onEditSkills} label="스킬 수정" />
        </div>
        <div className="h-[164px] space-y-3 overflow-y-auto pr-1">
          {skillItems.map((skill, index) => (
            <div key={`${skill}-${index}`}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-slate-700">{skill}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: "80%" }} />
              </div>
            </div>
          ))}
          {skillItems.length === 0 && (
            <div className="flex h-[150px] items-center justify-center rounded-2xl bg-slate-50 text-xs text-slate-400">
              스킬을 추가해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
