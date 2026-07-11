import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const source = path.join(root, "..", "server", "src", "themes");
const target = path.join(root, "dist-server", "themes");

await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, { recursive: true, force: true });
