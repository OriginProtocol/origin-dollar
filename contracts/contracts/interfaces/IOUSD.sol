// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOUSD {
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event GovernorshipTransferred(
        address indexed previousGovernor,
        address indexed newGovernor
    );
    event PendingGovernorshipTransfer(
        address indexed previousGovernor,
        address indexed newGovernor
    );
    event TotalSupplyUpdatedHighres(
        uint256 totalSupply,
        uint256 rebasingCredits,
        uint256 rebasingCreditsPerToken
    );
    event Transfer(address indexed from, address indexed to, uint256 value);

    function _totalSupply() external view returns (uint256);

    function allowance(address _owner, address _spender)
        external
        view
        returns (uint256);

    function approve(address _spender, uint256 _value) external returns (bool);

    function balanceOf(address _account) external view returns (uint256);

    function burn(address account, uint256 amount) external;

    function changeSupply(uint256 _newTotalSupply) external;

    function claimGovernance() external;

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

    function decimals() external view returns (uint8);

    function decreaseAllowance(address _spender, uint256 _subtractedValue)
        external
        returns (bool);

    function governor() external view returns (address);

    function increaseAllowance(address _spender, uint256 _addedValue)
        external
        returns (bool);

    function initialize(
        string memory _nameArg,
        string memory _symbolArg,
        address _vaultAddress
    ) external;

    function isGovernor() external view returns (bool);

    function isUpgraded(address) external view returns (uint256);

    function mint(address _account, uint256 _amount) external;

    function name() external view returns (string memory);

    function nonRebasingCreditsPerToken(address)
        external
        view
        returns (uint256);

    function nonRebasingSupply() external view returns (uint256);

    function rebaseOptIn() external;

    function rebaseOptOut() external;

    function rebaseState(address) external view returns (uint8);

    function rebasingCredits() external view returns (uint256);

    function rebasingCreditsHighres() external view returns (uint256);

    function rebasingCreditsPerToken() external view returns (uint256);

    function rebasingCreditsPerTokenHighres() external view returns (uint256);

    function symbol() external view returns (string memory);

    function totalSupply() external view returns (uint256);

    function transfer(address _to, uint256 _value) external returns (bool);

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool);

    function transferGovernance(address _newGovernor) external;

    function vaultAddress() external view returns (address);
}
