#!/usr/bin/env node

const loadConfig = async (configFilePath) => {
  if (!configFilePath) {
    throw new Error("Missing config file path");
  }
};

if (require.main === module) {
  console.log("a");
} else {
  module.exports = loadConfig;
}
