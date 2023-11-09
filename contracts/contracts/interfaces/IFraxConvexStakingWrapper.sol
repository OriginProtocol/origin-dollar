// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IFraxConvexStakingWrapper is IERC20 {
    event Deposited(
        address indexed _user,
        address indexed _account,
        uint256 _amount,
        bool _wrapped
    );
    event Withdrawn(address indexed _user, uint256 _amount, bool _unwrapped);
    event RewardInvalidated(address _rewardToken);
    event RewardRedirected(address indexed _account, address _forward);
    event RewardAdded(address _token);
    event Shutdown();

    struct EarnedData {
        address token;
        uint256 amount;
    }

    function collateralVault() external view returns (address);

    function convexBooster() external view returns (address);

    function convexPool() external view returns (address);

    function convexPoolId() external view returns (uint256);

    function convexToken() external view returns (address);

    function curveToken() external view returns (address);

    function deposit(uint256 _amount, address _to) external;

    function earned(address _account)
        external
        returns (EarnedData[] memory claimable);

    function getReward(address _account, address _forwardTo) external;

    function getReward(address _account) external;

    function isShutdown() external view returns (bool);

    function rewardLength() external view returns (uint256);

    function rewardRedirect(address) external view returns (address);

    function rewards(uint256)
        external
        view
        returns (
            address reward_token,
            address reward_pool,
            uint256 reward_integral,
            uint256 reward_remaining
        );

    function stake(uint256 _amount, address _to) external;

    function totalBalanceOf(address _account) external view returns (uint256);

    function withdraw(uint256 _amount) external;

    function withdrawAndUnwrap(uint256 _amount) external;
}
