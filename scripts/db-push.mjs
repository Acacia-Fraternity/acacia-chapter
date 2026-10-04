// Applies supabase/schema.sql directly to the live database over a raw
// Postgres connection, bypassing the Supabase dashboard's SQL Editor
// entirely. That's deliberate: the SQL Editor's Monaco-based text field
// auto-indents/auto-closes brackets on every keystroke, which corrupts a
// file this large when it arrives via simulated typing (see the "Running
// SQL against the live database" section of CLAUDE.md) — this script never
// touches that editor, so the problem it's a workaround for can't recur.
//
// Usage: npm run db:push  (reads SUPABASE_DB_URL from .env.local)

import { readFile } from "node:fs/promises";
import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error(
    "Missing SUPABASE_DB_URL. Add it to .env.local — see .env.local.example.",
  );
  process.exit(1);
}

const sql = await readFile(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);

// Supabase signs its Postgres/pooler certs with its own private CA
// ("Supabase Root 2021 CA") rather than a publicly-trusted one, so Node's
// bundled CA bundle doesn't recognize it and full verification fails with
// SELF_SIGNED_CERT_IN_CHAIN unless we hand Node that CA ourselves. This is
// Supabase's actual, published root (not a workaround) — see
// supabase-root-ca.pem in this folder — so this still gets genuine
// certificate verification, not rejectUnauthorized:false.
const caCert = await readFile(
  new URL("./supabase-root-ca.pem", import.meta.url),
  "utf8",
);
const client = new Client({ connectionString, ssl: { ca: caCert } });

await client.connect();

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("schema.sql applied successfully.");
} catch (err) {
  await client.query("rollback");
  console.error("schema.sql failed — rolled back, no changes were made.");
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
