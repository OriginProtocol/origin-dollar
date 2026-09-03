// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Harvest} from "tests/utils/artifacts/Harvest.sol";

// --- Project imports
import {IFeeSplitter} from "contracts/interfaces/IFeeSplitter.sol";
import {MockRebasingToken} from "tests/mocks/MockRebasingToken.sol";

abstract contract Unit_FeeSplitter_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    IFeeSplitter internal feeSplitter;
    MockRebasingToken internal ousd;
    MockRebasingToken internal oeth;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    address internal operationsWallet;
    address internal harvester;

    uint16 internal constant OPERATIONS_BPS = 2000; // 20% ops / 80% buyback
    uint256 internal constant MIN_DISTRIBUTE_OUSD = 20e18;
    uint256 internal constant MIN_DISTRIBUTE_OETH = 0.01e18;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        operationsWallet = makeAddr("OperationsWallet");
        harvester = makeAddr("Harvester");

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        ousd = new MockRebasingToken("Origin Dollar", "OUSD", 18);
        oeth = new MockRebasingToken("Origin Ether", "OETH", 18);

        // Governable sets the deployer as governor, so this test contract
        // configures the splitter and then hands over, mirroring the deploy
        // script's sequence.
        feeSplitter = IFeeSplitter(vm.deployCode(Harvest.FEE_SPLITTER));

        feeSplitter.setOperationsBps(OPERATIONS_BPS);
        feeSplitter.setOperationsWallet(operationsWallet);
        feeSplitter.setHarvester(harvester);
        feeSplitter.setOperatorAddr(operator);
        feeSplitter.addAsset(address(ousd), MIN_DISTRIBUTE_OUSD);
        feeSplitter.addAsset(address(oeth), MIN_DISTRIBUTE_OETH);
        feeSplitter.optIntoRebase(address(ousd));
        feeSplitter.optIntoRebase(address(oeth));
        feeSplitter.setStrategistAddr(strategist);

        feeSplitter.transferGovernance(governor);
        vm.prank(governor);
        feeSplitter.claimGovernance();
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _expectedSplit(uint256 balance) internal pure returns (uint256 opsAmount, uint256 buybackAmount) {
        opsAmount = (balance * OPERATIONS_BPS) / 1e4;
        buybackAmount = balance - opsAmount;
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(feeSplitter), "FeeSplitter");
        vm.label(address(ousd), "OUSD");
        vm.label(address(oeth), "OETH");
        vm.label(operationsWallet, "OperationsWallet");
        vm.label(harvester, "Harvester");
    }
}
