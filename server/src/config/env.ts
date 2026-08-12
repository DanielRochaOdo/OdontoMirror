import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({ NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), PORT: z.coerce.number().int().positive().default(3333), FRONTEND_URL: z.string().url().default('http://localhost:5173'), SUPABASE_URL: z.string().url().optional(), SUPABASE_SERVICE_ROLE_KEY: z.string().optional() });
export const env = schema.parse(process.env);
