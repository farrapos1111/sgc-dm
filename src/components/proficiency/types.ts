export type CarteirinhaDados = {
  nome: string;
  capitulo: string;
  numero: string;
  cidade: string;
  uf: string;
  registro: string;
  foto: string;
  proficiencia: {
    iniciatico: string | null;
    demolay: string | null;
  };
  validade: string;
  assinaturaMembro: string;
  assinaturaConsultor: string;
  qr: string;
  codigo: string;
  emissao: string;
  endereco: string[];
};
