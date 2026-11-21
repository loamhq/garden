"""Serve the island and serialize observations from the page and persona tool."""
import datetime as dt
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from model import KINDS, garden, observe

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path(os.environ["LOAM_PLUGIN_PRIVATE"])
STATE = PRIVATE / "garden.json"
LOCK = threading.RLock()
cache = None
expires = 0


def read(path, otherwise):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return otherwise


def line_controls(state):
    values = read(Path(os.environ["LOAM_PLUGIN_SETTINGS_DIR"]) / "values.json", {})
    return dict(preview_line=(PRIVATE / "preview-chat-line").is_file(),
                closed=state.get("closed"), line=values.get("chat-line", "show") == "show")


def snapshot(action=None, body=None):
    global cache, expires
    with LOCK:
        state = read(STATE, {})
        if cache is None or time.monotonic() >= expires:
            raw = subprocess.check_output([os.environ["LOAM_PLUGIN_FACTS"]], timeout=120)
            cache = garden(json.loads(raw), state.get("previous", {}).get("app", {}))
            expires = time.monotonic() + 45
        old = json.dumps(state, sort_keys=True)
        observe(state, cache)
        ideas = state.setdefault("ideas", {})
        if action == "seen":
            seen = int(body.get("revision", state["revision"]))
            state["seen"] = max(state.get("seen", 0), min(seen, state["revision"]))
        elif action == "close":
            day = dt.date.fromisoformat(body["day"])
            state["closed"] = day.isoformat()
        elif action in ("dismiss", "agent-idea"):
            kind = body["kind"]
            if kind not in KINDS or kind == "bed":
                raise ValueError("Unknown garden kind")
            if action == "dismiss" or body.get("action") == "withdraw":
                ideas.pop(kind, None)
            else:
                agent, label, draft = body["agent"], body["label"].strip(), body["draft"].strip()
                if (body.get("action") != "set" or agent not in {r["id"] for r in cache["items"]["agent"]}
                        or not 10 <= len(label) <= 88 or not 20 <= len(draft) <= 1200
                        or label.lower().strip(".!?") in ("build an app", "start a project", "make a plugin")):
                    raise ValueError("Name the material and a specific thing to make.")
                idea = dict(agent=agent, label=label, draft=draft)
                if idea != ideas.get(kind):
                    ideas[kind] = idea
                    state["revision"] += 1
                    state.setdefault("idea_changes", {})[kind] = state["revision"]
        if json.dumps(state, sort_keys=True) != old:
            tmp = STATE.with_suffix(".tmp")
            tmp.write_text(json.dumps(state, ensure_ascii=False))
            tmp.replace(STATE)
        seen = state.get("seen", 0)
        changed = [k for k, rev in state.get("count_changes", {}).items() if rev > seen]
        suggested = [k for k in ideas if state.get("idea_changes", {}).get(k, 0) > seen]
        return dict(**cache, ideas=ideas, changed=changed, suggested=suggested, revision=state["revision"],
                    new=state["revision"] > state.get("seen", 0), news=state.get("news", ""),
                    **line_controls(state))


FILES = {"/plants.js": ("page/plants.js", "text/javascript"), "/": ("assets/index.html", "text/html"), "/island.js": ("assets/island.js", "text/javascript"),
         "/guide.js": ("assets/guide.js", "text/javascript"), "/garden.css": ("assets/garden.css", "text/css"),
         "/three.min.js": ("assets/three.min.js", "text/javascript")}


class Handler(BaseHTTPRequestHandler):
    def answer(self, status, data, mime="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Cache-Control", "no-store" if mime != "text/javascript" else "private, max-age=60")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'; object-src 'none'")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in FILES:
            name, mime = FILES[path]
            self.answer(200, (ROOT / name).read_bytes(), mime)
        elif path == "/line-controls":
            # The state file is replaced atomically. Checking dismissal and the switch
            # on a warm load need not wait for the activity reader's lock.
            self.answer(200, json.dumps(line_controls(read(STATE, {}))).encode())
        elif path in ("/state", "/summary"):
            self.api(compact=path == "/summary")
        else:
            self.send_error(404)

    def do_POST(self):
        action = self.path.strip("/")
        if action not in ("seen", "dismiss", "close", "agent-idea"):
            return self.send_error(404)
        if action == "agent-idea" and (self.headers.get("X-Garden-Tool") != "1" or self.headers.get("X-Forwarded-Prefix") or self.headers.get("Origin")):
            return self.send_error(403)
        self.api(action)

    def api(self, action=None, compact=False):
        try:
            body = {}
            if action:
                size = int(self.headers.get("Content-Length", "0"))
                if size < 0 or size > 8192:
                    return self.send_error(413)
                body = json.loads(self.rfile.read(size) or b"{}")
                if not isinstance(body, dict):
                    raise ValueError("Expected an object")
            value = snapshot(action, body)
            if compact or action == "close":
                agents = value["items"]["agent"]
                value = {key: value[key] for key in ("counts", "new", "news", "revision", "closed", "line", "preview_line", "started", "ideas", "changed", "suggested")}
                value["sprout"] = len(agents) == 1 and agents[0]["size"] <= 12
                value["ideas"] = {key: {"agent": idea["agent"], "label": idea["label"]} for key, idea in value["ideas"].items()}
            if action == "agent-idea":
                value = {"ok": True, "kind": body["kind"]}
            self.answer(200, json.dumps(value).encode())
        except (ValueError, TypeError, KeyError, AttributeError) as exc:
            self.answer(400, json.dumps({"error": str(exc)}).encode())
        except (OSError, subprocess.SubprocessError):
            self.answer(503, b'{"error":"The garden facts are temporarily unavailable."}')


if __name__ == "__main__":
    PRIVATE.mkdir(exist_ok=True, parents=True)
    ThreadingHTTPServer(("127.0.0.1", int(os.environ["PORT"])), Handler).serve_forever()
