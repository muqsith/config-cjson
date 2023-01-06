const pathModule = require("path");
const assert = require("assert");

const loadConfig = require("../index.js");

describe("loadConfig", async () => {
	it("should return config", async () => {
		const configFilePath = pathModule.resolve(__dirname, "configs", "c.cjson");
		const config = await loadConfig(configFilePath);
		/* remove-console */ /* prettier-ignore */ console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Line: 17, File: index.spec.js ~ printing(config) <<<<<<<<<<<<<<<<<<<<<<<<<< \n  ${JSON.stringify(config, null, 2)}`);
		assert.equal(config.table.dimensions.width, "115 cm");
	});
});
