// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, SafeERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IBasicToken } from "../../interfaces/IBasicToken.sol";

import { AbstractCrossChainV3Strategy } from "./AbstractCrossChainV3Strategy.sol";

/**
 * @title AbstractWOTokenStrategy
 * @author Origin Protocol Inc
 *
 * @notice Shared base for the wOToken cross-chain strategy pair (Master on L2, Remote on
 *         Ethereum). Lifts everything that's duplicated between Master and Remote:
 *
 *           - The `bridgeAsset` immutable and the 18-decimal invariant it must satisfy.
 *           - `_abstractSetPToken` and `collectRewardTokens` no-op stubs (Strategy base
 *             requires them; neither strategy uses them).
 *           - `onlyOperatorGovernorOrStrategist` modifier (operator OR strategist OR governor).
 *           - Outbound-adapter allowance rotation, shared because both sides only ever
 *             push `bridgeAsset` through the adapter.
 */
abstract contract AbstractWOTokenStrategy is
    AbstractCrossChainV3Strategy,
    InitializableAbstractStrategy
{
    using SafeERC20 for IERC20;

    // --- Constants & immutables --------------------------------------------

    /// @notice Asset that bridges between Master and Remote (WETH for OETHb).
    address public immutable bridgeAsset;

    /// @dev Reserved for future expansion of this abstract layer.
    uint256[50] private __gap;

    // --- Construction -------------------------------------------------------

    constructor(BaseStrategyConfig memory _stratConfig, address _bridgeAsset)
        InitializableAbstractStrategy(_stratConfig)
    {
        require(_bridgeAsset != address(0), "WOT: bridge asset required");
        // The pair accounts in a single 18-decimal domain: bridgeAsset amounts, OToken
        // amounts and wOToken share values are all directly comparable with no scaling.
        // Enforced here so a mismatched asset fails at deploy rather than mis-accounting.
        require(
            IBasicToken(_bridgeAsset).decimals() == 18,
            "WOT: bridge asset not 18dp"
        );
        bridgeAsset = _bridgeAsset;
    }

    /// @dev Shared `initialize` body: no reward tokens, `[bridgeAsset]` as the supported
    ///      asset, and `[pToken]` as the platform token for the strategy registry. Master
    ///      passes `bridgeAsset` (it has no real platform); Remote passes `woToken`.
    function _initWithPToken(address pToken) internal {
        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](1);
        address[] memory pTokens = new address[](1);
        assets[0] = bridgeAsset;
        pTokens[0] = pToken;
        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    // --- Modifiers ----------------------------------------------------------

    /// @notice Permits the operator, strategist, or governor.
    modifier onlyOperatorGovernorOrStrategist() {
        require(
            msg.sender == operator ||
                isGovernor() ||
                msg.sender == IVault(vaultAddress).strategistAddr(),
            "WOT: not authorised"
        );
        _;
    }

    // --- Strategy-base shims (no-op) ---------------------------------------

    /// @inheritdoc InitializableAbstractStrategy
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == bridgeAsset;
    }

    /// @inheritdoc InitializableAbstractStrategy
    function _abstractSetPToken(address, address) internal override {}

    /// @inheritdoc InitializableAbstractStrategy
    function collectRewardTokens()
        external
        override
        onlyHarvesterOrStrategist
        nonReentrant
    {}

    /**
     * @inheritdoc AbstractCrossChainV3Strategy
     * @dev Rotates the bridgeAsset allowance from the old outbound adapter to the new one
     *      (old → 0, new → max) so the per-op send path never needs a per-call approve.
     *      Shared by Master and Remote — both only ever push bridgeAsset through the adapter.
     */
    function _setOutboundAdapter(address _outboundAdapter)
        internal
        virtual
        override
    {
        address old = outboundAdapter;
        if (old != address(0) && old != _outboundAdapter) {
            IERC20(bridgeAsset).safeApprove(old, 0);
        }
        // slither-disable-next-line reentrancy-no-eth
        super._setOutboundAdapter(_outboundAdapter);
        if (_outboundAdapter != address(0) && old != _outboundAdapter) {
            IERC20(bridgeAsset).safeApprove(
                _outboundAdapter,
                type(uint256).max
            );
        }
    }
}
