"""Unit tests for repo_triage.py bot extensions (stdlib unittest + mock).

Run: python3 -m unittest workflows/scripts/test_repo_triage.py -v
"""

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import repo_triage as r  # noqa: E402


class SemverBumpTests(unittest.TestCase):
    def test_major_minor_patch(self):
        self.assertEqual(r.semver_bump("chore(deps): bump x from 1.2.3 to 2.0.0"), "major")
        self.assertEqual(r.semver_bump("chore(deps): bump x from 1.2.3 to 1.3.0"), "minor")
        self.assertEqual(r.semver_bump("chore(deps): bump x from 1.2.3 to 1.2.9"), "patch")

    def test_digest_and_pin(self):
        self.assertEqual(r.semver_bump("update x.digest to abc123"), "digest")
        self.assertEqual(r.semver_bump("pin dependency x to v4"), "pin")

    def test_single_number_versions(self):
        self.assertEqual(r.semver_bump("bump actions/deploy-pages from 4.0.0 to 5.0.0"), "major")

    def test_unknown(self):
        self.assertEqual(r.semver_bump("weird title with no versions"), "unknown")


class CheckRollupTests(unittest.TestCase):
    def test_green_when_all_success(self):
        roll = [{"status": "COMPLETED", "conclusion": "SUCCESS"},
                {"status": "COMPLETED", "conclusion": "SKIPPED"}]
        self.assertEqual(r.check_rollup_state(roll), "green")

    def test_red_on_failure(self):
        roll = [{"status": "COMPLETED", "conclusion": "FAILURE"}]
        self.assertEqual(r.check_rollup_state(roll), "red")

    def test_pending_when_incomplete(self):
        roll = [{"status": "IN_PROGRESS", "conclusion": None}]
        self.assertEqual(r.check_rollup_state(roll), "pending")

    def test_empty_and_none(self):
        self.assertEqual(r.check_rollup_state([]), "none")
        self.assertEqual(r.check_rollup_state(None), "none")


class BriefBuilderTests(unittest.TestCase):
    def test_green_minor_is_mergeable(self):
        items, brief = r.build_items_and_brief(
            [{"kind": "dep_bot", "number": 5, "title": "bump x from 1.2.3 to 1.3.0",
              "bump": "minor", "checks": "green"}],
            [], [], [], [], [])
        kinds = [i["kind"] for i in items]
        self.assertIn("merge", kinds)
        self.assertIn("READY TO MERGE", brief)

    def test_major_never_mergeable_files_bead(self):
        items, brief = r.build_items_and_brief(
            [{"kind": "dep_bot", "number": 6, "title": "bump y from 1.0.0 to 2.0.0",
              "bump": "major", "checks": "green"}],
            [], [], [], [], [])
        self.assertEqual([i["kind"] for i in items], ["major_bead"])
        self.assertIn("MAJOR bump", brief)
        self.assertNotIn("READY TO MERGE", brief)

    def test_red_checks_file_bead_not_merge(self):
        items, _ = r.build_items_and_brief(
            [{"kind": "dep_bot", "number": 7, "title": "bump z from 1.0.0 to 1.0.2",
              "bump": "patch", "checks": "red"}],
            [], [], [], [], [])
        self.assertEqual(items[0]["kind"], "failure_bead")

    def test_monitor_alerts_collapse_to_one_item(self):
        items, brief = r.build_items_and_brief([], [], [], [], [],
                                               ["a — failure", "b — failure", "c — failure"])
        self.assertEqual(len([i for i in items if i["kind"] == "monitor_bead"]), 1)
        self.assertIn("(3 runs since last burst)", brief)

    def test_brief_line_cap(self):
        many_prs = [{"kind": "dep_bot", "number": n, "title": f"bump p{n} from 1.0.0 to 1.0.{n}",
                     "bump": "patch", "checks": "green"} for n in range(30)]
        _, brief = r.build_items_and_brief(many_prs, [], [], [], [], [])
        self.assertLessEqual(len(brief.splitlines()), r.MAX_BRIEF_LINES)


class ApprovalParsingTests(unittest.TestCase):
    def _apply(self, text):
        return r.parse_approval(text, 3)

    def test_forms(self):
        self.assertEqual(self._apply("go all"), {1, 2, 3})
        self.assertEqual(self._apply("GO NONE"), set())
        self.assertEqual(self._apply("go 1 3"), {1, 3})
        self.assertIsNone(self._apply("merge everything"))
        self.assertIsNone(self._apply("go 1 2; also close 4"))

    def test_total_items_bounds_all(self):
        self.assertEqual(r.parse_approval("go all", 5), {1, 2, 3, 4, 5})


