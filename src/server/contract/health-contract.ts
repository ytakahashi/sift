import { SIFT_PRODUCT_NAME } from '../../domain/app/app-info';

/**
 * Discriminator that identifies a health response as coming from Sift rather
 * than from an unrelated process that happens to own the port.
 */
export const SIFT_HEALTH_PRODUCT = SIFT_PRODUCT_NAME;

export const NOTES_V1_CAPABILITY = 'notes-v1';

/**
 * Capabilities this build advertises. Kept as a literal tuple so the contract
 * states the exact set; widening it to `string[]` would let a capability be
 * dropped or renamed without any caller noticing.
 */
export const SIFT_HEALTH_CAPABILITIES = [NOTES_V1_CAPABILITY] as const;

/**
 * Identity fields parsed from a trusted `{ kind: 'sift' }` health response.
 * `capabilities` stays `readonly string[]`: it comes from whatever server owns
 * the port, which may be a different version advertising an unknown set.
 */
export interface SiftHealthIdentity {
  version: string;
  capabilities: readonly string[];
}
