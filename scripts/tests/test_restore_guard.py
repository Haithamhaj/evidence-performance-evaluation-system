import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CREATE = ROOT / "scripts" / "backup" / "create-engine-backup.mjs"
RESTORE = ROOT / "scripts" / "backup" / "restore-engine-backup.mjs"
VERIFY_RESTORE = ROOT / "scripts" / "backup" / "verify-restored-engine.mjs"


class RestoreGuardTest(unittest.TestCase):
    def test_rejects_production_without_direct_human_approval(self):
        result = subprocess.run(
            [
                "node",
                str(RESTORE),
                "--environment",
                "production",
                "--manifest",
                "/not-used/manifest.json",
                "--key-file",
                "/not-used/key",
                "--target-dir",
                "/not-used/target",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("direct human approval required", result.stderr)

    def test_restores_and_verifies_only_an_isolated_target(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = root / "database.dump"
            objects = root / "objects.json"
            config = root / "config.json"
            key = root / "backup.key"
            backup = root / "backup"
            restored = root / "restored"
            database.write_bytes(b"synthetic protected database\n")
            objects.write_text(json.dumps([{"key": "private/a", "version": "v1"}]))
            config.write_text(
                json.dumps(
                    {
                        "schemaVersion": 37,
                        "integrityInventory": {
                            "auditChain": 2,
                            "foreignKeys": 7,
                            "closedEvaluations": 1,
                            "upwardResponses": 1,
                            "evidenceSources": 3,
                            "responsibilityWindows": 2,
                            "delegationWindows": 1,
                        },
                    }
                )
            )
            key.write_bytes(os.urandom(32))
            create = subprocess.run(
                [
                    "node",
                    str(CREATE),
                    "--target-dir",
                    str(backup),
                    "--database-dump",
                    str(database),
                    "--object-inventory",
                    str(objects),
                    "--config-inventory",
                    str(config),
                    "--key-file",
                    str(key),
                    "--key-reference",
                    "local-drill-key",
                    "--created-at",
                    "2026-08-07T00:00:00.000Z",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
            )
            self.assertEqual(create.returncode, 0, create.stderr)

            restore = subprocess.run(
                [
                    "node",
                    str(RESTORE),
                    "--environment",
                    "local-isolated",
                    "--manifest",
                    str(backup / "manifest.json"),
                    "--key-file",
                    str(key),
                    "--target-dir",
                    str(restored),
                    "--approval-reference",
                    "local-drill-approved",
                    "--maintenance-mode",
                    "enabled",
                    "--safety-backup-reference",
                    "local-safety-backup",
                    "--connectors",
                    "disabled",
                    "--queue-replay",
                    "disabled",
                    "--expected-schema-version",
                    "37",
                    "--now",
                    "2026-08-07T01:00:00.000Z",
                    "--max-age-hours",
                    "24",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
            )
            self.assertEqual(restore.returncode, 0, restore.stderr)

            verify = subprocess.run(
                ["node", str(VERIFY_RESTORE), "--target-dir", str(restored)],
                cwd=ROOT,
                capture_output=True,
                text=True,
            )
            self.assertEqual(verify.returncode, 0, verify.stderr)
            self.assertEqual(json.loads(verify.stdout)["status"], "VERIFIED")


if __name__ == "__main__":
    unittest.main()
