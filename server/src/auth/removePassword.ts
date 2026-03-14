export default function removePassword<T extends { password: unknown }>(obj: T): Omit<T, 'password'> {
  delete obj.password;
  return obj;
}
