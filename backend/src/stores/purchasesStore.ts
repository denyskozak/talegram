import { Purchase } from '../entities/Purchase.js';
import { appDataSource } from '../utils/data-source.js';

export type PurchaseDetails = {
  paymentId: string;
  purchasedAt: string;
  walrusBlobId: string | null;
  downloadUrl: string | null;
};

function mapEntityToDetails(entity: Purchase): PurchaseDetails {
  return {
    paymentId: entity.paymentId,
    purchasedAt: entity.purchasedAt.toISOString(),
    walrusBlobId: entity.walrusBlobId ?? null,
    downloadUrl: entity.downloadUrl ?? null,
  };
}

export const setPurchased = async (
  bookId: string,
  telegramUserId: string,
  details: PurchaseDetails,
): Promise<void> => {
  const repository = appDataSource.getRepository(Purchase);
  const existing = await repository.findOne({ where: { bookId, telegramUserId } });

  if (existing) {
    existing.paymentId = details.paymentId;
    existing.purchasedAt = new Date(details.purchasedAt);
    existing.walrusBlobId = details.walrusBlobId ?? null;
    existing.downloadUrl = details.downloadUrl ?? null;
    await repository.save(existing);
    return;
  }

  const purchase = repository.create({
    bookId,
    telegramUserId,
    paymentId: details.paymentId,
    purchasedAt: new Date(details.purchasedAt),
    walrusBlobId: details.walrusBlobId ?? null,
    downloadUrl: details.downloadUrl ?? null,
  });

  await repository.save(purchase);
};

export const getPurchaseDetails = async (
  bookId: string,
  telegramUserId: string,
): Promise<PurchaseDetails | undefined> => {
  const repository = appDataSource.getRepository(Purchase);
  const entity = await repository.findOne({ where: { bookId, telegramUserId } });
  if (!entity) {
    return undefined;
  }

  return mapEntityToDetails(entity);
};

export const listPurchasedBooks = async (
  telegramUserId: string,
): Promise<Array<{ bookId: string } & PurchaseDetails>> => {
  const repository = appDataSource.getRepository(Purchase);
  const entities = await repository.find({
    where: { telegramUserId },
    order: { purchasedAt: 'DESC' },
  });

  return entities.map((entity) => ({
    bookId: entity.bookId,
    ...mapEntityToDetails(entity),
  }));
};
