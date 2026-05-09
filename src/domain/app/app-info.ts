/**
 * Application metadata shared between the CLI version flag and the server
 * health endpoint. The values are populated at runtime from `package.json`
 * by the server composition layer; the domain layer only owns the shape.
 */
export interface AppInfo {
  name: string;
  version: string;
  description: string;
}
