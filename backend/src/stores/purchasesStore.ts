import { Purchase } from '../entities/Purchase.js';
import { appDataSource } from '../utils/data-source.js';

export type PurchaseDetails = {
  paymentId: string;
  purchasedAt: string;
  filePath: string | null;
  telegramChargeId?: string | null;
};

function mapEntityToDetails(entity: Purchase): PurchaseDetails {
  return {
    paymentId: entity.paymentId,
    purchasedAt: entity.purchasedAt.toISOString(),
    filePath: entity.filePath ?? null,
    telegramChargeId: entity.telegramChargeId ?? null,
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
    existing.filePath = details.filePath ?? null;
    existing.telegramChargeId = details.telegramChargeId ?? null;
    await repository.save(existing);
    return;
  }

  const purchase = repository.create({
    bookId,
    telegramUserId,
    paymentId: details.paymentId,
    purchasedAt: new Date(details.purchasedAt),
    filePath: details.filePath ?? null,
    telegramChargeId: details.telegramChargeId ?? null,
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

export const getPurchaseByPaymentId = async (
  paymentId: string,
): Promise<(PurchaseDetails & { bookId: string; telegramUserId: string }) | undefined> => {
  const repository = appDataSource.getRepository(Purchase);
  const entity = await repository.findOne({ where: [{ paymentId }, { telegramChargeId: paymentId }] });
  if (!entity) {
    return undefined;
  }

  return {
    bookId: entity.bookId,
    telegramUserId: entity.telegramUserId,
    ...mapEntityToDetails(entity),
  };
};

export const deletePurchaseByPaymentId = async (paymentId: string): Promise<void> => {
  const repository = appDataSource.getRepository(Purchase);
  await repository.delete([{ paymentId }, { telegramChargeId: paymentId }]);
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
