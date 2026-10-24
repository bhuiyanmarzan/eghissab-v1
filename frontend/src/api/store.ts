import { api } from './client';

export interface StoreSettings {
  store_id: string;
  timezone: string;
  currency: string;
  invoice_preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  role_code?: string;
  role_name?: string;
  settings?: StoreSettings;
}

export interface StoreMember {
  id: string;
  store_id: string;
  user_id: string;
  first_name: string;
  last_name?: string;
  email: string;
  role_code: string;
  role_name: string;
  status: string;
  created_at: string;
}

export interface Permission {
  id: string;
  code: string;
  scope: 'organization' | 'store' | 'platform';
  description?: string;
}

export interface StoreRole {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  system_role: boolean;
  permissions: string[];
  created_at: string;
}

export interface StoreInvitation {
  id: string;
  store_id: string;
  intended_contact: string;
  role_id: string;
  role_code: string;
  role_name: string;
  status: string;
  expires_at: string;
  created_by: string;
  created_at: string;
  accepted_at?: string;
  invitation_token?: string;
}

export interface MenuItem {
  id: string;
  key: string;
  label: string;
  route: string;
  parent_id?: string;
  portal: string;
  display_order: number;
  icon?: string;
  children?: MenuItem[];
}

export interface CreateStorePayload {
  organization_id: string;
  name: string;
  slug?: string;
}

export interface UpdateStorePayload {
  name: string;
  status?: string;
}

export interface UpdateStoreSettingsPayload {
  timezone?: string;
  currency?: string;
  invoice_preferences?: Record<string, unknown>;
}

export interface CreateStoreRolePayload {
  organization_id: string;
  code: string;
  name: string;
  permissions: string[];
}

export interface UpdateStoreRolePermissionsPayload {
  permissions: string[];
}

export interface AssignStoreMemberPayload {
  user_id: string;
  role_code: string;
}

export interface CreateStoreInvitationPayload {
  intended_contact: string;
  role_id: string;
}

export interface AcceptStoreInvitationPayload {
  token: string;
}

export async function createStore(payload: CreateStorePayload): Promise<Store> {
  const { data } = await api.post<Store>('/stores', payload);
  return data;
}

export async function listStores(organizationId: string): Promise<Store[]> {
  const { data } = await api.get<Store[]>('/stores', {
    params: { organization_id: organizationId },
  });
  return data;
}

export async function getStore(id: string): Promise<Store> {
  const { data } = await api.get<Store>(`/stores/${id}`);
  return data;
}

export async function updateStore(id: string, payload: UpdateStorePayload): Promise<Store> {
  const { data } = await api.patch<Store>(`/stores/${id}`, payload);
  return data;
}

// Store Settings
export async function getStoreSettings(id: string): Promise<StoreSettings> {
  const { data } = await api.get<StoreSettings>(`/stores/${id}/settings`);
  return data;
}

export async function updateStoreSettings(id: string, payload: UpdateStoreSettingsPayload): Promise<StoreSettings> {
  const { data } = await api.patch<StoreSettings>(`/stores/${id}/settings`, payload);
  return data;
}

// Permissions Catalog
export async function listPermissions(scope?: string): Promise<Permission[]> {
  const { data } = await api.get<Permission[]>('/stores/permissions', {
    params: scope ? { scope } : undefined,
  });
  return data;
}

// Reusable Store Roles
export async function listStoreRoles(organizationId: string): Promise<StoreRole[]> {
  const { data } = await api.get<StoreRole[]>('/stores/roles', {
    params: { organization_id: organizationId },
  });
  return data;
}

export async function createStoreRole(payload: CreateStoreRolePayload): Promise<StoreRole> {
  const { data } = await api.post<StoreRole>('/stores/roles', payload);
  return data;
}

export async function updateStoreRolePermissions(
  roleId: string,
  payload: UpdateStoreRolePermissionsPayload
): Promise<{ message: string }> {
  const { data } = await api.put<{ message: string }>(`/stores/roles/${roleId}/permissions`, payload);
  return data;
}

export async function deleteStoreRole(roleId: string): Promise<void> {
  await api.delete(`/stores/roles/${roleId}`);
}

// Memberships
export async function listStoreMembers(id: string): Promise<StoreMember[]> {
  const { data } = await api.get<StoreMember[]>(`/stores/${id}/members`);
  return data;
}

export async function assignStoreMember(id: string, payload: AssignStoreMemberPayload): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(`/stores/${id}/members`, payload);
  return data;
}

export async function removeStoreMember(storeId: string, userId: string): Promise<void> {
  await api.delete(`/stores/${storeId}/members/${userId}`);
}

// Store Invitations
export async function listStoreInvitations(storeId: string): Promise<StoreInvitation[]> {
  const { data } = await api.get<StoreInvitation[]>(`/stores/${storeId}/invitations`);
  return data;
}

