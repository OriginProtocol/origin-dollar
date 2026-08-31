import importlib.util
import pathlib
import sys
import types
import unittest


class Provider:
    def __init__(self):
        self.calls = []

    def make_request(self, method, params):
        self.calls.append((method, params))
        return {"result": True}


class AnvilRpcTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.provider = Provider()
        brownie = types.ModuleType("brownie")
        setattr(
            brownie,
            "network",
            types.SimpleNamespace(web3=types.SimpleNamespace(provider=cls.provider)),
        )
        addresses = types.ModuleType("addresses")
        setattr(addresses, "STRATEGIST", "0x0000000000000000000000000000000000000001")
        setattr(
            addresses,
            "OETHB_STRATEGIST",
            "0x0000000000000000000000000000000000000002",
        )
        eth_abi = types.ModuleType("eth_abi")
        setattr(eth_abi, "abi", types.SimpleNamespace())
        sys.modules.update(
            {"brownie": brownie, "addresses": addresses, "eth_abi": eth_abi}
        )
        path = pathlib.Path(__file__).parents[1] / "world_abstract.py"
        spec = importlib.util.spec_from_file_location("world_abstract_under_test", path)
        assert spec is not None and spec.loader is not None
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def setUp(self):
        self.provider.calls.clear()

    def test_unlock_uses_anvil_impersonation(self):
        address = "0x0000000000000000000000000000000000001234"
        self.module.unlock(address)
        self.assertEqual(
            self.provider.calls,
            [("anvil_impersonateAccount", [address])],
        )

    def test_fund_eth_encodes_integer_as_rpc_quantity(self):
        address = "0x0000000000000000000000000000000000001234"
        self.module.fund_eth(address, 10**18)
        self.assertEqual(
            self.provider.calls,
            [("anvil_setBalance", [address, hex(10**18)])],
        )


if __name__ == "__main__":
    unittest.main()
