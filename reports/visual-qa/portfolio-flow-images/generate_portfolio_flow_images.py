from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
W, H = 1600, 900

FONT_REGULAR = Path("C:/Windows/Fonts/malgun.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size)


F_TITLE = font(54, True)
F_SUBTITLE = font(25)
F_SECTION = font(26, True)
F_LABEL = font(24, True)
F_BODY = font(19)
F_SMALL = font(16)
F_TINY = font(14)
F_METRIC = font(46, True)


COLORS = {
    "ink": "#111827",
    "muted": "#667085",
    "line": "#98A2B3",
    "bg": "#F5F7FB",
    "card": "#FFFFFF",
    "border": "#D0D5DD",
    "blue": "#0B4FB3",
    "blue2": "#3B82F6",
    "sky": "#E8F1FF",
    "red": "#EF5A6F",
    "red_bg": "#FFF1F3",
    "orange": "#F6A33A",
    "orange_bg": "#FFF3E2",
    "green": "#7DC862",
    "green_bg": "#EEF9E8",
    "navy": "#071A36",
    "dark": "#090A0C",
    "dark_card": "#171717",
    "dark_card2": "#222222",
    "dark_border": "#3B3B3B",
    "yellow": "#FFE100",
    "pink": "#FF4F7A",
    "lime": "#64E600",
}


def hex_to_rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
        alpha,
    )


def make_canvas(bg: str = COLORS["bg"]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (W, H), hex_to_rgba(bg))
    draw = ImageDraw.Draw(img)
    return img, draw


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for raw_line in text.split("\n"):
        words = raw_line.split(" ")
        line = ""
        for word in words:
            candidate = word if not line else f"{line} {word}"
            if text_size(draw, candidate, fnt)[0] <= max_width:
                line = candidate
                continue
            if line:
                lines.append(line)
                line = word
            if text_size(draw, line, fnt)[0] > max_width:
                buf = ""
                for ch in line:
                    candidate_ch = f"{buf}{ch}"
                    if text_size(draw, candidate_ch, fnt)[0] <= max_width:
                        buf = candidate_ch
                    else:
                        if buf:
                            lines.append(buf)
                        buf = ch
                line = buf
        lines.append(line)
    return lines


def draw_multiline(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.ImageFont,
    fill: str,
    max_width: int,
    line_gap: int = 8,
    align: str = "left",
) -> int:
    x, y = xy
    lines = wrap_text(draw, text, fnt, max_width)
    line_height = text_size(draw, "가", fnt)[1] + line_gap
    for idx, line in enumerate(lines):
        lx = x
        if align == "center":
            lx = x + (max_width - text_size(draw, line, fnt)[0]) // 2
        draw.text((lx, y + idx * line_height), line, font=fnt, fill=fill)
    return y + len(lines) * line_height


def shadow_round(
    img: Image.Image,
    xy: tuple[int, int, int, int],
    radius: int = 24,
    shadow: str = "#D8DEE8",
    offset: tuple[int, int] = (0, 8),
    alpha: int = 80,
) -> None:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    x1, y1, x2, y2 = xy
    dx, dy = offset
    od.rounded_rectangle((x1 + dx, y1 + dy, x2 + dx, y2 + dy), radius=radius, fill=hex_to_rgba(shadow, alpha))
    img.alpha_composite(overlay)


