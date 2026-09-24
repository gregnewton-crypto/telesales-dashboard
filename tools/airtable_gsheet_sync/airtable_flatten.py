"""Shared helpers for turning Airtable record fields into spreadsheet cells."""

from __future__ import annotations

import json
from typing import Any


def flatten_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        if not value:
            return ""
        first = value[0]
        if isinstance(first, str):
            return ", ".join(str(v) for v in value)
        if isinstance(first, dict):
            if "url" in first:
                return ", ".join(
                    str(item.get("url") or item.get("name") or json.dumps(item))
                    for item in value
                )
            if "name" in first:
                return ", ".join(str(item.get("name", "")) for item in value)
        return ", ".join(json.dumps(v, ensure_ascii=False) for v in value)
    if isinstance(value, dict):
        if "name" in value:
            return str(value["name"])
        if "url" in value:
            return str(value["url"])
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def record_to_row(record: dict, columns: list[str]) -> list[str]:
    fields = record.get("fields") or {}
    return [record.get("id", "")] + [flatten_value(fields.get(col)) for col in columns]
