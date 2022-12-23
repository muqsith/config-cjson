#!/usr/bin/env node

const pathModule = require("path");
const fs = require("fs-extra");
const JSON5 = require("json5");
const { program } = require("commander");
const _ = require("lodash");

const INCLUDE_PROP_NAME = "#include";
const PUBLIC_PROP_NAME = "#public";

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
    filesRead.push(configFilePath);
    const textData = await fs.readFile(configFilePath, { encoding: "utf8" });
    result = JSON5.parse(textData);
    if (Array.isArray(result)) {
      throw new Error("Array as root of config is not supported.");
    }
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
  return result;
};

const reconstructObjectWithPublicConfig = (
  publicResult,
  result,
  parentKey,
  value,
  isPublic
) => {
  if (Array.isArray(value)) {
    result[parentKey] = [];
    publicResult[parentKey] = [];
    for (let i = 0; i < value.length; i += 1) {
      const item = value[i];
      reconstructObjectWithPublicConfig(
        publicResult[parentKey],
        result[parentKey],
        i,
        item,
        false
      );
    }
    // knock-off empty publicResult arrays
    if (
      Array.isArray(publicResult[parentKey]) &&
      !publicResult[parentKey].length
    ) {
      delete publicResult[parentKey];
    }
  } else if (typeof value === "object" && value !== null) {
    if (parentKey !== null) {
      if (!result[parentKey]) {
        result[parentKey] = {};
      }
      if (!publicResult[parentKey]) {
        publicResult[parentKey] = {};
      }
    }

    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
      let key = keys[i];
      const item = value[key];
      let hasPublicProp = isPublic ? true : false;

      if (key.indexOf(PUBLIC_PROP_NAME) !== -1) {
        hasPublicProp = true;
        key = key.replace(PUBLIC_PROP_NAME, "");
        if (key === "") {
          key = parentKey;
        }
      }

      reconstructObjectWithPublicConfig(
        parentKey !== null ? publicResult[parentKey] : publicResult,
        parentKey !== null ? result[parentKey] : result,
        key,
        item,
        hasPublicProp
      );
    }

    // knock-off empty publicResult objects
    if (publicResult[parentKey]) {
      const publicKeys = Object.keys(publicResult[parentKey]);
      if (!publicKeys.length) {
        delete publicResult[parentKey];
      }
    }
  } else {
    result[parentKey] = value;
    if (isPublic) {
      publicResult[parentKey] = value;
    }
  }
};

const extractPublicConfig = (config) => {
  const reconstructedResult = {};
  const publicResult = {};
  reconstructObjectWithPublicConfig(
    publicResult,
    reconstructedResult,
    null,
    config,
    false
  );
  reconstructedResult[PUBLIC_PROP_NAME] = publicResult;
  return reconstructedResult;
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
  const resultWithPublicConfig = extractPublicConfig(result);
  return resultWithPublicConfig;
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
