import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilteredGames(db: Database): Promise<void> {
    const [strategy] = await db.insert(categories).values({ name: 'Strategy', description: 'strategy' }).returning({ id: categories.id });
    const [puzzle] = await db.insert(categories).values({ name: 'Puzzle', description: 'puzzle' }).returning({ id: categories.id });
    const [pubOne] = await db.insert(publishers).values({ name: 'Pub One', description: 'pub one' }).returning({ id: publishers.id });
    const [pubTwo] = await db.insert(publishers).values({ name: 'Pub Two', description: 'pub two' }).returning({ id: publishers.id });

    const entries = [
        { title: 'Alpha Strategy', categoryId: strategy.id, publisherId: pubOne.id },
        { title: 'Beta Strategy', categoryId: strategy.id, publisherId: pubTwo.id },
        { title: 'Gamma Puzzle', categoryId: puzzle.id, publisherId: pubTwo.id },
    ];

    for (const entry of entries) {
        await db.insert(games).values({
            title: entry.title,
            description: `${entry.title} description`,
            starRating: 4.1,
            categoryId: entry.categoryId,
            publisherId: entry.publisherId,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('lists categories and publishers in alphabetical order', async () => {
        await seedFilteredGames(db);
        expect(await getAllCategories(db)).toEqual([
            { id: expect.any(Number), name: 'Puzzle' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
        expect(await getAllPublishers(db)).toEqual([
            { id: expect.any(Number), name: 'Pub One' },
            { id: expect.any(Number), name: 'Pub Two' },
        ]);
    });

    it('returns games filtered by category and publisher together', async () => {
        await seedFilteredGames(db);
        const [strategy] = await getAllCategories(db).then((all) => all.filter((category) => category.name === 'Strategy'));
        const [pubTwo] = await getAllPublishers(db).then((all) => all.filter((publisher) => publisher.name === 'Pub Two'));

        const filtered = await getFilteredGames(db, { categoryIds: [strategy.id], publisherId: pubTwo.id });

        expect(filtered.map((game) => game.title)).toEqual(['Beta Strategy']);
    });
});
