import { exec } from 'node:child_process';
import os from 'node:os';

export function openBrowser(url: string): void {
  const platform = os.platform();
  let command = '';

  if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    // Linux and others
    command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.warn(`Failed to open browser automatically: ${error.message}`);
      console.log(`Please open your browser and navigate to: ${url}`);
    }
  });
}
