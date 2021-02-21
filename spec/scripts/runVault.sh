BASE=${1}
sed "s/VAULT_BASE/${BASE}/g" ../spec/harnesses/VaultHarnessTemplate.sol > VaultHarness.sol
# Use either Vault or VaultAdmin
certoraRun VaultHarness.sol ../spec/harnesses/DummyERC20A.sol ../spec/harnesses/DummyERC20B.sol \
  --verify VaultHarness:../spec/vault.spec \
  --cache vault \
  --solc solc5.11 \
  --settings -assumeUnwindCond,-b=2,-t=300,-enableStorageAnalysis=true \
  --msg "Vault - ${BASE} verification"