# Garden

![A tree, birdhouse and flowers on a floating island](assets/icon.svg)

Your Loam in miniature. Open **Apps → Garden**, turn the island with one finger and pinch or scroll to zoom. Tap a plant or open **What grows here** to find its story.

Garden uses the Loam plugin interfaces described in PLUGIN.md. It keeps growth observations and suggestions on the server. Its WebGL scene uses the three.js r160 source modules in assets/three, distributed under the MIT license in assets/three-LICENSE. The local modules match the upstream three@0.160.0 source with two editorial changes: the hex lookup table wraps across lines and the OffscreenCanvas fallback comment describes its result. There is no client-side CDN or analytics.

The host starts server/main.py with Python 3. Run the model tests with `python3 -m unittest discover -s tests`. The agent tool speaks newline-delimited MCP on stdin and gets the agent identity from its lane.

## How growth works

Garden reads the declared fact groups through the host. The server keeps a snapshot for 45 seconds and records each observed object's identity and size in private state. The first observation establishes a baseline. The island reads the full snapshot when opened. The Apps icon and Chats line share a compact summary. On a return visit, the browser restores the last visible band after checking the current Chats setting and dismissal, then refreshes the counts. Opening the island acknowledges the revision that was actually displayed.

The 12 most recently active chats have individual shrubs. The rest share one thicket. Its card opens Chats. At 36 messages a shrub blooms. Trees grow more slowly as their workspaces and project folders get larger. An app carries up to 16 fruit from explicit opens recorded in Apps over its recorded lifetime. Garden itself is omitted. An archived agent leaves a cleared bed.

The first 24 eligible files each make a flower. Each complete group of five additional files makes one more. The newest five patches of twelve remain separate beds. A phone overview draws older flowers as individual faceted blooms and restores their full meshes on zoom. The map keeps the source count at every scale. The young island starts at a radius of 1.25. The landscape grows to a maximum radius of ten scene units and displays up to 4,096 individual flowers.

Every Market publication has a birdhouse with one resident bird for the maker’s own use. The publication ID selects the species. Optional host download totals add flockmates at 10, 100 and 1,000 downloads.

Ideas live on this installation. A newly observed object of the proposed kind clears that kind's idea. This uses the object's identity, so two unrelated projects can fulfill the same project suggestion. Agents can replace or withdraw an idea and the person can dismiss it. An agent supplies the wording and draft. Opening the draft leaves the choice to send with the person.

## Changing your Garden

Edit the tree species in `assets/island.js`. Its `KINDS` object draws the crowns and trunks, and the agent ID chooses a consistent shape and tint. The same file lays out the island, frames the camera, handles taps and adjusts mobile rendering resolution. `server/model.py` turns Loam facts into garden inhabitants, weights the flowers and records growth. The visual thresholds for limbs, shrubs and fruit sit beside their geometry in the scene.

The map and Chats share the drawings in `page/plants.js`. Edit tap-card copy in `assets/guide.js` and the compact counts in `page/main.js`.
