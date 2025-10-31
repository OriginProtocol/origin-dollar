require("dotenv").config();
const { AutotaskClient } = require("@openzeppelin/defender-autotask-client");

const log = require("../utils/logger")("task:defender");

const setActionVars = async ({ id, name }) => {
  log(`Used DEFENDER_TEAM_KEY ${process.env.DEFENDER_TEAM_KEY}`);
  const creds = {
    apiKey: process.env.DEFENDER_TEAM_KEY,
    apiSecret: process.env.DEFENDER_TEAM_SECRET,
  };
  const client = new AutotaskClient(creds);

  const envVars = {};
  if (name) {
    envVars[name] = process.env[name];
  }

  // Update Variables
  const variables = await client.updateEnvironmentVariables(id, {
    ...envVars,
    DEBUG: "origin*",
  });
  console.log("Updated Defender Actions environment variables to:", variables);
};

module.exports = {
  setActionVars,
};
