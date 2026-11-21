---
id: garden
name: Garden
description: See what you and your agents have made growing together on a little island.
author: Loam HQ
version: 0.1.1
api: 0
kind: [app, extension]
icon: assets/icon.svg
places: [apps.icon, thread.list.line]
touches:
  server: true
  facts: [agents, projects, files, chats, apps, local-plugins, installation, public-work]
  network:
    - host: api.github.com
      why: Checks public reports and merged contributions using your chosen GitHub login.
    - host: raw.githubusercontent.com
      why: Reads your public Market listings and their download totals when available.
contributes:
  settings.entry:
    - key: chat-line
      label: Garden updates in Chats during your first two weeks
      choices: [show, hide]
      labels: {show: Show, hide: Hide}
      default: show
  agent.tool:
    - name: garden
      run: python3 tools/idea.py
      lanes: [persona]
  agent.prompt:
    - lanes: [persona]
      file: tools/ideas.md
---

Open Garden from Apps. Turn the island with a finger, or scroll or pinch to look closer.
Tap a plant to see what grew there. **What grows here** is your field guide.

An agent can leave a specific idea beside one kind of plant. Open it to start a chat with a draft you can edit, or dismiss it. During your first two weeks, Garden can show one update in Chats. Close it for the day or turn it off in this plugin’s settings.

## Technical details

The scene and its copy of three.js are served locally. The plugin reads declared activity summaries. Public attribution uses the chosen GitHub login, the public Market list, reports filed in the upstream project and merged pull requests. It sends no chat text, file contents or garden state to either host. Unverified work has no ornament. A publication starts with one bird for your own use. The host can supply an optional public download total for that listing. At 10, 100 and 1,000 downloads another bird arrives.
