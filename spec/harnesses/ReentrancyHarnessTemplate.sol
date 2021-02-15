// replace SRC with the contract name, PATH with the path
import "./contracts/PATH/SRC.sol";
contract ReentrancyHarness is SRC {
    function isEnteredState() external view returns (bool) {
        bytes32 position = 0x53bf423e48ed90e97d02ab0ebab13b2a235a6bfbe9c321847d5c175333ac4535; // reentryStatusPosition;
        uint256 _reentry_status;
        assembly {
            _reentry_status := sload(position)
        }
        return _reentry_status == 2; // entered
    }
}