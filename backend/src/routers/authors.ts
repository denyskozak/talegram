import { createRouter, procedure } from '../trpc/trpc.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import { Author } from '../entities/Author.js';

export const authorsRouter = createRouter({
  list: procedure.query(async () => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(Author);
    const authors = await repository.find({ order: { name: 'ASC' } });
    return authors.map((author) => ({
      id: author.id,
      name: author.name,
      telegramUsername: author.telegramUsername,
    }));
  }),
});
