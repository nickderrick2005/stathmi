import type { DatabaseError } from 'pg';

export type RepositoryErrorCode = 'NOT_FOUND' | 'CONSTRAINT' | 'UNKNOWN';

export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
  }
}

const UNIQUE_VIOLATION = '23505';

const asDatabaseError = (error: unknown): DatabaseError | undefined => {
  if (error && typeof error === 'object' && 'code' in error) {
    return error as DatabaseError;
  }
  return undefined;
};

const normalizeError = (operation: string, error: unknown): RepositoryError => {
  if (error instanceof RepositoryError) {
    return error;
  }

  // 检查是否是数据库错误
  const dbError = asDatabaseError(error);
  if (dbError?.code === UNIQUE_VIOLATION) {
    return new RepositoryError('CONSTRAINT', `${operation}: constraint violation`, error);
  }

  // 通用错误处理
  return new RepositoryError('UNKNOWN', `${operation} failed`, error);
};

export const wrapDbError = async <T>(operation: string, task: () => Promise<T>): Promise<T> => {
  try {
    return await task();
  } catch (error) {
    throw normalizeError(operation, error);
  }
};
