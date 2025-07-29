import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

interface Package {
  root: string;
  name: string;
  version: string;
  type: string;
  private: boolean;
  'repo-meta': {
    built: boolean;
    supportcjs?: boolean;
    strictness?: string;
    lint?: string[];
    env?: string[];
  };
}

interface Metadata {
  workspace: {
    packages: string[];
    version: string;
  };
  packages: Package[];
}

interface PackageJson {
  name: string;
  scripts?: Record<string, string>;
  [key: string]: any;
}

interface TurboJson {
  tasks: Record<string, any>;
  [key: string]: any;
}

async function main() {
  const projectRoot = join(dirname(import.meta.url.replace('file://', '')), '../..');

  // Read metadata.json
  const metadataPath = join(projectRoot, 'repo-metadata/metadata.json');
  const metadataContent = await readFile(metadataPath, 'utf-8');
  const metadata: Metadata = JSON.parse(metadataContent);

  // Find packages with repo-meta.built: true
  const builtPackages = metadata.packages.filter((pkg) => pkg['repo-meta'].built);

  console.log(`Found ${builtPackages.length} packages with repo-meta.built: true`);

  // Process each built package
  let updatedCount = 0;
  for (const pkg of builtPackages) {
    const packageJsonPath = join(projectRoot, pkg.root, 'package.json');

    try {
      // Read package.json
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(packageJsonContent);

      // Initialize scripts if not present
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      // Check if pack:local already exists
      if (packageJson.scripts['pack:local']) {
        console.log(`Package ${pkg.name} already has pack:local script, skipping`);
        continue;
      }

      // Calculate relative path from package to benchmark directory
      const packageDir = join(projectRoot, pkg.root);
      const benchmarkDir = join(projectRoot, 'benchmark/benchmarks/krausest/packages');
      const relativePath = relative(packageDir, benchmarkDir);

      // Add pack:local script
      packageJson.scripts['pack:local'] = `pnpm pack --pack-destination ${relativePath}`;

      // Write updated package.json
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`Updated ${pkg.name} with pack:local script`);
      updatedCount++;
    } catch (error) {
      console.error(`Error processing ${pkg.name}:`, error);
    }
  }

  console.log(`\nUpdated ${updatedCount} package.json files`);

  // Update turbo.json
  const turboJsonPath = join(projectRoot, 'turbo.json');
  const turboJsonContent = await readFile(turboJsonPath, 'utf-8');
  const turboJson: TurboJson = JSON.parse(turboJsonContent);

  // Check if pack:local task already exists
  if (!turboJson.tasks['pack:local']) {
    // Add pack:local task configuration
    turboJson.tasks['pack:local'] = {
      cache: true,
      dependsOn: ['prepack'],
      inputs: ['dist/**'],
      outputs: ['*.tgz'],
      env: ['NODE_ENV'],
    };

    // Write updated turbo.json
    await writeFile(turboJsonPath, JSON.stringify(turboJson, null, 2) + '\n');
    console.log('\nUpdated turbo.json with pack:local task');
  } else {
    console.log('\nturbo.json already has pack:local task');
  }

  console.log('\nScript completed successfully!');
}

// Run the script
main().catch((error) => {
  console.error('Error running script:', error);
  process.exit(1);
});
