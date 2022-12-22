#!/usr/bin/env node

const pathModule = require("path");
const fs = require("fs-extra");
const JSON5 = require("json5");
const { program } = require("commander");
const _ = require("lodash");

const INCLUDE_PROP_NAME = "#include";

const getIncludedConfigFiless = (includesProp) => {
  let result = [];
  if (Array.isArray(includesProp)) {
    result = includesProp;
  } else if (includesProp && typeof includesProp === "string") {
    result.push(includesProp);
  }
  return result;
};

const getConfig = async (configFileDir, filePath, filesRead) => {
  let result = {};
  let configFilePath = filePath;
  if (!pathModule.isAbsolute(filePath)) {
    configFilePath = pathModule.resolve(configFileDir, filePath);
  }
  if (filesRead.indexOf(configFilePath) === -1) {
    if (fs.pathExists(configFilePath)) {
      const textData = await fs.readFile(configFilePath, { encoding: "utf8" });
      result = JSON5.parse(textData);
      const includesProp = result[INCLUDE_PROP_NAME];
      if (includesProp) {
        delete result[INCLUDE_PROP_NAME];
        const includedConfigFiles = getIncludedConfigFiless(includesProp);
        for (const includedConfigFile of includedConfigFiles) {
          const includedConfig = await getConfig(
            configFileDir,
            includedConfigFile,
            filesRead
          );
          result = _.merge(includedConfig, result);
        }
      }
    }
  }
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
  const filesRead = [];
  const result = await getConfig(configFileDir, filePath, filesRead);
  return result;
};

if (require.main === module) {
  program
    .name("config-cjson")
    .description(
      "Returns config object from hierarchy of cjson config files.\nAccepts first config file path as an argument."
    )
    .argument("<config file path>", "config file path")
    .action(async (configFilePath, options) => {
      const config = await loadConfig(configFilePath);
      console.log(JSON.stringify(config, null, 2));
    })
    .parse();
} else {
  module.exports = loadConfig;
}
