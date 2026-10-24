import { api } from './client';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  role?: string;
}

export interface Member {
  id: string;
  organization_id: string;
  user_id: string;
  first_name: string;
  last_name?: string;
  email: string;
  status: string;
  is_owner: boolean;
  role_code?: string;
  role_name?: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role_code?: string;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
  invitation_token?: string;
}

export interface CreateOrganizationPayload {
  name: string;
  slug?: string;
}

export interface UpdateOrganizationPayload {
  name: string;
}

export interface InviteMemberPayload {
  email: string;
  role_code?: string;
}

export async function createOrganization(payload: CreateOrganizationPayload): Promise<Organization> {
  const { data } = await api.post<Organization>('/organizations', payload);
  return data;
}

export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await api.get<Organization[]>('/organizations');
  return data;
}

export async function getOrganization(id: string): Promise<Organization> {
  const { data } = await api.get<Organization>(`/organizations/${id}`);
  return data;
}

export async function updateOrganization(id: string, payload: UpdateOrganizationPayload): Promise<Organization> {
  const { data } = await api.patch<Organization>(`/organizations/${id}`, payload);
  return data;
}

export async function listOrganizationMembers(id: string): Promise<Member[]> {
  const { data } = await api.get<Member[]>(`/organizations/${id}/members`);
  return data;
}

export async function inviteOrganizationMember(id: string, payload: InviteMemberPayload): Promise<Invitation> {
  const { data } = await api.post<Invitation>(`/organizations/${id}/invitations`, payload);
  return data;
}

export async function acceptOrganizationInvitation(token: string): Promise<Organization> {
  const { data } = await api.post<Organization>('/organizations/invitations/accept', { token });
  return data;
}

export async function transferOrganizationOwnership(id: string, newOwnerUserId: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(`/organizations/${id}/transfer-ownership`, {
    new_owner_user_id: newOwnerUserId,
  });
  return data;
}

export async function updateOrganizationMemberRole(orgId: string, userId: string, roleCode: string): Promise<{ message: string }> {
  const { data } = await api.put<{ message: string }>(`/organizations/${orgId}/members/${userId}/role`, {
    role_code: roleCode,
  });
  return data;
}

export async function removeOrganizationMember(orgId: string, userId: string): Promise<void> {
  await api.delete(`/organizations/${orgId}/members/${userId}`);
}
