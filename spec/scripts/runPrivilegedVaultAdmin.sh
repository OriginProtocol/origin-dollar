certoraRun contracts/vault/VaultAdmin.sol \
  --verify VaultAdmin:../spec/PrivilegedVaultAdmin.spec \
  --settings -b=2,-assumeUnwindCond,-ignoreViewFunctions \
  --msg "VaultCore Privileged"