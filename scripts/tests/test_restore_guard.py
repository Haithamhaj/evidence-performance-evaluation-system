import json
import base64
import hashlib
import os
import subprocess
import tempfile
import unittest
import uuid
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
        source_database_url = os.environ.get(
            "TEST_DATABASE_URL",
            "postgresql://evaluation_test:local-evaluation-test-password@127.0.0.1:5432/evaluation_test",
        )
        admin_database_url = os.environ.get(
            "POSTGRES_ADMIN_DATABASE_URL",
            "postgresql://postgres:local-postgres-password@127.0.0.1:5432/postgres",
        )
        target_database_name = f"ebpes_restore_{uuid.uuid4().hex}"
        target_database_url = (
            "postgresql://postgres:local-postgres-password@127.0.0.1:5432/"
            f"{target_database_name}"
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = root / "database.dump"
            objects = root / "objects.json"
            config = root / "config.json"
            key = root / "backup.key"
            backup = root / "backup"
            restored = root / "restored"
            object_content = b"encrypted-bundle object restored locally"
            objects.write_text(
                json.dumps(
                    [
                        {
                            "key": "private/a.txt",
                            "version": "v1",
                            "sha256": hashlib.sha256(object_content).hexdigest(),
                            "contentBase64": base64.b64encode(object_content).decode("ascii"),
                        }
                    ]
                )
            )
            config.write_text(
                json.dumps(
                    {
                        "schemaVersion": 38,
                        "configurationVersion": "e6c-local-restore-test",
                    }
                )
            )
            key.write_bytes(os.urandom(32))
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

            try:
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
                        "38",
                        "--admin-database-url",
                        admin_database_url,
                        "--target-database-url",
                        target_database_url,
                        "--postgres-container",
                        postgres_container,
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
                    [
                        "node",
                        str(VERIFY_RESTORE),
                        "--target-dir",
                        str(restored),
                        "--target-database-url",
                        target_database_url,
                        "--postgres-container",
                        postgres_container,
                    ],
                    cwd=ROOT,
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(verify.returncode, 0, verify.stderr)
                receipt = json.loads(verify.stdout)
                self.assertEqual(receipt["status"], "VERIFIED")
                self.assertTrue(receipt["databaseRestored"])
                self.assertEqual(
                    (restored / "objects" / "private" / "a.txt").read_bytes(),
                    object_content,
                )
            finally:
                subprocess.run(
                    [
                        "docker",
                        "exec",
                        "-u",
                        "postgres",
                        postgres_container,
                        "psql",
                        "--dbname",
                        "postgres",
                        "--set",
                        "ON_ERROR_STOP=1",
                        "--command",
                        (
                            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                            f"WHERE datname = '{target_database_name}' AND pid <> pg_backend_pid(); "
                            f'DROP DATABASE IF EXISTS "{target_database_name}";'
                        ),
                    ],
                    cwd=ROOT,
                    capture_output=True,
                    text=True,
                )


if __name__ == "__main__":
    unittest.main()
