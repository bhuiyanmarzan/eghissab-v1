import { describe, expect, it } from 'vitest';
import { customerCsv, customerDefaults, customerSchema, type CustomerRecord } from './customer';
const row: CustomerRecord = {
  id: '100',
  name: 'Earl Parrini',
  email: 'sah@gmail.com',
  phone: '+1 965 8864355',
  age: 55,
  country: 'Russia',
  status: 'Complete',
};
describe('Customer record helpers', () => {
  it('adapts existing records without inventing profile information', () => {
    expect(customerDefaults(row)).toMatchObject({
      firstName: 'Earl',
      lastName: 'Parrini',
      role: '',
      contactPublic: true,
    });
    expect(customerSchema.safeParse(customerDefaults(row)).success).toBe(true);
  });
  it('validates age, contact and required identity fields', () => {
    const values = customerDefaults(row);
    expect(customerSchema.safeParse({ ...values, age: 17 }).success).toBe(false);
    expect(customerSchema.safeParse({ ...values, phone: 'abc' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...values, email: 'invalid' }).success).toBe(false);
  });
  it('escapes CSV and neutralizes formula prefixes', () => {
    const csv = customerCsv([{ ...row, name: '=SUM(1,2)', country: 'a "quote"' }]);
    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain('"a ""quote"""');
    expect(csv).toContain('"100"');
  });
});
