# config-cjson

A small utility to load config files written in cjson (JSON with comments).

Inspiration: https://www.npmjs.com/package/oconf

## usage

1. Use as a module
   ```
   const  pathModule = require('path');
   const loadConfig = require("config-cjson");
   .
   .
   .
   const config = await loadConfig(
       pathModule.resolve(__dirname, "..", "config", "development.cjson")
   );
   ```
2. Use as CLI - prints config in the terminal
   ```
   ./node_modules/.bin/config-cjson <config file path>
   ```

## supported directives

1.  `#include` - directive to include parent configs, path to included config can be relative(relative to the first config loaded) or absolute.

    ```
    {
        "#include": "common.cjson",
        .
        .
        .
    }
    ```

    or

    ```
    {
        "#include": ["common.cjson", "production.cjson"],
        .
        .
        .
    }
    ```

2.  `#public` - directive to expose a property on a separate `#public` attribute.
    ```
    {
        ...
        "title#public": "My App"
        ...
    }
    ```
    or
    ```
        ...
        "lang#public": {
            "defaultLocale": "en-US",
            "supportedLocales: ["en-US", "es-ES"]
        }
        ...
    ```
    
    <span style="color:red">Below is not supported</span>
    ```
    # Not supported
    "#public": {
        "lang" : {
            "defaultLocale": "en-US"
        }
    }
    ```
