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
        sk = str(vals.get("SUPABASE_SERVICE_KEY", "EMPTY"))[:20]
        uk = str(vals.get("SUPABASE_KEY", "EMPTY"))[:20]
        print(f"파일: {p}")
        print(f"  SUPABASE_SERVICE_KEY: {sk}")
        print(f"  SUPABASE_KEY: {uk}")
    else:
        print(f"없음: {p}")
