import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('Generating TypeScript types from database schema...\n');

  const typeMapping = JSON.stringify({
    int8: 'BigIntString',
    timestamp: 'Timestamp',
    timestamptz: 'Timestamp',
  });

  const customImports = JSON.stringify({
    BigIntString: './helpers.js',
    Timestamp: './helpers.js',
  });

  // 1. 执行 kysely-codegen
  const cmd = [
    'kysely-codegen',
    '--dialect postgres',
    `--url "${dbUrl}"`,
    '--default-schema public',
    '--default-schema web_app',
    '--out-file src/types/database.ts',
    '--camel-case false',
    '--exclude-pattern "^kysely_migration"',
    `--type-mapping '${typeMapping}'`,
    `--custom-imports '${customImports}'`,
  ].join(' ');

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: path.join(__dirname, '..'),
    });

    if (stderr && !stderr.includes('kysely-codegen')) {
      console.warn('⚠️  stderr:', stderr);
    }
    if (stdout) console.log(stdout);
  } catch (error: unknown) {
    const err = error as { message?: string; stdout?: string; stderr?: string };
    console.error('kysely-codegen failed:', err.message ?? 'Unknown error');
    if (err.stdout) console.log('stdout:', err.stdout);
    if (err.stderr) console.error('stderr:', err.stderr);
    process.exit(1);
  }

  // 2. 后处理：替换类型和添加导入
  console.log('🔧 Post-processing generated types...');
  const typesPath = path.join(__dirname, '../src/types/database.ts');
  let content = await readFile(typesPath, 'utf-8');

  // 替换 PostgreSQL BIGINT 默认的 Int8 alias
  content = content.replace(/\bInt8\b/g, 'BigIntString');

  // 替换 BIGINT 类型（多种格式）
  content = content.replace(/:\s*bigint;/g, ': BigIntString;');
  content = content.replace(/:\s*bigint\s*\|/g, ': BigIntString |');
  content = content.replace(/:\s*Generated<bigint>/g, ': Generated<BigIntString>');
  content = content.replace(/:\s*ColumnType<bigint,/g, ': ColumnType<BigIntString,');

  // 替换 TIMESTAMPTZ 类型
  content = content.replace(/:\s*Date;/g, ': Timestamp;');
  content = content.replace(/:\s*Date\s*\|/g, ': Timestamp |');
  content = content.replace(/:\s*Generated<Date>/g, ': Generated<Timestamp>');
  content = content.replace(/:\s*ColumnType<Date,/g, ': ColumnType<Timestamp,');

  // 移除原有的 kysely 导入
  content = content.replace(/^import\s+.*?from\s+['"]kysely['"];?\s*\n/gm, '');
  // 移除重复的 helpers 导入（避免自定义导入和手动导入重复）
  content = content.replace(/^import\s+.*?from\s+['"].\/helpers(?:\.js)?['"];?\s*\n/gm, '');

  // 移除 kysely-codegen 生成的内置类型定义，统一使用自定义 helpers
  content = content.replace(/^export type Generated<[\s\S]*?;\s*\n/gm, '');
  content = content.replace(/^export type Timestamp\s*=\s*ColumnType<[^>]+>;\s*\n/gm, '');
  content = content.replace(/^export type Int8\s*=\s*ColumnType<[^>]+>;\s*\n/gm, '');

  // 添加新导入（文件头部）
  const imports = [
    `import type { ColumnType, Generated } from 'kysely';`,
    `import type { BigIntString, Timestamp } from './helpers.js';`,
    ``,
    ``,
  ].join('\n');

  content = imports + content;

  await writeFile(typesPath, content, 'utf-8');

  console.log(`Types generated successfully`);
  console.log(`   Output: ${typesPath}\n`);
}

main().catch((error) => {
  console.error('Type generation failed:', error);
  process.exit(1);
});
