import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { whatsappRoutes } from './routes/whatsapp.js';
import { WhatsAppSessionManager } from './whatsapp/WhatsAppSessionManager.js';
import { WhatsAppProviderImplementation } from './whatsapp/providers/WhatsAppProviderImplementation.js';

export async function buildApp() {
  const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] } });
  await app.register(helmet);
  await app.register(cors, { origin: env.FRONTEND_URL, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  const manager = new WhatsAppSessionManager(new WhatsAppProviderImplementation());
  await app.register(healthRoutes);
  await app.register(whatsappRoutes, { manager });
  app.setNotFoundHandler((_request, response) => response.code(404).send({ error: 'not_found' }));
  return app;
}
