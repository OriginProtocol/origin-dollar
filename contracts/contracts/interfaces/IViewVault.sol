pragma solidity 0.5.11;

contract IViewVault {
    function getAllAssets() public view returns (address[] memory);

    function totalValue() public view returns (uint256 value);

    function getAPR() public view returns (uint256);

    function priceUSDMint(string calldata symbol)
        external
        view
        returns (uint256);

    function priceUSDRedeem(string calldata symbol)
        external
        view
        returns (uint256);

    function calculateRedeemOutputs(uint256 _amount)
        external
        view
        returns (uint256[] memory);
}
