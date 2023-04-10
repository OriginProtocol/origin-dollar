// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OUSD Timelock Contract
 * @author Origin Protocol Inc
 */
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface CapitalPausable {
    function pauseCapital() external;

    function unpauseCapital() external;
}

contract Timelock {
    using SafeMath for uint256;

    event NewAdmin(address indexed newAdmin);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewDelay(uint256 indexed newDelay);
    event CancelTransaction(
        bytes32 indexed txHash,
        address indexed target,
        string signature,
        bytes data,
        uint256 eta
    );
    event ExecuteTransaction(
        bytes32 indexed txHash,
        address indexed target,
        string signature,
        bytes data,
        uint256 eta
    );
    event QueueTransaction(
        bytes32 indexed txHash,
        address indexed target,
        string signature,
        bytes data,
        uint256 eta
    );

    uint256 public constant GRACE_PERIOD = 3 days;
    uint256 public constant MINIMUM_DELAY = 1 minutes;
    uint256 public constant MAXIMUM_DELAY = 2 days;

    address public admin;
    address public pendingAdmin;
    uint256 public delay;

    mapping(bytes32 => bool) public queuedTransactions;

    /**
     * @dev Throws if called by any account other than the Admin.
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Caller is not the admin");
        _;
    }

    constructor(address admin_, uint256 delay_) {
        require(
            delay_ >= MINIMUM_DELAY,
            "Timelock::constructor: Delay must exceed minimum delay."
        );
        require(
            delay_ <= MAXIMUM_DELAY,
            "Timelock::setDelay: Delay must not exceed maximum delay."
        );

        admin = admin_;
        delay = delay_;
    }

    function setDelay(uint256 delay_) public {
        require(
            msg.sender == address(this),
            "Timelock::setDelay: Call must come from Timelock."
        );
        require(
            delay_ >= MINIMUM_DELAY,
            "Timelock::setDelay: Delay must exceed minimum delay."
        );
        require(
            delay_ <= MAXIMUM_DELAY,
            "Timelock::setDelay: Delay must not exceed maximum delay."
        );
        delay = delay_;

        emit NewDelay(delay);
    }

    function acceptAdmin() public {
        require(
            msg.sender == pendingAdmin,
            "Timelock::acceptAdmin: Call must come from pendingAdmin."
        );
        admin = msg.sender;
        pendingAdmin = address(0);

        emit NewAdmin(admin);
    }

    function setPendingAdmin(address pendingAdmin_) public onlyAdmin {
        pendingAdmin = pendingAdmin_;

        emit NewPendingAdmin(pendingAdmin);
    }

    function queueTransaction(
        address target,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) internal returns (bytes32) {
        require(
            msg.sender == admin,
            "Timelock::queueTransaction: Call must come from admin."
        );
        require(
            eta >= getBlockTimestamp().add(delay),
            "Timelock::queueTransaction: Estimated execution block must satisfy delay."
        );

        bytes32 txHash = keccak256(
            abi.encode(target, signature, keccak256(data), eta)
        );
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, signature, data, eta);
        return txHash;
    }

    function cancelTransaction(
        address target,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) internal {
        require(
            msg.sender == admin,
            "Timelock::cancelTransaction: Call must come from admin."
        );

        bytes32 txHash = keccak256(
            abi.encode(target, signature, keccak256(data), eta)
        );
        queuedTransactions[txHash] = false;

        emit CancelTransaction(txHash, target, signature, data, eta);
    }

    function _getRevertMsg(bytes memory _returnData)
        internal
        pure
        returns (string memory)
    {
        // If the _res length is less than 68, then the transaction failed
        // silently (without a revert message)
        if (_returnData.length < 68) return "Transaction reverted silently";

        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string));
    }

    function executeTransaction(
        address target,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) internal returns (bytes memory) {
        require(
            msg.sender == admin,
            "Timelock::executeTransaction: Call must come from admin."
        );

        bytes32 txHash = keccak256(
            abi.encode(target, signature, keccak256(data), eta)
        );
        require(
            queuedTransactions[txHash],
            "Timelock::executeTransaction: Transaction hasn't been queued."
        );
        require(
            getBlockTimestamp() >= eta,
            "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
        );
        require(
            getBlockTimestamp() <= eta.add(GRACE_PERIOD),
            "Timelock::executeTransaction: Transaction is stale."
        );

        queuedTransactions[txHash] = false;

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(
                bytes4(keccak256(bytes(signature))),
                data
            );
        }

        (bool success, bytes memory returnData) = target.call(callData);

        if (!success) {
            revert(_getRevertMsg(returnData));
        }

        emit ExecuteTransaction(txHash, target, signature, data, eta);

        return returnData;
    }

    function getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }

    function pauseCapital(address target) external {
        require(
            msg.sender == admin,
            "Timelock::pauseCapital: Call must come from admin."
        );
        CapitalPausable(target).pauseCapital();
    }

    function unpauseCapital(address target) external {
        require(
            msg.sender == admin,
            "Timelock::unpauseCapital: Call must come from admin."
        );
        CapitalPausable(target).unpauseCapital();
    }
}
