import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ensureMirrorSellerIdentity,
  issueMirrorSellerLoginToken,
  MirrorSellerAuthError,
} from '../commercial/SellerAuthService.js';
import {
  authenticateRotasSeller,
  isRotasSellerAuthConfigured,
  RotasSellerAuthError,
} from '../rotas/authClient.js';

const sellerLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(512),
});

export async function sellerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/seller-login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, response) => {
    if (!isRotasSellerAuthConfigured()) {
      return response.code(503).send({
        error: 'rotas_auth_not_configured',
        message: 'O acesso comercial pelo Rotas ainda não está configurado no servidor.',
      });
    }

    const parsed = sellerLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.code(400).send({
        error: 'invalid_login_payload',
        message: 'Informe e-mail e senha.',
      });
    }

    try {
      const seller = await authenticateRotasSeller(parsed.data.email, parsed.data.password);
      const mirrorIdentity = await ensureMirrorSellerIdentity(seller);
      const loginToken = await issueMirrorSellerLoginToken(mirrorIdentity.email);

      return {
        tokenHash: loginToken.tokenHash,
        type: loginToken.type,
        seller: {
          name: mirrorIdentity.name,
          email: mirrorIdentity.email,
        },
      };
    } catch (error) {
      if (error instanceof RotasSellerAuthError) {
        if (error.code === 'invalid_credentials') {
          return response.code(401).send({
            error: 'invalid_credentials',
            message: 'E-mail ou senha inválidos.',
          });
        }
        if (error.code === 'access_denied') {
          return response.code(403).send({
            error: 'seller_access_denied',
            message: 'Este usuário não possui acesso comercial ativo no sistema de Rotas.',
          });
        }
        return response.code(503).send({
          error: 'rotas_auth_not_configured',
          message: 'O acesso comercial pelo Rotas ainda não está configurado no servidor.',
        });
      }

      if (error instanceof MirrorSellerAuthError && error.code === 'email_conflict') {
        return response.code(403).send({
          error: 'seller_identity_conflict',
          message: 'Não foi possível liberar o acesso comercial para este usuário. Procure o administrador.',
        });
      }

      request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'seller login bridge failed');
      return response.code(500).send({
        error: 'seller_login_failed',
        message: 'Não foi possível concluir o acesso comercial agora. Tente novamente em instantes.',
      });
    }
  });
}
