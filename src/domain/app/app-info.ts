/**
 * Application metadata shared by Sift's runtime entry points.
 *
 * `productName` is the stable protocol and command identity, while version
 * and description are populated from the npm package metadata.
 */
export interface AppInfo {
  productName: string;
  version: string;
  description: string;
}

export const SIFT_PRODUCT_NAME = 'sift';
