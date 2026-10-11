import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL as string);
export const q = (text: string, params: unknown[] = []) => sql.query(text, params) as Promise<any[]>;
