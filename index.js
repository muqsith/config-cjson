#!/usr/bin/env node

const pathModule = require("path");
const fs = require("fs-extra");
const JSON5 = require("json5");
const { program } = require("commander");

const getIncludes = (configFileDir, includeProp) => {};

const getConfig = async (configFileDir, filePath) => {
  const filesRead = [];

  let result = {};

  return result;
};

const loadConfig = async (configFilePath) => {
  if (!configFilePath) {
    throw new Error("Missing config file path");
  }

  let absoluteFilePath = configFilePath;
  if (!pathModule.isAbsolute(configFilePath)) {
    absoluteFilePath = pathModule.resolve(process.cwd(), configFilePath);
  }
  const configFileDir = pathModule.dirname(absoluteFilePath);
  const filePath = pathModule.basename(absoluteFilePath);

  const config = await getConfig(configFileDir, filePath);
  return config;
};

const execCmd = async (configFilePath) => {
  await loadConfig(configFilePath);
};

if (require.main === module) {
  program
    .name("config-cjson")
    .description(
      "Returns config object from hierarchy of cjson config files.\nAccepts first config file path as an argument."
    )
    .argument("<string>", "config file path")
    .action((configFilePath, options) => {
      execCmd(configFilePath);
    })
    .parse();
} else {
  module.exports = loadConfig;
}
