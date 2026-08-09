import { SIFT_PRODUCT_NAME } from '../../domain/app/app-info';

/**
 * Discriminator that identifies a health response as coming from Sift rather
 * than from an unrelated process that happens to own the port.
 */
export const SIFT_HEALTH_PRODUCT = SIFT_PRODUCT_NAME;

/**
 * The Notes API as of the note shape that carries `staleness`.
 *
 * Notes clients validate responses strictly, so any change to the public Note
 * shape breaks clients built against the previous one. The capability is
 * therefore bumped with the shape, and the superseded value is *not* also
 * advertised: letting an older client through would only move its failure from
 * an actionable "versions do not match" to an opaque parse error.
 */
export const NOTES_V2_CAPABILITY = 'notes-v2';

/**
 * Capabilities this build advertises. Kept as a literal tuple so the contract
 * states the exact set; widening it to `string[]` would let a capability be
 * dropped or renamed without any caller noticing.
 */
export const SIFT_HEALTH_CAPABILITIES = [NOTES_V2_CAPABILITY] as const;

/**
 * Identity fields parsed from a trusted `{ kind: 'sift' }` health response.
 * `capabilities` stays `readonly string[]`: it comes from whatever server owns
 * the port, which may be a different version advertising an unknown set.
 */
export interface SiftHealthIdentity {
  version: string;
  capabilities: readonly string[];
}
