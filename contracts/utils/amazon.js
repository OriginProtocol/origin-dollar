require("dotenv").config();
const {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

const log = require("../utils/logger")("task:aws");

const getS3Context = async () => {
  const apiKey = process.env.AWS_ACCESS_S3_KEY_ID;
  const apiSecret = process.env.AWS_SECRET_S3_ACCESS_KEY;
  const bucketName = process.env.VALIDATOR_KEYS_S3_BUCKET_NAME;

  if (!apiKey || !apiSecret || !bucketName) {
    throw new Error(
      "AWS_ACCESS_S3_KEY_ID & AWS_SECRET_S3_ACCESS_KEY & VALIDATOR_KEYS_S3_BUCKET_NAME need to all be set."
    );
  }

  return [
    new S3Client({
      region: "us-east-1",
      credentials: {
        accessKeyId: apiKey,
        secretAccessKey: apiSecret,
      },
    }),
    bucketName,
  ];
};

const getPrivateKeyFromS3 = async (pubkey) => {
  const [s3Client, bucketName] = await getS3Context();
  log("Attempting to fetch encrypted private key from S3");
  const fileName = `${pubkey}.json`;

  const input = {
    Bucket: bucketName,
    Key: fileName,
  };

  const command = new GetObjectCommand(input);

  try {
    const response = await s3Client.send(command);
    return await response.Body.transformToString();
  } catch (err) {
    log("Error fetching file from S3", err);
    throw err;
  }
};

const storePrivateKeyToS3 = async (pubkey, encryptedPrivateKey) => {
  const [s3Client, bucketName] = await getS3Context();
  log("Attempting to store encrypted private key to S3");

  const fileName = `${pubkey}.json`;
  const putCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: JSON.stringify({
      encryptedPrivateKey,
    }),
  });

  try {
    await s3Client.send(putCommand);
    log(`Private key stored under s3://${bucketName}/${fileName}`);
  } catch (err) {
    log("Error uploading file to S3", err);
  }
};

module.exports = {
  getPrivateKeyFromS3,
  storePrivateKeyToS3,
};
