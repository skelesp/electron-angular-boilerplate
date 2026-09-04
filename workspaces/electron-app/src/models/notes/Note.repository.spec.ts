import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../test-utils/sqliteTestDataSource';
import { NoteRepository } from './Note.repository';

describe('NoteRepository', () => {
  let dataSource: DataSource;
  let repository: NoteRepository;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    repository = new NoteRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('findAllOrderedByCreatedAt returns saved notes newest first', async () => {
    const older = await repository.save(repository.create({ title: 'Older', content: 'first' }));
    const newer = await repository.save(repository.create({ title: 'Newer', content: 'second' }));

    // CreateDateColumn's SQLite default (datetime('now')) has second-level precision, so two
    // inserts in the same test can tie - set explicit, unambiguously-ordered timestamps via a
    // raw query rather than relying on real elapsed time or on save() re-persisting a mutated
    // CreateDateColumn (which TypeORM treats as insert-only and may not honor on update).
    await dataSource.query('UPDATE note_record SET createdAt = ? WHERE id = ?', ['2020-01-01 00:00:00', older.id]);
    await dataSource.query('UPDATE note_record SET createdAt = ? WHERE id = ?', ['2020-01-02 00:00:00', newer.id]);

    const notes = await repository.findAllOrderedByCreatedAt();

    expect(notes.map((n) => n.id)).toEqual([newer.id, older.id]);
  });
});
