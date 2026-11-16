// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {
    InitializeGovernedUpgradeabilityProxy as Proxy
} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {OETHProxy, OETHVaultProxy, CompoundingStakingStrategyProxy} from "contracts/proxies/Proxies.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {BeaconProofs} from "contracts/beacon/BeaconProofs.sol";
import {BeaconProofsGloas} from "contracts/beacon/BeaconProofsGloas.sol";
import {BeaconProofsForkRouter} from "contracts/beacon/BeaconProofsForkRouter.sol";
import {CompoundingStakingStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingStrategy.sol";
import {CompoundingStakingStrategyView} from "contracts/strategies/NativeStaking/CompoundingStakingView.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IHoodiWETH is IERC20 {
    function deposit() external payable;
}

/// @notice Fresh, independent Hoodi stack. Existing Defender-controlled contracts are never called.
contract $001_FreshStaking is AbstractDeployScript("001_FreshStaking") {
    address internal constant WETH = 0x2387fD72C1DA19f6486B843F5da562679FbB4057;
    address internal constant DEPOSIT = 0x00000000219ab540356cBB839Cbe05303d7705Fa;
    address internal constant OLD_RELAYER = 0x419B6BdAE482f41b8B194515749F3A2Da26d583b;
    uint64 internal constant GENESIS = 1_742_213_400;

    function _execute() internal override {
        require(block.chainid == 560048, "Hoodi only");
        address relayer = vm.envAddress("HOODI_RELAYER_ADDRESS");
        require(relayer != address(0) && relayer != OLD_RELAYER, "Invalid Hoodi relayer");
        require(relayer != deployer, "Use a separate bootstrap deployer");
        require(WETH.code.length > 0 && DEPOSIT.code.length > 0, "Missing Hoodi dependencies");

        OETHProxy tokenProxy = new OETHProxy();
        OETHVaultProxy vaultProxy = new OETHVaultProxy();
        CompoundingStakingStrategyProxy strategyProxy = new CompoundingStakingStrategyProxy();
        OETH tokenImpl = new OETH();
        OETHVault vaultImpl = new OETHVault(WETH);
        tokenProxy.initialize(
            address(tokenImpl),
            deployer,
            abi.encodeWithSignature("initialize(address,uint256)", address(vaultProxy), 1e27)
        );
        vaultProxy.initialize(
            address(vaultImpl), deployer, abi.encodeWithSignature("initialize(address)", address(tokenProxy))
        );

        BeaconProofs legacy = new BeaconProofs();
        BeaconProofsGloas gloas = new BeaconProofsGloas();
        // Zero selects legacy first; the router still accepts Gloas proofs via its fallback.
        BeaconProofsForkRouter router = new BeaconProofsForkRouter(
            address(legacy), address(gloas), vm.envOr("HOODI_GLAMSTERDAM_TIMESTAMP", uint256(0))
        );
        CompoundingStakingStrategy strategyImpl = new CompoundingStakingStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(vaultProxy)
            }),
            WETH,
            DEPOSIT,
            address(router),
            GENESIS
        );
        address[] memory empty = new address[](0);
        strategyProxy.initialize(
            address(strategyImpl),
            deployer,
            abi.encodeWithSignature("initialize(address[],address[],address[],uint256)", empty, empty, empty, 1 ether)
        );
        CompoundingStakingStrategy strategy = CompoundingStakingStrategy(payable(address(strategyProxy)));
        OETHVault vault = OETHVault(address(vaultProxy));
        strategy.setRegistrator(relayer);
        vault.setStrategistAddr(relayer);
        vault.setOperatorAddr(relayer);
        vault.setMaxSupplyDiff(5e16);
        vault.setDripDuration(0);
        vault.setRebaseRateMax(200e18);
        vault.setWithdrawalClaimDelay(10 minutes);
        vault.approveStrategy(address(strategyProxy));
        vault.setDefaultStrategy(address(strategyProxy));
        vault.unpauseCapital();

        CompoundingStakingStrategyView strategyView = new CompoundingStakingStrategyView(address(strategyProxy));
        _recordDeployment("OETH_IMPL", address(tokenImpl), type(OETH).name);
        _recordDeployment("OETH_PROXY", address(tokenProxy), type(OETHProxy).name);
        _recordDeployment("OETH_VAULT_IMPL", address(vaultImpl), type(OETHVault).name);
        _recordDeployment("OETH_VAULT_PROXY", address(vaultProxy), type(OETHVaultProxy).name);
        _recordDeployment("BEACON_PROOFS_LEGACY", address(legacy), type(BeaconProofs).name);
        _recordDeployment("BEACON_PROOFS_GLOAS", address(gloas), type(BeaconProofsGloas).name);
        _recordDeployment("BEACON_PROOFS_ROUTER", address(router), type(BeaconProofsForkRouter).name);
        _recordDeployment(
            "COMPOUNDING_STAKING_STRATEGY_IMPL", address(strategyImpl), type(CompoundingStakingStrategy).name
        );
        _recordDeployment(
            "COMPOUNDING_STAKING_STRATEGY_PROXY", address(strategyProxy), type(CompoundingStakingStrategyProxy).name
        );
        _recordDeployment(
            "COMPOUNDING_STAKING_STRATEGY_VIEW", address(strategyView), type(CompoundingStakingStrategyView).name
        );

        tokenProxy.transferGovernance(relayer);
        vaultProxy.transferGovernance(relayer);
        strategyProxy.transferGovernance(relayer);
    }

    function _fork() internal override {
        address relayer = vm.envAddress("HOODI_RELAYER_ADDRESS");
        address tokenAddress = resolver.resolve("OETH_PROXY");
        address vaultAddress = resolver.resolve("OETH_VAULT_PROXY");
        address strategyAddress = resolver.resolve("COMPOUNDING_STAKING_STRATEGY_PROXY");
        address[3] memory proxies = [tokenAddress, vaultAddress, strategyAddress];
        for (uint256 i; i < proxies.length; ++i) {
            Proxy proxy = Proxy(payable(proxies[i]));
            if (proxy.governor() != relayer) {
                vm.prank(relayer);
                proxy.claimGovernance();
            }
            require(proxy.governor() == relayer, "Governance handoff failed");
        }
        OETHVault vault = OETHVault(vaultAddress);
        CompoundingStakingStrategy strategy = CompoundingStakingStrategy(payable(strategyAddress));
        require(vault.strategistAddr() == relayer, "Wrong strategist");
        require(vault.operatorAddr() == relayer, "Wrong operator");
        require(vault.defaultStrategy() == strategyAddress, "Wrong default strategy");
        require(strategy.validatorRegistrator() == relayer, "Wrong registrator");
        require(strategy.BEACON_PROOFS() == resolver.resolve("BEACON_PROOFS_ROUTER"), "Wrong verifier");
        require(strategy.vaultAddress() == vaultAddress, "Wrong vault");
        require(strategy.initialDepositAmountWei() == 1 ether, "Wrong initial deposit");
        address user = address(0xBEEF);
        vm.deal(user, 1 ether);
        vm.startPrank(user);
        IHoodiWETH(WETH).deposit{value: 1 ether}();
        IHoodiWETH(WETH).approve(vaultAddress, 1 ether);
        vault.mint(1 ether);
        vault.allocate();
        vm.stopPrank();
        require(OETH(tokenAddress).balanceOf(user) == 1 ether, "Mint failed");
        require(strategy.checkBalance(WETH) == 1 ether, "Allocation failed");
    }
}
