const signMessage = async ({ signer, message }) => {
  console.log(`Message: ${message}`);
  console.log(`Signer: ${await signer.getAddress()}`);

  const hash = await signer.signMessage(message);
  console.log(`Hash: ${hash}`);
};

module.exports = {
  signMessage,
};
