export type Role = 'admin' | 'manager' | 'viewer';
export type Action = 'read' | 'create' | 'update' | 'delete' | 'export';

const grants: Record<Role, Action[]> = {
  admin: ['read', 'create', 'update', 'delete', 'export'],
  manager: ['read', 'create', 'update', 'export'],
  viewer: ['read'],
};

export function can(role: Role, action: Action) {
  return grants[role].includes(action);
}
