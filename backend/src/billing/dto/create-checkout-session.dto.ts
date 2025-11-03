export class CreateCheckoutSessionDto {
  successUrl: string;
  cancelUrl: string;
  priceId?: string;
  customerEmail?: string;
}
