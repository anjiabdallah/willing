import { spawn } from 'node:child_process';
import path from 'node:path';

const SCRIPT_DIR = path.resolve('src/scripts/recommendation');

const runStep = (fileName: string, description: string, args: string[] = []) =>
  new Promise<void>((resolve, reject) => {
    console.log(`\n[recommendation] ${description}`);

    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['tsx', path.join(SCRIPT_DIR, fileName), ...args],
      {
        stdio: 'inherit',
        shell: false,
      },
    );

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Step failed (${fileName}) with exit code ${String(code)}`));
    });
  });

const run = async () => {
  await runStep('seed.ts', 'Seeding recommendation dataset');
  await runStep('recompute-all.ts', 'Recomputing all recommendation vectors (OpenAI calls possible)');
  await runStep('audit.ts', 'Auditing recommendation quality');
};

run().catch((error) => {
  console.error('\nRecommendation pipeline failed:', error);
  process.exit(1);
});
