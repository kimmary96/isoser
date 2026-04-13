"use client";

import { useState } from "react";
import { Map, MapMarker, useKakaoLoader } from "react-kakao-maps-sdk";

type Bootcamp = {
  name: string;
  lat: number;
  lng: number;
};

const BOOTCAMPS: Bootcamp[] = [
  { name: "코드스테이츠 강남", lat: 37.5066, lng: 127.0537 },
  { name: "패스트캠퍼스 강남", lat: 37.4979, lng: 127.0276 },
  { name: "스파르타코딩클럽", lat: 37.501, lng: 127.0368 },
  { name: "멀티캠퍼스 선릉", lat: 37.504, lng: 127.049 },
  { name: "그린컴퓨터아카데미 홍대", lat: 37.5563, lng: 126.9223 },
];

export default function KakaoMap() {
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  console.log("kakao key:", process.env.NEXT_PUBLIC_KAKAO_MAP_KEY);

  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY!,
    libraries: ["services"],
  });

  if (!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-6 text-center text-sm text-amber-700">
        카카오맵 키를 찾을 수 없어 지도를 표시할 수 없습니다.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        지도를 불러오는 중입니다...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 text-center text-sm text-rose-700">
        지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Map
        center={{ lat: 37.51, lng: 127.02 }}
        level={8}
        className="h-[420px] w-full"
      >
        {BOOTCAMPS.map((bootcamp) => (
          <MapMarker
            key={bootcamp.name}
            position={{ lat: bootcamp.lat, lng: bootcamp.lng }}
            title={bootcamp.name}
            clickable
            onClick={() =>
              setActiveMarker((current) =>
                current === bootcamp.name ? null : bootcamp.name,
              )
            }
          >
            {activeMarker === bootcamp.name && (
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-lg">
                {bootcamp.name}
              </div>
            )}
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
