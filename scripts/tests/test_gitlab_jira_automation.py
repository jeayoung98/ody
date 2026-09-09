"""Offline specification tests only: no webhook server, network, or Jira writes.

Run: python -m unittest discover -s scripts/tests -p test_gitlab_jira_automation.py -v
The model does not execute Jira smart values or validate a deployed rule.
"""

import copy
import re
import unittest


PROJECT = "s15-bigdata-dist-sub1/S15P21A405"
SOURCE_PATTERN = (
    r"^(frontend|backend|data)/[a-z][a-z0-9-]*/"
    r"(S15P21A405-[0-9]+)-[a-z0-9]+(?:-[a-z0-9]+)*$"
)


def decide(payload, status="In Progress"):
    """Pure model of the documented guards and sequential duplicate handling."""
    if not isinstance(payload, dict):
        return "IGNORE", None
    project = payload.get("project")
    attrs = payload.get("object_attributes")
    if not isinstance(project, dict) or not isinstance(attrs, dict):
        return "IGNORE", None
    if (
        payload.get("object_kind") != "merge_request"
        or payload.get("event_type") != "merge_request"
        or project.get("path_with_namespace") != PROJECT
        or attrs.get("action") != "merge"
        or attrs.get("state") != "merged"
    ):
        return "IGNORE", None
    source = attrs.get("source_branch")
    match = re.fullmatch(SOURCE_PATTERN, source) if isinstance(source, str) else None
    if not match or attrs.get("target_branch") != match[1] + "/dev":
        return "IGNORE", None
    key = match[2]
    if status is None:
        return "MISSING_OR_INACCESSIBLE", key
    if status == "Done":
        return "ALREADY_DONE", key
    return "TRANSITION_REQUESTED", key


def event(source="backend/feat/S15P21A405-34-nearby", target="backend/dev",
          action="merge", state="merged"):
    # Synthetic minimal payload, not a captured event. Keys are examples only.
    return {
        "object_kind": "merge_request",
        "event_type": "merge_request",
        "project": {"path_with_namespace": PROJECT},
        "object_attributes": {
            "iid": 1, "action": action, "state": state,
            "source_branch": source, "target_branch": target,
        },
    }


class AutomationContractTests(unittest.TestCase):
    def test_case_01_backend(self):
        self.assertEqual(decide(event()), ("TRANSITION_REQUESTED", "S15P21A405-34"))

    def test_case_02_frontend(self):
        self.assertEqual(decide(event("frontend/feat/S15P21A405-101-map", "frontend/dev")),
                         ("TRANSITION_REQUESTED", "S15P21A405-101"))

    def test_case_03_ai(self):
        self.assertEqual(decide(event("data/feat/S15P21A405-70-pca", "data/dev")),
                         ("TRANSITION_REQUESTED", "S15P21A405-70"))

    def test_case_04_feature_to_main(self):
        self.assertEqual(decide(event(target="backend/main")), ("IGNORE", None))

    def test_case_05_dev_to_main(self):
        self.assertEqual(decide(event("backend/dev", "backend/main")), ("IGNORE", None))

    def test_case_06_missing_key(self):
        self.assertEqual(decide(event("frontend/feat/no-jira-key", "frontend/dev")),
                         ("IGNORE", None))

    def test_case_07_cross_part(self):
        self.assertEqual(decide(event("frontend/feat/S15P21A405-101-map", "backend/dev")),
                         ("IGNORE", None))

    def test_case_08_already_done(self):
        self.assertEqual(decide(event("backend/fix/S15P21A405-34-fix"), "Done"),
                         ("ALREADY_DONE", "S15P21A405-34"))

    def test_case_09_closed_unmerged(self):
        self.assertEqual(decide(event(action="close", state="closed")), ("IGNORE", None))

    def test_other_actions_and_failed_merge(self):
        for action in ("open", "update", "approval", "approved", "reopen", "close"):
            with self.subTest(action=action):
                self.assertEqual(decide(event(action=action)), ("IGNORE", None))
        self.assertEqual(decide(event(state="opened")), ("IGNORE", None))

    def test_all_parts_and_types(self):
        for part in ("frontend", "backend", "data"):
            for kind in ("feat", "fix", "refactor", "chore", "test", "docs", "perf"):
                with self.subTest(part=part, kind=kind):
                    self.assertEqual(decide(event(f"{part}/{kind}/S15P21A405-1-demo", f"{part}/dev")),
                                     ("TRANSITION_REQUESTED", "S15P21A405-1"))

    def test_all_cross_parts_and_promotions(self):
        for part in ("frontend", "backend", "data"):
            for other in ("frontend", "backend", "data"):
                if part != other:
                    self.assertEqual(decide(event(f"{part}/feat/S15P21A405-1-demo", f"{other}/dev")),
                                     ("IGNORE", None))
            self.assertEqual(decide(event(f"{part}/dev", f"{part}/main")), ("IGNORE", None))
            for root in ("master", "main"):
                self.assertEqual(decide(event(f"{part}/main", root)), ("IGNORE", None))

    def test_malformed_or_untrusted_payload(self):
        for payload in (None, [], {}, {"project": None}, {"project": {}, "object_attributes": []}):
            self.assertEqual(decide(payload), ("IGNORE", None))
        for field in ("object_kind", "event_type"):
            payload = event()
            payload[field] = "push"
            self.assertEqual(decide(payload), ("IGNORE", None))
        payload = event()
        payload["project"]["path_with_namespace"] = "other/S15P21A405"
        self.assertEqual(decide(payload), ("IGNORE", None))
        for source in (None, 123, "backend/feat/OTHER-34-demo",
                       "backend/feat/S15P21A405-34-demo-S15P21A405-35",
                       "backend/feat/S15P21A405-34-demo\n",
                       'backend/feat/S15P21A405-34-demo" OR project=OTHER'):
            self.assertEqual(decide(event(source)), ("IGNORE", None))

    def test_missing_issue(self):
        self.assertEqual(decide(event(), None), ("MISSING_OR_INACCESSIBLE", "S15P21A405-34"))

    def test_sequential_replay(self):
        payload = event()
        snapshot = copy.deepcopy(payload)
        self.assertEqual(decide(payload)[0], "TRANSITION_REQUESTED")
        # Simulate successful external transition, not an actual Jira API call.
        self.assertEqual(decide(payload, "Done")[0], "ALREADY_DONE")
        self.assertEqual(payload, snapshot)


if __name__ == "__main__":
    unittest.main()
