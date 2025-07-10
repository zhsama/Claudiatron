import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('app_settings')
export class AppSettings {
  @PrimaryColumn('text')
  key!: string

  @Column('text')
  value!: string

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
