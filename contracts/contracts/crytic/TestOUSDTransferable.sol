import "./PropertiesOUSDTransferable.sol";

contract TestOUSDTransferable is PropertiesOUSDTransferable {
    constructor() public {
        // Existing addresses:
        // - crytic_owner: If the contract has an owner, it must be crytic_owner
        // - crytic_user: Legitimate user
        // - crytic_attacker: Attacker
        //
        // Add below a minimal configuration:
        // - crytic_owner must have some tokens
        // - crytic_user must have some tokens
        // - crytic_attacker must have some tokens

        rebasingCredits = 0;
        rebasingCreditsPerToken = 1e18;
        vaultAddress = crytic_owner;
        nonRebasingSupply = 0;

        initialTotalSupply = ~uint128(0);
        initialBalance_owner = initialTotalSupply / 3;
        _mint(crytic_owner, initialBalance_owner);
        initialBalance_user = initialTotalSupply / 3;
        _mint(crytic_user, initialBalance_user);
        initialBalance_attacker = initialTotalSupply / 3;
        _mint(crytic_attacker, initialBalance_attacker);
    }

    function initialize(
        string calldata _nameArg,
        string calldata _symbolArg,
        address _vaultAddress
    ) external {
        revert();
    } // We don't need to call initialize
}
