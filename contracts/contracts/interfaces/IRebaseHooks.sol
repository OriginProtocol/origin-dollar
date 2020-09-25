pragma solidity 0.5.11;

interface IRebaseHooks {
    function postRebase(bool sync) external;
}
