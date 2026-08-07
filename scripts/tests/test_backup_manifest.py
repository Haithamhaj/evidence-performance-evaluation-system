import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CREATE = ROOT / "scripts" / "backup" / "create-engine-backup.mjs"
VERIFY = ROOT / "scripts" / "backup" / "verify-engine-backup.mjs"


class BackupManifestTest(unittest.TestCase):
    def test_creates_and_verifies_secret_free_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = root / "database.dump"
            objects = root / "objects.json"
            config = root / "config.json"
            key = root / "backup.key"
            target = root / "backup"
            database.write_bytes(b"synthetic database dump\n")
            objects.write_text(json.dumps([{"key": "evidence/a", "version": "v1"}]))
            config.write_text(json.dumps({"schemaVersion": 1, "versions": ["rubric-v1"]}))
            key.write_bytes(os.urandom(32))

            create = subprocess.run(
                [
                    "node",
                    str(CREATE),
                    "--target-dir",
                    str(target),
                    "--database-dump",
                    str(database),
                    "--object-inventory",
                    str(objects),
                    "--config-inventory",
                    str(config),
                    "--key-file",
                    str(key),
                    "--key-reference",
                    "local-test-key",
                    "--created-at",
                    "2026-08-07T00:00:00.000Z",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
            )
            self.assertEqual(create.returncode, 0, create.stderr)

            manifest_path = target / "manifest.json"
            manifest = json.loads(manifest_path.read_text())
            self.assertEqual(manifest["schemaVersion"], 1)
            self.assertIn("databaseSha256", manifest)
            self.assertIn("encryptedBundleSha256", manifest)
            self.assertEqual(manifest["encryption"]["keyReference"], "local-test-key")
            self.assertNotIn("databasePassword", json.dumps(manifest))
            self.assertNotIn(str(key), json.dumps(manifest))
            self.assertNotIn("synthetic database dump", json.dumps(manifest))

            verify = subprocess.run(
                [
                    "node",
                    str(VERIFY),
                    "--manifest",
                    str(manifest_path),
                    "--key-file",
                    str(key),
                    "--now",
                    "2026-08-07T01:00:00.000Z",
                    "--max-age-hours",
                    "24",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
            )
            self.assertEqual(verify.returncode, 0, verify.stderr)
            result = json.loads(verify.stdout)
            self.assertEqual(result["status"], "VERIFIED")


if __name__ == "__main__":
    unittest.main()
