import pg from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function reset() {
  console.log("Dropping schema public...");
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log("Schema reset.");
  process.exit(0);
}

reset().catch(e => {
  console.error(e);
  process.exit(1);
});
