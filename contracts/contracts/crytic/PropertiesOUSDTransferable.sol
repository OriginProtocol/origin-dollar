import "./interfaces.sol";
import "../token/OUSD.sol";

contract PropertiesOUSDTransferable is CryticInterface, OUSD {
    function init_total_supply() public returns (bool) {
        return
            this.totalSupply() >= 0 && this.totalSupply() == initialTotalSupply;
    }

    function init_owner_balance() public returns (bool) {
        return initialBalance_owner == this.balanceOf(crytic_owner);
    }

    function init_user_balance() public returns (bool) {
        return initialBalance_user == this.balanceOf(crytic_user);
    }

    function init_attacker_balance() public returns (bool) {
        return initialBalance_attacker == this.balanceOf(crytic_attacker);
    }

    function init_caller_balance() public returns (bool) {
        return this.balanceOf(msg.sender) > 0;
    }

    function init_total_supply_is_balances() public returns (bool) {
        return
            this.balanceOf(crytic_owner) +
                this.balanceOf(crytic_user) +
                this.balanceOf(crytic_attacker) ==
            this.totalSupply();
    }

    function crytic_zero_always_empty_ERC20Properties() public returns (bool) {
        return this.balanceOf(address(0x0)) == 0;
    }

    function crytic_approve_overwrites() public returns (bool) {
        bool approve_return;
        approve_return = approve(crytic_user, 10);
        require(approve_return);
        approve_return = approve(crytic_user, 20);
        require(approve_return);
        return this.allowance(msg.sender, crytic_user) == 20;
    }

    function crytic_less_than_total_ERC20Properties() public returns (bool) {
        return this.balanceOf(msg.sender) <= totalSupply();
    }

    function crytic_revert_transfer_to_zero_ERC20PropertiesTransferable()
        public
        returns (bool)
    {
        if (this.balanceOf(msg.sender) == 0) {
            revert();
        }
        return transfer(address(0x0), this.balanceOf(msg.sender));
    }

    function crytic_revert_transferFrom_to_zero_ERC20PropertiesTransferable()
        public
        returns (bool)
    {
        uint256 balance = this.balanceOf(msg.sender);
        if (balance == 0) {
            revert();
        }
        approve(msg.sender, balance);
        return
            transferFrom(msg.sender, address(0x0), this.balanceOf(msg.sender));
    }

    function crytic_self_transferFrom_ERC20PropertiesTransferable()
        public
        returns (bool)
    {
        uint256 balance = this.balanceOf(msg.sender);
        bool approve_return = approve(msg.sender, balance);
        bool transfer_return = transferFrom(msg.sender, msg.sender, balance);
        return
            (this.balanceOf(msg.sender) == balance) &&
            approve_return &&
            transfer_return;
    }

    function crytic_self_transferFrom_to_other_ERC20PropertiesTransferable()
        public
        returns (bool)
    {
        uint256 balance = this.balanceOf(msg.sender);
        bool approve_return = approve(msg.sender, balance);
        address other = crytic_user;
        if (other == msg.sender) {
            other = crytic_owner;
        }
        bool transfer_return = transferFrom(msg.sender, other, balance);
        return
            (this.balanceOf(msg.sender) == 0) &&
            approve_return &&
            transfer_return;
    }

    function crytic_self_transfer_ERC20PropertiesTransferable()
        public
        returns (bool)
    {
        uint256 balance = this.balanceOf(msg.sender);
        bool transfer_return = transfer(msg.sender, balance);
        return (this.balanceOf(msg.sender) == balance) && transfer_return;
    }

    function crytic_transfer_to_other_ERC20PropertiesTransferable()
        public
        returns (bool)
    {
        uint256 balance = this.balanceOf(msg.sender);
        address other = crytic_user;
        if (other == msg.sender) {
            other = crytic_owner;
        }
        if (balance >= 1) {
            bool transfer_other = transfer(other, 1);
            return
                (this.balanceOf(msg.sender) == balance - 1) &&
                (this.balanceOf(other) >= 1) &&
                transfer_other;
        }
        return true;
    }

    function crytic_revert_transfer_to_user_ERC20PropertiesTransferable()
        public
        returns (bool)
    {
        uint256 balance = this.balanceOf(msg.sender);
        if (balance == (2**128 - 1)) return true;
        bool transfer_other = transfer(crytic_user, balance + 1);
        return transfer_other;
    }
}
