import type { Activity } from "@/lib/types";

type ResumeProfile = {
  name: string;
  bio?: string;
  email: string;
  phone: string;
  self_intro: string;
  skills: string[];
} | null;

type ResumePreviewPaneProps = {
  profile: ResumeProfile;
  bioInput: string;
  onBioInputChange: (value: string) => void;
  onBioSave: () => Promise<void>;
  bioSaving: boolean;
  targetJob: string;
  selectedCareerActivities: Activity[];
  selectedProjectActivities: Activity[];
  selectedSkillsList: string[];
  selectedQuestions: string[];
};

export function ResumePreviewPane({
  profile,
  bioInput,
  onBioInputChange,
  onBioSave,
  bioSaving,
  targetJob,
  selectedCareerActivities,
  selectedProjectActivities,
  selectedSkillsList,
  selectedQuestions,
}: ResumePreviewPaneProps) {
  const isEmpty =
    selectedCareerActivities.length === 0 &&
    selectedProjectActivities.length === 0 &&
    selectedSkillsList.length === 0 &&
    selectedQuestions.length === 0;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white/80 px-8 py-3 backdrop-blur-sm">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-gray-50 px-4 py-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-400"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="text-sm text-gray-400">문서 검색...</span>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="mx-auto min-h-[800px] max-w-2xl rounded-2xl bg-white p-10 shadow-sm">
          <div className="mb-4 flex items-start justify-between border-b border-gray-200 pb-4">
            <div>
              <h1
                className="mb-1 text-3xl font-bold text-gray-900"
                style={{ fontFamily: "Pretendard, sans-serif" }}
              >
                {profile?.name || "이름을 입력해주세요"}
              </h1>
              <input
                type="text"
                value={bioInput}
                onChange={(e) => onBioInputChange(e.target.value)}
                onBlur={() => void onBioSave()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void onBioSave();
                  }
                }}
                placeholder="5년차 마케터 | 브랜드 기획 전문"
                className="mt-0.5 w-full border-b border-transparent bg-transparent text-sm text-gray-500 outline-none focus:border-gray-300"
              />
              {targetJob && <p className="mt-0.5 text-sm text-gray-500">{targetJob}</p>}
              <div className="mt-2 flex gap-3 text-xs text-gray-400">
                {profile?.email && <span>✉ {profile.email}</span>}
                {profile?.phone && <span>☎ {profile.phone}</span>}
              </div>
              {bioSaving && <p className="mt-1 text-[10px] text-gray-400">bio 저장 중...</p>}
            </div>
            <p className="text-xs text-gray-400">Seoul, South Korea</p>
          </div>

          {profile?.self_intro && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-semibold tracking-widest text-gray-400">
                PROFESSIONAL PROFILE
              </p>
              <p className="text-xs leading-relaxed text-gray-600">{profile.self_intro}</p>
            </div>
          )}

          {selectedCareerActivities.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 text-[10px] font-semibold tracking-widest text-gray-400">
                WORK EXPERIENCE
              </p>
              <div className="space-y-4">
                {selectedCareerActivities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-3">
                    <div
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        index === 0 ? "bg-blue-500" : "bg-gray-300"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="mb-1 flex items-start justify-between">
                        <h3 className="text-sm font-bold text-gray-900">{activity.title}</h3>
                        <span className="ml-4 flex-shrink-0 text-xs text-gray-400">
                          {activity.period}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="text-xs leading-relaxed text-gray-600">
                          {activity.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedProjectActivities.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 text-[10px] font-semibold tracking-widest text-gray-400">
                KEY EXPERIENCE
              </p>
              <div className="space-y-4">
                {selectedProjectActivities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-3">
                    <div
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        index === 0 ? "bg-blue-500" : "bg-gray-300"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="mb-1 flex items-start justify-between">
                        <h3 className="text-sm font-bold text-gray-900">{activity.title}</h3>
                        <span className="ml-4 flex-shrink-0 text-xs text-gray-400">
                          {activity.period}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="text-xs leading-relaxed text-gray-600">
                          {activity.description}
                        </p>
                      )}
                      {Array.isArray(activity.skills) && activity.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {activity.skills.map((skill, skillIndex) => (
                            <span
                              key={`${skill}-${skillIndex}`}
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedSkillsList.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 text-[10px] font-semibold tracking-widest text-gray-400">
                SKILLS
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedSkillsList.map((skill, index) => (
                  <span
                    key={`${skill}-${index}`}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedQuestions.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 text-[10px] font-semibold tracking-widest text-gray-400">
                COVER LETTER
              </p>
              <div className="space-y-4">
                {selectedQuestions.map((question, index) => (
                  <div key={`${question}-${index}`}>
                    <p className="mb-1 text-xs font-bold text-gray-700">{question}</p>
                    <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-gray-200">
                      <p className="text-xs text-gray-300">내용을 입력해주세요</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEmpty && (
            <div className="py-16 text-center text-gray-300">
              <p className="mb-2 text-base">왼쪽에서 항목을 선택하세요.</p>
              <p className="text-sm">경력, 프로젝트, 기술스택 순으로 구성됩니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
