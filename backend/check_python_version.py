"""Python runtime version guard for backend."""

from __future__ import annotations

import sys

REQUIRED_MAJOR = 3
REQUIRED_MINOR = 10


def main() -> None:
    current = sys.version_info
    if (current.major, current.minor) != (REQUIRED_MAJOR, REQUIRED_MINOR):
        raise SystemExit(
            f"[python-version-guard] Python {REQUIRED_MAJOR}.{REQUIRED_MINOR}.x required, "
            f"but running {current.major}.{current.minor}.{current.micro}."
        )

    print(
        f"[python-version-guard] OK: {current.major}.{current.minor}.{current.micro}"
    )


if __name__ == "__main__":
    main()
