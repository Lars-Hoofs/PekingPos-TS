import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// Runs from dist/test/unit, reads the TypeScript sources in src.
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

/** Which layers each layer may import. main.ts is the composition root and may import all of them. */
const allowed: Record<string, readonly string[]> = {
  domain: ["domain"],
  logic: ["logic", "domain"],
  dal: ["dal", "logic", "domain"],
  web: ["web", "logic", "domain"],
};

function sourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : entry.name.endsWith(".ts") ? [full] : [];
  });
}

function importedLayers(file: string): string[] {
  const imports = [...readFileSync(file, "utf8").matchAll(/from\s+"(\.[^"]+)"/g)].map((match) => match[1] ?? "");
  return imports.map((specifier) => path.relative(src, path.resolve(path.dirname(file), specifier)).split(path.sep)[0] ?? "");
}

describe("Layers", () => {
  for (const [layer, mayImport] of Object.entries(allowed)) {
    it(`${layer} only imports ${mayImport.join(", ")}`, () => {
      for (const file of sourceFiles(path.join(src, layer))) {
        for (const imported of importedLayers(file)) {
          assert.ok(
            mayImport.includes(imported),
            `${path.relative(src, file)} imports from ${imported}, which ${layer} may not use`,
          );
        }
      }
    });
  }

  it("keeps the domain free of the database and the web", () => {
    for (const file of sourceFiles(path.join(src, "domain"))) {
      const code = readFileSync(file, "utf8");
      assert.doesNotMatch(code, /from\s+"(mssql|express)"/, `${path.relative(src, file)} uses a framework`);
    }
  });

  it("keeps the logic free of the database and the web", () => {
    for (const file of sourceFiles(path.join(src, "logic"))) {
      const code = readFileSync(file, "utf8");
      assert.doesNotMatch(code, /from\s+"(mssql|express)"/, `${path.relative(src, file)} uses a framework`);
    }
  });
});
