export class Regional {
  constructor(
    public readonly id: number,
    public readonly nome: string,
    public readonly sigla: string,
    public readonly ativa: boolean,
    public readonly maxServidoresDia: number
  ) {}

  static create(data: {
    nome: string;
    sigla: string;
    maxServidoresDia: number;
  }): Regional {
    return new Regional(
      0, // ID será definido pelo banco
      data.nome,
      data.sigla,
      true,
      data.maxServidoresDia
    );
  }

  podeAlocarServidor(totalServidoresAtivos: number): boolean {
    return totalServidoresAtivos < this.maxServidoresDia;
  }


} 