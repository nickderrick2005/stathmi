const REQUIRED_ENV_VARS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_SERVER_ID',
  'DISCORD_SERVER_ROLES',
  'SESSION_SECRET',
];

export const validateRequiredEnv = (): void => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing
        .map((key) => `  - ${key}`)
        .join('\n')}\nPlease update your environment configuration.`
    );
  }
};

export const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
};

export const parseRoleIds = (envVar: string): string[] =>
  getRequiredEnv(envVar)
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
