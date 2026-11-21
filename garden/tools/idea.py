#!/usr/bin/env python3
"""A dependency-free stdio MCP tool. The host supplies the calling persona."""
import json
import os
import sys
from urllib.request import Request, urlopen

KINDS = ["agent", "project", "app", "chat", "flower", "change", "market", "idea", "code"]
TOOL = {"name": "garden_idea", "description": "Set, replace or withdraw one specific idea grounded in this person's work. Name the source material and concrete result.",
        "inputSchema": {"type": "object", "required": ["kind", "action"], "additionalProperties": False,
                        "properties": {"action": {"enum": ["set", "withdraw"]}, "kind": {"enum": KINDS},
                                       "label": {"type": "string", "maxLength": 88}, "draft": {"type": "string", "maxLength": 1200}}}}


def handle(msg):
    method = msg.get("method")
    if msg.get("id") is None:
        return
    if method == "initialize":
        result = dict(protocolVersion=msg["params"].get("protocolVersion", "2025-06-18"),
                      capabilities={"tools": {}}, serverInfo={"name": "garden", "version": "0.1.0"})
    elif method == "tools/list":
        result = {"tools": [TOOL]}
    elif method == "ping":
        result = {}
    elif method == "tools/call":
        try:
            params = msg["params"]
            if params["name"] != TOOL["name"]:
                raise ValueError("Unknown tool")
            body = {**params["arguments"], "agent": os.environ["LOAM_AGENT"]}
            req = Request(os.environ["LOAM_PLUGIN_URL"] + "agent-idea", data=json.dumps(body).encode(),
                          headers={"content-type": "application/json", "X-Garden-Tool": "1"})
            with urlopen(req, timeout=60) as response:
                answer = response.read().decode()
            result = {"content": [{"type": "text", "text": answer}]}
        except Exception as exc:
            result = {"isError": True, "content": [{"type": "text", "text": str(exc)}]}
    else:
        return {"jsonrpc": "2.0", "id": msg["id"], "error": {"code": -32601, "message": "Unknown method"}}
    return {"jsonrpc": "2.0", "id": msg["id"], "result": result}


for line in sys.stdin:
    try:
        reply = handle(json.loads(line))
        if reply:
            print(json.dumps(reply), flush=True)
    except (ValueError, KeyError, TypeError):
        continue
