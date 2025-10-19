export interface ServidorProps {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  perfil: 'Membro' | 'Supervisor' | 'Administrador';
  regionalId: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export class Servidor {
  private constructor(private props: ServidorProps) {}

  static create(props: Omit<ServidorProps, 'id' | 'criadoEm' | 'atualizadoEm'>): Servidor {
    return new Servidor({
      ...props,
      id: crypto.randomUUID(),
      criadoEm: new Date(),
      atualizadoEm: new Date()
    });
  }

  static fromPersistence(props: ServidorProps): Servidor {
    return new Servidor(props);
  }

  get id(): string {
    return this.props.id;
  }

  get nome(): string {
    return this.props.nome;
  }

  get email(): string {
    return this.props.email;
  }

  get matricula(): string {
    return this.props.matricula;
  }

  get perfil(): 'Membro' | 'Supervisor' | 'Administrador' {
    return this.props.perfil;
  }

  get regionalId(): string {
    return this.props.regionalId;
  }

  get ativo(): boolean {
    return this.props.ativo;
  }

  get criadoEm(): Date {
    return this.props.criadoEm;
  }

  get atualizadoEm(): Date {
    return this.props.atualizadoEm;
  }

  isMembro(): boolean {
    return this.props.perfil === 'Membro';
  }

  isSupervisor(): boolean {
    return this.props.perfil === 'Supervisor';
  }

  isAdministrador(): boolean {
    return this.props.perfil === 'Administrador';
  }

  ativar(): void {
    this.props.ativo = true;
    this.props.atualizadoEm = new Date();
  }

  desativar(): void {
    this.props.ativo = false;
    this.props.atualizadoEm = new Date();
  }

  alterarPerfil(novoPerfil: 'Membro' | 'Supervisor' | 'Administrador'): void {
    this.props.perfil = novoPerfil;
    this.props.atualizadoEm = new Date();
  }

  toJSON(): ServidorProps {
    return { ...this.props };
  }
} 