// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOToken {
    // Events
    event TotalSupplyUpdatedHighres(
        uint256 totalSupply,
        uint256 rebasingCredits,
        uint256 rebasingCreditsPerToken
    );
    event AccountRebasingEnabled(address account);
    event AccountRebasingDisabled(address account);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event YieldDelegated(address source, address target);
    event YieldUndelegated(address source, address target);

    // View functions
    function symbol() external view returns (string memory);

    function name() external view returns (string memory);

    function decimals() external view returns (uint8);

    function totalSupply() external view returns (uint256);

    function vaultAddress() external view returns (address);

    function nonRebasingSupply() external view returns (uint256);

    function rebasingCreditsPerTokenHighres()
        external
        view
        returns (uint256);

    function rebasingCreditsPerToken() external view returns (uint256);

    function rebasingCreditsHighres() external view returns (uint256);

    function rebasingCredits() external view returns (uint256);

    function balanceOf(address _account) external view returns (uint256);

    function creditsBalanceOf(address _account)
        external
        view
        returns (uint256, uint256);

    function creditsBalanceOfHighres(address _account)
        external
        view
        returns (
            uint256,
            uint256,
            bool
        );

    function nonRebasingCreditsPerToken(address _account)
        external
        view
        returns (uint256);

    function allowance(address _owner, address _spender)
        external
        view
        returns (uint256);

    function rebaseState(address _account) external view returns (uint8);

    function yieldTo(address _account) external view returns (address);

    function yieldFrom(address _account) external view returns (address);

    // State-changing functions
    function initialize(address _vaultAddress, uint256 _initialCreditsPerToken)
        external;

    function transfer(address _to, uint256 _value) external returns (bool);

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool);

    function approve(address _spender, uint256 _value)
        external
        returns (bool);

    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function changeSupply(uint256 _newTotalSupply) external;

    function rebaseOptIn() external;

    function rebaseOptOut() external;

    function governanceRebaseOptIn(address _account) external;

    function delegateYield(address _from, address _to) external;

    function undelegateYield(address _from) external;
}
