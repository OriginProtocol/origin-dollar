// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NativeStakingSSVStrategy} from "contracts/strategies/NativeStaking/NativeStakingSSVStrategy.sol";
import {CompoundingStakingSSVStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingSSVStrategy.sol";
import {CompoundingValidatorManager} from "contracts/strategies/NativeStaking/CompoundingValidatorManager.sol";
import {ConsolidationController} from "contracts/strategies/NativeStaking/ConsolidationController.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {ISSVNetwork, Cluster} from "contracts/interfaces/ISSVNetwork.sol";
import {MockBeaconRoots} from "contracts/mocks/beacon/MockBeaconRoots.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

// solhint-disable max-states-count

abstract contract Fork_ConsolidationController_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    // 5 million wei should cover the fee when there is a high number of requests
    uint256 internal constant CONSOLIDATION_FEE = 5e6;

    // 261 epochs * 32 slots/epoch * 12 seconds/slot = 100224 seconds
    uint256 internal constant MIN_CONSOLIDATION_PERIOD = 261 * 32 * 12;

    // SNAP_BALANCES_DELAY = 35 slots * 12 seconds = 420 seconds
    uint256 internal constant SNAP_DELAY = 35 * 12;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    OETH internal oeth;
    OETHVault internal oethVault;
    OETHProxy internal oethProxy;
    OETHVaultProxy internal oethVaultProxy;
    ConsolidationController internal consolidationController;
    CompoundingStakingSSVStrategy internal compoundingStakingSSVStrategy;
    NativeStakingSSVStrategy internal nativeStakingSSVStrategy2;
    NativeStakingSSVStrategy internal nativeStakingSSVStrategy3;
    MockBeaconRoots internal beaconRoots;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal validatorRegistratorAddr;
    address internal adminAddr; // Guardian (owner of ConsolidationController)

    //////////////////////////////////////////////////////
    /// --- SECOND CLUSTER DATA (operators [752, 753, 754, 755])
    //////////////////////////////////////////////////////

    uint64[4] internal SECOND_CLUSTER_OPERATOR_IDS = [uint64(752), uint64(753), uint64(754), uint64(755)];

    //////////////////////////////////////////////////////
    /// --- THIRD CLUSTER DATA (operators [338, 339, 340, 341])
    //////////////////////////////////////////////////////

    uint64[4] internal THIRD_CLUSTER_OPERATOR_IDS = [uint64(338), uint64(339), uint64(340), uint64(341)];

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _deployContracts();
        _resetValidatorStates();
        _labelContracts();
    }

    // solhint-disable-next-line function-max-lines
    function _deployContracts() internal {
        // Use real WETH from fork
        weth = IERC20(Mainnet.WETH);

        // Resolve actors
        validatorRegistratorAddr = Mainnet.validatorRegistrator;
        adminAddr = Mainnet.Guardian;

        // Fund test actors and test contract with ETH for msg.value calls
        vm.deal(adminAddr, 100 ether);
        vm.deal(validatorRegistratorAddr, 100 ether);
        vm.deal(address(this), 100 ether);
        vm.deal(josh, 100 ether);
        vm.deal(nick, 100 ether);

        // --- Deploy fresh OETH + OETHVault ---
        vm.startPrank(deployer);

        OETH oethImpl = new OETH();
        OETHVault oethVaultImpl = new OETHVault(Mainnet.WETH);

        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = OETH(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // --- Deploy fresh strategy implementations pointing to fresh vault ---

        // CompoundingStakingSSVStrategy implementation
        CompoundingStakingSSVStrategy compoundingImpl = new CompoundingStakingSSVStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig(address(0), address(oethVault)),
            Mainnet.WETH,
            Mainnet.SSVNetwork,
            Mainnet.beaconChainDepositContract,
            Mainnet.BeaconProofs,
            1606824023 // beaconChainGenesisTimeMainnet
        );

        // NativeStakingSSVStrategy implementations (one per cluster)
        NativeStakingSSVStrategy nativeImpl2 = new NativeStakingSSVStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig(address(0), address(oethVault)),
            Mainnet.WETH,
            Mainnet.SSV,
            Mainnet.SSVNetwork,
            500,
            Mainnet.NativeStakingFeeAccumulator2Proxy,
            Mainnet.beaconChainDepositContract
        );
        NativeStakingSSVStrategy nativeImpl3 = new NativeStakingSSVStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig(address(0), address(oethVault)),
            Mainnet.WETH,
            Mainnet.SSV,
            Mainnet.SSVNetwork,
            500,
            Mainnet.NativeStakingFeeAccumulator3Proxy,
            Mainnet.beaconChainDepositContract
        );

        // ConsolidationController
        consolidationController = new ConsolidationController(
            adminAddr, // owner = Guardian
            validatorRegistratorAddr,
            Mainnet.NativeStakingSSVStrategy2Proxy,
            Mainnet.NativeStakingSSVStrategy3Proxy,
            Mainnet.CompoundingStakingSSVStrategyProxy
        );

        // --- Upgrade existing strategy proxies to new implementations ---
        // (preserves SSV validator state on the proxies)
        address timelockAddr = Mainnet.Timelock;
        vm.deal(timelockAddr, 1 ether);
        vm.startPrank(timelockAddr);

        InitializeGovernedUpgradeabilityProxy(payable(Mainnet.CompoundingStakingSSVStrategyProxy))
            .upgradeTo(address(compoundingImpl));

        InitializeGovernedUpgradeabilityProxy(payable(Mainnet.NativeStakingSSVStrategy2Proxy))
            .upgradeTo(address(nativeImpl2));

        InitializeGovernedUpgradeabilityProxy(payable(Mainnet.NativeStakingSSVStrategy3Proxy))
            .upgradeTo(address(nativeImpl3));

        // Set registrators to the new ConsolidationController
        compoundingStakingSSVStrategy =
            CompoundingStakingSSVStrategy(payable(Mainnet.CompoundingStakingSSVStrategyProxy));
        compoundingStakingSSVStrategy.setRegistrator(address(consolidationController));

        nativeStakingSSVStrategy2 = NativeStakingSSVStrategy(payable(Mainnet.NativeStakingSSVStrategy2Proxy));
        nativeStakingSSVStrategy2.setRegistrator(address(consolidationController));

        nativeStakingSSVStrategy3 = NativeStakingSSVStrategy(payable(Mainnet.NativeStakingSSVStrategy3Proxy));
        nativeStakingSSVStrategy3.setRegistrator(address(consolidationController));

        vm.stopPrank();

        // --- Deploy MockBeaconRoots at the real precompile address ---
        MockBeaconRoots mockImpl = new MockBeaconRoots();
        vm.etch(Mainnet.beaconRoots, address(mockImpl).code);
        beaconRoots = MockBeaconRoots(Mainnet.beaconRoots);
    }

    /// @dev After fresh deployment, some validators may have been exited on-chain
    /// independently. Reset any EXITING validators back to STAKED to simulate the
    /// clean state right after the 181 deployment.
    /// validatorsStates mapping is at slot 53 on NativeStakingSSVStrategy.
    function _resetValidatorStates() internal {
        bytes[] memory keys2 = _getSecondClusterPubKeys();
        for (uint256 i = 0; i < keys2.length; i++) {
            _resetValidatorToStaked(address(nativeStakingSSVStrategy2), keys2[i]);
        }
        bytes[] memory keys3 = _getThirdClusterPubKeys();
        for (uint256 i = 0; i < keys3.length; i++) {
            _resetValidatorToStaked(address(nativeStakingSSVStrategy3), keys3[i]);
        }
    }

    function _resetValidatorToStaked(address strategy, bytes memory pubKey) internal {
        bytes32 pubKeyHash = keccak256(pubKey);
        bytes32 slot = keccak256(abi.encode(pubKeyHash, uint256(53)));
        uint256 state = uint256(vm.load(strategy, slot));
        if (state != 2 && state != 0) {
            // Reset non-STAKED, non-UNKNOWN validators back to STAKED
            vm.store(strategy, slot, bytes32(uint256(2)));
        }
    }

    function _labelContracts() internal {
        vm.label(address(nativeStakingSSVStrategy2), "NativeStakingSSVStrategy2");
        vm.label(address(nativeStakingSSVStrategy3), "NativeStakingSSVStrategy3");
        vm.label(address(compoundingStakingSSVStrategy), "CompoundingStakingSSVStrategy");
        vm.label(address(consolidationController), "ConsolidationController");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(weth), "WETH");
        vm.label(address(beaconRoots), "MockBeaconRoots");
        vm.label(validatorRegistratorAddr, "ValidatorRegistrator");
        vm.label(adminAddr, "AdminGuardian");
    }

    //////////////////////////////////////////////////////
    /// --- PUB KEY DATA
    //////////////////////////////////////////////////////

    // solhint-disable-next-line function-max-lines
    function _getSecondClusterPubKeys() internal pure returns (bytes[] memory) {
        bytes[] memory keys = new bytes[](38);
        keys[0] = hex"b7e1156c6ca50c42f60fc3503d435ecc430614d9d0304442d0badea7c648de854fa1b37c3125c8ff4de9ca765823eefd";
        keys[1] = hex"ace3a5e7b04a2f9b8ddc79524181571654c4e9569d571c3d0a9742fa0fe2db8d54014fb72cfa74a5e23b9676e461fdc9";
        keys[2] = hex"a018a0216aa11b0ab61e7adcd9bd163f567e4b5ed7de3a89c6488efc932d7965bf708999c9fe28ce37a165b8161d5681";
        keys[3] = hex"a032b875e9d6bbeab98d6b060bcb3a145ec666d50c80aa6be6aaa4684d57402c01caf80ae28ee94a81fabbf50e9bd249";
        keys[4] = hex"a0667d5b740b71b8ae50c07d695c1f1e4363fc52057a931dfec42c389069bfa3eed9acc5312044d3896f1cdb2d54d3df";
        keys[5] = hex"a241e3d37b54f92c965fb3c390b900d85f416c47b7d4057331620b359e9c8f34f265cc532ca52403c59f2fca42e7c9f2";
        keys[6] = hex"a2f883624840cb5bf744c23c477efdcb3e7cccfbbd5bb7eef00a7fd9860765f9a1c82616e5107fada49d2786c239c8ae";
        keys[7] = hex"a9da10b01962ca118b3ad409f384ec1acf2c76020633b5c80bc432a52c2413df5aeef0a6c7d3cf6c69d79278c2d1ac91";
        keys[8] = hex"abad67a3625c14e85922aa72f452df88bffc7a2d30e2916dbfe78f174c699cde529b8c30cef43ad43c2734b857999a0c";
        keys[9] = hex"ae12edc5d57aa4999038c8968184af8236d551e7051df5c8682dc984638cec4716c23cd40a65eb9a3fd8ba73e9877c0c";
        keys[10] = hex"b9081e786155204e9d6d8739651bffd7e019c9104fcff1b9598cdbe596cea1fae99a99ad8cac9647be2001317da07b91";
        keys[11] = hex"84bfb105e60735a20ba9a4c2ce8e8a117a1fb9c66e8cc20ce1d880de69cb093c068bbe72924e272098d7018eca2ed130";
        keys[12] = hex"851149b79b15b1bfc02f70d04860c64ba85ff0e63765d42fe39117f38ef66f3bfbf071c3241ae0d96917f175b1379e37";
        keys[13] = hex"870d2a79d2ca276158b62b10ccfc608b8435c8df8d0d1f5bb1290dd4fd396759843248fd7877be8bc2183684ab07bcfe";
        keys[14] = hex"8757a40dc9a2351536654a1d82cc01f8bf2acd1a04c2cbc4e7a50310ba3a9bd932980b4e531dcadcdf65361691896590";
        keys[15] = hex"897fc84f154b2a2be55058a7a2c122cbc48bdf1d4f030a6d1d0216caeb0f51ff777c23b6dc4601006a6e6ebed38be081";
        keys[16] = hex"8a8c7ace7d84cb3cba43cafb5bc21b84df457d51b57c3c63dadd2dd4c093e17cfc95a07fde55cdc9225978df8f095bc4";
        keys[17] = hex"8e44878278bbd96c980b66a74ffc9b71a835f3991064a645d7e1836d99de6acfd6c7061148d5034f6959e69f419f44a9";
        keys[18] = hex"8ed6e3d45faed1f149ce35f8f0371e922cc4ff99e93cd938fde696acab2be58c09adb4c3909b54f22aa5325fefcf5a74";
        keys[19] = hex"a0feaa07399cd3635f881f54d8ebb51c4bedf376149f4c649a5ab5a1f1eae8ea4759dd5e3521a9f367e09dcc9182cdea";
        keys[20] = hex"a8188c3d4618f4e45c8fc0d8e4b686e92c7b128993a2efefd5c8edc9f1ed5c5a5b0421be6c6e01284c4be778b8d351af";
        keys[21] = hex"aa70003c8439881aaa268e71fe5290185a4f66f51597f883837fea71690b419bfc2ebcd02fb21386feea7c8ac41a8ed8";
        keys[22] = hex"ab4d5f12e16034a72244f9f1a1a3ac9d4951b58106f89c604e5631530dc2accd7e5f24e7150ad5e1cbe899f1eaf1ce7d";
        keys[23] = hex"acf48a22e69b0ba9df39d775b1799f6bceeeb0888c39fb909b3c9af4b95c7d85907b1fac37a3abe249981cdec3f52426";
        keys[24] = hex"ad4ccd890dff1e95993158c64790fcd51b44245858173619976532ab6044f584e23b09445f1ca0207161cd2ce831249a";
        keys[25] = hex"b8d868f540cdaeac91ee049382049d6263a04ad0cd7e89f61992f4626640a22225975bc14ca896f8a62203629411447f";
        keys[26] = hex"b97684ed60df7e58d33819e522bf248b87ed2ca431f2458d9e4bc95a43715266bbc3fb510923d51a683ab2380098de70";
        keys[27] = hex"80a5f26411ffab3778166b6614551b2aa8cc73f56f9d36958cffad0ffa37c10bb629ba9101df605849f5b69248893d12";
        keys[28] = hex"8d2e3214eb39d8db9a486975a0f71bda253a332938341fcddeb2ca7ffe8e18d5ce99d4844e5acd3f05110734ce43afa2";
        keys[29] = hex"8d411e1ac3d246897d5e977722ab79e22b8f4692393770928c201ac88b98431676ab56833179fffd761ee47ba02e567b";
        keys[30] = hex"8d875da93d02e3c0fb90ab11a4b079f8b2f9d83035ecdccf55df17afc9ae5b352674d08daf766fb2d30f39bce1ce29ba";
        keys[31] = hex"90d1cd1c19af352d82363eca0f0fdd9d35a7fde98240f217d136c8e7841ab091d7a1a78d396542abf9b5cb1c8035f8ea";
        keys[32] = hex"94d22fce3edc96965d2cf289969fb3099101761534bfe9d029edb319a683cadb295bf02c0610b98c91c91a904db03611";
        keys[33] = hex"a1b4899e5460428df7b66007cccad6dee6ce3183b856897070d23cf4cb8de7fb8a1bf02a42e5b4a761cf68adcf2dc5ae";
        keys[34] = hex"a4f24e7e1d3ec6b56d6085f2c15d6f19ebefe2e5d8c08de58830ef254131c34c8bc5a6a85b1daf60ff3331c05790929b";
        keys[35] = hex"a577f2c72d35d5dff2d76cc8169e32c32a9a114c904dff1094d86f2efe6021b795e63671e1464a0741f015ed73ada55e";
        keys[36] = hex"ab14b385b3cf1ba09048d7177eaab385cb9a3b3ad4a44e6c6c714811b9ee1cfe9243aaf212957e7306567df8f92b962f";
        keys[37] = hex"ab53c575fc015ba508aca923062903cb6b7635d09835fd5825d98dcfde4da7445ca1ac5db52e094d4c32204344999647";
        return keys;
    }

    function _getThirdClusterPubKeys() internal pure returns (bytes[] memory) {
        bytes[] memory keys = new bytes[](3);
        keys[0] = hex"999702d1ad3f224ac76dca1edcb91c5e7d1e05bd13646cd4d0b0fa1252ad3ace4d8b34f48a7c4ca13c84a7c71f175c72";
        keys[1] = hex"a5fe057240ad0ea978f7ac58130ff124c733de28ac271878178d00017b91353062bcc220cabaeccbc77fba71a48d4dfa";
        keys[2] = hex"b734f922193e9f5fa82bc023703b6ff9d48b94d7dc37bd02514268881834bc8117d82fc33bae857f5a1ac1e5ee5c2395";
        return keys;
    }

    // solhint-disable-next-line func-name-mixedcase
    function ACTIVE_TARGET_PUB_KEY() internal pure returns (bytes memory) {
        return hex"b5d37226e27e0ab066541ccb795e04149300bb8c0b0fd528785f6a940e94c624b65ef1eb771f78a5f2685317b7e6f34f";
    }

    //////////////////////////////////////////////////////
    /// --- BALANCE PROOFS (pre-consolidation)
    //////////////////////////////////////////////////////

    function _getBalanceProofs() internal pure returns (CompoundingValidatorManager.BalanceProofs memory) {
        bytes32[] memory leaves = new bytes32[](5);
        leaves[0] = 0xfd7c8373070000008984d5b626000000dba68373070000002e054f8207000000;
        leaves[1] = 0x7bc26d8107000000a9b15ccc0e0000004b9e8073070000000000000000000000;
        leaves[2] = 0x1fc47c7307000000e2b07c73070000000c927c730700000000a5269107000000;
        leaves[3] = 0x519f7b7307000000d2af7b73070000002a70028407000000f6977b7307000000;
        leaves[4] = 0xec30747307000000255474730700000000a52691070000001026e9463a000000;

        bytes[] memory proofs = new bytes[](5);
        proofs[0] =
            hex"917d8373070000009eaf837307000000ea7d837307000000b39e8373070000008c48c30a5f5ae1a56746099c051ca96073e376aac7551f0d6d6a15a9a48f4052d994e0b28373640577c0ab09ace51a55fef80ad962e2faed045b55947a7a4f34e54d6073f9d09e38595b3f6ecfd92945b721d23784789129babc2094a2915987da37705db46c6e770d7f8c5b9ec69d35257f92434347705e56b1d5d561f2fdaa50a600d0379af06018ac56268cf9a870f71986b9a9e60cdf51fb3c6d0d52e9f0670e19e0ff26a62093902fbca179f7f36f258d50a9073149f965612acb5773dcfd63d877accda0a33848d28d9689f0e3b83a09bef854569381d7889bbb536159d7e71add819625b8fb0ede9e5c35e0ed113de4618d5f442e7f82e0a0f582c4ac53f83b465d1d41767e25220cc72c91e6b5eceb05f2952e98dad8db50a87de1b6ed1740dd097f2086df81b875c8b39db903df524bdc88b56ac9a50f1ca1ab16ba6ecf6113eb8e424f51815a7f0a0864004680bf513454bba188ec30a1c66a9b8534965f292af9adf02e23328f62e4bef83791aeb3d729ed87cd9838fad6790dd7d66891394e3eeb07d48be1bf8604cac743a2841e87a4e163862255cf07f5195f0ebdd8cd635541d51b39455c8da6481af73661128d0b29da8a88c5da854f3144daeeea7a208232bf77025a6e81e886e674b3aadc3931bc8f0268e2b8350d63608fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a43e251b9aa4f9097ef23129626b849648d24e38fb1f16829559482a9d5da28473cddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a748d18220000000000000000000000000000000000000000000000000000000000";
        proofs[1] =
            hex"5058807307000000d6c780730700000070bf7f76070000002560807307000000a360ff8aa16d43dbf04b07a5b55942294f5d57adf813a844d305c8c6b2cd993ffbf093e17c6938a06cc1a21c77904c05c21e5f710e745ca3e40b88f1671050c633b03e8a35f6247def38d97d633697663930096b94cf96bda09764ec852d3abc29848299af499e3c19da8a78b953624818e08eb50a7b4bd6cdb884e7c4e9f9de7a3b437e6ac8737e2fb5e8268cc3b4804f92bfb6efd420fe08b0f69cda9653f46e8a1707614ee210693a4ab9296bca5d1f7d5ff3e435f4d1a842d94e669f2404986fb00fe176687a08685b8333dc93c6d4a3a549a9efd75c64709d82d8c95eec837c502df948738b0e5a1e5cc552caf4f8c1a87ec43a01a890b069acbb0936c417af734a796fa2937aad9c827c0db2f0acf793fafdef4eddd71a12886765359e8d8fc5bf9ce38b8bdd8fbea19bd20cc3974d7fb337f1e513b7121df301e709733eb355e772fa45ebc65fb923d0eff6c2dc7632e422725146683ad8b8bad084f634965f292af9adf02e23328f62e4bef83791aeb3d729ed87cd9838fad6790dd7d66891394e3eeb07d48be1bf8604cac743a2841e87a4e163862255cf07f5195f0ebdd8cd635541d51b39455c8da6481af73661128d0b29da8a88c5da854f3144daeeea7a208232bf77025a6e81e886e674b3aadc3931bc8f0268e2b8350d63608fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a43e251b9aa4f9097ef23129626b849648d24e38fb1f16829559482a9d5da28473cddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a748d18220000000000000000000000000000000000000000000000000000000000";
        proofs[2] =
            hex"a49a7c7307000000acf67c730700000037e57c730700000033e57c73070000008511637653965e07d7eeec0223160f5358eadfaa3c6105ba20ea3bdf05ba7c6f75e7b877dedc859f9584a998e122e6aeffa96b9f05459f83e3936af6e50659ce6544de0e1bcef3cf00b1214e085b562bbab1889bd25bcf8849fe8c1da7fdec72a5148e91dd117e0dab7a05c9d2394e7e66cb7b21096dc8690dd0d8208c336604aad72859e0cbcf82058befcb3ceb8cea7fb7067115232dd11ab59a47ed538aeb46933c6defd1f2f9ab6c19b5e9d6bdfd184d7913f2e0cc9b588116966b5f5cf0b966c56783dfe114de1a7df4dc96def908aa579b9b56e06e4b0465f7d1332fc5cf9a044bff818ea2b269f25762c367896911a93f2203a913d64e811611b1da45d7d5b62bc68abf2e770261e5ae2c128f915c56a61a166a4cdbb3372911b6c69f9abff178ccc312b22b154981de48b8a5b0650b3a4e175ab9dd3636e67e5c4eff6b93420876ef20a461a47eb645ed08b852f79e40ce93cd2b9203568fbbd6094c34b74724946c4673142c68b9fd1d7daa05f34dd5747a10f1c5010de31d47960e78c9350c52049bb9000dbda4f0a908c8eb29606b74fb3702653514a19cb6147f6db4c812b0451988f4ee7061bc49e1f7fe37e1a2548469e13db07d9f235e9023daeeea7a208232bf77025a6e81e886e674b3aadc3931bc8f0268e2b8350d63608fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a43e251b9aa4f9097ef23129626b849648d24e38fb1f16829559482a9d5da28473cddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a748d18220000000000000000000000000000000000000000000000000000000000";
        proofs[3] =
            hex"e8b07b73070000006e5bb4eb34000000be957b730700000097867b730700000059e193bc2473fca31d2a10f8454520bee1957d7e3e9ced87f2e8425c0c08f6bb52cf8c48e946e9da705ac19a462706b411d24b8f373e325a628208d7047d0ffc0fee33b653cd0fd01e2ca1608a9b94c94c67f365657d8a86a53bc8dfaa3988a724504dfe79b6f5afb44ecf53753aad7efff2452183032a5b1219b5c99f384719c1022f632a5e029648ce78f33b5cbe1c606c327b7b29aa4c03cff2be1ae5ccebac8253bf25ade6c873f6509570ce4a30783c746c5875ca346078e184eac19dfc9f416299e9fb4250b04a8e3e2d22a2771eda8639962bc285055754f357667fdd80cd1d2fef1f6a297426c80d198e5821e538e851fc608333ac632937e0753b69b1b1cba2be0ab14696726eac8f6b818ef3d0396e6d563b73d378a48f0ed77cd518b72fef2551971a58c574c4fad812bbd71e0a41ed97c1c74d3f665e4f849945939fc1349559b3feaf32db756fbdb425cb7de72cee400a0a83ae1a3fc1541ee163812708e31e1ec62e05f94e47973926890f90e5e6bdfc4e034e6d75ace091b678c9350c52049bb9000dbda4f0a908c8eb29606b74fb3702653514a19cb6147f6db4c812b0451988f4ee7061bc49e1f7fe37e1a2548469e13db07d9f235e9023daeeea7a208232bf77025a6e81e886e674b3aadc3931bc8f0268e2b8350d63608fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a43e251b9aa4f9097ef23129626b849648d24e38fb1f16829559482a9d5da28473cddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a748d18220000000000000000000000000000000000000000000000000000000000";
        proofs[4] =
            hex"c14ded8209000000d3399f7507000000c35c74730700000052547473070000003fd8a8a3abe91daabbcefb46c12679757b5ef84a1d1a86f88ff4f72108743082c16a90f3122651c46b9fe13ad5fa9039689f8f8310bd87fede796de7ae7e6b8b26e8b864ab910e64fac8d21420305ac13d40ff60b337734cbed410b74d045b4b191c8a834a78383c882c63cd73b5ec3045147d6866b03d668926675421d9dd9430059267161313dd5d8078f97681146f8ad9699662294f8d96838c1a02eb55950ba94ee41400881a940e82b104faa44ea94de3aafc6708bdfdfad612e5f8b3b17db9f9b3303b7fb8910a42ac46832ad3dbc1122ff9b81ce8343aea02b9dd4f08b85f6f22463648903c3e2c93d738ec5c5bbabc7969d350c5fb65538711c7651da9758deaadab0eda5cf7047a9b4cf76f32ba76d0f410e2eb0979f709ef7c3a875c6c2088e2ae731e9e64583785467c21b800cf320d9807a45210ef86d0b70e44efa206455c565617f73c5a3a4cd1b98c93d21d398f2bc25a63c5ea5095c8fd3905383a708f1ae8e6cdfef5a2aabf0fa4bf39ab9c9dd8aca35c9fd45ea283df683a83c2524a66c24e653e6fa354bbba4050ce12082d94df4108e75baf1b125bfe6db4c812b0451988f4ee7061bc49e1f7fe37e1a2548469e13db07d9f235e9023daeeea7a208232bf77025a6e81e886e674b3aadc3931bc8f0268e2b8350d63608fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a43e251b9aa4f9097ef23129626b849648d24e38fb1f16829559482a9d5da28473cddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a748d18220000000000000000000000000000000000000000000000000000000000";

        return CompoundingValidatorManager.BalanceProofs({
            balancesContainerRoot: 0x8f27c7c7ce2f490662a385bd0e1f8cff0edbefae993e39ca2f21205429b3814a,
            balancesContainerProof: hex"85324c52a14d47585124af7b122fb4e5dc95a328195a69cdbd2ac467a380087bde78b6f9afdee27c83dcab795db1174fb31809c3e18ccd101c45ca92146a34ba0fe39f130e2611965f830d94a77f38cd694b1c92c82bb1426082fd11974bf67429a18eca977c27b0c22f5df812b50554ee42926f66b70fe930751eaee9e5577c88cbdc15d22d62cf98507f4ec9c2859d7a3604a8712b3a4696e8ca42eca1293c35ecb1dce6bdc3af85bd9cf2f1f03cb8a04d217a199b03abd30d462a261fe2e7445fd94dbbc7e4c1e17974c0745d82a97865458517ec4d426b861f9c4e90e9d0b53e114879b41538e556e5d6a209127efcd4b0fe59e0bf64de8357cdc2273d6ec0cdabace9443f7ec6183c3a82e1762c339d8dfbbd1dfca1ba16967b4f2e6e8a",
            validatorBalanceLeaves: leaves,
            validatorBalanceProofs: proofs
        });
    }

    bytes32 internal constant BEACON_BLOCK_ROOT = 0x93f545e9c23550f0934192e433a74438e65beec7c90f92a771b5e611ae494dfc;

    function _getPendingDepositProofs()
        internal
        pure
        returns (CompoundingValidatorManager.PendingDepositProofs memory)
    {
        uint32[] memory indexes = new uint32[](6);
        indexes[0] = 6791;
        indexes[1] = 33011;
        indexes[2] = 6790;
        indexes[3] = 6789;
        indexes[4] = 6788;
        indexes[5] = 6786;

        bytes[] memory proofs = new bytes[](6);
        proofs[0] =
            hex"b052e26ca38ea7d23a9d8e2b4e0930caec9762902558a0c69a6165d2b34225cead345f10252274408791763ea728c60cfd0c0e4b830a4478358e903ea5fb8e9d16631debd57ef20f7e5d80e7309e1c5cbe09fba84a45739d0c2f7a5385b99de044e3aedd9b6413b72e62e221a47feac65b8b61639e4d8c3f9595cb28f5a2ed0928f91fd42bd629d13ea3d088dc7684890efb7bd6982995cb06b993262d317fe481cb939e8682f2529ac5b34889c745c9c3d451c6acae5603acd9e750b81054e588a198201c81b745cd183dc6b095f0281c04ec988c9d9e5a372e145eb5f03a4936392d008637fb405334e3793bcd032cec028bbfcf3de88b34bd4c893d350dc8fa58dccb16086ce949d26e8061c375a96ab0aa4dbc7d0ba7340a2732faab6dd749aee54ff9f9e931158eaca9fd12e915a1f7c205b499d7cf98fb2c9b70b55cfdff2cf7a711c6d0a64a4c0819b47e1e8c98534a134bf0a46773151d8ca393f25cfcb86c8f337e89e710accfcacd13518797b5f871b33f5f8a522d1070b5dd3851fb301c44c748be1402321a538f1f3d0ec0ed99161b33c8d7ab778e58ea4013f2ed12cb9bcd9bbcb04e046d6ae4c230f7a759e0c88be26bb8f34c33e0fa1d121dab1875e7cf07f93e85275fc8eb4755076cd072cb30830890c57ccc0ac57fec3d1bb0ac320fc57a100f5f395873579aed371896e8be97a52c5f03809c5f2aceb08fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467659aa5000000000000000000000000000000000000000000000000000000000000";
        proofs[1] =
            hex"f7249eead0f1aea2b1fbd85cc602f80baf13e0a02cf9d3089e718e6658ce1693f792d6b43e88db568ea6dfcb3610f61591ee6b5c6eaeb6ccfef90f21d4b59639d55dd5372c0ccbe43f33259d9de97bfbb1e50625553b883a20f883ac588df75c54591b16d0df56bd9b2fef101017199b4beb0fdd39204fdee898baf569b591734284ea78eab42ac0bc127e4a33c0f1b6b1d7ce7f1c22c077571b4b4ab17cd6d15ec0911248ab6ac0fb6e40784dee43a812f1b2e6825e663b3c3bb9c8e919f1276b2bd5a3617467e8bc2a537855f2f6ace03a9fc68c3bde3fd4ea00e6428a4114a8749e8f840f1e524602b6b9ef58a896ac8ccba0e55bb89c72eae1130fcf463433b6e9dcdd3563b9304399dbabe9f1cb6c5681c72c703678e5bcb6a343607a9844c92daa1fe18120b85cdebb842c8761b2318bd50bad75742cd23e24674e55657075a0f80fc134385cae7ca7a8d0bf310debf5e875dd4c2ed98f5082e013576152827b331483b5af2d583798206b7673defe032939eaa66fba62754814cddc226b0d00c895f66aea0409aa599d3f4e99192e2bacb7a99bf00646e55d758f18bd72f2d4e1e15bc9b4649c63daf8060b6b26098a0f3837e145b78e5418c4fe23c9b58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da729378453c470d6bb6d6d92cb4b1f45bdf68e17b3b2d513ccad61d8e91baeec8cbf2c568fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467659aa5000000000000000000000000000000000000000000000000000000000000";
        proofs[2] =
            hex"e43aa97c7b45d686240e148893fb944692f4a5513afca99a351c1f20e26c5597ad345f10252274408791763ea728c60cfd0c0e4b830a4478358e903ea5fb8e9d16631debd57ef20f7e5d80e7309e1c5cbe09fba84a45739d0c2f7a5385b99de044e3aedd9b6413b72e62e221a47feac65b8b61639e4d8c3f9595cb28f5a2ed0928f91fd42bd629d13ea3d088dc7684890efb7bd6982995cb06b993262d317fe481cb939e8682f2529ac5b34889c745c9c3d451c6acae5603acd9e750b81054e588a198201c81b745cd183dc6b095f0281c04ec988c9d9e5a372e145eb5f03a4936392d008637fb405334e3793bcd032cec028bbfcf3de88b34bd4c893d350dc8fa58dccb16086ce949d26e8061c375a96ab0aa4dbc7d0ba7340a2732faab6dd749aee54ff9f9e931158eaca9fd12e915a1f7c205b499d7cf98fb2c9b70b55cfdff2cf7a711c6d0a64a4c0819b47e1e8c98534a134bf0a46773151d8ca393f25cfcb86c8f337e89e710accfcacd13518797b5f871b33f5f8a522d1070b5dd3851fb301c44c748be1402321a538f1f3d0ec0ed99161b33c8d7ab778e58ea4013f2ed12cb9bcd9bbcb04e046d6ae4c230f7a759e0c88be26bb8f34c33e0fa1d121dab1875e7cf07f93e85275fc8eb4755076cd072cb30830890c57ccc0ac57fec3d1bb0ac320fc57a100f5f395873579aed371896e8be97a52c5f03809c5f2aceb08fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467659aa5000000000000000000000000000000000000000000000000000000000000";
        proofs[3] =
            hex"ac9a98d48b7b13938bbf6c50c07b7d9f41c78c2dc9515280ec3cab9209ac44bad1382044558891e141307d62d35f69c7e8ef2566e8a758ac46807c46fab10b6d16631debd57ef20f7e5d80e7309e1c5cbe09fba84a45739d0c2f7a5385b99de044e3aedd9b6413b72e62e221a47feac65b8b61639e4d8c3f9595cb28f5a2ed0928f91fd42bd629d13ea3d088dc7684890efb7bd6982995cb06b993262d317fe481cb939e8682f2529ac5b34889c745c9c3d451c6acae5603acd9e750b81054e588a198201c81b745cd183dc6b095f0281c04ec988c9d9e5a372e145eb5f03a4936392d008637fb405334e3793bcd032cec028bbfcf3de88b34bd4c893d350dc8fa58dccb16086ce949d26e8061c375a96ab0aa4dbc7d0ba7340a2732faab6dd749aee54ff9f9e931158eaca9fd12e915a1f7c205b499d7cf98fb2c9b70b55cfdff2cf7a711c6d0a64a4c0819b47e1e8c98534a134bf0a46773151d8ca393f25cfcb86c8f337e89e710accfcacd13518797b5f871b33f5f8a522d1070b5dd3851fb301c44c748be1402321a538f1f3d0ec0ed99161b33c8d7ab778e58ea4013f2ed12cb9bcd9bbcb04e046d6ae4c230f7a759e0c88be26bb8f34c33e0fa1d121dab1875e7cf07f93e85275fc8eb4755076cd072cb30830890c57ccc0ac57fec3d1bb0ac320fc57a100f5f395873579aed371896e8be97a52c5f03809c5f2aceb08fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467659aa5000000000000000000000000000000000000000000000000000000000000";
        proofs[4] =
            hex"5884a4ac9f90f068ebec13e3be02253bc0f44b196572038dd09e77edf8ec0d5dd1382044558891e141307d62d35f69c7e8ef2566e8a758ac46807c46fab10b6d16631debd57ef20f7e5d80e7309e1c5cbe09fba84a45739d0c2f7a5385b99de044e3aedd9b6413b72e62e221a47feac65b8b61639e4d8c3f9595cb28f5a2ed0928f91fd42bd629d13ea3d088dc7684890efb7bd6982995cb06b993262d317fe481cb939e8682f2529ac5b34889c745c9c3d451c6acae5603acd9e750b81054e588a198201c81b745cd183dc6b095f0281c04ec988c9d9e5a372e145eb5f03a4936392d008637fb405334e3793bcd032cec028bbfcf3de88b34bd4c893d350dc8fa58dccb16086ce949d26e8061c375a96ab0aa4dbc7d0ba7340a2732faab6dd749aee54ff9f9e931158eaca9fd12e915a1f7c205b499d7cf98fb2c9b70b55cfdff2cf7a711c6d0a64a4c0819b47e1e8c98534a134bf0a46773151d8ca393f25cfcb86c8f337e89e710accfcacd13518797b5f871b33f5f8a522d1070b5dd3851fb301c44c748be1402321a538f1f3d0ec0ed99161b33c8d7ab778e58ea4013f2ed12cb9bcd9bbcb04e046d6ae4c230f7a759e0c88be26bb8f34c33e0fa1d121dab1875e7cf07f93e85275fc8eb4755076cd072cb30830890c57ccc0ac57fec3d1bb0ac320fc57a100f5f395873579aed371896e8be97a52c5f03809c5f2aceb08fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467659aa5000000000000000000000000000000000000000000000000000000000000";
        proofs[5] =
            hex"308dba54c2444e4683aa4c92c423532dae274d39dc0a95a2871b90006b41a357f48cf215d71cd05cb4214ebac67ba013270cc2c9b3e9cd3764671f1461135947ff01249f12eebda99afdc7882e5a0b55955740fe202576daabaf7fd026a0d73e44e3aedd9b6413b72e62e221a47feac65b8b61639e4d8c3f9595cb28f5a2ed0928f91fd42bd629d13ea3d088dc7684890efb7bd6982995cb06b993262d317fe481cb939e8682f2529ac5b34889c745c9c3d451c6acae5603acd9e750b81054e588a198201c81b745cd183dc6b095f0281c04ec988c9d9e5a372e145eb5f03a4936392d008637fb405334e3793bcd032cec028bbfcf3de88b34bd4c893d350dc8fa58dccb16086ce949d26e8061c375a96ab0aa4dbc7d0ba7340a2732faab6dd749aee54ff9f9e931158eaca9fd12e915a1f7c205b499d7cf98fb2c9b70b55cfdff2cf7a711c6d0a64a4c0819b47e1e8c98534a134bf0a46773151d8ca393f25cfcb86c8f337e89e710accfcacd13518797b5f871b33f5f8a522d1070b5dd3851fb301c44c748be1402321a538f1f3d0ec0ed99161b33c8d7ab778e58ea4013f2ed12cb9bcd9bbcb04e046d6ae4c230f7a759e0c88be26bb8f34c33e0fa1d121dab1875e7cf07f93e85275fc8eb4755076cd072cb30830890c57ccc0ac57fec3d1bb0ac320fc57a100f5f395873579aed371896e8be97a52c5f03809c5f2aceb08fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92beb8d0d63c39ebade8509e0ae3c9c3876fb5fa112be18f905ecacfecb92057603ab95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17fcddba7b592e3133393c16194fac7431abf2f5485ed711db282183c819e08ebaa8a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467659aa5000000000000000000000000000000000000000000000000000000000000";

        return CompoundingValidatorManager.PendingDepositProofs({
            pendingDepositContainerRoot: 0x8e9a353f5d80d749c0f322bc97530477e6c5a3ca14b253d0a26264872b45bdcf,
            pendingDepositContainerProof: hex"c5a691c90b1e5a4b98433a0f4bd86eba8048f63b7d3a1b4fb66ba0c7ae8812773db8d01d9495a3bbeb4f3d22d6a373692bbbf60c638fa615738f83ac08f464c9f7507516e2aa2af211bec2d8c99165b7fad41b628ba3483ae4538d0297e9959bc78009fdf07fc56a11f122370658a353aaa542ed63e44c4bc15ff4cd105ab33c536d98837f2dd165a55d5eeae91485954472d56f246df256bf3cae19352a123ce0ef6aa1d629eca8a8ec78c2649b889f0c585e16e92862010bb41d58afd7df61445fd94dbbc7e4c1e17974c0745d82a97865458517ec4d426b861f9c4e90e9d0b53e114879b41538e556e5d6a209127efcd4b0fe59e0bf64de8357cdc2273d6ec0cdabace9443f7ec6183c3a82e1762c339d8dfbbd1dfca1ba16967b4f2e6e8a",
            pendingDepositIndexes: indexes,
            pendingDepositProofs: proofs
        });
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _hashPubKey(bytes memory pubKey) internal pure returns (bytes32) {
        require(pubKey.length == 48, "Invalid public key");
        return sha256(abi.encodePacked(pubKey, bytes16(0)));
    }

    /// @dev Sets up the beacon roots and verifies balances so that target validators are "active".
    /// This mimics the `activateTargetValidators` function from the Hardhat test.
    function _activateTargetValidators() internal {
        // Advance time past SNAP_BALANCES_DELAY so snapBalances will work
        skip(SNAP_DELAY + 12);

        // In Foundry we control the timestamp precisely.
        // Set beacon root at the current block.timestamp so snapBalances() finds it.
        beaconRoots.setBeaconRoot(block.timestamp, BEACON_BLOCK_ROOT);

        CompoundingValidatorManager.BalanceProofs memory bProofs = _getBalanceProofs();
        CompoundingValidatorManager.PendingDepositProofs memory pdProofs = _getPendingDepositProofs();

        vm.prank(validatorRegistratorAddr);
        consolidationController.snapBalances();

        vm.prank(validatorRegistratorAddr);
        consolidationController.verifyBalances(bProofs, pdProofs);
    }

    /// @dev Returns operator IDs as a dynamic uint64[] array from the 4-element fixed array
    function _getSecondClusterOperatorIds() internal view returns (uint64[] memory) {
        uint64[] memory ids = new uint64[](4);
        ids[0] = SECOND_CLUSTER_OPERATOR_IDS[0];
        ids[1] = SECOND_CLUSTER_OPERATOR_IDS[1];
        ids[2] = SECOND_CLUSTER_OPERATOR_IDS[2];
        ids[3] = SECOND_CLUSTER_OPERATOR_IDS[3];
        return ids;
    }

    function _getThirdClusterOperatorIds() internal view returns (uint64[] memory) {
        uint64[] memory ids = new uint64[](4);
        ids[0] = THIRD_CLUSTER_OPERATOR_IDS[0];
        ids[1] = THIRD_CLUSTER_OPERATOR_IDS[1];
        ids[2] = THIRD_CLUSTER_OPERATOR_IDS[2];
        ids[3] = THIRD_CLUSTER_OPERATOR_IDS[3];
        return ids;
    }

    /// @dev Returns an empty SSV Cluster struct
    function _getEmptyCluster() internal pure returns (Cluster memory) {
        return Cluster({validatorCount: 0, networkFeeIndex: 0, index: 0, active: true, balance: 0});
    }
}
