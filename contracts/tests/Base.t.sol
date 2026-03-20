// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {OUSD} from "contracts/token/OUSD.sol";
import {OUSDVault} from "contracts/vault/OUSDVault.sol";
import {OUSDProxy} from "contracts/proxies/Proxies.sol";
import {VaultProxy} from "contracts/proxies/Proxies.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHBase} from "contracts/token/OETHBase.sol";
import {OSonic} from "contracts/token/OSonic.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OSVault} from "contracts/vault/OSVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {WOETHProxy} from "contracts/proxies/Proxies.sol";
import {WrappedOUSDProxy} from "contracts/proxies/Proxies.sol";
import {WOETH} from "contracts/token/WOETH.sol";
import {WrappedOusd} from "contracts/token/WrappedOusd.sol";
import {WOETHBase} from "contracts/token/WOETHBase.sol";
import {WOETHPlume} from "contracts/token/WOETHPlume.sol";
import {WOSonic} from "contracts/token/WOSonic.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";
import {MockNonRebasing} from "contracts/mocks/MockNonRebasing.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {MockCreateX} from "tests/mocks/MockCreateX.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockWrappedSonic} from "tests/mocks/MockWrappedSonic.sol";
import {MockSFC} from "contracts/mocks/MockSFC.sol";
import {MockSwapXPair} from "tests/mocks/MockSwapXPair.sol";
import {MockSwapXGauge} from "tests/mocks/MockSwapXGauge.sol";
import {OSonicProxy, OSonicVaultProxy} from "contracts/proxies/SonicProxies.sol";
import {OETHBaseVault} from "contracts/vault/OETHBaseVault.sol";
import {OETHBaseProxy, OETHBaseVaultProxy} from "contracts/proxies/BaseProxies.sol";

import {OETHZapper} from "contracts/zapper/OETHZapper.sol";
import {OETHBaseZapper} from "contracts/zapper/OETHBaseZapper.sol";
import {OSonicZapper} from "contracts/zapper/OSonicZapper.sol";
import {WOETHCCIPZapper} from "contracts/zapper/WOETHCCIPZapper.sol";

import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";
import {PoolBoosterFactorySwapxSingle} from "contracts/poolBooster/PoolBoosterFactorySwapxSingle.sol";
import {PoolBoosterFactorySwapxDouble} from "contracts/poolBooster/PoolBoosterFactorySwapxDouble.sol";
import {PoolBoosterFactoryMerkl} from "contracts/poolBooster/PoolBoosterFactoryMerkl.sol";
import {PoolBoosterFactoryMetropolis} from "contracts/poolBooster/PoolBoosterFactoryMetropolis.sol";
import {PoolBoosterSwapxSingle} from "contracts/poolBooster/PoolBoosterSwapxSingle.sol";
import {PoolBoosterSwapxDouble} from "contracts/poolBooster/PoolBoosterSwapxDouble.sol";
import {PoolBoosterMerklV2} from "contracts/poolBooster/PoolBoosterMerklV2.sol";
import {PoolBoosterMetropolis} from "contracts/poolBooster/PoolBoosterMetropolis.sol";
import {CurvePoolBooster} from "contracts/poolBooster/curve/CurvePoolBooster.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {CurvePoolBoosterFactory} from "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol";

