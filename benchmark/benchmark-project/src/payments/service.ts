export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

const payments: Map<string, Payment> = new Map();

export function createPayment(userId: string, amount: number, currency = 'USD'): Payment {
  if (amount <= 0) throw new Error('Amount must be positive');
  const payment: Payment = {
    id: Math.random().toString(36).slice(2),
    userId, amount, currency, status: 'pending', createdAt: new Date(),
  };
  payments.set(payment.id, payment);
  return payment;
}

export function completePayment(id: string): Payment {
  const p = payments.get(id);
  if (!p) throw new Error(`Payment ${id} not found`);
  p.status = 'completed';
  return p;
}

export function getPaymentsByUser(userId: string): Payment[] {
  return Array.from(payments.values()).filter((p) => p.userId === userId);
}
