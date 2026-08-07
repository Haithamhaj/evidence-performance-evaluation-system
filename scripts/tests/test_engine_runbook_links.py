import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DOCUMENTS = [
    ROOT / "docs" / "operations" / "EXTERNAL_GATE_REGISTER.md",
    ROOT / "docs" / "runbooks" / "INCIDENT_RESPONSE.md",
    ROOT / "docs" / "runbooks" / "CONNECTOR_REVOCATION.md",
    ROOT / "docs" / "runbooks" / "QUEUE_REPLAY.md",
    ROOT / "docs" / "runbooks" / "EXPORT_REVOCATION.md",
    ROOT / "docs" / "runbooks" / "DEPLOYMENT_ROLLBACK.md",
]


class EngineRunbookLinkTest(unittest.TestCase):
    def test_local_runbook_links_resolve(self):
        for document in DOCUMENTS:
            self.assertTrue(document.exists(), f"missing required runbook: {document}")
            text = document.read_text()
            for target in re.findall(r"\[[^]]+\]\(([^)]+)\)", text):
                if target.startswith(("http://", "https://", "#")):
                    continue
                resolved = (document.parent / target.split("#", 1)[0]).resolve()
                self.assertTrue(resolved.exists(), f"broken link in {document}: {target}")


if __name__ == "__main__":
    unittest.main()