import {VaultValueChecker, OETHVaultValueChecker} from "contracts/strategies/VaultValueChecker.sol";
import {BridgedWOETHStrategy} from "contracts/strategies/BridgedWOETHStrategy.sol";
import {CurveAMOStrategy} from "contracts/strategies/CurveAMOStrategy.sol";
import {BaseCurveAMOStrategy} from "contracts/strategies/BaseCurveAMOStrategy.sol";
import {SonicStakingStrategy} from "contracts/strategies/sonic/SonicStakingStrategy.sol";
import {SonicSwapXAMOStrategy} from "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol";
import {CrossChainMasterStrategy} from "contracts/strategies/crosschain/CrossChainMasterStrategy.sol";
import {CrossChainRemoteStrategy} from "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol";
import {AerodromeAMOStrategy} from "contracts/strategies/aerodrome/AerodromeAMOStrategy.sol";
import {AerodromeAMOQuoter, QuoterHelper} from "contracts/utils/AerodromeAMOQuoter.sol";
import {CCTPMessageTransmitterMock} from "contracts/mocks/crosschain/CCTPMessageTransmitterMock.sol";
import {CCTPTokenMessengerMock} from "contracts/mocks/crosschain/CCTPTokenMessengerMock.sol";
import {MockERC4626Vault} from "contracts/mocks/MockERC4626Vault.sol";
import {MockSSVNetwork} from "contracts/mocks/MockSSVNetwork.sol";
import {MockSSV} from "contracts/mocks/MockSSV.sol";
import {MockDepositContract} from "contracts/mocks/MockDepositContract.sol";
import {NativeStakingSSVStrategy} from "contracts/strategies/NativeStaking/NativeStakingSSVStrategy.sol";
import {FeeAccumulator} from "contracts/strategies/NativeStaking/FeeAccumulator.sol";
import {CompoundingStakingSSVStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingSSVStrategy.sol";
import {CompoundingStakingStrategyView} from "contracts/strategies/NativeStaking/CompoundingStakingView.sol";
import {MockBeaconProofs} from "contracts/mocks/beacon/MockBeaconProofs.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";

import {AbstractSafeModule} from "contracts/automation/AbstractSafeModule.sol";
import {AutoWithdrawalModule} from "contracts/automation/AutoWithdrawalModule.sol";
import {ClaimStrategyRewardsSafeModule} from "contracts/automation/ClaimStrategyRewardsSafeModule.sol";
import {CollectXOGNRewardsModule} from "contracts/automation/CollectXOGNRewardsModule.sol";
import {CurvePoolBoosterBribesModule} from "contracts/automation/CurvePoolBoosterBribesModule.sol";
import {ClaimBribesSafeModule} from "contracts/automation/ClaimBribesSafeModule.sol";
import {EthereumBridgeHelperModule} from "contracts/automation/EthereumBridgeHelperModule.sol";
import {BaseBridgeHelperModule} from "contracts/automation/BaseBridgeHelperModule.sol";

abstract contract Base is Test {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant DEFAULT_WETH_AMOUNT = 10_000e18;
    uint256 internal constant DEFAULT_USDC_AMOUNT = 10_000e6;

    //////////////////////////////////////////////////////
    /// --- ACTORS
    //////////////////////////////////////////////////////
    // Random users with same length names, mostly used for invariant testing
    address internal alice;
    address internal bobby;
    address internal cathy;
    address internal david;
    address internal emily;
    address internal frank;

    // Random users
    address internal josh;
    address internal matt;
    address internal nick;
    address internal domen;
    address internal shahul;
    address internal daniel;
    address internal clement;

    // Deployer and governance actors
    address internal deployer;
    address internal governor;
    address internal guardian;
    address internal strategist;

    // Automation operator
    address internal operator;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    OUSD internal ousd;
    OUSDVault internal ousdVault;
    OUSDProxy internal ousdProxy;
    VaultProxy internal ousdVaultProxy;

    OETH internal oeth;
    OSonic internal oSonic;
    OETHBase internal oethBase;
    OETHVault internal oethVault;
    OETHProxy internal oethProxy;
    OETHVaultProxy internal oethVaultProxy;

    WOETH internal woeth;
    WOETHProxy internal woethProxy;

    WrappedOusd internal wrappedOusd;
    WrappedOUSDProxy internal wrappedOusdProxy;

    WOETHBase internal woethBase;
    WOETHProxy internal woethBaseProxy;

    WOETHPlume internal woethPlume;
    WOETHProxy internal woethPlumeProxy;

    WOSonic internal woSonic;
    WOETHProxy internal woSonicProxy;

    OETHBaseVault internal oethBaseVault;
    OETHBaseProxy internal oethBaseProxy;
    OETHBaseVaultProxy internal oethBaseVaultProxy;

    OSVault internal oSonicVault;
    OSonicProxy internal oSonicProxy;
    OSonicVaultProxy internal oSonicVaultProxy;

    //////////////////////////////////////////////////////
    /// --- MOCKS
    //////////////////////////////////////////////////////

    MockWETH internal mockWeth;
    MockCreateX internal mockCreateX;
    MockStrategy internal mockStrategy;
    MockNonRebasing internal mockNonRebasing;
    MockWrappedSonic internal mockWrappedSonic;
    MockSFC internal mockSfc;
    MockSwapXPair internal mockSwapXPair;
    MockSwapXGauge internal mockSwapXGauge;
    MockERC20 internal swpxToken;
    CCTPMessageTransmitterMock internal cctpMessageTransmitterMock;
    CCTPTokenMessengerMock internal cctpTokenMessengerMock;
    MockERC4626Vault internal mockERC4626Vault;
    MockSSVNetwork internal mockSsvNetwork;
    MockSSV internal mockSsv;
    MockDepositContract internal mockDepositContract;
    MockBeaconProofs internal mockBeaconProofs;

    //////////////////////////////////////////////////////
    /// --- ZAPPERS
    //////////////////////////////////////////////////////

    OETHZapper internal oethZapper;
    OSonicZapper internal oSonicZapper;
    OETHBaseZapper internal oethBaseZapper;
    WOETHCCIPZapper internal woethCcipZapper;

    //////////////////////////////////////////////////////
    /// --- EXTERNAL TOKENS
    //////////////////////////////////////////////////////

    IERC20 internal crv;
    IERC20 internal usdc;
    IERC20 internal usdt;
    IERC20 internal weth;

    //////////////////////////////////////////////////////
    /// --- POOL BOOSTER CONTRACTS
    //////////////////////////////////////////////////////

    PoolBoostCentralRegistry internal centralRegistry;
    PoolBoosterFactorySwapxSingle internal factorySwapxSingle;
    PoolBoosterFactorySwapxDouble internal factorySwapxDouble;
    PoolBoosterFactoryMerkl internal factoryMerkl;
    PoolBoosterFactoryMetropolis internal factoryMetropolis;

    PoolBoosterSwapxSingle internal boosterSwapxSingle;
    PoolBoosterSwapxDouble internal boosterSwapxDouble;
    PoolBoosterMerklV2 internal boosterMerkl;
    PoolBoosterMetropolis internal boosterMetropolis;

    CurvePoolBooster internal curvePoolBooster;
    CurvePoolBoosterPlain internal curvePoolBoosterPlain;
    CurvePoolBoosterFactory internal curvePoolBoosterFactory;

    //////////////////////////////////////////////////////
    /// --- STRATEGIES
    //////////////////////////////////////////////////////

    BridgedWOETHStrategy internal bridgedWOETHStrategy;
    CurveAMOStrategy internal curveAMOStrategy;
    BaseCurveAMOStrategy internal baseCurveAMOStrategy;
    SonicStakingStrategy internal sonicStakingStrategy;
    SonicSwapXAMOStrategy internal sonicSwapXAMOStrategy;
    CrossChainMasterStrategy internal crossChainMasterStrategy;
    CrossChainRemoteStrategy internal crossChainRemoteStrategy;
    AerodromeAMOStrategy internal aerodromeAMOStrategy;
    AerodromeAMOQuoter internal aerodromeAMOQuoter;
    NativeStakingSSVStrategy internal nativeStakingSSVStrategy;
    FeeAccumulator internal nativeStakingFeeAccumulator;
    CompoundingStakingSSVStrategy internal compoundingStakingSSVStrategy;
    CompoundingStakingStrategyView internal compoundingStakingView;

    //////////////////////////////////////////////////////
    /// --- VAULT VALUE CHECKERS
    //////////////////////////////////////////////////////

    VaultValueChecker internal ousdChecker;
    OETHVaultValueChecker internal oethChecker;

    //////////////////////////////////////////////////////
    /// --- AUTOMATION MODULES
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    AutoWithdrawalModule internal autoWithdrawalModule;
    ClaimStrategyRewardsSafeModule internal claimStrategyRewardsModule;
    CollectXOGNRewardsModule internal collectXOGNRewardsModule;
    CurvePoolBoosterBribesModule internal curvePoolBoosterBribesModule;
    ClaimBribesSafeModule internal claimBribesModule;
    EthereumBridgeHelperModule internal ethereumBridgeHelperModule;
    BaseBridgeHelperModule internal baseBridgeHelperModule;

    //////////////////////////////////////////////////////
    /// --- FORK IDS
    //////////////////////////////////////////////////////

    uint256 internal forkIdMainnet;
    uint256 internal forkIdBase;
    uint256 internal forkIdSonic;
    uint256 internal forkIdArbitrum;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////
    function setUp() public virtual {
        // Create random users
        josh = makeAddr("Josh");
        matt = makeAddr("Matt");
        nick = makeAddr("Nick");
        domen = makeAddr("Domen");
        shahul = makeAddr("Shahul");
        daniel = makeAddr("Daniel");
        clement = makeAddr("Clement");

        // Create random users with same length names
        alice = makeAddr("Alice");
        bobby = makeAddr("Bobby");
        cathy = makeAddr("Cathy");
        david = makeAddr("David");
        emily = makeAddr("Emily");
        frank = makeAddr("Frank");

        // Create deployer and governance actors
        deployer = makeAddr("Deployer");
        governor = makeAddr("Governor");
        guardian = makeAddr("Guardian");
        strategist = makeAddr("Strategist");

        // Create automation operator
        operator = makeAddr("Operator");
    }
}
