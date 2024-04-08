// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IVault } from "../interfaces/IVault.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IRateProvider } from "../interfaces/balancer/IRateProvider.sol";

import { IBalancerVault } from "../interfaces/balancer/IBalancerVault.sol";
import { IERC20 } from "../utils/InitializableAbstractStrategy.sol";

import { StableMath } from "../utils/StableMath.sol";

contract MockEvilReentrantContract {
    using StableMath for uint256;

    IBalancerVault public immutable balancerVault;
    IERC20 public immutable reth;
    IERC20 public immutable weth;
    IVault public immutable oethVault;
    address public immutable poolAddress;
    bytes32 public immutable balancerPoolId;

    constructor(
        address _balancerVault,
        address _oethVault,
        address _reth,
        address _weth,
        address _poolAddress,
        bytes32 _poolId
    ) {
        balancerVault = IBalancerVault(_balancerVault);
        oethVault = IVault(_oethVault);
        reth = IERC20(_reth);
        weth = IERC20(_weth);
        poolAddress = _poolAddress;
        balancerPoolId = _poolId;
    }

    function doEvilStuff() public {
        address priceProvider = oethVault.priceProvider();
        uint256 rethPrice = IOracle(priceProvider).price(address(reth));

        // 1. Join pool
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = uint256(10 ether);
        amounts[1] = rethPrice * 10;

        address[] memory assets = new address[](2);
        assets[0] = address(reth);
        assets[1] = address(weth);

        uint256 minBPT = getBPTExpected(assets, amounts).mulTruncate(
            0.99 ether
        );

        bytes memory joinUserData = abi.encode(
            IBalancerVault.WeightedPoolJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT,
            amounts,
            minBPT
        );

        IBalancerVault.JoinPoolRequest memory joinRequest = IBalancerVault
            .JoinPoolRequest(assets, amounts, joinUserData, false);

        balancerVault.joinPool(
            balancerPoolId,
            address(this),
            address(this),
            joinRequest
        );

        uint256 bptTokenBalance = IERC20(poolAddress).balanceOf(address(this));

        // 2. Redeem as ETH
        bytes memory exitUserData = abi.encode(
            IBalancerVault.WeightedPoolExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT,
            bptTokenBalance,
            1
        );

        assets[1] = address(0); // Receive ETH instead of WETH
        uint256[] memory exitAmounts = new uint256[](2);
        exitAmounts[1] = 15 ether;
        IBalancerVault.ExitPoolRequest memory exitRequest = IBalancerVault
            .ExitPoolRequest(assets, exitAmounts, exitUserData, false);

        balancerVault.exitPool(
            balancerPoolId,
            address(this),
            payable(address(this)),
            exitRequest
        );
        bptTokenBalance = IERC20(poolAddress).balanceOf(address(this));
    }

    function getBPTExpected(address[] memory _assets, uint256[] memory _amounts)
        internal
        view
        virtual
        returns (uint256 bptExpected)
    {
        // Get the oracle from the OETH Vault
        address priceProvider = oethVault.priceProvider();

        for (uint256 i = 0; i < _assets.length; ++i) {
            uint256 strategyAssetMarketPrice = IOracle(priceProvider).price(
                _assets[i]
            );
            // convert asset amount to ETH amount
            bptExpected =
                bptExpected +
                _amounts[i].mulTruncate(strategyAssetMarketPrice);
        }

        uint256 bptRate = IRateProvider(poolAddress).getRate();
        // Convert ETH amount to BPT amount
        bptExpected = bptExpected.divPrecisely(bptRate);
    }

    function approveAllTokens() public {
        // Approve all tokens
        weth.approve(address(oethVault), type(uint256).max);
        reth.approve(poolAddress, type(uint256).max);
        weth.approve(poolAddress, type(uint256).max);
        reth.approve(address(balancerVault), type(uint256).max);
        weth.approve(address(balancerVault), type(uint256).max);
    }

    receive() external payable {
        // 3. Try to mint OETH
        oethVault.mint(address(weth), 1 ether, 0.9 ether);
    }
}
