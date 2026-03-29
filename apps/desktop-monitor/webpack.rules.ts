import type { RuleSetRule } from "webpack";

const rules: RuleSetRule[] = [
  {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: {
      loader: "ts-loader",
      options: {
        transpileOnly: true,
      },
    },
  },
  {
    test: /\.node$/,
    use: "node-loader",
  },
];

export default rules;
