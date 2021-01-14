certoraRun contracts/vault/VaultAdmin.sol \
  --verify VaultAdmin:../spec/PrivilegedVaultAdmin.spec \
  --solc solc5.11 \
  --settings -b=2,-assumeUnwindCond,-ignoreViewFunctions \
  --cloud --msg "VaultCore Privileged"
