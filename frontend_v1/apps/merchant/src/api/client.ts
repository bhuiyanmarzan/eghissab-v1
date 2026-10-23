import { api } from '@eghissab/api';
export { api } from '@eghissab/api';

export type Stat = { id: string; label: string; value: string; change: number; color: string };
export type Order = { id: string; product: string; quantity: number; status: 'Approved' | 'Pending' | 'Rejected'; amount: number };
export type Customer = { id: string; name: string; email: string; phone: string; age: number; country: string; status: 'Complete' | 'Pending' | 'Canceled' };
export type Product = { id: string; name: string; category: string; price: number; stock: number; rating: number };

export async function getStats() {
  try {
    return (await api.get<Stat[]>('/stats')).data;
  } catch {
    return [];
  }
}

export async function getOrders() {
  try {
    return (await api.get<Order[]>('/orders')).data;
  } catch {
    return [];
  }
}

export async function getCustomers() {
  try {
    return (await api.get<Customer[]>('/customers')).data;
  } catch {
    return [];
  }
}

export async function getProducts() {
  try {
    return (await api.get<Product[]>('/products')).data;
  } catch {
    return [];
  }
}
