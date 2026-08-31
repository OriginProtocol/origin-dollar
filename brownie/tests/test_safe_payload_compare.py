import importlib.util
import json
import pathlib
import tempfile
import unittest


PATH = pathlib.Path(__file__).parents[1] / "compare_safe_batches.py"
SPEC = importlib.util.spec_from_file_location("compare_safe_batches", PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SafePayloadComparisonTest(unittest.TestCase):
    def write(self, payload):
        file = tempfile.NamedTemporaryFile(mode="w", delete=False)
        json.dump(payload, file)
        file.close()
        self.addCleanup(pathlib.Path(file.name).unlink)
        return file.name

    def payload(self, data="0x1234", created_at=1, gas=100):
        return {
            "chainId": "1",
            "createdAt": created_at,
            "meta": {"gas": gas},
            "transactions": [
                {
                    "to": "0x000000000000000000000000000000000000ABCD",
                    "value": "0",
                    "data": data,
                    "gas": gas,
                }
            ],
        }

    def test_ignores_metadata_and_gas(self):
        MODULE.compare(
            self.write(self.payload(created_at=1, gas=100)),
            self.write(self.payload(created_at=2, gas=200)),
        )

    def test_rejects_changed_transaction_data(self):
        with self.assertRaisesRegex(AssertionError, "Safe payload mismatch"):
            MODULE.compare(
                self.write(self.payload(data="0x1234")),
                self.write(self.payload(data="0xabcd")),
            )


if __name__ == "__main__":
    unittest.main()
