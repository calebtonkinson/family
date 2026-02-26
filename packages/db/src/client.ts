import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index.js";

if (process.env.NEON_LOCAL_PROXY) {
  neonConfig.fetchEndpoint = () => process.env.NEON_LOCAL_PROXY!;
}

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

export type Database = typeof db;
