import { homedir } from 'node:os';
import path from 'node:path';

export const DEFAULT_REPOSITORY_CONFIG_PATH = path.join(
  homedir(),
  '.config',
  'sift',
  'config.json',
);
