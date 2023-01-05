#!/usr/bin/env node

const pathModule = require("path");
const fs = require("fs-extra");
const JSON5 = require("json5");
const { program } = require("commander");
const _ = require("lodash");

const INCLUDE_PROP_NAME = "#include";
const PUBLIC_PROP_NAME = "#public";

const TYPES = {
	ARRAY: "ARRAY",
	OBJECT: "OBJECT",
	STRING: "STRING",
	OTHER: "OTHER",
};

function getvariableType(variable) {
	if (Array.isArray(variable)) return TYPES.ARRAY;
	if (variable !== null && typeof variable === "object") return TYPES.OBJECT;
	if (typeof variable === "string") return TYPES.STRING;
	return TYPES.OTHER;
}

function getIncludedConfigFiles(includesProp) {
	let result = [];
	if (getvariableType(includesProp) === TYPES.ARRAY) {
		result = includesProp;
	} else if (getvariableType(includesProp) === TYPES.STRING) {
		result.push(includesProp);
	}
	return result;
}

function getAbsolutePath(configFileDir, filePath) {
	let configFilePath = filePath;
	if (!pathModule.isAbsolute(filePath)) {
		configFilePath = pathModule.resolve(configFileDir, filePath);
	}
	return configFilePath;
}

const readConfig = (() => {
	const memo = {};
	return async function (configFileDir, filePath) {
		let configFilePath = getAbsolutePath(configFileDir, filePath);
		if (!(configFilePath in memo)) {
			const textData = await fs.readFile(configFilePath, { encoding: "utf8" });
			memo[configFilePath] = JSON5.parse(textData);
		}
		return memo[configFilePath];
	};
})();

function publicHashed(key, includeHashPublicInKey) {
	if (!includeHashPublicInKey) return key;
	if (key.match(/#public$/i) === null) {
		return `${key}${PUBLIC_PROP_NAME}`;
	}
	return key;
}

async function mergeIncludedFiles(
	includedConfigFiles,
	configFileDir,
	includeHashPublicInKey,
	deadLockCheck
) {
	let result = {};

	for (const includedConfigFile of includedConfigFiles) {
		const absFilePath = getAbsolutePath(configFileDir, includedConfigFile);
		const extendedConfiFileJson = await readConfig(
			configFileDir,
			includedConfigFile
		);

		if (deadLockCheck.includes(absFilePath)) {
			throw new Error(`${absFilePath} causes deadlock`);
		}

		deadLockCheck.push(absFilePath);
		const expandedConfiFileJson = await getConfig(
			extendedConfiFileJson,
			configFileDir,
			includeHashPublicInKey,
			deadLockCheck
		);
		deadLockCheck.pop();
		if (getvariableType(expandedConfiFileJson) === TYPES.ARRAY) {
			throw new Error("included files cannot be Array");
		}
		result = _.merge(result, expandedConfiFileJson);
	}

	return result;
}

async function getConfig(
	currentConfig,
	configFileDir,
	includeHashPublicInKey = false,
	deadLockCheck = []
) {
	let result;
	// currentConfig is array
	if (getvariableType(currentConfig) === TYPES.ARRAY) {
		result = [];
		for (const configItem of currentConfig) {
			result.push(
				await getConfig(
					configItem,
					configFileDir,
					includeHashPublicInKey,
					deadLockCheck
				)
			);
		}
	}

	// currentConfig is object
	else if (getvariableType(currentConfig) === TYPES.OBJECT) {
		result = {};
		let hashIncludeConfig = {};
		let hashPublicConfig = {};

		//first handle #inlcude directive to get the baseConfig
		if (INCLUDE_PROP_NAME in currentConfig) {
			const includedConfigFiles = getIncludedConfigFiles(
				currentConfig[INCLUDE_PROP_NAME]
			);
			hashIncludeConfig = mergeIncludedFiles(
				includedConfigFiles,
				configFileDir,
				includeHashPublicInKey,
				deadLockCheck
			);
			delete currentConfig[INCLUDE_PROP_NAME];
		}

		//then handle #public directive
		if (PUBLIC_PROP_NAME in currentConfig) {
			if (getvariableType(currentConfig[PUBLIC_PROP_NAME]) !== TYPES.OBJECT) {
				throw new Error(`${PUBLIC_PROP_NAME} must be an object`);
			}
			hashPublicConfig = await getConfig(
				currentConfig[PUBLIC_PROP_NAME],
				configFileDir,
				true,
				deadLockCheck
			);

			delete currentConfig[PUBLIC_PROP_NAME];
		}

		for (const key in currentConfig) {
			result[publicHashed(key, includeHashPublicInKey)] = await getConfig(
				currentConfig[key],
				configFileDir,
				includeHashPublicInKey,
				deadLockCheck
			);
		}

		let configToMerge = _.merge(hashIncludeConfig, hashPublicConfig);
		result = _.merge(configToMerge, result);
	}
	// currentConfig is string, null, number, boolean
	else {
		result = currentConfig;
	}
	return result;
}

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
	const configJson = await readConfig(configFileDir, filePath);
	const result = await getConfig(configJson, configFileDir, false, [
		absoluteFilePath,
	]);

	const pathsWithHashPublic = [];
	const resultWithPublicConfig = extractPublicConfig(
		result,
		pathsWithHashPublic
	);
	resultWithPublicConfig[PUBLIC_PROP_NAME] = buildPubicObject(
		resultWithPublicConfig,
		pathsWithHashPublic
	);
	return resultWithPublicConfig;
};

