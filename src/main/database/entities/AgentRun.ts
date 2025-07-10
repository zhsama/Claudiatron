import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm'
import { Agent } from './Agent'

@Entity('agent_runs')
export class AgentRun {
  @PrimaryGeneratedColumn()
  id!: number

  @Column('integer')
  agent_id!: number

  @Column('text')
  agent_name!: string

  @Column('text')
  agent_icon!: string

  @Column('text')
  task!: string

  @Column('text')
  model!: string

  @Column('text')
  project_path!: string

  @Column('text')
  session_id!: string // UUID session ID from Claude Code

  @Column('text', { default: 'pending' })
  status!: string // 'pending', 'running', 'completed', 'failed', 'cancelled'

  @Column('integer', { nullable: true })
  pid?: number

  @Column({ type: 'datetime', nullable: true })
  process_started_at?: Date

  @CreateDateColumn()
  created_at!: Date

  @Column({ type: 'datetime', nullable: true })
  completed_at?: Date

  // Relations
  @ManyToOne(() => Agent, (agent) => agent.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent
}
