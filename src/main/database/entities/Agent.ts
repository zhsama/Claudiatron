import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm'
import { AgentRun } from './AgentRun'

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn()
  id!: number

  @Column('text')
  name!: string

  @Column('text')
  icon!: string

  @Column('text')
  system_prompt!: string

  @Column('text', { nullable: true })
  default_task?: string

  @Column('text', { default: 'sonnet' })
  model!: string

  @Column('boolean', { default: true })
  enable_file_read!: boolean

  @Column('boolean', { default: true })
  enable_file_write!: boolean

  @Column('boolean', { default: false })
  enable_network!: boolean

  @Column('text', { nullable: true })
  hooks?: string // JSON string of hooks configuration

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date

  // Relations
  @OneToMany(() => AgentRun, (agentRun) => agentRun.agent, { cascade: true })
  runs!: AgentRun[]
}
