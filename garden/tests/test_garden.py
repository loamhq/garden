import sys
import unittest
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"server"))
from model import flowers, garden, observe


class Garden(unittest.TestCase):
    def setUp(self):
        self.facts = dict(agents=[dict(id="wren", name="Wren", files=2, archived=True)],
                          projects=[], files=3, apps=[], chats=[], installation={"first_weeks_at": None},
                          **{"local-plugins":[]})

    def test_flowers(self):
        self.assertEqual([flowers(n) for n in (0,3,24,28,29,9200)], [0,3,24,24,25,1859])

    def test_publication_flock(self):
        listing = dict(id="trail", name="Trail", url="/trail")
        self.facts["public-work"] = {"publications": [listing]}
        def flock():
            model = garden(self.facts)
            self.assertEqual(model["counts"]["market"], 1)
            return model["items"]["market"][0]["size"]
        self.assertEqual(flock(), 1)
        for value, expected in [(None, 1), ("100", 1), (True, 1), (-1, 1), (0, 1),
                                (9, 1), (10, 2), (99, 2), (100, 3), (999, 3),
                                (1000, 4), (1000000, 4)]:
            with self.subTest(downloads=value):
                listing["downloads"] = value
                self.assertEqual(flock(), expected)

    def test_cleared_bed_and_unknown(self):
        model = garden(self.facts)
        self.assertEqual(model["counts"]["bed"],1)
        self.assertEqual(model["counts"]["agent"],0)
        self.assertCountEqual(model["unknown"],["market","idea","code"])

    def test_ninety_day_vacation_archive_and_delete(self):
        facts = self.facts
        facts["agents"][0]["archived"] = False
        facts["projects"] = [dict(path="Projects/Walks", name="Walks", files=8)]
        facts["apps"] = [dict(name="Atlas", url="/x/atlas/", opens=11)]
        facts["chats"] = [dict(id=str(i), name=str(i), messages=36+i) for i in range(15)]
        facts["files"] = 400
        facts["local-plugins"] = [dict(id="paper", name="Paper")]
        facts["public-work"] = {group: [dict(id="1", name="Map", url="/1", shipped=True)]
                                for group in ("publications", "reports", "contributions")}
        from copy import deepcopy
        with patch("time.time", return_value=100000):
            first = garden(facts)
            state = observe({}, first)
            saved = deepcopy(state)
        with patch("time.time", return_value=100000+90*86400):
            after = garden(facts)
            self.assertEqual(after, first)
            self.assertEqual(observe(state, after), saved)
            facts["agents"][0]["archived"] = True
            facts["files"] -= 50
            reduced = garden(facts)
            self.assertEqual(reduced["counts"]["agent"], 0)
            self.assertEqual(reduced["counts"]["bed"], 1)
            self.assertEqual(reduced["counts"]["flower"], 350)
            self.assertLess(reduced["flowers"], first["flowers"])
        facts["apps"][0].pop("opens")
        facts["apps"][0]["opens_28d"] = 0
        self.assertEqual(garden(facts, saved["previous"]["app"])["items"]["app"][0]["size"], 11)

    def test_observations_and_ideas(self):
        state = observe({},garden(self.facts))
        self.assertEqual(state["revision"],0)
        self.assertEqual(state.get("count_changes", {}), {})
        state["ideas"] = {"project": {"label":"A ridge journal"}, "app":{"label":"A shelf of books"}}
        self.facts["projects"] = [dict(name="Ridge journal",path="Projects/Ridge journal",files=1)]
        observe(state,garden(self.facts))
        self.assertEqual(state["revision"],1)
        self.assertEqual(state["count_changes"], {"project": 1})
        self.assertIn("Ridge journal",state["news"])
        self.assertEqual(set(state["ideas"]),{"app"})
        observe(state,garden(self.facts))
        self.assertEqual(state["revision"],1)