def round_rect(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    fill: str,
    outline: str = COLORS["border"],
    width: int = 2,
    radius: int = 20,
    shadow: bool = True,
) -> None:
    if shadow:
        shadow_round(img, xy, radius=radius)
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def dashed_round_rect(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    radius: int,
    fill: str | None,
    outline: str,
    dash: int = 10,
    gap: int = 7,
    width: int = 2,
) -> None:
    x1, y1, x2, y2 = xy
    if fill:
        draw.rounded_rectangle(xy, radius=radius, fill=fill)
    # Approximate dashed border with line segments; corners are intentionally light.
    for x in range(x1 + radius, x2 - radius, dash + gap):
        draw.line((x, y1, min(x + dash, x2 - radius), y1), fill=outline, width=width)
        draw.line((x, y2, min(x + dash, x2 - radius), y2), fill=outline, width=width)
    for y in range(y1 + radius, y2 - radius, dash + gap):
        draw.line((x1, y, x1, min(y + dash, y2 - radius)), fill=outline, width=width)
        draw.line((x2, y, x2, min(y + dash, y2 - radius)), fill=outline, width=width)
    for box, start, end in [
        ((x1, y1, x1 + 2 * radius, y1 + 2 * radius), 180, 270),
        ((x2 - 2 * radius, y1, x2, y1 + 2 * radius), 270, 360),
        ((x2 - 2 * radius, y2 - 2 * radius, x2, y2), 0, 90),
        ((x1, y2 - 2 * radius, x1 + 2 * radius, y2), 90, 180),
    ]:
        draw.arc(box, start, end, fill=outline, width=width)


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], color: str = COLORS["line"], width: int = 4) -> None:
    x1, y1 = start
    x2, y2 = end
    draw.line((x1, y1, x2, y2), fill=color, width=width)
    angle = math.atan2(y2 - y1, x2 - x1)
    size = 13
    pts = [
        (x2, y2),
        (x2 - size * math.cos(angle - math.pi / 6), y2 - size * math.sin(angle - math.pi / 6)),
        (x2 - size * math.cos(angle + math.pi / 6), y2 - size * math.sin(angle + math.pi / 6)),
    ]
    draw.polygon(pts, fill=color)


