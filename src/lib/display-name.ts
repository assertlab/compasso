/** How a person is shown: their name, else their e-mail; anonymized (deleted) users have no identity left. */
export const displayName = (u: { name: string | null; email: string; deletedAt: Date | null }) =>
  u.deletedAt ? "Usuário removido" : u.name?.trim() || u.email;
