from __future__ import annotations

import html
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MARKDOWN_PATH = ROOT / "docs" / "prd.md"
HTML_PATH = ROOT / "docs" / "prd.html"


def flush_paragraph(lines: list[str], out: list[str]) -> None:
    if not lines:
        return
    text = " ".join(line.strip() for line in lines if line.strip())
    if text:
        out.append(f"<p>{inline_markup(text)}</p>")
    lines.clear()


def flush_list(items: list[str], out: list[str], ordered: bool) -> None:
    if not items:
        return
    tag = "ol" if ordered else "ul"
    out.append(f"<{tag}>")
    for item in items:
        out.append(f"<li>{inline_markup(item)}</li>")
    out.append(f"</{tag}>")
    items.clear()


def inline_markup(text: str) -> str:
    escaped = html.escape(text)
    escaped = escaped.replace("`", "")
    return escaped


def markdown_to_html(markdown_text: str) -> str:
    lines = markdown_text.splitlines()
    body: list[str] = []
    paragraph: list[str] = []
    ul_items: list[str] = []
    ol_items: list[str] = []

    def flush_all() -> None:
        flush_paragraph(paragraph, body)
        flush_list(ul_items, body, ordered=False)
        flush_list(ol_items, body, ordered=True)

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        if not stripped:
            flush_all()
            continue

        if stripped.startswith("# "):
            flush_all()
            body.append(f"<h1>{inline_markup(stripped[2:])}</h1>")
            continue
        if stripped.startswith("## "):
            flush_all()
            body.append(f"<h2>{inline_markup(stripped[3:])}</h2>")
            continue
        if stripped.startswith("### "):
            flush_all()
            body.append(f"<h3>{inline_markup(stripped[4:])}</h3>")
            continue
        if stripped.startswith("> "):
            flush_all()
            body.append(f"<blockquote>{inline_markup(stripped[2:])}</blockquote>")
            continue
        if stripped.startswith("- "):
            flush_paragraph(paragraph, body)
            flush_list(ol_items, body, ordered=True)
            ul_items.append(stripped[2:])
            continue

        ordered_marker, dot, remainder = stripped.partition(". ")
        if ordered_marker.isdigit() and dot == ". ":
            flush_paragraph(paragraph, body)
            flush_list(ul_items, body, ordered=False)
            ol_items.append(remainder)
            continue

        paragraph.append(stripped)

    flush_all()

    css = """
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #111827; line-height: 1.6; font-size: 11pt; }
    main { max-width: 920px; margin: 0 auto; }
    h1 { font-size: 24pt; margin: 0 0 8px; line-height: 1.25; }
    h2 { font-size: 16pt; margin: 24px 0 8px; padding-top: 4px; border-top: 1px solid #d1d5db; }
    h3 { font-size: 12.5pt; margin: 16px 0 6px; }
    p, blockquote, li { margin: 0 0 8px; }
    blockquote { color: #4b5563; padding: 8px 12px; border-left: 4px solid #9ca3af; background: #f9fafb; }
    ul, ol { margin: 0 0 10px 20px; padding: 0; }
    li { margin-bottom: 4px; }
    code { font-family: Consolas, monospace; font-size: 10pt; background: #f3f4f6; padding: 1px 4px; border-radius: 4px; }
    """
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Isoser PRD</title>
  <style>{css}</style>
</head>
<body>
  <main>
    {''.join(body)}
  </main>
</body>
</html>
"""


def main() -> None:
    markdown_text = MARKDOWN_PATH.read_text(encoding="utf-8")
    html_text = markdown_to_html(markdown_text)
    HTML_PATH.write_text(html_text, encoding="utf-8")
    print(f"Generated HTML: {HTML_PATH}")


if __name__ == "__main__":
    main()
