// PDF 출력 페이지 - react-pdf로 이력서 PDF 생성 및 다운로드
"use client";

import { useState } from "react";

export default function ResumeExportPage() {
  const [generating, setGenerating] = useState(false);

  const handleExport = async () => {
    setGenerating(true);
    // TODO: STEP 4에서 react-pdf 구현
    setTimeout(() => setGenerating(false), 1500);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">PDF 출력</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 미리보기 영역 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[600px] flex items-center justify-center">
            <p className="text-gray-400 text-sm">이력서 미리보기</p>
          </div>

          {/* 설정 */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">출력 설정</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    템플릿
                  </label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400">
                    <option value="simple">심플</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={generating}
              className="w-full px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {generating ? "생성 중..." : "PDF 다운로드"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
