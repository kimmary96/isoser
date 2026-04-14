from pathlib import Path
from dotenv import dotenv_values

candidates = [
    Path("D:/02_2025_AI_Lab/isoser/backend/.env"),
    Path("D:/02_2025_AI_Lab/isoser/.env"),
    Path("D:/02_2025_AI_Lab/.env"),
]

for p in candidates:
    if p.exists():
        vals = dotenv_values(p)
        srk = str(vals.get("SUPABASE_SERVICE_ROLE_KEY", "EMPTY"))[:20]
        print(f"파일: {p}")
        print(f"  SUPABASE_SERVICE_ROLE_KEY: {srk}")
    else:
        print(f"없음: {p}")