export async function inviteStoreStaff(
  storeId: string,
  payload: CreateStoreInvitationPayload
): Promise<StoreInvitation> {
  const { data } = await api.post<StoreInvitation>(`/stores/${storeId}/invitations`, payload);
  return data;
}

export async function acceptStoreInvitation(payload: AcceptStoreInvitationPayload): Promise<Store> {
  const { data } = await api.post<Store>('/stores/invitations/accept', payload);
  return data;
}

export async function revokeStoreInvitation(storeId: string, invitationId: string): Promise<void> {
  await api.delete(`/stores/${storeId}/invitations/${invitationId}`);
}

// Dynamic Presentation Menus
export async function getAuthorizedMenus(params?: { store_id?: string; portal?: string }): Promise<MenuItem[]> {
  const { data } = await api.get<MenuItem[]>('/stores/menus', { params });
  return data;
}

// Domain D: Products & Inventory Types
export interface Product {
  id: string;
  store_id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  sku: string;
  name: string;
  description?: string;
  price: number;
  initial_quantity?: number;
  location_id?: string;
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  price?: number;
  status?: string;
}

export interface InventoryLocation {
  id: string;
  store_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryLocationPayload {
  name: string;
  is_default?: boolean;
}

export interface InventoryBalance {
  store_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  location_id: string;
  location_name: string;
  quantity: number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  store_id: string;
  product_id: string;
  location_id: string;
  quantity_delta: number;
  reason: string;
  reference_id?: string;
  actor_user_id?: string;
  created_at: string;
}

export interface RecordStockMovementPayload {
  product_id: string;
  location_id: string;
  quantity_delta: number;
  reason: string;
  reference_id?: string;
}

// Domain D: Store Customers Types
export interface StoreCustomer {
  id: string;
  store_id: string;
  customer_number: string;
  display_name: string;
  phone?: string;
  email?: string;
  address?: string;
  consumer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStoreCustomerPayload {
  customer_number?: string;
  display_name: string;
  phone?: string;
  email?: string;
  address?: string;
  consumer_id?: string;
}

export interface UpdateStoreCustomerPayload {
  display_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  consumer_id?: string;
}

// Domain D: Product & Inventory API Methods
export async function listProducts(storeId: string): Promise<Product[]> {
  const { data } = await api.get<Product[]>(`/stores/${storeId}/products`);
  return data;
}

export async function getProduct(storeId: string, productId: string): Promise<Product> {
  const { data } = await api.get<Product>(`/stores/${storeId}/products/${productId}`);
  return data;
}

export async function createProduct(storeId: string, payload: CreateProductPayload): Promise<Product> {
  const { data } = await api.post<Product>(`/stores/${storeId}/products`, payload);
  return data;
}

export async function updateProduct(storeId: string, productId: string, payload: UpdateProductPayload): Promise<Product> {
  const { data } = await api.patch<Product>(`/stores/${storeId}/products/${productId}`, payload);
  return data;
}

export async function listInventoryLocations(storeId: string): Promise<InventoryLocation[]> {
  const { data } = await api.get<InventoryLocation[]>(`/stores/${storeId}/locations`);
  return data;
}

export async function createInventoryLocation(storeId: string, payload: CreateInventoryLocationPayload): Promise<InventoryLocation> {
  const { data } = await api.post<InventoryLocation>(`/stores/${storeId}/locations`, payload);
  return data;
}

export async function listInventoryBalances(
  storeId: string,
  params?: { product_id?: string; location_id?: string }
): Promise<InventoryBalance[]> {
  const { data } = await api.get<InventoryBalance[]>(`/stores/${storeId}/inventory`, { params });
  return data;
}

export async function recordStockMovement(storeId: string, payload: RecordStockMovementPayload): Promise<StockMovement> {
  const { data } = await api.post<StockMovement>(`/stores/${storeId}/inventory/movements`, payload);
  return data;
}

// Domain D: Store Customers API Methods
export async function listStoreCustomers(storeId: string): Promise<StoreCustomer[]> {
  const { data } = await api.get<StoreCustomer[]>(`/stores/${storeId}/customers`);
  return data;
}

export async function getStoreCustomer(storeId: string, customerId: string): Promise<StoreCustomer> {
  const { data } = await api.get<StoreCustomer>(`/stores/${storeId}/customers/${customerId}`);
  return data;
}

export async function createStoreCustomer(storeId: string, payload: CreateStoreCustomerPayload): Promise<StoreCustomer> {
  const { data } = await api.post<StoreCustomer>(`/stores/${storeId}/customers`, payload);
  return data;
}

export async function updateStoreCustomer(storeId: string, customerId: string, payload: UpdateStoreCustomerPayload): Promise<StoreCustomer> {
  const { data } = await api.patch<StoreCustomer>(`/stores/${storeId}/customers/${customerId}`, payload);
  return data;
}

