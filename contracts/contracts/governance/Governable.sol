pragma solidity 0.5.17;

/**
 * @dev Copy of the openzeppelin Ownable.sol contract with nomenclature change
 * from owner to governor and renounce methods removed. Does not use Context.sol
 * like Ownable.sol does for simplification.
 *
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v2.5.0/contracts/ownership/Ownable.sol
 */

contract Governable {
    address private _governor;

    event GovernorshipTransferred(
        address indexed previousGovernor,
        address indexed newGovernor
    );

    /**
     * @dev Initializes the contract setting the deployer as the initial Governor.
     */
    constructor() internal {
        _governor = msg.sender;
        emit GovernorshipTransferred(address(0), _governor);
    }

    /**
     * @dev Returns the address of the current Governor.
     */
    function governor() public view returns (address) {
        return _governor;
    }

    /**
     * @dev Throws if called by any account other than the Governor.
     */
    modifier onlyGovernor() {
        require(isGovernor(), "Caller is not the Governor");
        _;
    }

    /**
     * @dev Returns true if the caller is the current Governor.
     */
    function isGovernor() public view returns (bool) {
        return msg.sender == _governor;
    }

    /**
     * @dev Transfers Governance of the contract to a new account (`newGovernor`).
     * Can only be called by the current Governor.
     * @param _newGovernor Address of the new Governor
     */
    function changeGovernor(address _newGovernor) external onlyGovernor {
        _changeGovernor(_newGovernor);
    }

    /**
     * @dev Change Governance of the contract to a new account (`newGovernor`).
     * @param _newGovernor Address of the new Governor
     */
    function _changeGovernor(address _newGovernor) internal {
        require(_newGovernor != address(0), "New Governor is address(0)");
        emit GovernorshipTransferred(_governor, _newGovernor);
        _governor = _newGovernor;
    }
}
