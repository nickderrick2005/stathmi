import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

interface AppConfig {
  whitelistedChannelIds: string[];
  channelMappings?: Record<string, string>;
}

let config: AppConfig | null = null;

export const getAppConfig = (): AppConfig => {
  if (config) {
    return config;
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const configPath = resolve(__dirname, '../../config/channels.json');

    const fileContent = readFileSync(configPath, 'utf-8');
    config = JSON.parse(fileContent);
  } catch (error) {
    console.warn('Failed to load channels config, using default empty whitelist', error);
    config = { whitelistedChannelIds: [] };
  }

  return config!;
};
