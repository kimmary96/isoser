import type { Activity } from "@/lib/types";

type ActivityDetailModalsProps = {
  showPostSaveModal: boolean;
  postSaveActivity: Activity | null;
  postSaveAction: "star" | "portfolio" | null;
  onSendToStar: () => Promise<void>;
  onSendToPortfolio: () => Promise<void>;
  onPostSaveLater: () => void;
  showDeleteModal: boolean;
  isNewActivity: boolean;
  onCloseDeleteModal: () => void;
  onDelete: () => Promise<void>;
  deleting: boolean;
};

export function ActivityDetailModals({
  showPostSaveModal,
  postSaveActivity,
  postSaveAction,
  onSendToStar,
  onSendToPortfolio,
  onPostSaveLater,
  showDeleteModal,
  isNewActivity,
  onCloseDeleteModal,
  onDelete,
  deleting,
}: ActivityDetailModalsProps) {
  return (
    <>
      {showPostSaveModal && postSaveActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <p className="text-sm font-semibold text-blue-500">저장 완료</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              다음 단계로 바로 이어서 작업하시겠어요?
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              방금 저장한 활동을 STAR 기록으로 정리하거나, 포트폴리오 초안으로
              변환해 이어서 보실 수 있습니다.
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => void onSendToStar()}
                disabled={postSaveAction !== null}
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-blue-700">
                  {postSaveAction === "star" ? "STAR로 변환 중..." : "STAR로 보내기"}
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-600">
                  활동 내용을 STAR 탭으로 옮겨서 바로 다듬을 수 있습니다.
                </p>
              </button>

              <button
                type="button"
                onClick={() => void onSendToPortfolio()}
                disabled={postSaveAction !== null}
                className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-emerald-700">
                  {postSaveAction === "portfolio"
                    ? "포트폴리오 초안 생성 중..."
                    : "포트폴리오에 추가하기"}
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-600">
                  현재 활동을 포트폴리오 구조로 변환한 초안을 확인할 수 있습니다.
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={onPostSaveLater}
              disabled={postSaveAction !== null}
              className="mt-6 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              나중에 하기
            </button>
          </div>
        </div>
      )}

      {showDeleteModal && !isNewActivity && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-80 text-center shadow-xl">
            <p className="font-bold text-gray-900 text-lg mb-2">성과를 삭제할까요?</p>
            <p className="text-sm text-gray-400 mb-6">
              삭제된 성과는 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCloseDeleteModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => void onDelete()}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
