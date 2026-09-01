import { DataSource } from 'typeorm';
import { NoteRecord } from '../models/notes/Note.entity';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: `../../data/boilerplate.sqlite`, //relative to main.ts
  synchronize: true, // Automatically sync the database with the entities
  logging: ['error', 'schema', 'warn'],
  entities: [NoteRecord], // Add your entities here
});

export async function initializeDatabase() {
  await AppDataSource.initialize();
  console.log(
    `[ORM config] Connection established with SQLite database: ${AppDataSource.options.database}`
  );
}
