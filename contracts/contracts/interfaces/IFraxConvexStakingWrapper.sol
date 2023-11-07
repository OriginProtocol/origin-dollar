// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFraxConvexStakingWrapper {
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
