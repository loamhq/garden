import importlib
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))


class Ideas(unittest.TestCase):
    def test_replace_withdraw_dismiss_and_unread(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {
            "LOAM_PLUGIN_PRIVATE": tmp, "LOAM_PLUGIN_SETTINGS_DIR": tmp,
        }):
            service = importlib.import_module("main")
            facts = dict(agents=[dict(id="sample", name="Sample", files=3, archived=False)],
                         projects=[], apps=[], chats=[], files=3,
                         installation={"first_weeks_at": None}, **{"local-plugins": []})
            with patch.object(service, "STATE", Path(tmp) / "garden.json"), \
                 patch.object(service, "cache", service.garden(facts)), \
                 patch.object(service, "expires", float("inf")):
                self.assertEqual(service.snapshot()["ideas"], {})
                idea = dict(kind="app", agent="sample", action="set", label="Build an app",
                            draft="Please map the three trailheads from my October walk notes.")
                with self.assertRaises(ValueError):
                    service.snapshot("agent-idea", idea)
                idea["label"] = "Map the three October trailheads"
                added = service.snapshot("agent-idea", idea)
                self.assertTrue(added["new"])
                self.assertEqual(added["suggested"], ["app"])
                self.assertEqual(added["changed"], [])
                self.assertEqual(added["ideas"]["app"]["draft"], idea["draft"])
                idea["label"] = "Mark the signed trailheads from October"
                revised = service.snapshot("agent-idea", idea)
                self.assertEqual(list(revised["ideas"]), ["app"])
                self.assertGreater(revised["revision"], added["revision"])
                self.assertTrue(service.snapshot("seen", {"revision": added["revision"]})["new"])
                current = service.snapshot("seen", {"revision": revised["revision"]})
                self.assertFalse(current["new"])
                self.assertEqual(current["suggested"], [])
                self.assertEqual(service.snapshot("agent-idea", dict(kind="app", action="withdraw"))["ideas"], {})
                service.snapshot("agent-idea", idea)
                self.assertEqual(service.snapshot("dismiss", {"kind": "app"})["ideas"], {})