function buildPubicObject(config, paths) {
	let result = {};
	for (const path of paths) {
		_.set(result, path, _.get(config, path));
	}
	return result;
}

function extractPublicConfig(config, pathsWithHashPublic, currentPath = []) {
	let result;
	if (getvariableType(config) === TYPES.ARRAY) {
		let index = 0;
		for (const configItem of config) {
			result = [];
			result.push(
				extractPublicConfig(configItem, pathsWithHashPublic, [
					...currentPath,
					index,
				])
			);
		}
	} else if (getvariableType(config) === TYPES.OBJECT) {
		result = {};
		for (const key in config) {
			let newKey = key;
			if (key.match(/#public$/i)) {
				newKey = key.replace(/#public$/i, "");
				if (newKey in config) {
					throw new Error(
						`${newKey} : cannot have both public and private key as same`
					);
				}
				const keyPath = `${currentPath.join(".")}${
					currentPath.length ? "." : ""
				}${newKey}`;
				pathsWithHashPublic.push(keyPath);
			}
			result[newKey] = extractPublicConfig(config[key], pathsWithHashPublic, [
				...currentPath,
				newKey,
			]);
		}
	} else {
		result = config;
	}
	return result;
}

if (require.main === module) {
	program
		.name("config-cjson")
		.description(
			"Returns config object from hierarchy of cjson config files.\nAccepts first config file path as an argument."
		)
		.argument("[config file path]", "config file path", "test/configs/a.cjson")
		.action(async (configFilePath, options) => {
			configFilePath = configFilePath;
			const config = await loadConfig(configFilePath);
			console.log(JSON.stringify(config, null, 2));
		})
		.parse();
} else {
	module.exports = loadConfig;
}

function test() {
	const obj1 = { a: { b: "", j: ["fd", 45, { d: "adhi" }] }, l: "" };
	const obj2 = { a: { d: "", k: "", j: "er" }, m: "" };
	console.log(_.get(obj1, "a.j.2.d"));
	// /* remove-console */ /* prettier-ignore */ console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Line: 302, File: index.js ~ printing(_.merge(obj1, obj2)) <<<<<<<<<<<<<<<<<<<<<<<<<< \n  ${JSON.stringify(_.merge(_.cloneDeep(obj1), _.cloneDeep(obj2)), null, 2)}`);

	// /* remove-console */ /* prettier-ignore */ console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Line: 302, File: index.js ~ printing(_.merge(obj2, obj1)) <<<<<<<<<<<<<<<<<<<<<<<<<< \n  ${JSON.stringify(_.merge(_.cloneDeep(obj2), _.cloneDeep(obj1)), null, 2)}`);

	// /* remove-console */ /* prettier-ignore */ console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Line: 283, File: index.js ~ printing(_.set(obj1, "a.b.0.c", "value")) <<<<<<<<<<<<<<<<<<<<<<<<<< \n  ${JSON.stringify(_.set(obj1, "a.b[2].c", "value"), null, 2)}`);
}