def pill(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    text: str,
    fill: str,
    txt: str = "#FFFFFF",
    outline: str | None = None,
    fnt: ImageFont.ImageFont = F_BODY,
) -> None:
    draw.rounded_rectangle(xy, radius=(xy[3] - xy[1]) // 2, fill=fill, outline=outline or fill, width=1)
    tw, th = text_size(draw, text, fnt)
    draw.text(((xy[0] + xy[2] - tw) // 2, (xy[1] + xy[3] - th) // 2 - 2), text, font=fnt, fill=txt)


def card(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    title: str,
    body: str = "",
    fill: str = COLORS["card"],
    accent: str = COLORS["blue"],
    title_fill: str = COLORS["ink"],
    body_fill: str = COLORS["muted"],
    shadow: bool = True,
    icon: str | None = None,
) -> None:
    round_rect(img, draw, xy, fill=fill, outline=COLORS["border"], radius=18, shadow=shadow)
    x1, y1, x2, _ = xy
    if icon:
        pill(img, draw, (x1 + 18, y1 + 18, x1 + 64, y1 + 64), icon, accent, fnt=F_BODY)
        tx = x1 + 78
    else:
        tx = x1 + 22
    title_end = draw_multiline(draw, (tx, y1 + 20), title, F_LABEL, title_fill, x2 - tx - 22, line_gap=5)
    if body:
        draw_multiline(draw, (x1 + 22, max(y1 + 66, title_end + 8)), body, F_BODY, body_fill, x2 - x1 - 44, line_gap=7)


def header(draw: ImageDraw.ImageDraw, title: str, subtitle: str, badge: str, dark: bool = False) -> None:
    fill = "#FFFFFF" if dark else COLORS["ink"]
    muted = "#D0D5DD" if dark else COLORS["muted"]
    draw.text((70, 48), title, font=F_TITLE, fill=fill)
    draw.text((72, 122), subtitle, font=F_SUBTITLE, fill=muted)
    bx1, by1, bx2, by2 = 1195, 58, 1518, 108
    draw.rounded_rectangle((bx1, by1, bx2, by2), radius=25, fill="#FFFFFF" if not dark else "#252525", outline="#CBD5E1" if not dark else "#444444")
    tw, th = text_size(draw, badge, F_BODY)
    draw.text(((bx1 + bx2 - tw) // 2, (by1 + by2 - th) // 2 - 1), badge, font=F_BODY, fill=COLORS["blue2"] if not dark else COLORS["lime"])


def legend(draw: ImageDraw.ImageDraw, items: Sequence[tuple[str, str]], xy: tuple[int, int], dark: bool = False) -> None:
    x, y = xy
    for idx, (label, color) in enumerate(items):
        cy = y + idx * 33
        draw.rounded_rectangle((x, cy, x + 42, cy + 22), radius=7, fill=color)
        draw.text((x + 56, cy - 2), label, font=F_SMALL, fill="#F5F5F5" if dark else COLORS["ink"])


def save(img: Image.Image, name: str) -> None:
    img.convert("RGB").save(ROOT / name, quality=96)


def slide_search_latency() -> None:
    img, draw = make_canvas()
    header(
        draw,
        "2. 탐색 지연을 이탈 신호로 해석",
        "filter API 병목을 분리하고 read-model + facet snapshot으로 첫 탐색 응답을 줄인 구조",
        "탐색 응답 최적화",
    )

    dashed_round_rect(draw, (55, 175, 535, 785), 28, "#FFFFFF", "#CBD5E1")
    dashed_round_rect(draw, (575, 175, 1545, 785), 28, "#FFFFFF", "#CBD5E1")
    pill(img, draw, (195, 160, 395, 202), "기존 병목", COLORS["red"], fnt=F_LABEL)
    pill(img, draw, (952, 160, 1170, 202), "개선 구조", COLORS["blue"], fnt=F_LABEL)

    # Before path
    card(img, draw, (92, 245, 300, 332), "사용자 탐색 진입", "프로그램 목록 진입", fill=COLORS["green_bg"], accent=COLORS["green"], icon="1")
    arrow(draw, (300, 285), (368, 285))
    card(img, draw, (368, 238, 500, 340), "동시 대기", "목록과 옵션을 함께 기다림", fill="#FFFFFF", accent=COLORS["orange"], icon="2")
    arrow(draw, (434, 332), (434, 392))
    card(img, draw, (305, 392, 505, 505), "filter API 병목", "row scan과 facet 계산이 진입 시간을 끌어올림", fill=COLORS["red_bg"], accent=COLORS["red"], icon="!")
    arrow(draw, (405, 493), (405, 560), color=COLORS["red"])
    card(img, draw, (305, 560, 505, 650), "약 29초 대기", "결과를 보기 전 멈춘 것처럼 보이는 상태", fill=COLORS["red"], accent=COLORS["red"], title_fill="#FFFFFF", body_fill="#FFFFFF")
    arrow(draw, (305, 605), (150, 700), color=COLORS["red"])
    card(img, draw, (92, 688, 330, 762), "이탈 위험 증가", "", fill="#FFFFFF", accent=COLORS["red"], icon="×")

    # After path
    card(img, draw, (625, 245, 860, 365), "기본 화면 즉시 렌더", "정적 옵션으로 먼저 열고 보조 요청은 뒤로 분리", fill=COLORS["sky"], accent=COLORS["blue"], icon="A")
    arrow(draw, (860, 302), (905, 302))
    card(img, draw, (905, 245, 1160, 365), "list read-model", "program_list_index 300 browse pool 조회", fill=COLORS["sky"], accent=COLORS["blue"], icon="B")
    arrow(draw, (1160, 302), (1205, 302))
    card(img, draw, (1205, 245, 1488, 365), "facet snapshot", "기본 탐색 facet은 snapshot fast path 사용", fill=COLORS["green_bg"], accent=COLORS["green"], icon="C")

    arrow(draw, (742, 365), (742, 430))
    arrow(draw, (1030, 365), (1030, 430))
    arrow(draw, (1345, 365), (1345, 430))
    card(img, draw, (625, 430, 860, 550), "결과 먼저 노출", "옵션 계산보다 목록 탐색 경험을 우선", fill="#FFFFFF", accent=COLORS["green"], icon="✓")
    card(img, draw, (905, 430, 1160, 550), "검색은 3.5초 제한", "timeout 시 fallback으로 SSR 500과 장기 대기 차단", fill="#FFFFFF", accent=COLORS["orange"], icon="⏱")
    card(img, draw, (1205, 430, 1488, 550), "동적 옵션은 필요 시만", "검색어·필터·마감공고 보기에서만 시도", fill="#FFFFFF", accent=COLORS["blue2"], icon="↻")

    round_rect(img, draw, (625, 610, 1488, 725), fill=COLORS["navy"], outline=COLORS["navy"], radius=22, shadow=True)
    draw.text((660, 637), "설계 판단", font=F_SECTION, fill="#FFFFFF")
    draw_multiline(draw, (660, 680), "응답 지연을 추천 결과 전 이탈하는 전환 손실로 해석했다.", F_BODY, "#DCEBFF", 430, line_gap=6)
    draw.text((1115, 632), "0.3초", font=F_METRIC, fill=COLORS["green"])
    draw.text((1118, 687), "facet snapshot", font=F_SMALL, fill="#DCEBFF")
    draw.text((1280, 632), "3.5초", font=F_METRIC, fill=COLORS["orange"])
    draw.text((1284, 687), "검색 timeout 기준", font=F_SMALL, fill="#DCEBFF")

    legend(
        draw,
        [
            ("빨강: 기존 이탈 위험", COLORS["red"]),
            ("파랑: read-model 응답 경로", COLORS["blue"]),
            ("초록: 빠른 노출/복구", COLORS["green"]),
        ],
        (74, 805),
    )
    save(img, "portfolio-flow-02-search-latency.png")


def slide_payment_cta() -> None:
    img, draw = make_canvas()
    header(
        draw,
        "3. PDF 필요성이 생긴 순간에 결제 CTA",
        "결제 화면을 먼저 보여주지 않고, 저장 문서를 확인한 뒤 PDF 출력 흐름 안에 배치",
        "CTA 타이밍 설계",
    )

    # Avoided path
    round_rect(img, draw, (70, 190, 505, 370), fill="#FFFFFF", outline=COLORS["border"], radius=24, shadow=True)
    draw.text((102, 220), "피한 흐름", font=F_SECTION, fill=COLORS["red"])
    card(img, draw, (105, 270, 230, 345), "작성 시작", fill=COLORS["sky"], accent=COLORS["blue"], shadow=False)
    arrow(draw, (230, 305), (280, 305), color=COLORS["red"])
    card(img, draw, (280, 260, 470, 355), "결제 먼저 노출", "가치 확인 전 비용을 만남", fill=COLORS["red_bg"], accent=COLORS["red"], shadow=False)
    draw.line((95, 353, 482, 215), fill=COLORS["red"], width=8)
    draw.text((100, 380), "사용자가 구매 필요성을 느끼기 전 결제를 보면 전환보다 이탈이 커질 수 있음", font=F_BODY, fill=COLORS["muted"])

    # Main flow
    dashed_round_rect(draw, (545, 190, 1535, 645), 30, "#FFFFFF", "#CBD5E1")
    pill(img, draw, (910, 173, 1170, 216), "선택한 CTA 흐름", COLORS["blue"], fnt=F_LABEL)
    steps = [
        ((590, 275, 755, 385), "성과/공고핏 선택", "문서 재료 확보", COLORS["sky"], COLORS["blue"], "1"),
        ((805, 275, 970, 385), "문서 생성", "resume·portfolio draft", COLORS["sky"], COLORS["blue"], "2"),
        ((1020, 275, 1185, 385), "저장 완료", "사용자 산출물 확보", COLORS["green_bg"], COLORS["green"], "3"),
        ((1235, 260, 1485, 395), "문서 저장소", "미리보기와 디자인 선택으로 최종 검토", "#FFFFFF", COLORS["blue2"], "4"),
    ]
    for i, (xy, title, body, fill, accent, icon) in enumerate(steps):
        card(img, draw, xy, title, body, fill=fill, accent=accent, icon=icon, shadow=True)
        if i < len(steps) - 1:
            arrow(draw, (xy[2], (xy[1] + xy[3]) // 2), (steps[i + 1][0][0] - 10, (steps[i + 1][0][1] + steps[i + 1][0][3]) // 2), color=COLORS["line"])

    arrow(draw, (1360, 395), (1360, 455), color=COLORS["orange"])
    card(img, draw, (1218, 455, 1502, 570), "PDF 필요성 발생", "저장 문서를 확인한 뒤 다운로드 목적이 분명해짐", fill=COLORS["orange_bg"], accent=COLORS["orange"], icon="!")
    arrow(draw, (1218, 507), (1055, 507), color=COLORS["orange"])
    card(img, draw, (790, 455, 1055, 570), "PDF 출력 CTA", "문서 저장소 안에서 결제 모달 오픈", fill=COLORS["green_bg"], accent=COLORS["green"], icon="✓")
    arrow(draw, (790, 507), (650, 507), color=COLORS["green"])

    # Modal mock
    round_rect(img, draw, (575, 665, 1088, 825), fill=COLORS["navy"], outline=COLORS["navy"], radius=22, shadow=True)
    draw.text((610, 695), "결제 모달", font=F_SECTION, fill="#FFFFFF")
    draw.text((610, 738), "선택 문서 · 디자인 확인", font=F_BODY, fill="#DCEBFF")
    draw.rounded_rectangle((860, 730, 1048, 790), radius=15, fill=COLORS["orange"])
    draw.text((890, 746), "결제하고 다운로드", font=F_BODY, fill=COLORS["ink"])

    # Principle panel
    round_rect(img, draw, (1115, 665, 1535, 825), fill="#FFFFFF", outline=COLORS["border"], radius=22, shadow=True)
    draw.text((1148, 696), "CTA 위치 원칙", font=F_SECTION, fill=COLORS["ink"])
    bullets = [
        ("작성 중", "목적 달성에 집중"),
        ("저장 후", "문서 가치를 확인"),
        ("PDF 출력", "결제 CTA 노출"),
    ]
    y = 742
    for label, desc in bullets:
        pill(img, draw, (1148, y, 1228, y + 28), label, COLORS["blue"] if label != "PDF 출력" else COLORS["orange"], fnt=F_SMALL)
        draw.text((1245, y - 1), desc, font=F_BODY, fill=COLORS["muted"])
        y += 34

    legend(
        draw,
        [
            ("파랑: 문서 작성·저장", COLORS["blue"]),
            ("주황: PDF 필요성 발생", COLORS["orange"]),
            ("초록: 자연스러운 결제 CTA", COLORS["green"]),
        ],
        (75, 745),
    )
    save(img, "portfolio-flow-03-payment-cta.png")


def dark_card(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    title: str,
    body: str,
    accent: str,
    big: str | None = None,
) -> None:
    round_rect(img, draw, xy, fill=COLORS["dark_card"], outline=COLORS["dark_border"], radius=22, shadow=False)
    x1, y1, x2, _ = xy
    draw.text((x1 + 24, y1 + 22), title, font=F_LABEL, fill="#E7E7E7")
    if big:
        draw.text((x1 + 24, y1 + 62), big, font=F_METRIC, fill=accent)
        body_y = y1 + 128
    else:
        body_y = y1 + 68
    draw_multiline(draw, (x1 + 24, body_y), body, F_BODY, "#C9CDD5", x2 - x1 - 48, line_gap=5)


def slide_collaboration() -> None:
    img, draw = make_canvas(COLORS["dark"])
    header(
        draw,
        "4. 사람을 더 투입하지 않는 작업 기준 구조화",
        "작업 단위 · 승인 기준 · 검수 흐름을 분리해 3인 팀도 반복 가능한 협업 구조로 운영",
        "반자동 협업 플로우",
        dark=True,
    )

    # Main flow container
    round_rect(img, draw, (55, 175, 1545, 520), fill="#111111", outline=COLORS["dark_border"], radius=28, shadow=False)
    draw.text((85, 205), "실행 전 기준 분리", font=F_SECTION, fill="#FFFFFF")
    flow = [
        ((85, 275, 265, 360), "기획 원본", "cowork/packets", COLORS["blue2"], "1"),
        ((330, 275, 510, 360), "리뷰 산출물", "cowork/reviews", COLORS["yellow"], "2"),
        ((575, 275, 755, 360), "사람 승인", "cowork/approvals", COLORS["lime"], "3"),
        ((820, 275, 1000, 360), "실행 큐", "tasks/inbox", COLORS["blue2"], "4"),
    ]
    for i, (xy, title, body, accent, icon) in enumerate(flow):
        round_rect(img, draw, xy, fill=COLORS["dark_card2"], outline=COLORS["dark_border"], radius=18, shadow=False)
        pill(img, draw, (xy[0] + 16, xy[1] + 18, xy[0] + 56, xy[1] + 58), icon, accent, txt="#111111", fnt=F_SMALL)
        draw.text((xy[0] + 68, xy[1] + 18), title, font=F_LABEL, fill="#FFFFFF")
        draw.text((xy[0] + 68, xy[1] + 52), body, font=F_SMALL, fill="#C9CDD5")
        if i < len(flow) - 1:
            arrow(draw, (xy[2], 318), (flow[i + 1][0][0] - 12, 318), color="#6B7280")

    # Supervisor subflow
    dashed_round_rect(draw, (1050, 240, 1505, 455), 24, None, "#5B6472")
    pill(img, draw, (1190, 222, 1365, 260), "Supervisor 검수", COLORS["pink"], fnt=F_BODY)
    sub = [
        ((1080, 300, 1205, 370), "Inspector", "현재 코드·drift 점검"),
        ((1240, 300, 1365, 370), "Implementer", "최소 변경 구현"),
        ((1400, 300, 1490, 370), "Verifier", "검증·판정"),
    ]
    for i, (xy, title, body) in enumerate(sub):
        draw.rounded_rectangle(xy, radius=14, fill="#242424", outline="#505050")
        draw.text((xy[0] + 14, xy[1] + 14), title, font=F_SMALL, fill="#FFFFFF")
        draw_multiline(draw, (xy[0] + 14, xy[1] + 40), body, F_TINY, "#C9CDD5", xy[2] - xy[0] - 28, line_gap=4)
        if i < len(sub) - 1:
            arrow(draw, (xy[2], 335), (sub[i + 1][0][0] - 10, 335), color="#6B7280", width=3)
    arrow(draw, (1000, 318), (1050, 318), color="#6B7280")

    # Status outputs
    statuses = [
        ("done", COLORS["lime"]),
        ("drifted", COLORS["yellow"]),
        ("blocked", COLORS["pink"]),
        ("review-required", COLORS["orange"]),
    ]
    x = 1080
    for label, color in statuses:
        pill(img, draw, (x, 405, x + 94 if label != "review-required" else x + 170, 438), label, color, txt="#111111", fnt=F_TINY)
        x += 104 if label != "review-required" else 180

    # Lower cards
    dark_card(
        img,
        draw,
        (70, 550, 455, 750),
        "작업 단위",
        "기능 요청을 task packet으로 쪼개고 scope, acceptance, constraints를 먼저 고정",
        COLORS["blue2"],
        "Packet",
    )
    dark_card(
        img,
        draw,
        (485, 550, 870, 750),
        "승인 기준",
        "review가 최신 packet과 맞고 사람 승인 marker가 있어야 실행 큐로 승격",
        COLORS["lime"],
        "Review",
    )
    dark_card(
        img,
        draw,
        (900, 550, 1285, 750),
        "검수 흐름",
        "inspector → implementer → verifier로 구현 전 점검과 최종 검증을 분리",
        COLORS["yellow"],
        "3단계",
    )
    dark_card(
        img,
        draw,
        (1315, 550, 1530, 750),
        "효과",
        "충돌·환경 차이·검수 누락을 상태와 문서로 표시",
        COLORS["pink"],
        "표준화",
    )

    # Bottom principle strip
    round_rect(img, draw, (70, 780, 1530, 845), fill="#161616", outline=COLORS["dark_border"], radius=18, shadow=False)
    draw.text((100, 799), "핵심 판단", font=F_LABEL, fill="#FFFFFF")
    draw.text(
        (250, 802),
        "사람을 더 투입하는 대신, 사람이 판단해야 할 지점과 자동화가 처리할 지점을 명확히 나눴다.",
        font=F_BODY,
        fill="#D4D7DD",
    )

    legend(
        draw,
        [
            ("파랑: 작업 정의/실행 큐", COLORS["blue2"]),
            ("초록: 사람 승인", COLORS["lime"]),
            ("노랑: 검수·드리프트", COLORS["yellow"]),
            ("핑크: 재검토/차단", COLORS["pink"]),
        ],
        (88, 430),
        dark=True,
    )
    save(img, "portfolio-flow-04-collaboration-standards.png")


def main() -> None:
    slide_search_latency()
    slide_payment_cta()
    slide_collaboration()


if __name__ == "__main__":
    main()
