import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Plyr: "readonly",
        confetti: "readonly",
      },
    },
    rules: js.configs.recommended.rules,
  },
  prettier,
]);
