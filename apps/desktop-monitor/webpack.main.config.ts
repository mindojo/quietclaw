import TerserPlugin from "terser-webpack-plugin";
import type { Configuration } from "webpack";

import rules from "./webpack.rules.ts";

const config: Configuration = {
  target: "electron-main",
  entry: "./src/main/index.ts",
  module: {
    rules,
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".json"],
    extensionAlias: {
      ".js": [".ts", ".js"],
      ".mjs": [".mts", ".mjs"],
    },
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
};

export default config;
