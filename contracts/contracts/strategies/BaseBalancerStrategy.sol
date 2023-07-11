// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Base Balancer Abstract Strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IBalancerVault } from "../interfaces/IBalancerVault.sol";

abstract contract BaseBalancerStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;
    address internal auraDepositorAddress;
    address internal auraRewardStakerAddress;
    uint256 internal auraDepositorPTokenId;
    address internal pTokenAddress;
    bytes32 internal balancerPoolId;
    // Max withdrawal slippage denominated in 1e18 (1e18 == 100%)
    uint256 public maxWithdrawalSlippage;
    int256[50] private __reserved;
    IBalancerVault private balancerVault = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

    event MaxWithdrawalSlippageUpdated(
        uint256 _prevMaxSlippagePercentage,
        uint256 _newMaxSlippagePercentage
    );

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Balancer's strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of BAL & AURA
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                WETH, stETH
     * @param _pTokens Platform Token corresponding addresses
     * @param platformAddress Address of the Balancer's 3pool
     * @param vaultAddress Address of the vault
     * @param auraDepositorAddress Address of the Auraa depositor(AKA booster) for this pool
     * @param auraRewardStakerAddress Address of the Aura rewards staker
     * @param auraDepositorPTokenId Address of the Aura rewards staker
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // BAL & AURA
        address[] calldata _assets,
        address[] calldata _pTokens,
        address platformAddress,
        address vaultAddress,
        address auraDepositorAddress,
        address auraRewardStakerAddress,
        uint256 auraDepositorPTokenId,
        bytes32 balancerPoolId
    ) external onlyGovernor initializer {
        auraDepositorAddress = auraDepositorAddress;
        auraRewardStakerAddress = auraRewardStakerAddress;
        auraDepositorPTokenId = auraDepositorPTokenId;
        pTokenAddress = _pTokens[0];
        maxWithdrawalSlippage = 1e15;
        balancerPoolId = balancerPoolId;

        super._initialize(
            platformAddress,
            vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    /**
     * @dev Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return assetToPToken[_asset] != address(0);
    }

    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256)
    {
        (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = balancerVault.getPoolTokens(balancerPoolId);
        // TODO: override in AURA implementation
        uint256 yourPoolShare = IERC20(pTokenAddress).balanceOf(address(this)) / IERC20(pTokenAddress).totalSupply();
        
        uint256 balancesLength = balances.length;
        for (uint256 i=0; i < balances.length; ++i){
            if(address(tokens[i]) == _asset) {
                return balances[i] * yourPoolShare;
            }
        }
    }

    

    /**
     * @dev Sets max withdrawal slippage that is considered when removing
     * liquidity from Balancer pools.
     * @param _maxWithdrawalSlippage Max withdrawal slippage denominated in
     *        wad (number with 18 decimals): 1e18 == 100%, 1e16 == 1%
     *
     * IMPORTANT Minimum maxWithdrawalSlippage should actually be 0.1% (1e15)
     * for production usage. Contract allows as low value as 0% for confirming
     * correct behavior in test suite.
     */
    function setMaxWithdrawalSlippage(uint256 _maxWithdrawalSlippage)
        external
        onlyVaultOrGovernorOrStrategist
    {
        require(
            _maxWithdrawalSlippage <= 1e18,
            "Max withdrawal slippage needs to be between 0% - 100%"
        );
        emit MaxWithdrawalSlippageUpdated(
            maxWithdrawalSlippage,
            _maxWithdrawalSlippage
        );
        maxWithdrawalSlippage = _maxWithdrawalSlippage;
    }

    function _approveBase() internal {
        IERC20 pToken = IERC20(pTokenAddress);
        // Balancer vault for BPT token (required for removing liquidity)
        pToken.safeApprove(address(balancerVault), 0);
        pToken.safeApprove(address(balancerVault), type(uint256).max);

        // Gauge for LP token
        pToken.safeApprove(auraDepositorAddress, 0);
        pToken.safeApprove(auraDepositorAddress, type(uint256).max);
    }

}