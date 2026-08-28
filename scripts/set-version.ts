/** Write one version, taken from the git tag, into every manifest that carries it. */

import { readFileSync, writeFileSync } from "node:fs";

const raw = process.argv[2] ?? "";
const version = raw.replace(/^v/, "");

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`not a version: ${raw || "(nothing given)"}`);
  process.exit(2);
}

const root = new URL("..", import.meta.url).pathname;

const json = (path: string) => {
  const file = `${root}${path}`;
  const data = JSON.parse(readFileSync(file, "utf8"));
  data.version = version;
  writeFileSync(file, `${JSON.stringify(data, null, 4)}\n`);
  console.log(`${path} -> ${version}`);
};

const toml = (path: string) => {
  const file = `${root}${path}`;
  const body = readFileSync(file, "utf8");
  const line = /^version = ".*"$/m;
  if (!line.test(body)) {
    console.error(`no version line in ${path}`);
    process.exit(1);
  }
  writeFileSync(file, body.replace(line, `version = "${version}"`));
  console.log(`${path} -> ${version}`);
};

json("app/src-tauri/tauri.conf.json");
json("app/package.json");
toml("app/src-tauri/Cargo.toml");
