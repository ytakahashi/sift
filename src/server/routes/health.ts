import { Hono } from 'hono';
import type { Env } from './env';
import { SIFT_HEALTH_CAPABILITIES, SIFT_HEALTH_PRODUCT } from '../contract/health-contract';

export interface CreateHealthRoutesOptions {
  /**
   * Version of the running server. Injected rather than read here because it
   * comes from package.json at runtime, which is a composition-root concern.
   */
  version: string;
}

export function createHealthRoutes(options: CreateHealthRoutesOptions): Hono<Env> {
  const healthRoutes = new Hono<Env>();

  healthRoutes.get('/', (c) => {
    return c.json({
      product: SIFT_HEALTH_PRODUCT,
      version: options.version,
      capabilities: SIFT_HEALTH_CAPABILITIES,
    });
  });

  return healthRoutes;
}
