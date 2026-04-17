/**
 * Shared currency symbols mapping.
 * Used by multiple routes (tax-currency, localization, etc.)
 * to avoid duplicating the same data.
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'د.إ',
  SGD: 'S$', AUD: 'A$', CAD: 'C$', JPY: '¥', CNY: '¥',
  CHF: 'CHF', HKD: 'HK$', NZD: 'NZ$', SEK: 'kr', KRW: '₩',
  MXN: 'MX$', BRL: 'R$', ZAR: 'R', RUB: '₽', TRY: '₺',
  THB: '฿', MYR: 'RM', PHP: '₱', IDR: 'Rp', VND: '₫',
  SAR: '﷼', EGP: 'E£', NGN: '₦', KES: 'KSh', GHS: '₵',
  UAH: '₴', PLN: 'zł', NOK: 'kr', DKK: 'kr', CZK: 'Kč',
  HUF: 'Ft', RON: 'lei', BGN: 'лв', ILS: '₪', TWD: 'NT$',
  BDT: '৳', PKR: 'Rs', LKR: 'Rs', NPR: 'रू', MUR: 'Rs',
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}
