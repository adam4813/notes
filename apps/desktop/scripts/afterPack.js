import { execSync } from "child_process";

async function afterPack() {
  console.log("Packaging complete. Restoring local Node.js native modules...");
  try {
    // Rebuilds modules back to your local system Node version
    execSync("npm rebuild", { stdio: "inherit" });
  } catch (error) {
    console.error("Failed to rebuild local modules:", error);
  }
}

// eslint-disable-next-line import/no-default-export
export default afterPack;
