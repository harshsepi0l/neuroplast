// Lets `node --test` import app modules directly: resolves the `@/` alias to
// src/ and extensionless relative specifiers to their .ts/.tsx files, the
// way the bundler does. Loaded via `node --import`.
import { register } from "node:module";

register("./resolve.mjs", import.meta.url);
