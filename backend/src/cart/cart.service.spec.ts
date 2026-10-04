import { CartService } from './cart.service';

describe('CartService.getOrCreateCart image URLs', () => {
  const makeCart = (file_path: string | null) => ({
    id: 'cart-1',
    user_id: 'user-1',
    session_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    items: [
      {
        id: 'item-1',
        product_id: 'prod-1',
        quantity: 2,
        product: {
          id: 'prod-1',
          title: 'Book',
          slug: 'book',
          price: '10.00',
          product_type: 'physical',
          stock_status: 'in_stock',
          stock_quantity: 5,
          media: file_path ? [{ media: { file_path } }] : [],
        },
      },
    ],
  });

  const build = (file_path: string | null) => {
    const prisma: any = { cart: { findFirst: jest.fn().mockResolvedValue(makeCart(file_path)) } };
    const storage: any = {
      getUrl: jest.fn(async (p: string) => `https://storage.googleapis.com/bucket/${p}`),
    };
    return { service: new CartService(prisma, storage), storage };
  };

  it('resolves the thumbnail through the storage provider', async () => {
    const { service, storage } = build('123-cover.png');
    const cart = await service.getOrCreateCart('user-1');
    expect(storage.getUrl).toHaveBeenCalledWith('123-cover.png');
    expect(cart.items[0].product.featured_image_url).toBe(
      'https://storage.googleapis.com/bucket/123-cover.png',
    );
  });

  it('reduces legacy absolute paths to the stored filename', async () => {
    const { service, storage } = build('/uploads/123-cover.png');
    await service.getOrCreateCart('user-1');
    expect(storage.getUrl).toHaveBeenCalledWith('123-cover.png');
  });

  it('returns null when the product has no media', async () => {
    const { service, storage } = build(null);
    const cart = await service.getOrCreateCart('user-1');
    expect(storage.getUrl).not.toHaveBeenCalled();
    expect(cart.items[0].product.featured_image_url).toBeNull();
  });
});
