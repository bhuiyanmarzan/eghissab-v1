import { z } from 'zod';
import type { Customer } from '../api/client';
export const customerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.string().trim().email('Enter a valid email address'),
  age: z.number().int().min(18, 'Age must be at least 18').max(100, 'Age must be 100 or less'),
  fatherName: z.string().trim().max(160),
  role: z.string().trim().max(160),
  gender: z.enum(['Female', 'Male']),
  status: z.enum(['Complete', 'Pending', 'Canceled']),
  phone: z
    .string()
    .trim()
    .min(1, 'Contact is required')
    .max(40)
    .refine(
      (v) => /^[+()\d\s.-]+$/.test(v) && v.replace(/\D/g, '').length >= 7,
      'Enter a valid contact number',
    ),
  country: z.string().trim().min(1, 'Country is required').max(100),
  location: z.string().trim().max(500),
  about: z.string().trim().max(2000),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  contactPublic: z.boolean(),
  availableToHire: z.boolean(),
  avatar: z.string(),
});
export type CustomerValues = z.infer<typeof customerSchema>;
export type CustomerRecord = Customer &
  Partial<Omit<CustomerValues, 'status' | 'age' | 'email' | 'country' | 'phone'>> & {
    tenantId?: string;
    deleted?: boolean;
    visits?: number;
    progress?: number;
    portfolio?: string;
    zipCode?: string;
  };
export function customerDefaults(row?: CustomerRecord): CustomerValues {
  const [first = '', ...last] = row?.name.split(' ') ?? [];
  return {
    firstName: row?.firstName ?? first,
    lastName: row?.lastName ?? last.join(' '),
    email: row?.email ?? '',
    age: row?.age ?? 18,
    fatherName: row?.fatherName ?? '',
    role: row?.role ?? '',
    gender: row?.gender ?? 'Female',
    status: row?.status ?? 'Pending',
    phone: row?.phone ?? '',
    country: row?.country ?? '',
    location: row?.location ?? '',
    about: row?.about ?? '',
    skills: row?.skills ?? [],
    contactPublic: row?.contactPublic ?? true,
    availableToHire: row?.availableToHire ?? false,
    avatar: row?.avatar ?? '',
  };
}
export function customerCsv(rows: CustomerRecord[]) {
  const quote = (v: string | number) => {
    const text = String(v);
    return '"' + (/^\s*[=+\-@]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
  };
  return (
    '\uFEFF' +
    [
      ['#', 'Name', 'Email', 'Contact', 'Age', 'Country', 'Status'],
      ...rows.map((r) => [r.id, r.name, r.email, r.phone, r.age, r.country, r.status]),
    ]
      .map((r) => r.map(quote).join(','))
      .join('\r\n')
  );
}
export const skillOptions = [
  'Angular',
  'Codeigniter',
  'Figma',
  'HTML',
  'Javascript',
  'Mobile App',
  'NodeJS',
  'Photoshop',
  'Prototyping',
  'React',
  'Sketch',
  'UI Design',
  'UX Design',
  'Vue',
];
