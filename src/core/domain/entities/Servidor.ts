import { CicloFuncional } from '../value-objects/CicloFuncional';

export type PerfilServidor = 'Membro' | 'Supervisor' | 'Administrador';

export class Servidor {
  constructor(
    public readonly id: number,
    public readonly matricula: string,
    public readonly nome: string,
    public readonly perfil: PerfilServidor,
    public readonly regionalId: number,
    public readonly ativo: boolean,
    public readonly cicloFuncional: CicloFuncional,
    public readonly limiteMensalDiarias: number,
    public readonly contadorParticipacoesMes: number = 0
  ) {}

  static create(data: {
    matricula: string;
    nome: string;
    perfil: PerfilServidor;
    regionalId: number;
    cicloInicio: Date;
    cicloFim: Date;
    limiteMensalDiarias: number;
  }): Servidor {
    const cicloFuncional = new CicloFuncional(data.cicloInicio, data.cicloFim);
    
    return new Servidor(
      0, // ID será definido pelo banco
      data.matricula,
      data.nome,
      data.perfil,
      data.regionalId,
      true,
      cicloFuncional,
      data.limiteMensalDiarias
    );
  }

  podeParticiparOperacao(dataOperacao: Date): boolean {
    return this.ativo && this.cicloFuncional.contemData(dataOperacao);
  }

  podeReceberMaisDiarias(): boolean {
    return this.contadorParticipacoesMes < this.limiteMensalDiarias;
  }

  incrementarParticipacoes(): Servidor {
    return new Servidor(
      this.id,
      this.matricula,
      this.nome,
      this.perfil,
      this.regionalId,
      this.ativo,
      this.cicloFuncional,
      this.limiteMensalDiarias,
      this.contadorParticipacoesMes + 1
    );
  }
} 