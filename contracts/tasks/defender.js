require("dotenv").config();
const path = require("path");
const fs = require("fs");
const JSZip = require("jszip");
const { Defender } = require("@openzeppelin/defender-sdk");

const log = require("../utils/logger")("task:defender");

const getClient = () => {
  log(`Used DEFENDER_TEAM_KEY ${process.env.DEFENDER_TEAM_KEY}`);
  const creds = {
    apiKey: process.env.DEFENDER_TEAM_KEY,
    apiSecret: process.env.DEFENDER_TEAM_SECRET,
  };
  return new Defender(creds);
};

const setActionVars = async ({ id, name }) => {
  const client = getClient();

  const envVars = {};
  if (name) {
    envVars[name] = process.env[name];
  }

  // Update Variables
  const variables = await client.action.updateEnvironmentVariables(id, {
    variables: {
      ...envVars,
      DEBUG: "origin*",
      DEBUG_HIDE_DATE: "1",
    },
  });
  console.log("Updated Defender Actions environment variables to:", variables);
};

const updateAction = async ({ id, file }) => {
  const client = getClient();

  // Read and zip the code
  const distPath = path.join(
    process.cwd(),
    `scripts/defender-actions/dist/${file}`
  );
  const zip = new JSZip();
  const files = fs.readdirSync(distPath, { recursive: true });
  files.forEach((file) => {
    const filePath = path.join(distPath, file);
    const relativePath = path.relative(distPath, filePath);
    const content = fs.readFileSync(filePath);
    zip.file(relativePath, content);
  });
  const encodedZippedCode = await client.action.getEncodedZippedCodeFromFolder(
    distPath
  ); // SDK helper to base64-encode the zip

  // Fetch the current autotask/action to preserve existing config
  const currentAction = await client.action.get(id);

  // Update with new code (preserve name, trigger, etc.)
  const updateBody = {
    ...currentAction,
    encodedZippedCode,
  };

  const updated = await client.action.update(updateBody);
  console.log("Autotask updated successfully:", updated);
};

module.exports = {
  setActionVars,
  updateAction,
  getClient,
};
