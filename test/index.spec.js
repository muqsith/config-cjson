const pathModule = require("path");
const assert = require("assert");

const loadConfig = require("../config-cjson");

describe("loadConfig", async () => {
  it("should return config", async () => {
    const configFilePath = pathModule.resolve(__dirname, "configs", "c.cjson");
    const config = await loadConfig(configFilePath);
    console.log(JSON.stringify(config, null, 4));
    assert.equal(config.table.dimensions.width, "115 cm");
  });
});
