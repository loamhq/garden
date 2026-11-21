"""Garden growth, independent of the renderer or host."""

KINDS = ("agent", "bed", "project", "app", "chat", "flower", "change", "market", "idea", "code")


def flowers(n):
    return min(n, 24) + max(0, n - 24) // 5


def birds(downloads):
    if type(downloads) is not int:
        return 1
    return 1 + sum(downloads >= step for step in (10, 100, 1000))


def garden(facts, previous_opens=None):
    items = {key: [] for key in KINDS}
    def add(kind, id, name, size=1, **extra):
        items[kind].append(dict(kind=kind, id=id, name=name, size=size, **extra))
    for a in facts["agents"]:
        add("bed" if a["archived"] else "agent", a["id"], a["name"], a["files"])
    for p in facts["projects"]:
        add("project", p["path"], p["name"], p["files"])
    for a in facts["apps"]:
        if a["url"] != "/x/garden/":
            opens = a.get("opens")
            if opens is None:
                # During a host upgrade an older reader can still return a daily window.
                opens = max((previous_opens or {}).get(a["url"], 0), a["opens_28d"])
            add("app", a["url"], a["name"], opens)
    for c in facts["chats"]:
        add("chat", c["id"], c["name"], c["messages"])
    for p in facts["local-plugins"]:
        add("change", p["id"], p["name"])
    public = facts.get("public-work") or {}
    unknown = []
    for kind, group in (("market", "publications"), ("idea", "reports"), ("code", "contributions")):
        if public.get(group) is None:
            unknown.append(kind)
        for p in public.get(group) or []:
            size = birds(p.get("downloads")) if kind == "market" else 1
            add(kind, p["id"], p["name"], size, url=p["url"], shipped=p.get("shipped", False))
    counts = {key: len(rows) for key, rows in items.items()}
    counts["flower"] = facts["files"]
    return dict(items=items, counts=counts, flowers=flowers(facts["files"]), unknown=unknown,
                started=facts["installation"]["first_weeks_at"])


def identity(model):
    # Per-item observations distinguish a creation from a simultaneous deletion.
    return {kind: {r["id"]: r["size"] for r in rows} for kind, rows in model["items"].items()} | {
        "flower": {"files": model["counts"]["flower"]}}


def observe(state, model):
    current = identity(model)
    before = state.get("previous", current)
    unseen = state.setdefault("revision", 0)
    for kind, values in current.items():
        prior = before.get(kind, {})
        if kind in model["unknown"]:
            current[kind] = prior
            continue
        new = set(values) - set(prior)
        grown = {key for key, size in values.items() if key in prior and size > prior[key]}
        count_changed = values != prior if kind == "flower" else len(values) != len(prior)
        if new or grown or count_changed:
            unseen += 1
        if count_changed:
            state.setdefault("count_changes", {})[kind] = unseen
        if new or grown:
            if new or kind == "flower":
                state.setdefault("ideas", {}).pop(kind, None)
            key = sorted(new or grown)[0]
            row = next((r for r in model["items"][kind] if r["id"] == key), {})
            state["news"] = ({"agent": "A tree grew for ", "project": "A maple grew for ",
                 "chat": "A shrub grew for ", "app": "A fruit tree grew for ", "bed": "A cleared bed for ",
                 "change": "A pond for ", "idea": "A hive for ", "market": "A birdhouse for ",
                 "code": "A lantern for "}.get(kind, "") + row.get("name", "New flowers in your garden"))
    state.update(previous=current, revision=unseen)
    return state
