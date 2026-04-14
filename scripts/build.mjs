import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.resolve(rootDir, "dist");

// Files and folders to copy to dist/
const filesToCopy = [
  "index.html",
  "app.bundle.js",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "README.md"
];

const foldersToCopy = [
  "assets",
  "appwrite/templates"
];

async function build() {
  try {
    console.log("🔨 Building for deployment...");

    // Clean dist directory
    try {
      await fs.rm(distDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist yet
    }

    // Create dist directory
    await fs.mkdir(distDir, { recursive: true });
    console.log("✓ Created dist/ directory");

    // Copy individual files
    for (const file of filesToCopy) {
      const source = path.join(rootDir, file);
      const dest = path.join(distDir, file);
      try {
        const stats = await fs.stat(source);
        if (stats.isFile()) {
          await fs.copyFile(source, dest);
          console.log(`✓ Copied ${file}`);
        }
      } catch (error) {
        console.warn(`⚠ Skipped ${file} (not found)`);
      }
    }

    // Copy folders recursively
    async function copyDir(src, dst) {
      await fs.mkdir(dst, { recursive: true });
      const entries = await fs.readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const dstPath = path.join(dst, entry.name);
        if (entry.isDirectory()) {
          await copyDir(srcPath, dstPath);
        } else {
          await fs.copyFile(srcPath, dstPath);
        }
      }
    }

    for (const folder of foldersToCopy) {
      const source = path.join(rootDir, folder);
      const dest = path.join(distDir, folder);
      try {
        const stats = await fs.stat(source);
        if (stats.isDirectory()) {
          await copyDir(source, dest);
          console.log(`✓ Copied ${folder}/ directory`);
        }
      } catch (error) {
        console.warn(`⚠ Skipped ${folder}/ (not found)`);
      }
    }

    // Create a .nojekyll file for GitHub Pages
    await fs.writeFile(path.join(distDir, ".nojekyll"), "");
    console.log("✓ Created .nojekyll (GitHub Pages marker)");

    // Summary
    const files = await fs.readdir(distDir, { recursive: true });
    console.log(`\n✅ Build complete! ${files.length} files in dist/`);
    console.log("\n📦 Ready to deploy:\n");
    console.log("  GitHub Pages:");
    console.log("    git add dist/");
    console.log("    git commit -m 'Build for deployment'");
    console.log("    git push\n");
  } catch (error) {
    console.error("❌ Build failed:", error.message);
    process.exit(1);
  }
}

build();
