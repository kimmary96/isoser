from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass
class NcsUnit:
    name: str
    description: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class JobProfileRaw:
    normalized_job_key: str
    source: str
    source_id: str
    title: str
    summary_text: str = ""
    knowledge_items: list[str] = field(default_factory=list)
    skill_items: list[str] = field(default_factory=list)
    attitude_items: list[str] = field(default_factory=list)
    ncs_units: list[NcsUnit] = field(default_factory=list)
    career_path: list[str] = field(default_factory=list)
    experience_hint: str = ""
    source_refs: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["ncs_units"] = [unit.to_dict() for unit in self.ncs_units]
        return data


@dataclass
class JobKeywordPatternSeed:
    id: str
    job: str
    job_family: str
    pattern: str
    keywords: list[str]
    source_refs: list[str]
    lang: str = "ko"
    version: int = 1
    is_active: bool = True

    def to_dict(self) -> dict:
        return asdict(self)