class CommandDispatchTests(unittest.TestCase):
    def test_table_routes(self):
        with mock.patch.object(r, "gather_renovate", return_value=[]), \
             mock.patch.object(r, "gather_ci_failures", return_value=[]), \
             mock.patch.object(r, "gather_security",
                               return_value={"dependabot": [], "codeql": [], "secret": []}), \
             mock.patch.object(r, "gather_bd_summary", return_value=(10, 2, 1)), \
             mock.patch.object(r, "gather_failed_runs", return_value=[]), \
             mock.patch.object(r, "gather_release_drafts", return_value=[]), \
             mock.patch.object(r, "gh_json", return_value=[]):
            for cmd in ("/status", "/prs", "/issues", "/security", "/deps",
                        "/runs", "/plans", "/releases", "/help", "status", "help"):
                out = r.handle_command(cmd)
                self.assertIsInstance(out, str)
                self.assertTrue(len(out) > 0, cmd)

    def test_unknown_gets_help(self):
        with mock.patch.object(r, "gather_renovate", return_value=[]):
            self.assertEqual(r.handle_command("tell me a joke"), r.HELP_TEXT)


class EndpointProbeTests(unittest.TestCase):
    def test_probe_formats_code_and_latency(self):
        class FakeResp:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        with mock.patch.object(r.urllib.request, "urlopen", return_value=FakeResp()), \
             mock.patch.object(r.time, "perf_counter", side_effect=[0.0, 0.250]):
            code, ms = r.probe_endpoint("https://example.com")
        self.assertEqual(code, 200)
        self.assertGreaterEqual(ms, 240)

    def test_probe_error_returns_down(self):
        with mock.patch.object(r.urllib.request, "urlopen",
                               side_effect=Exception("nope")):
            code, ms = r.probe_endpoint("https://example.com")
        self.assertEqual(code, 0)
        self.assertGreaterEqual(ms, 0)


class MetricsCoercionTests(unittest.TestCase):
    def test_coerce_snapshot_metrics(self):
        payload = {"overview": {"totals": {"downloads": 100, "success": 80,
                                           "fail": 15, "cancelled": 5},
                                "installs": {"usersTotal": 42}}}
        m = r.coerce_snapshot_metrics(payload)
        self.assertEqual(m["downloads"], 100)
        self.assertEqual(m["users"], 42)

    def test_coerce_garbage_is_safe(self):
        m = r.coerce_snapshot_metrics({"overview": None})
        self.assertEqual(m["downloads"], 0)
        self.assertEqual(m["users"], 0)
        m2 = r.coerce_snapshot_metrics(None)
        self.assertEqual(m2["downloads"], 0)


if __name__ == "__main__":
    unittest.main()


class SecurityAvailabilityTests(unittest.TestCase):
    def test_unavailable_is_not_all_clear(self):
        with mock.patch.object(r, "gather_security",
                               return_value={"dependabot": [], "codeql": [],
                                             "secret": [], "_unavailable": True}):
            out = r.fmt_security()
        self.assertIn("unavailable", out.lower())
        self.assertNotIn("all clear", out.lower())

    def test_clear_when_zero_and_available(self):
        with mock.patch.object(r, "gather_security",
                               return_value={"dependabot": [], "codeql": [],
                                             "secret": [], "_unavailable": False}):
            out = r.fmt_security()
        self.assertIn("all clear", out.lower())


class StatusLastBurstTests(unittest.TestCase):
    def test_status_mentions_last_burst_age(self):
        with mock.patch.object(r, "gather_renovate", return_value=[]), \
             mock.patch.object(r, "gather_ci_failures", return_value=[]), \
             mock.patch.object(r, "gather_security",
                               return_value={"dependabot": [], "codeql": [],
                                             "secret": [], "_unavailable": False}), \
             mock.patch.object(r, "gather_bd_summary", return_value=(1, 0, 0)), \
             mock.patch.object(r, "gather_failed_runs", return_value=[]), \
             mock.patch.object(r, "gather_release_drafts", return_value=[]), \
             mock.patch.object(r, "gh_json", return_value=[]), \
             mock.patch.object(r, "gather_endpoint_health", return_value=[]), \
             mock.patch.object(r, "gather_snapshot_metrics",
                               return_value={"downloads": 0, "success": 0,
                                             "fail": 0, "cancelled": 0, "users": 0}), \
             mock.patch.object(r, "read_last_run",
                               return_value=r.time.time() - 3600 * 5):
            out = r.fmt_status()
        self.assertIn("Last burst: 5h ago", out)
