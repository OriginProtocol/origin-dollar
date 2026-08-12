// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Initializable } from "../utils/Initializable.sol";

/// @notice Shared reward-harvesting implementation for active wrapped-native-token deployments.
abstract contract SimpleHarvester is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    address public immutable wrappedNativeToken;
    address public dripper;
    mapping(address => bool) public supportedStrategies;
    uint256[48] private ___gap;

    event Harvested(
        address indexed strategy,
        address token,
        uint256 amount,
        address indexed receiver
    );
    event SupportedStrategyUpdated(address strategy, bool status);
    event DripperUpdated(address dripper);

    constructor(address _wrappedNativeToken) {
        wrappedNativeToken = _wrappedNativeToken;
        _setGovernor(address(0));
    }

    function initialize() external onlyGovernor initializer {}

    function harvestAndTransfer(address _strategy) external {
        _harvestAndTransfer(_strategy);
    }

    function harvestAndTransfer(address[] calldata _strategies) external {
        for (uint256 i = 0; i < _strategies.length; i++) {
            _harvestAndTransfer(_strategies[i]);
        }
    }

    function _harvestAndTransfer(address _strategy) internal virtual {
        require(supportedStrategies[_strategy], "Strategy not supported");

        address _strategist = strategistAddr;
        address _dripper = dripper;
        IStrategy(_strategy).collectRewardTokens();
        address[] memory rewardTokens = IStrategy(_strategy)
            .getRewardTokenAddresses();

        uint256 len = rewardTokens.length;
        for (uint256 i = 0; i < len; i++) {
            address token = rewardTokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                address receiver = token == wrappedNativeToken
                    ? _dripper
                    : _strategist;
                require(receiver != address(0), "Invalid receiver");
                IERC20(token).safeTransfer(receiver, balance);
                emit Harvested(_strategy, token, balance, receiver);
            }
        }
    }

    function setSupportedStrategy(address _strategy, bool _isSupported)
        external
        onlyGovernorOrStrategist
    {
        require(_strategy != address(0), "Invalid strategy");
        supportedStrategies[_strategy] = _isSupported;
        emit SupportedStrategyUpdated(_strategy, _isSupported);
    }

    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernorOrStrategist
    {
        IERC20(_asset).safeTransfer(strategistAddr, _amount);
    }

    function setDripper(address _dripper) external onlyGovernor {
        require(_dripper != address(0), "Invalid dripper");
        dripper = _dripper;
        emit DripperUpdated(_dripper);
    }
}
