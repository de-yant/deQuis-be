import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const appPath = resolve(__dirname, '../dist/server/index.js');
const appModule = await import(appPath);
const app = appModule.default;

export default async function handler(req: any, res: any) {
  return app(req, res);
}