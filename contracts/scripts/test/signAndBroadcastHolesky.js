require("dotenv").config();
const { ethers } = require("ethers");

async function signAndBroadcast() {
  console.log("Started");

  // Enter the serialized transaction
  const rawTransaction = process.env.RAW_TRANSACTION;

  // Enter the private key of the address used to transfer the stake amount
  const privateKey = process.env.HOLESKY_DEPLOYER_PRIVATE_KEY;

  // Enter the selected RPC URL
  const rpcURL = process.env.HOLESKY_PROVIDER_URL;

  // Initialize the provider using the RPC URL
  const provider = new ethers.providers.JsonRpcProvider(rpcURL);

  // Initialize a new Wallet instance
  const wallet = new ethers.Wallet(privateKey, provider);

  // Parse the raw transaction
  const tx = ethers.utils.parseTransaction(rawTransaction);

  const newTx = {
    to: tx.to,
    data: tx.data,
    chainId: tx.chainId,
    value: tx.value,
    gasLimit: tx.gasLimit,
    type: 2,

    nonce: await provider.getTransactionCount(wallet.address),
    // Enter the max fee per gas and prirorty fee
    maxFeePerGas: ethers.utils.parseUnits("5", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei"),
  };

  // Sign the transaction
  const signedTransaction = await wallet.signTransaction(newTx);

  // Send the signed transaction
  const transactionResponse = await provider.sendTransaction(signedTransaction);

  return transactionResponse;
}

signAndBroadcast()
  .then((transactionResponse) => {
    console.log("Transaction broadcasted, transaction hash:", transactionResponse.hash);
  })
  .catch((error) => {
    console.error("Error:", error);
  })
  .finally(() => {
    console.log("Finished");
  });
