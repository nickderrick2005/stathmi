import type { Kysely } from 'kysely';
import type { Role } from '@opz-hub/shared';
import type { DB } from '../../types/database.js';
import type { RolesRepository } from '../rolesRepository.js';
import { wrapDbError } from '../../utils/dbErrors.js';

const intToHex = (value: string | null): string | null => {
  if (!value) return null;
  const num = parseInt(value, 10);
  if (isNaN(num)) return null;
  return '#' + num.toString(16).toUpperCase().padStart(6, '0');
};

export class KyselyRolesRepository implements RolesRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listRoles(): Promise<Role[]> {
    return wrapDbError('KyselyRolesRepository.listRoles', async () => {
      const rows = await this.db
        .selectFrom('roles')
        .select([
          'role_id',
          'role_name',
          'role_icon_url',
          'role_emoji',
          'role_primary_color',
          'role_secondary_color',
          'role_tertiary_color',
          'role_position',
        ])
        .where('is_deleted', '=', false)
        .execute();

      return rows.map((row) => ({
        id: String(row.role_id),
        name: row.role_name,
        iconUrl: row.role_icon_url,
        emoji: row.role_emoji,
        primaryColor: intToHex(row.role_primary_color),
        secondaryColor: intToHex(row.role_secondary_color),
        tertiaryColor: intToHex(row.role_tertiary_color),
        position: row.role_position,
      }));
    });
  }

  async getRoleById(roleId: string): Promise<Role | null> {
    return wrapDbError('KyselyRolesRepository.getRoleById', async () => {
      const row = await this.db
        .selectFrom('roles')
        .select([
          'role_id',
          'role_name',
          'role_icon_url',
          'role_emoji',
          'role_primary_color',
          'role_secondary_color',
          'role_tertiary_color',
          'role_position',
        ])
        .where('role_id', '=', roleId)
        .where('is_deleted', '=', false)
        .executeTakeFirst();

      if (!row) {
        return null;
      }

      return {
        id: String(row.role_id),
        name: row.role_name,
        iconUrl: row.role_icon_url,
        emoji: row.role_emoji,
        primaryColor: intToHex(row.role_primary_color),
        secondaryColor: intToHex(row.role_secondary_color),
        tertiaryColor: intToHex(row.role_tertiary_color),
        position: row.role_position,
      };
    });
  }

  async getRolesByIds(roleIds: string[]): Promise<Role[]> {
    if (roleIds.length === 0) {
      return [];
    }
    return wrapDbError('KyselyRolesRepository.getRolesByIds', async () => {
      const rows = await this.db
        .selectFrom('roles')
        .select([
          'role_id',
          'role_name',
          'role_icon_url',
          'role_emoji',
          'role_primary_color',
          'role_secondary_color',
          'role_tertiary_color',
          'role_position',
        ])
        .where('role_id', 'in', roleIds)
        .where('is_deleted', '=', false)
        .execute();

      return rows.map((row) => ({
        id: String(row.role_id),
        name: row.role_name,
        iconUrl: row.role_icon_url,
        emoji: row.role_emoji,
        primaryColor: intToHex(row.role_primary_color),
        secondaryColor: intToHex(row.role_secondary_color),
        tertiaryColor: intToHex(row.role_tertiary_color),
        position: row.role_position,
      }));
    });
  }
}
