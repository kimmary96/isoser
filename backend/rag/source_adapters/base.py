from __future__ import annotations

from dataclasses import asdict, dataclass, field
import os

try:
    from backend.rag.runtime_config import load_backend_dotenv
except ImportError:
    from rag.runtime_config import load_backend_dotenv


@dataclass
class SourceRequestSpec:
    source_name: str
    endpoint_url: str
    method: str = "GET"
    params: dict[str, str] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    timeout_seconds: int = 30

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def _mask_secret(value: str) -> str:
        if len(value) <= 8:
            return "*" * len(value)
        return f"{value[:4]}...{value[-4:]}"

    def to_safe_dict(
        self,
        *,
        secret_param_names: set[str] | None = None,
        redact_authorization: bool = True,
    ) -> dict:
        payload = self.to_dict()
        secret_param_names = secret_param_names or set()

        for name in secret_param_names:
            raw_value = payload["params"].get(name)
            if raw_value:
                payload["params"][name] = self._mask_secret(raw_value)

        auth_value = payload["headers"].get("Authorization")
        if redact_authorization and auth_value:
            scheme, _, token = auth_value.partition(" ")
            if token:
                payload["headers"]["Authorization"] = f"{scheme} {self._mask_secret(token)}"
            else:
                payload["headers"]["Authorization"] = self._mask_secret(auth_value)

        return payload


@dataclass
class SourceStatus:
    source_name: str
    display_name: str
    purpose: str
    key_env_name: str
    key_present: bool
    ready: bool
    auth_scheme: str
    guide_url: str | None

    def to_dict(self) -> dict:
        return asdict(self)


class ApiSourceAdapter:
    def __init__(
        self,
        *,
        source_name: str,
        display_name: str,
        purpose: str,
        key_env_name: str,
        key_env_aliases: tuple[str, ...] | None = None,
        auth_param_name: str,
        guide_url_env_name: str | None = None,
        guide_url_default: str | None = None,
        supports_infuser_header: bool = False,
    ) -> None:
        self.source_name = source_name
        self.display_name = display_name
        self.purpose = purpose
        self.key_env_name = key_env_name
        self.key_env_aliases = tuple(key_env_aliases or ())
        self.auth_param_name = auth_param_name
        self.guide_url_env_name = guide_url_env_name
        self.guide_url_default = guide_url_default
        self.supports_infuser_header = supports_infuser_header

    def _ensure_env_loaded(self) -> None:
        load_backend_dotenv()

    def _resolve_api_key_value(self) -> tuple[str | None, str]:
        self._ensure_env_loaded()
        for env_name in (self.key_env_name, *self.key_env_aliases):
            value = os.getenv(env_name, "").strip()
            if value:
                return env_name, value
        return None, ""

    def get_api_key(self) -> str:
        _, value = self._resolve_api_key_value()
        if not value:
            supported_names = ", ".join((self.key_env_name, *self.key_env_aliases))
            raise ValueError(f"API key is not configured. Checked: {supported_names}")
        return value

    def get_guide_url(self) -> str | None:
        self._ensure_env_loaded()
        if self.guide_url_env_name:
            value = os.getenv(self.guide_url_env_name, "").strip()
            if value:
                return value
        return self.guide_url_default

    def describe_status(self) -> SourceStatus:
        _, api_key = self._resolve_api_key_value()
        key_present = bool(api_key)
        auth_scheme = f"query:{self.auth_param_name}"
        if self.supports_infuser_header:
            auth_scheme += " | header:Authorization=Infuser {API_KEY}"

        return SourceStatus(
            source_name=self.source_name,
            display_name=self.display_name,
            purpose=self.purpose,
            key_env_name=self.key_env_name,
            key_present=key_present,
            ready=key_present,
            auth_scheme=auth_scheme,
            guide_url=self.get_guide_url(),
        )

    def build_request_spec(
        self,
        endpoint_url: str,
        *,
        extra_params: dict[str, str] | None = None,
        use_infuser_header: bool = False,
        timeout_seconds: int = 30,
    ) -> SourceRequestSpec:
        api_key = self.get_api_key()
        params = dict(extra_params or {})
        headers: dict[str, str] = {}

        if use_infuser_header:
            if not self.supports_infuser_header:
                raise ValueError(f"{self.source_name} does not support Infuser header auth.")
            headers["Authorization"] = f"Infuser {api_key}"
        else:
            params[self.auth_param_name] = api_key

        return SourceRequestSpec(
            source_name=self.source_name,
            endpoint_url=endpoint_url,
            params=params,
            headers=headers,
            timeout_seconds=timeout_seconds,
        )
