import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kibibyte = 1024;
const failures = [];

async function javascriptAssets(application) {
  const directory = path.join(root, "apps", application, "dist", "assets");
  return (await readdir(directory))
    .filter((name) => name.endsWith(".js"))
    .map(async (name) => {
      const bytes = await readFile(path.join(directory, name));
      return { name, gzipBytes: gzipSync(bytes).byteLength };
    });
}

function enforce(label, assets, limitKiB) {
  for (const asset of assets) {
    if (asset.gzipBytes > limitKiB * kibibyte) {
      failures.push(
        `${label}/${asset.name}: ${(asset.gzipBytes / kibibyte).toFixed(2)} KiB gzip exceeds ${limitKiB} KiB`,
      );
    }
  }
}

const web = await Promise.all(await javascriptAssets("web"));
const curation = await Promise.all(await javascriptAssets("curation"));
enforce(
  "web non-map",
  web.filter((asset) => !asset.name.startsWith("AtlasPage-")),
  150,
);
enforce(
  "web map",
  web.filter((asset) => asset.name.startsWith("AtlasPage-")),
  350,
);
enforce("curation", curation, 150);

if (failures.length > 0) {
  console.error(`Build budget failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Build budgets passed (${web.length} web JS assets, ${curation.length} curation JS assets).`,
  );
}
