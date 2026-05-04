const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const target = path.join(root, "android", "app", "src", "main", "assets", "www");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "service-worker.js",
  "assets"
];

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  const destination = path.join(target, file);
  fs.cpSync(source, destination, { recursive: true });
}

console.log(`Synced web assets to ${target}`);
