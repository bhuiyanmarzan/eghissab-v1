import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

export type Stat = { id: string; label: string; value: string; change: number; color: string };
export type Order = { id: string; product: string; quantity: number; status: 'Approved' | 'Pending' | 'Rejected'; amount: number };
export type Customer = { id: string; name: string; email: string; phone: string; age: number; country: string; status: 'Complete' | 'Pending' | 'Canceled' };
export type Product = { id: string; name: string; category: string; price: number; stock: number; rating: number };

export async function getStats() { return (await api.get<Stat[]>('/stats')).data; }
export async function getOrders() { return (await api.get<Order[]>('/orders')).data; }
export async function getCustomers() { return (await api.get<Customer[]>('/customers')).data; }
export async function getProducts() { return (await api.get<Product[]>('/products')).data; }
