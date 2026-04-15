from abc import ABC, abstractmethod
from typing import List, Dict


class BaseCollector(ABC):
    tier: int = 1
    source_key: str = ""
    source_type: str = "national_api"
    source_name: str = ""
    collection_method: str = "public_api"
    scope: str = "national"
    region: str = "전국"
    region_detail: str = ""

    @abstractmethod
    def collect(self) -> List[Dict]:
        pass

    def get_source_meta(self) -> Dict:
        return {
            "tier": self.tier,
            "source_key": self.source_key,
            "source_type": self.source_type,
            "source_name": self.source_name,
            "collection_method": self.collection_method,
            "scope": self.scope,
            "region": self.region,
            "region_detail": self.region_detail,
        }
