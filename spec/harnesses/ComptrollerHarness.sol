import { IComptroller } from "../../contracts/contracts/interfaces/IComptroller.sol";

interface Mintable {
    function mint(address, uint) external;
}

contract ComptrollerHarness is IComptroller {
    mapping(address => mapping (uint => uint)) whoToIndexToMintAmount;
    mapping(address => uint) whoToCurrentIndex;
    address public compToken;

    function claimComp(address who) external {
        uint index = whoToCurrentIndex[who];
        uint amt = whoToIndexToMintAmount[who][index];
        whoToCurrentIndex[who] = index+1;
        Mintable(compToken).mint(who, amt);
    }
}