import type { Role } from '@opz-hub/shared';
import type { RolesRepository } from '../repositories/rolesRepository.js';

export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async listRoles(): Promise<Role[]> {
    return this.rolesRepository.listRoles();
  }

  async getRoleById(roleId: string): Promise<Role | null> {
    return this.rolesRepository.getRoleById(roleId);
  }

  async getRolesByIds(roleIds: string[]): Promise<Role[]> {
    return this.rolesRepository.getRolesByIds(roleIds);
  }
}
