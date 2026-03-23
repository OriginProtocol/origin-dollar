// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NativeStakingSSVStrategy} from "contracts/strategies/NativeStaking/NativeStakingSSVStrategy.sol";
import {ValidatorStakeData} from "contracts/strategies/NativeStaking/ValidatorRegistrator.sol";
import {ValidatorAccountant} from "contracts/strategies/NativeStaking/ValidatorAccountant.sol";
import {ValidatorRegistrator} from "contracts/strategies/NativeStaking/ValidatorRegistrator.sol";
import {FeeAccumulator} from "contracts/strategies/NativeStaking/FeeAccumulator.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {ISSVNetwork, Cluster} from "contracts/interfaces/ISSVNetwork.sol";
import {OETHHarvesterSimple} from "contracts/harvest/OETHHarvesterSimple.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

import {Vm} from "forge-std/Vm.sol";

abstract contract Fork_NativeStakingSSVStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    ISSVNetwork internal ssvNetwork;
    IERC20 internal ssv;
    OETHHarvesterSimple internal harvester;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal validatorRegistratorAddr;
    address internal stakingMonitorAddr;
    address internal strategistAddr;
    address internal feeAccumulatorAddr;

    //////////////////////////////////////////////////////
    /// --- TEST VALIDATOR DATA (Strategy 2, operators [752, 753, 754, 755])
    //////////////////////////////////////////////////////

    // solhint-disable-next-line max-line-length
    bytes internal constant TEST_VALIDATOR_PUBKEY =
        hex"ae24289bd670bfbdd3bc904596b475d080dde3415506f1abe1fb76ff292ff6bd743d710061b9e2b16fd8541a76fe53ee";

    uint64[4] internal TEST_OPERATOR_IDS = [uint64(752), uint64(753), uint64(754), uint64(755)];

    // solhint-disable-next-line max-line-length
    bytes internal constant TEST_SHARES_DATA =
        hex"b2cff426a8898f801feed0e3efb1d036def14590809426995df98ad243c0927987c0f207a3c2d9b48d47a0ceec80eb2d0b1839d84ab1a2d75fd48aaf4a859ab8d2ae776b55f64e2c40733a44697c924882a5a8688790ec4203b8847a61e84803a8252f2a2812ec9854b381fc12a222ea8764e07084c8a7873426f62a43ca1b88dfa258713a5ff7749290add650843533a5b2a8430c1cf5e476d5498736b384464db057b05f8a120c4a08b84dfb8a9c2c6adfdcb5660386cd582c610eb06422628dfc08496bf0edfffc6e1e05964c710a104ed6c2d700c823243fce8a3c76575ca1618113e036498f839830c5d24d604ab13769367f9467b8f3771082a29a8ce96194da370a0550ce5d09975590ba5e1fa154382ba0bc2d7ebd7fd2192978998d53d845103bbfa2f8f3680245b005bc802109ea6a8449fce0fffcfa712cc8bbf6672eda7bbfd209644190a1c383faac861aad1534f50acd7c58104c4ad27e0b6d4b44c80e52ede1b0f066cae285e193f356f193872d40586020c75a68c011d2ca172126139d1728985c9ca9b76db5639ec0d265b9bf239ad3ed94a55709442031b18db6fd430b25138b1d7a17484cde1433e8d5837c3c806630135187d27261991e94f84d3ceb1fc2eaa44042cc09f10cea84b0ef6a00cb07aebdd7df6a4e14fd6efce5954d19219efd3419c338a6fa9644db5fdeb5b226cc008c0599f0c02bf3c99c74ff80e5ea2c2d0e47304ee21dfdf870599288dedd0977711af5cc467179765df58b0a489c906d85f5855c1d7359cab73e22229f354d9f9e0a1e623d9264988df14da8b710dfe42a895cbdc10ac25bd0d3412e9c90a632c8f1890b3d412bf6756367893f800b8895f000645fb56bf1b956cca68ee19238e64047b4b75be13c0316c5a220af0e28f0d9948fd74b7e261cddb0e79f80349686a0089a9d50baa79bdccd4ac9392ec857530456a9f7302ca091a640feb4a6f1c31c1c6fd1847e20986d2e87f84a01522d3004ddf002c56d5e9549eca04ce3738b8bc5a7e239c967906305d820f6a3b8f1f6a61af7fcdfabd935d068f8cd0cc58c84dc120ef20df1ea492c70937282a9e5a0857511ab7c6d6300947da3f0f7fa4d022453163c1d82e78b15182d9a2878fb96ba0f08a71288772249f52a34dff4b7ae106bb76055e05309c4701abdf685d68163d0a705b162e91c409c7d8c386dc24f2d7c01c150017b365c6d72304f082d4030057917fb55a927ed5a6150e9e70a8b12cfadca1bfba0e85f694c946ef781fb8344285c28adc2e358513ed9ec2a1fb80935de88ec2cdac6e0d538e25043716ec8b29c157fb41a3d887c2025ffc71b414b977f9b81c497ee8bd9db042d4121dc4a8c5220a0f438dbdcde55580fb8c8b3aec3a53ffe958056653fd9bf58aa3b060a99c38c94035a27a6bfd66767965090526f1f403f7332914d2726d2f2bdd979895031a1afad4e112d4471193080e13a301e7a6ad24a217d94a5c964a6118dbcc9b2dfd3a0180189c0ca4dee3e8d24a18b904e826e324256d478deb66b9b47cdb65de2a2b951787dad3536a839b230313d6fd202364a8a3a0ce033fb8bf6a32d4b7c94af54f5ca7d861497d50a593606437f7420485ccda17977eb495967f700ef4bcc9f8d2c2ed4933b26418768b31ae02a0ca2fbaa7b63f349619278bac3f3ef5796c669c3ecb9ed19f2ffa453b4801f4ac78938a11c8e7a778a7ae8e5813dd93414b1b9912e4466519216ac58a6b538d03128feee6235adef2ecc57d9b2d9fec719fb8c8aac0bd7f491860658e8f32ee6285c264c843c6142d578abfc9bab330355bed41a12862669f0b88f894cce277bcdbd94";

    // This signature isn't correct but will do for testing
    // solhint-disable-next-line max-line-length
    bytes internal constant TEST_SIGNATURE =
        hex"90157a1c1b26384f0b4d41bec867d1a000f75e7b634ac7c4c6d8dfc0b0eaeb73bcc99586333d42df98c6b0a8c5ef0d8d071c68991afcd8fbbaa8b423e3632ee4fe0782bc03178a30a8bc6261f64f84a6c833fb96a0f29de1c34ede42c4a859b0";

    bytes32 internal constant TEST_DEPOSIT_DATA_ROOT =
        0x6f9cc503009ceb0960637bbf2482b19a62153144ab091f0b9f66d5800f02cc2c;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        // TODO: SSV Network migrated from SSV-token to ETH-based payments.
        // The on-chain strategy proxy (0x4685...) was upgraded to a new implementation
        // where `registerSsvValidators` lost its `ssvAmount` parameter and became `payable`,
        // and `depositSSV`/`withdrawSSV` were removed. Our source code still has the old
        // interface, causing selector mismatches against the latest block.
        // See plan in contracts for the full migration steps.
        vm.skip(true);

        super.setUp();

        _createAndSelectForkMainnet();
        _loadForkContracts();
        _fundTestAccounts();
        _labelContracts();
    }

    function _loadForkContracts() internal {
        // Strategy 2
        nativeStakingSSVStrategy = NativeStakingSSVStrategy(payable(Mainnet.NativeStakingSSVStrategy2Proxy));
        nativeStakingFeeAccumulator = FeeAccumulator(payable(nativeStakingSSVStrategy.FEE_ACCUMULATOR_ADDRESS()));
        oeth = OETH(Mainnet.OETHProxy);
        oethVault = OETHVault(payable(Mainnet.OETHVaultProxy));

        ssvNetwork = ISSVNetwork(Mainnet.SSVNetwork);
        ssv = IERC20(Mainnet.SSV);
        weth = IERC20(Mainnet.WETH);
        harvester = OETHHarvesterSimple(Mainnet.OETHHarvesterSimpleProxy);

        // Read on-chain addresses
        validatorRegistratorAddr = nativeStakingSSVStrategy.validatorRegistrator();
        stakingMonitorAddr = nativeStakingSSVStrategy.stakingMonitor();
        strategistAddr = IVault(address(oethVault)).strategistAddr();
        feeAccumulatorAddr = address(nativeStakingFeeAccumulator);
    }

    function _fundTestAccounts() internal {
        deal(Mainnet.WETH, domen, 1_000 ether);
    }

    function _labelContracts() internal {
        vm.label(address(nativeStakingSSVStrategy), "NativeStakingSSVStrategy2");
        vm.label(address(nativeStakingFeeAccumulator), "FeeAccumulator");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(ssvNetwork), "SSVNetwork");
        vm.label(address(ssv), "SSV");
        vm.label(address(weth), "WETH");
        vm.label(address(harvester), "OETHHarvesterSimple");
        vm.label(validatorRegistratorAddr, "ValidatorRegistrator");
        vm.label(stakingMonitorAddr, "StakingMonitor");
        vm.label(strategistAddr, "Strategist");
        vm.label(feeAccumulatorAddr, "FeeAccumulatorAddr");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deposit WETH to strategy via the vault's depositToStrategy
    function _depositToStrategy(uint256 amount) internal {
        // Vault needs: assetBalance > outstandingWithdrawals + amount
        // (the check is amount <= assetBalance - outstandingWithdrawals)
        uint256 vaultWethBalance = weth.balanceOf(address(oethVault));
        (uint128 queued,, uint128 claimed,) = oethVault.withdrawalQueueMetadata();
        uint256 outstandingWithdrawals = uint256(queued) - uint256(claimed);
        // Need vaultWethBalance + transferAmount > outstandingWithdrawals + amount
        uint256 needed = outstandingWithdrawals + amount;
        if (vaultWethBalance < needed + 1) {
            uint256 transferAmount = needed + 1 - vaultWethBalance;
            deal(Mainnet.WETH, domen, weth.balanceOf(domen) + transferAmount);
            vm.prank(domen);
            weth.transfer(address(oethVault), transferAmount);
        }

        address[] memory assets = new address[](1);
        assets[0] = address(weth);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        vm.prank(strategistAddr);
        oethVault.depositToStrategy(address(nativeStakingSSVStrategy), assets, amounts);
    }

    /// @dev Register validator on SSV and stake 32 ETH. Returns updated cluster.
    function _registerAndStakeEth() internal returns (Cluster memory) {
        uint256 strategyWethBalanceBefore = weth.balanceOf(address(nativeStakingSSVStrategy));

        // Get current cluster state
        Cluster memory cluster = _getCluster();

        // Deal SSV tokens to strategy for registration fees
        deal(address(ssv), address(nativeStakingSSVStrategy), 1_000 ether);

        // Verify initial state is NON_REGISTERED
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(TEST_VALIDATOR_PUBKEY))),
            0,
            "Validator state not 0 (NON_REGISTERED)"
        );

        // Build arrays for registerSsvValidators
        bytes[] memory pubkeys = new bytes[](1);
        pubkeys[0] = TEST_VALIDATOR_PUBKEY;
        bytes[] memory sharesData = new bytes[](1);
        sharesData[0] = TEST_SHARES_DATA;
        uint64[] memory operatorIds = _getTestOperatorIds();

        // Record logs to capture ValidatorAdded event
        vm.recordLogs();

        // Register validator with SSV Network
        vm.prank(validatorRegistratorAddr);
        nativeStakingSSVStrategy.registerSsvValidators(pubkeys, operatorIds, sharesData, cluster);

        // Extract updated cluster from ValidatorAdded event
        Cluster memory updatedCluster = _extractClusterFromLogs();

        // Verify state is REGISTERED
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(TEST_VALIDATOR_PUBKEY))),
            1,
            "Validator state not 1 (REGISTERED)"
        );

        // Stake 32 ETH
        ValidatorStakeData[] memory stakeData = new ValidatorStakeData[](1);
        stakeData[0] = ValidatorStakeData({
            pubkey: TEST_VALIDATOR_PUBKEY, signature: TEST_SIGNATURE, depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });

        vm.prank(validatorRegistratorAddr);
        nativeStakingSSVStrategy.stakeEth(stakeData);

        // Verify state is STAKED
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(TEST_VALIDATOR_PUBKEY))),
            2,
            "Validator state not 2 (STAKED)"
        );

        // Verify WETH decreased by 32 ETH
        assertEq(
            weth.balanceOf(address(nativeStakingSSVStrategy)),
            strategyWethBalanceBefore - 32 ether,
            "strategy WETH not decreased"
        );

        return updatedCluster;
    }

    /// @dev Reset the stake ETH tally by pranking the staking monitor
    function _resetStakeETHTally() internal {
        vm.prank(stakingMonitorAddr);
        nativeStakingSSVStrategy.resetStakeETHTally();
    }

    /// @dev Returns hardcoded cluster data for operators [752, 753, 754, 755].
    /// Fetched from SSV API:
    ///   curl "https://api.ssv.network/api/v4/mainnet/clusters/owner/0x4685dB8bF2Df743c861d71E6cFb5347222992076/operators/752%2C753%2C754%2C755"
    /// If fork block changes significantly, refresh this data from the API.
    function _getCluster() internal pure returns (Cluster memory) {
        return Cluster({
            validatorCount: 485,
            networkFeeIndex: 416695837505,
            index: 9585132,
            active: true,
            balance: 661293212143542776597
        });
    }

    /// @dev Returns the test operator IDs as a dynamic array
    function _getTestOperatorIds() internal view returns (uint64[] memory) {
        uint64[] memory ids = new uint64[](4);
        ids[0] = TEST_OPERATOR_IDS[0];
        ids[1] = TEST_OPERATOR_IDS[1];
        ids[2] = TEST_OPERATOR_IDS[2];
        ids[3] = TEST_OPERATOR_IDS[3];
        return ids;
    }

    /// @dev Parse ValidatorAdded event from recorded logs to extract the updated Cluster.
    /// The ValidatorAdded event signature:
    ///   ValidatorAdded(address indexed owner, uint64[] operatorIds, bytes publicKey, bytes shares, Cluster cluster)
    function _extractClusterFromLogs() internal returns (Cluster memory) {
        bytes32 validatorAddedTopic =
            keccak256("ValidatorAdded(address,uint64[],bytes,bytes,(uint32,uint64,uint64,bool,uint256))");

        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == validatorAddedTopic) {
                // Decode the non-indexed data: (uint64[] operatorIds, bytes publicKey, bytes shares, Cluster cluster)
                (,,, Cluster memory cluster) = abi.decode(logs[i].data, (uint64[], bytes, bytes, Cluster));
                return cluster;
            }
        }
        revert("ValidatorAdded event not found in logs");
    }
}
