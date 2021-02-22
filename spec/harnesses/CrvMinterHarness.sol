import "../../contracts/contracts/strategies/ICRVMinter.sol";

interface Mintable {
    function mint(address, uint) external;
}

contract CrvMinterHarness is ICRVMinter {
    mapping(address => mapping (uint => uint)) whoToIndexToMintAmount;
    mapping(address => uint) whoToCurrentIndex;
    address public crvToken;

    function mint(address gaugeAddress) external {
        uint index = whoToCurrentIndex[msg.sender];
        uint amt = whoToIndexToMintAmount[msg.sender][index];
        whoToCurrentIndex[msg.sender] = index+1;
        Mintable(crvToken).mint(msg.sender, amt);
    }
}