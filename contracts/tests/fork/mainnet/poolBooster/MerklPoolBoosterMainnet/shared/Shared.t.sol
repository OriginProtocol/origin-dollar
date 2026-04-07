// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";
import {IPoolBoosterFactoryMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterFactoryMerkl.sol";
import {IPoolBoosterMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterMerkl.sol";
import {IMerklDistributor} from "contracts/interfaces/poolBooster/IMerklDistributor.sol";

import {Mainnet} from "tests/utils/Addresses.sol";

interface IMerklDistributorAdmin {
    function setRewardTokenMinAmounts(address[] calldata tokens, uint256[] calldata amounts) external;
}

abstract contract Fork_MerklPoolBoosterMainnet_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IERC20 internal oeth;
    IPoolBoostCentralRegistryFull internal centralRegistry;
    IPoolBoosterFactoryMerkl internal factoryMerkl;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    uint32 internal constant DEFAULT_CAMPAIGN_ID = 12;
    uint32 internal constant DEFAULT_DURATION = 86400;
    address internal constant DEFAULT_AMM_ADDRESS = 0x4c0AF5d6Bcb10B3C05FB5F3a846999a3d87534C7;
    bytes internal constant DEFAULT_CAMPAIGN_DATA = hex"c0c0c0";

    //////////////////////////////////////////////////////
    /// --- LOCAL VARIABLES
    //////////////////////////////////////////////////////

    IMerklDistributor internal merklDistributor;
    UpgradeableBeacon internal beacon;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _deployFreshContracts();
        _ensureTokenApproved();
        _labelContracts();
    }

    function _deployFreshContracts() internal {
        // 1. Deploy fresh MockERC20 as OETH
        oeth = IERC20(address(new MockERC20("Origin Ether", "OETH", 18)));

        // 2. Deploy PoolBoostCentralRegistry and set governor via storage slot
        centralRegistry = IPoolBoostCentralRegistryFull(
            vm.deployCode("contracts/poolBooster/PoolBoostCentralRegistry.sol:PoolBoostCentralRegistry")
        );
        vm.store(address(centralRegistry), GOVERNOR_SLOT, bytes32(uint256(uint160(Mainnet.Timelock))));

        // 3. Deploy beacon + factory
        address impl = vm.deployCode("contracts/poolBooster/PoolBoosterMerklV2.sol:PoolBoosterMerklV2");
        beacon = new UpgradeableBeacon(impl);

        factoryMerkl = IPoolBoosterFactoryMerkl(
            vm.deployCode(
                "contracts/poolBooster/PoolBoosterFactoryMerkl.sol:PoolBoosterFactoryMerkl",
                abi.encode(address(oeth), Mainnet.Timelock, address(centralRegistry), address(beacon))
            )
        );

        // 4. Approve factory on registry
        vm.prank(Mainnet.Timelock);
        centralRegistry.approveFactory(address(factoryMerkl));

        // 5. Set up Merkl distributor reference
        merklDistributor = IMerklDistributor(Mainnet.CampaignCreator);
    }

    function _ensureTokenApproved() internal {
        // Approve mock OETH on Merkl Distributor using the Merkl owner
        // On mainnet the owner is the same address as on Sonic
        address merklOwner = 0xA9DdD91249DFdd450E81E1c56Ab60E1A62651701;

        address[] memory tokens = new address[](1);
        tokens[0] = address(oeth);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1e18;

        vm.prank(merklOwner);
        IMerklDistributorAdmin(Mainnet.CampaignCreator).setRewardTokenMinAmounts(tokens, amounts);
    }

    function _labelContracts() internal {
        vm.label(address(oeth), "OETH (MockERC20)");
        vm.label(address(centralRegistry), "CentralRegistry");
        vm.label(address(factoryMerkl), "FactoryMerkl");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _dealOETH(address _to, uint256 _amount) internal {
        MockERC20(address(oeth)).mint(_to, _amount);
    }

    function _defaultInitData() internal view returns (bytes memory) {
        return abi.encodeWithSelector(
            IPoolBoosterMerkl.initialize.selector,
            DEFAULT_DURATION,
            DEFAULT_CAMPAIGN_ID,
            address(oeth),
            Mainnet.CampaignCreator,
            Mainnet.Timelock,
            Mainnet.Timelock, // strategist = timelock for simplicity
            DEFAULT_CAMPAIGN_DATA
        );
    }

    function _createMerklBooster(uint256 _salt) internal returns (IPoolBoosterMerkl) {
        vm.prank(Mainnet.Timelock);
        factoryMerkl.createPoolBoosterMerkl(DEFAULT_AMM_ADDRESS, _defaultInitData(), _salt);

        uint256 count = factoryMerkl.poolBoosterLength();
        (address boosterAddr,,) = factoryMerkl.poolBoosters(count - 1);
        return IPoolBoosterMerkl(boosterAddr);
    }
}
