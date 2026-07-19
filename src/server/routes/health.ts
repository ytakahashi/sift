import { Hono } from 'hono';
import type { Env } from '../create-app';
import {
  SIFT_HEALTH_CAPABILITIES,
  SIFT_HEALTH_PRODUCT,
  SIFT_HEALTH_VERSION,
} from '../health-probe';

export const healthRoutes = new Hono<Env>();

healthRoutes.get('/', (c) => {
  return c.json({
    product: SIFT_HEALTH_PRODUCT,
    version: SIFT_HEALTH_VERSION,
    capabilities: SIFT_HEALTH_CAPABILITIES,
  });
});
