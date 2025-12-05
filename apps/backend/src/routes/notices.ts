import type { FastifyPluginCallback } from 'fastify';
import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';

const NOTICES_DIR = resolve(process.cwd(), '../../notices');

export type NoticeType = 'error' | 'warning' | 'hint' | 'info';

export interface Notice {
  type: NoticeType;
  content: string;
  filename: string;
  updatedAt: string;
}

function parseNoticeType(firstLine: string): NoticeType {
  const line = firstLine.trim().toLowerCase();
  if (line === '<error>') return 'error';
  if (line === '<warning>') return 'warning';
  if (line === '<hint>') return 'hint';
  return 'info';
}

export const noticesRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/notices/latest', async (_request, reply) => {
    try {
      const files = await readdir(NOTICES_DIR);
      const mdFiles = files.filter((f) => f.endsWith('.md'));

      if (mdFiles.length === 0) {
        return reply.send(null);
      }

      // 获取所有 md 文件的修改时间
      const fileStats = await Promise.all(
        mdFiles.map(async (filename) => {
          const filepath = join(NOTICES_DIR, filename);
          const stats = await stat(filepath);
          return { filename, filepath, mtime: stats.mtime };
        })
      );

      // 按修改时间排序，获取最新的
      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      const latest = fileStats[0];

      const rawContent = await readFile(latest.filepath, 'utf-8');
      const lines = rawContent.split('\n');
      const firstLine = lines[0] || '';
      const type = parseNoticeType(firstLine);

      // 如果首行是类型标签，则移除它
      const isTypeTag = ['<error>', '<warning>', '<hint>'].includes(firstLine.trim().toLowerCase());
      const content = isTypeTag ? lines.slice(1).join('\n').trim() : rawContent.trim();

      const notice: Notice = {
        type,
        content,
        filename: latest.filename,
        updatedAt: latest.mtime.toISOString(),
      };

      return reply.send(notice);
    } catch (err) {
      // 如果目录不存在或其他错误，返回 null
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.send(null);
      }
      throw err;
    }
  });

  done();
};
