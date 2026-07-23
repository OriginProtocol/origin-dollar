// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_VerifyValidator_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_verifyValidator_0x01WithdrawalCredentials() public view {
        bytes32 beaconRoot = 0xafdaf9d9572ee13f9a0d0cf4a41e3e6012dfd65642b1a2adab70a3503304bb51;
        uint40 validatorIndex = 1_222_119;
        bytes32 publicKeyLeaf = 0x9763eab2448c08aaca5f3309aac635809691c3c51e41bd6afdf5c1a2b960a282;
        bytes32 withdrawalCredentials = 0x010000000000000000000000d7466c5fd68774d70a5f1590f7b51f879e192d20;
        bytes memory proof = _hoodiValidatorProof();

        assertEq(proof.length, 1696);
        beaconProofs.verifyValidator(beaconRoot, publicKeyLeaf, proof, validatorIndex, withdrawalCredentials);
    }

    function test_RevertWhen_zeroBlockRoot() public {
        bytes memory proof = _makeProof(1696);
        // Set first 32 bytes to withdrawal creds we'll pass
        bytes32 withdrawalCreds = keccak256("creds");
        assembly {
            mstore(add(proof, 32), withdrawalCreds)
        }

        vm.expectRevert("Invalid block root");
        beaconProofs.verifyValidator(bytes32(0), keccak256("pubkey"), proof, 0, withdrawalCreds);
    }

    function test_RevertWhen_wrongProofLength() public {
        bytes memory proof = _makeProof(1600); // Wrong: should be 1696
        // Must match first 32 bytes of proof (withdrawal creds) to pass that check first
        bytes32 withdrawalCreds;
        assembly {
            withdrawalCreds := mload(add(proof, 32))
        }
        vm.expectRevert("Invalid validator proof");
        beaconProofs.verifyValidator(keccak256("root"), keccak256("pubkey"), proof, 0, withdrawalCreds);
    }

    function test_RevertWhen_wrongWithdrawalCredentials() public {
        bytes memory proof = _makeProof(1696);
        // Read first 32 bytes of proof via assembly
        bytes32 proofCreds;
        assembly {
            proofCreds := mload(add(proof, 32))
        }
        bytes32 wrongCreds = ~proofCreds; // Different creds

        vm.expectRevert("Invalid withdrawal cred");
        beaconProofs.verifyValidator(keccak256("root"), keccak256("pubkey"), proof, 0, wrongCreds);
    }

    function test_RevertWhen_invalidProof() public {
        bytes memory proof = _makeProof(1696);
        bytes32 withdrawalCreds;
        assembly {
            withdrawalCreds := mload(add(proof, 32))
        }

        // Proof is random data, so verification will fail
        vm.expectRevert("Invalid validator proof");
        beaconProofs.verifyValidator(keccak256("root"), keccak256("pubkey"), proof, 0, withdrawalCreds);
    }

    function _hoodiValidatorProof() private pure returns (bytes memory) {
        return hex"010000000000000000000000d7466c5fd68774d70a5f1590f7b51f879e192d2019327cb9763c96e00332bde93bdbb1032c4b796dda73e515c8c5f7ede9a419be3249810276d8d8740fc8cc9187edd31ddeee92650ae636e7b87b36ed015e4498f1558b2ad3a8b43719b54ea1c16a6fb6455031dd3d169615b9098c7d51eca13d8d0e092750a9efd9cbab5e6b7f36d0fb1ea7624a1e13d5afcbf078734b94aacbc50c4a69d59c0d1b803b986e4fc5f7fe88ad30ab0054842a18e82ce91dd0c10a30cf6f7d10dac06ca475da79ac3dd034d74f55413112262bca97fc091abfb549a1fd9bc4b48745f98956231d71308eb89820d7b4136d2ce3e92dcbb2fbd453eab3df69ea687467eca1972c07a4314c13acf1529e9aca0273aa0f72ed4afd7a3b7b0abaf8bfbebbfec6996a92dce8ec5f0139780a995d7edbd97480e84736b1a843b0421133a61ce5f137f8fc2aa2882b4177c72d044ffd580e17b5774752149754f025bf8c4f60adf28efe8f33e8c2da1266922461c02db9b018a8f1c450c99854a7f7ee6154f5e7d46777334414d6d051a6682f2dcf5f13b42732340aeec38b99496cb9db22328cc11624f671eda45ee940cd2e0933131a63d73e14d87ccf3c496a2b0447926938f277865a197d26d90f39d78ddc929c37c940dbe7fa5f75feb7d05f875f140027ef5118a2247bbb84ce8f2f0f1123623085daf7960c329f5fffe7e8de8c00f93a9e2716d864b95761eb28b9fde8d0d358647ea6e34a3b3ebdb58d900f5e182e3c50ef74969ea16c7726c549757cc23523c369587da7293784898a54911e092b561e5bb20162d9f9b783010e062d45af64756a83c8c5d361fd8fe6b1689256c0d385f42f5bbe2027a22c1996e110ba97c171d3e5948de92bebf52959c496012ab1260bb313a49f054aa8a68f4a671c681964fc2458c3cbef5c95eec8b2e541cad4e91de38385f2e046619f54496c2382cb6cacd5b98c26f5a4f893e908917775b62bff23294dbbe3a1cd8e6cc1c35b4801887b646a6f81f17f40193653818402a3b9e2cc714f85b60e4ae6eb3b52c506536e4011141b5b81f58a8d7fe3af8caa085a7639a832001457dfb9128a8061142ad0335629ff23ff9cfeb3c337d7a51a6fbf00b9e34c52e1c9195c969bd4e7a0bfd51d5c5bed9c1167e71f0aa83cc32edfbefa9f4d3e0174ca85182eec9f3a09f6a6c0df6377a510d731206fa80a50bb6abe29085058f16212212a60eec8f049fecb92d8c8e0a84bc021352bfecbeddde993839f614c3dac0a3ee37543f9b412b16199dc158e23b544619e312724bb6d7c3153ed9de791d764a366b389af13c58bf8a8d90481a467657cdd2986268250628d0c10e385c58c6191e6fbe05191bcc04f133f2cea72c1c4848930bd7ba8cac54661072113fb278869e07bb8587f91392933374d017bcbe18869ff2c22b28cc10510d9853292803328be4fb0e80495e8bb8d271f5b889636b5fe28e79f1b850f8658246ce9b6a1e7b49fc06db7143e8fe0b4f2b0c5523a5c985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7c6f67e02e6e4e1bdefb994c6098953f34636ba2b6ca20a4721d2b26a886722ff1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74f7210d4f8e7e1039790e7bf4efa207555a10a6db1dd4b95da313aaa88b88fe76ad21b516cbc645ffe34ab5de1c8aef8cd4e7f8d2b51e8e1456adc7563cda206fc9a81200000000000000000000000000000000000000000000000000000000007c67000000000000000000000000000000000000000000000000000000000000cc31bb7605a892a8e3a0774f3c3298f2f51e0a177d7cbab3cb05bb6a25b2753f493c36e4659b50251ebb083bcbefb1bacc1f81630d0e55049fb9e86600b79b39043b26951ef74da4c0cb5f1e1c4e5a2e429813edf762e51e7e4b4498c9404ecb5ff4bc3271625d63c5c56a9229856ce68d247a5ad43b8e18118a4e24121544687b0f5420f3432931918f1a395f499d3239333c301bb7d925c2b1041395e55e71a9f43bca28a11b8927de32393be7dfbf3255fe25576febfb181fb698f9ecf5ea6a7a12d251976a24713d32e6d23c486a56a4a55891b2121969107b21373f2dce75f0f9b7c815827cd54d4d53550351da9adb7dddba7687c49a6cfb11ef60efa6";
    }
}
