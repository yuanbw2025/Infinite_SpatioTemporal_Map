#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
llm_client.py — 零依赖 LLM 客户端（Poe / OpenAI-compatible）

【核心原则】
1. 只用 Python 标准库（urllib / json / hashlib / os / time），不 import 任何第三方包。
2. 绝不默认 MOCK。MOCK 必须显式 `MOCK_LLM=true` 才打开，且只返回空串，绝不伪造实体。
3. 手写 .env 解析、指数退避重试、磁盘缓存。
4. 直接运行 `python scripts/llm_client.py` 即冒烟测试：调一次真 API，打印回复。

【环境变量】
  LLM_BASE_URL    默认 https://api.poe.com/v1/
  LLM_API_KEY     必填
  LLM_MODEL       默认 Claude-Sonnet-4.5
  LLM_TEMPERATURE 默认 0.1
  LLM_MAX_RETRIES 默认 5
  LLM_TIMEOUT     默认 180 秒
  LLM_CACHE_DIR   默认 .llm_cache
  MOCK_LLM        默认 false；true 时返回空串不调 API

【用法】
  from scripts.llm_client import chat
  reply = chat([{"role":"user","content":"你好"}])
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------- .env 解析

def _load_dotenv(path: str = ".env") -> None:
    """把 .env 文件里的 KEY=VALUE 写进 os.environ（已存在的不覆盖）。"""
    p = Path(path)
    if not p.exists():
        return
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_load_dotenv()

# ---------------------------------------------------------------- 配置

BASE_URL    = os.environ.get("LLM_BASE_URL", "https://api.poe.com/v1/").rstrip("/")
API_KEY     = os.environ.get("LLM_API_KEY", "").strip()
MODEL       = os.environ.get("LLM_MODEL", "Claude-Sonnet-4.5").strip()
TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", "0.1"))
MAX_RETRIES = int(os.environ.get("LLM_MAX_RETRIES", "5"))
TIMEOUT     = int(os.environ.get("LLM_TIMEOUT", "180"))
CACHE_DIR   = Path(os.environ.get("LLM_CACHE_DIR", ".llm_cache"))
MOCK        = os.environ.get("MOCK_LLM", "false").lower() in ("1", "true", "yes")

CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- 统计

class _Stats:
    calls = 0
    cache_hits = 0
    prompt_tokens = 0
    completion_tokens = 0
    errors = 0

    @classmethod
    def report(cls) -> str:
        return (
            f"[LLM] calls={cls.calls} cache_hits={cls.cache_hits} "
            f"prompt_tokens={cls.prompt_tokens} completion_tokens={cls.completion_tokens} "
            f"errors={cls.errors}"
        )


stats = _Stats

# ---------------------------------------------------------------- 缓存

def _cache_key(payload: dict) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> dict | None:
    f = CACHE_DIR / f"{key}.json"
    if not f.exists():
        return None
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return None


def _cache_put(key: str, value: dict) -> None:
    f = CACHE_DIR / f"{key}.json"
    try:
        f.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass  # 缓存写失败不影响主流程

# ---------------------------------------------------------------- HTTP

def _post(url: str, headers: dict, body: dict, timeout: int) -> dict:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        return json.loads(raw)

# ---------------------------------------------------------------- 主入口

def chat(
    messages: list[dict],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    use_cache: bool = True,
) -> str:
    """
    调用 OpenAI 兼容 /chat/completions，返回纯文本。
    失败会重试 MAX_RETRIES 次，指数退避。MOCK 模式直接返回 ""。
    """
    if MOCK:
        stats.calls += 1
        return ""  # 绝不伪造

    payload: dict[str, Any] = {
        "model": model or MODEL,
        "messages": messages,
        "temperature": TEMPERATURE if temperature is None else temperature,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens

    key = _cache_key(payload)
    if use_cache:
        cached = _cache_get(key)
        if cached is not None:
            stats.cache_hits += 1
            return cached.get("content", "")

    if not API_KEY:
        raise RuntimeError("LLM_API_KEY is empty. Check your .env")

    url = BASE_URL + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            stats.calls += 1
            resp = _post(url, headers, payload, TIMEOUT)
            choices = resp.get("choices") or []
            if not choices:
                raise RuntimeError(f"no choices in response: {resp}")
            content = choices[0].get("message", {}).get("content", "") or ""
            usage = resp.get("usage") or {}
            stats.prompt_tokens     += int(usage.get("prompt_tokens", 0) or 0)
            stats.completion_tokens += int(usage.get("completion_tokens", 0) or 0)
            if use_cache:
                _cache_put(key, {"content": content, "usage": usage})
            return content
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            last_err = RuntimeError(f"HTTP {e.code}: {body[:500]}")
            # 4xx 除了 429 不重试
            if 400 <= e.code < 500 and e.code != 429:
                stats.errors += 1
                raise last_err
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as e:
            last_err = e
        except Exception as e:
            last_err = e

        if attempt < MAX_RETRIES:
            wait = min(2 ** attempt, 30)
            print(f"[LLM] attempt {attempt}/{MAX_RETRIES} failed: {last_err} — retry in {wait}s", file=sys.stderr)
            time.sleep(wait)

    stats.errors += 1
    raise RuntimeError(f"LLM failed after {MAX_RETRIES} attempts: {last_err}")


# ---------------------------------------------------------------- CLI 冒烟测试

def _smoke() -> int:
    print("====== LLM CLIENT SMOKE TEST ======")
    print(f"BASE_URL  : {BASE_URL}")
    print(f"MODEL     : {MODEL}")
    print(f"API_KEY   : {'(set, len=%d)' % len(API_KEY) if API_KEY else '(EMPTY!!)'}")
    print(f"MOCK_LLM  : {MOCK}")
    print(f"CACHE_DIR : {CACHE_DIR}")
    print("-----------------------------------")

    if not API_KEY:
        print("ERROR: .env 里 LLM_API_KEY 是空的", file=sys.stderr)
        return 2
    if MOCK:
        print("WARN: MOCK_LLM=true，不会调真 API。要验货请在 .env 里设 MOCK_LLM=false")
        return 1

    t0 = time.time()
    try:
        reply = chat(
            [
                {"role": "system", "content": "你是一个简洁的中文助手，用一句话回答。"},
                {"role": "user",   "content": "请用一句话告诉我：汉高祖是谁？"},
            ],
            max_tokens=80,
            use_cache=False,
        )
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        return 3
    dt = time.time() - t0

    print(f"REPLY ({dt:.2f}s):")
    print(reply.strip() or "(empty)")
    print("-----------------------------------")
    print(stats.report())
    print("====== SMOKE TEST PASSED ======")
    return 0


if __name__ == "__main__":
    sys.exit(_smoke())
