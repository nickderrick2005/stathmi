import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    console.log('Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Execute init-schema.sql
    console.log('Executing init-schema.sql...');
    const initSchema = readFileSync(join(__dirname, 'init-schema.sql'), 'utf-8');
    await pool.query(initSchema);
    console.log('✅ init-schema.sql executed successfully\n');

    // Verify tables were created
    console.log('Verifying tables...');
    const result = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'web_app'
      ORDER BY tablename
    `);

    console.log(`\n✅ Created ${result.rows.length} tables in web_app schema:`);
    result.rows.forEach((row) => {
      console.log(`   - ${row.tablename}`);
    });

    console.log('\n✅ All schema scripts executed successfully!');
  } catch (error) {
    console.error('❌ Error executing schema scripts:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
