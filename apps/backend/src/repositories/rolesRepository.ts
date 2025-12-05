import type { Role } from '@opz-hub/shared';

export interface RolesRepository {
  listRoles(): Promise<Role[]>;
  getRoleById(roleId: string): Promise<Role | null>;
  getRolesByIds(roleIds: string[]): Promise<Role[]>;
}
