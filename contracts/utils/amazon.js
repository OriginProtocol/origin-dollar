require("dotenv").config();
const {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

const log = require("../utils/logger")("task:aws");

const getS3Context = async ({
  awsS3AccessKeyId,
  awsS3SexcretAccessKeyId,
  s3BucketName,
}) => {
  return [
    new S3Client({
      region: "us-east-1",
      credentials: {
        accessKeyId: awsS3AccessKeyId,
        secretAccessKey: awsS3SexcretAccessKeyId,
      },
    }),
    s3BucketName,
  ];
};

const getPrivateKeyFromS3 = async ({ pubkey }) => {
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

const storePrivateKeyToS3 = async ({
  pubkey,
  encryptedPrivateKey,
  awsS3AccessKeyId,
  awsS3SexcretAccessKeyId,
  s3BucketName,
}) => {
  const [s3Client, bucketName] = await getS3Context({
    awsS3AccessKeyId,
    awsS3SexcretAccessKeyId,
    s3BucketName,
  });
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
