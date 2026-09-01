import { Repository, DataSource } from 'typeorm';
import { NoteRecord } from './Note.entity';

export class NoteRepository extends Repository<NoteRecord> {
  constructor(dataSource: DataSource) {
    super(NoteRecord, dataSource.createEntityManager());
  }

  async findAllOrderedByCreatedAt(): Promise<NoteRecord[]> {
    return this.find({ order: { createdAt: 'DESC' } });
  }
}
