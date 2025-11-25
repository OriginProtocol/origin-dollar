// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Initializable } from "../utils/Initializable.sol";
import { Strategizable } from "../governance/Strategizable.sol";
import { CurvePoolBoosterPlain } from "./CurvePoolBoosterPlain.sol";
import { ICreateX } from "../interfaces/ICreateX.sol";
import { Initializable } from "../utils/Initializable.sol";

/// @title CurvePoolBoosterFactory
/// @author Origin Protocol
/// @notice Factory contract to create CurvePoolBoosterPlain instances
contract CurvePoolBoosterFactory is Initializable, Strategizable {
    /// @notice Address of the CreateX contract
    ICreateX public constant CREATEX =
        ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);
    event CurvePoolBoosterPlainCreated(address indexed poolBoosterAddress);

    /// @notice Initialize the contract. Normally we'd rather have the governor and strategist set in the constructor,
    ///         but since this contract is deployed by CreateX we need to set them in the initialize function because
    ///         the constructor's parameters influence the address of the contract when deployed using CreateX.
    ///         And having different governor and strategist on the same address on different chains would
    ///         cause issues.
    /// @param _governor Address of the governor
    /// @param _strategist Address of the strategist
    function initialize(address _governor, address _strategist)
        external
        initializer
    {
        _setGovernor(_governor);
        _setStrategistAddr(_strategist);
    }

    /// @notice Create a new CurvePoolBoosterPlain instance
    /// @param _rewardToken Address of the reward token (OETH or OUSD)
    /// @param _gauge Address of the gauge (e.g. Curve OETH/WETH Gauge)
    /// @param _feeCollector Address of the fee collector (e.g. MultichainStrategist)
    /// @param _fee Fee in FEE_BASE unit payed when managing campaign
    /// @param _campaignRemoteManager Address of the campaign remote manager
    /// @param _votemarket Address of the votemarket
    /// @param _salt A unique number that affects the address of the pool booster created. Note: this number
    ///        should match the one from `computePoolBoosterAddress` in order for the final deployed address
    ///        and pre-computed address to match
    /// @param _expectedAddress The expected address of the pool booster. This is used to verify that the pool booster
    ///        was deployed at the expected address, otherwise the transaction batch will revert. If set to 0 then the
    ///        address verification is skipped.
    function createCurvePoolBoosterPlain(
        address _rewardToken,
        address _gauge,
        address _feeCollector,
        uint16 _fee,
        address _campaignRemoteManager,
        address _votemarket,
        bytes32 _salt,
        address _expectedAddress
    ) external onlyGovernorOrStrategist returns (address) {
        require(governor() != address(0), "Governor not set");
        require(strategistAddr != address(0), "Strategist not set");
        // salt encoded sender
        address senderAddress = address(bytes20(_salt));
        // the contract that calls the CreateX should be encoded in the salt to protect against front-running
        require(senderAddress == address(this), "Front-run protection failed");

        address poolBoosterAddress = CREATEX.deployCreate2(
            _salt,
            getInitCode(_rewardToken, _gauge)
        );

        require(
            _expectedAddress == address(0) ||
                poolBoosterAddress == _expectedAddress,
            "Pool booster deployed at unexpected address"
        );

        CurvePoolBoosterPlain(payable(poolBoosterAddress)).initialize(
            governor(),
            strategistAddr,
            _fee,
            _feeCollector,
            _campaignRemoteManager,
            _votemarket
        );

        emit CurvePoolBoosterPlainCreated(poolBoosterAddress);
        return poolBoosterAddress;
    }

    // get initialisation code contract code + constructor arguments
    function getInitCode(address _rewardToken, address _gauge)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                type(CurvePoolBoosterPlain).creationCode,
                abi.encode(_rewardToken, _gauge)
            );
    }

    /// @notice Compute the guarded salt for CreateX protections. This version of guarded
    ///         salt expects that this factory contract is the one doing calls to the CreateX contract.
    function _computeGuardedSalt(bytes32 _salt)
        internal
        view
        returns (bytes32)
    {
        return
            _efficientHash({
                a: bytes32(uint256(uint160(address(this)))),
                b: _salt
            });
    }

    /**
     * @dev Returns the `keccak256` hash of `a` and `b` after concatenation.
     * @param a The first 32-byte value to be concatenated and hashed.
     * @param b The second 32-byte value to be concatenated and hashed.
     * @return hash The 32-byte `keccak256` hash of `a` and `b`.
     */
    function _efficientHash(bytes32 a, bytes32 b)
        internal
        pure
        returns (bytes32 hash)
    {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            mstore(0x00, a)
            mstore(0x20, b)
            hash := keccak256(0x00, 0x40)
        }
    }

    /// @notice Create a new CurvePoolBoosterPlain instance (address computation version)
    /// @param _rewardToken Address of the reward token (OETH or OUSD)
    /// @param _gauge Address of the gauge (e.g. Curve OETH/WETH Gauge)
    /// @param _salt A unique number that affects the address of the pool booster created. Note: this number
    ///        should match the one from `createCurvePoolBoosterPlain` in order for the final deployed address
    ///        and pre-computed address to match
    function computePoolBoosterAddress(
        address _rewardToken,
        address _gauge,
        bytes32 _salt
    ) external view returns (address) {
        bytes32 guardedSalt = _computeGuardedSalt(_salt);
        return
            CREATEX.computeCreate2Address(
                guardedSalt,
                keccak256(getInitCode(_rewardToken, _gauge)),
                address(CREATEX)
            );
    }

    /**
     * @dev Encodes a salt for CreateX by concatenating deployer address (bytes20), cross-chain protection flag (bytes1),
     * and the first 11 bytes of the provided salt (most significant bytes). This function is exposed for easier
     * operations. For the salt value itself just use the epoch time when the operation is performed.
     * @param salt The raw salt as uint256; converted to bytes32, then only the first 11 bytes (MSB) are used.
     * @return encodedSalt The resulting 32-byte encoded salt.
     */
    function encodeSaltForCreateX(uint256 salt)
        external
        view
        returns (bytes32 encodedSalt)
    {
        // only the right most 11 bytes are considered when encoding salt. Which is limited by the number in the below
        // require. If salt were higher, the higher bytes would need to be set to 0 to not affect the "or" way of
        // encoding the salt.
        require(salt <= 309485009821345068724781055, "Invalid salt");

        // prepare encoded salt guarded by this factory address. When the deployer part of the salt is the same as the
        // caller of CreateX the salt is re-hashed and thus guarded from front-running.
        address deployer = address(this);

        // Flag as uint8 (0)
        uint8 flag = 0;

        // Precompute parts
        uint256 deployerPart = uint256(uint160(deployer)) << 96; // 20 bytes shifted left 96 bits (12 bytes)
        uint256 flagPart = uint256(flag) << 88; // 1 byte shifted left 88 bits (11 bytes)

        // Concat via nested OR
        // solhint-disable-next-line no-inline-assembly
        assembly {
            encodedSalt := or(or(deployerPart, flagPart), salt)
        }
    }
}
