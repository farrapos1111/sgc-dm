/** Contatos da Comissão de Tecnologia (sugestões / notificações públicas). */
export const TECH_COMMISSION_CONTACTS = [
  {
    name: "Pedro Bossle",
    role: "Comissão de Tecnologia e Desenvolvimento",
    email: "pedro.bossle.s@gmail.com",
    phone: "(54) 99674-2031",
    phoneTel: "+5554996742031",
  },
  {
    name: "Lucas Borges",
    role: "Comissão de Tecnologia e Desenvolvimento",
    email: "lucasboeiraborges@gmail.com",
    phone: "(54) 98410-1106",
    phoneTel: "+5554984101106",
  },
] as const;

export const TECH_COMMISSION_EMAILS = TECH_COMMISSION_CONTACTS.map(
  (c) => c.email,
);
