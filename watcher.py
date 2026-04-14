import subprocess
import time
import os
import glob
import shutil

INBOX_DIR = "./tasks/inbox"
RUNNING_DIR = "./tasks/running"
DONE_DIR = "./tasks/done"
REPORTS_DIR = "./reports"
PROJECT_PATH = r"D:\02_2025_AI_Lab\isoser"

for d in [INBOX_DIR, RUNNING_DIR, DONE_DIR, REPORTS_DIR]:
    os.makedirs(d, exist_ok=True)

print("watcher 시작됨. tasks/inbox 감시 중...")

while True:
    files = glob.glob(f"{INBOX_DIR}/*.md")

    for file in files:
        filename = os.path.basename(file)
        task_name = filename.replace(".md", "")
        running_path = f"{RUNNING_DIR}/{filename}"
        done_path = f"{DONE_DIR}/{filename}"

        # inbox → running으로 이동
        shutil.move(file, running_path)
        print(f"실행 시작: {filename}")

        prompt = (
            f"AGENTS.md를 읽고 tasks/running/{filename}을 처리해줘. "
            f"순서대로: repo 확인 → drift 검사 → 구현 → 검사 → 보고서 작성 → "
            f"docs/current-state.md 갱신 → docs/refactoring-log.md 추가 → "
            f"git add . → git commit -m '[codex] {task_name} 구현 완료' → "
            f"git push origin develop"
        )

        subprocess.run(
            ["codex", "exec", "--full-auto", prompt],
            cwd=PROJECT_PATH
        )

        # running → done으로 이동
        shutil.move(running_path, done_path)
        print(f"완료: {filename}")

    time.sleep(10)
