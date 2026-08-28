export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

const users: Map<string, User> = new Map();

export function createUser(name: string, email: string): User {
  const user: User = { id: Math.random().toString(36).slice(2), name, email, createdAt: new Date() };
  users.set(user.id, user);
  return user;
}

export function getUserById(id: string): User | undefined {
  return users.get(id);
}

export function getAllUsers(): User[] {
  return Array.from(users.values());
}

export function deleteUser(id: string): boolean {
  return users.delete(id);
}
