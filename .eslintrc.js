module.exports = {
  extends: ["airbnb-typescript-prettier", "plugin:jest/recommended"],
  plugins: ["jest"],
  rules: {
    "jest/no-disabled-tests": "warn",
    "jest/no-focused-tests": "error",
    "jest/no-identical-title": "error",
    "jest/prefer-to-have-length": "warn",
    "jest/valid-expect": "error",
    "jest/expect-expect": [
      "error",
      { assertFunctionNames: ["expect", "request.**.expect"] },
    ],
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-shadow": "off",
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        ignoreRestSiblings: true,
        argsIgnorePattern: "^_",
      },
    ],
    "import/prefer-default-export": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      env: {
        jest: true,
        browser: false,
        es6: true,
      },
    },
  ],
  settings: {
    "import/resolver": {
      "babel-module": {},
      node: {
        extensions: [".ts", ".js"],
      },
      extensions: [".ts", ".js"],
    },
  },
};
