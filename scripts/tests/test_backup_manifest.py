import json
import base64
import hashlib
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
            source_database_url = os.environ.get(
                "TEST_DATABASE_URL",
                "postgresql://evaluation_test:local-evaluation-test-password@127.0.0.1:5432/evaluation_test",
            )
            postgres_container = os.environ.get(
                "POSTGRES_TOOL_CONTAINER", "evaluation-system-postgres-1"
            )
            dump = subprocess.run(
                [
                    "docker",
                    "exec",
                    "-u",
                    "postgres",
                    postgres_container,
                    "pg_dump",
                    "--format=custom",
                    "--no-owner",
                    "--no-privileges",
                    "--dbname",
                    "evaluation_test",
                ],
                cwd=ROOT,
                capture_output=True,
            )
            self.assertEqual(dump.returncode, 0, dump.stderr.decode("utf-8"))
            database.write_bytes(dump.stdout)
            object_content = b"backup manifest object"
            objects.write_text(
                json.dumps(
                    [
                        {
                            "key": "evidence/a.txt",
                            "version": "v1",
                            "sha256": hashlib.sha256(object_content).hexdigest(),
                            "contentBase64": base64.b64encode(object_content).decode("ascii"),
                        }
                    ]
                )
            )
            config.write_text(json.dumps({"schemaVersion": 38, "versions": ["rubric-v1"]}))
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
                    "--source-database-url",
                    source_database_url,
                    "--postgres-container",
                    postgres_container,
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
            self.assertIn("protectedIntegritySha256", manifest)
            self.assertEqual(manifest["encryption"]["keyReference"], "local-test-key")
            self.assertNotIn("databasePassword", json.dumps(manifest))
            self.assertNotIn(str(key), json.dumps(manifest))
            self.assertNotIn("backup manifest object", json.dumps(manifest))

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
