import https from 'https';
import { env } from './env.js';

/**
 * Razorpay Gateway Client (native HTTPS — no external SDK dependency)
 *
 * Uses Razorpay REST API v1 directly:
 *   https://razorpay.com/docs/api/orders/
 *   https://razorpay.com/docs/api/payments/
 */

export interface RazorpayOrderCreateParams {
  /** Amount in paise (₹1 = 100 paise) */
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export interface RazorpayRefundParams {
  /** Amount in paise to refund (if not provided, full refund) */
  amount?: number;
  speed?: 'normal' | 'optimum';
  notes?: Record<string, string>;
}

export interface RazorpayRefundResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  status: string;
  speed_processed: string;
  created_at: number;
}

/**
 * Generic Razorpay API request (uses basic auth with key_id:key_secret).
 * Wraps Node.js native https.request for zero external dependencies.
 */
function razorpayRequest<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      reject(new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured'));
      return;
    }

    const bodyStr = body ? JSON.stringify(body) : undefined;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const options: https.RequestOptions = {
      hostname: 'api.razorpay.com',
      path: `/v1${path}`,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 15000, // 15-second gateway timeout
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as T;
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`Razorpay API error ${res.statusCode}: ${data}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Failed to parse Razorpay response: ${data}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Razorpay API request timed out after 15 seconds'));
    });

    req.on('error', (err) => reject(err));

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

/**
 * Create a Razorpay payment order.
 * The returned `id` (razorpay_order_id) is passed to the frontend for checkout.
 */
export async function createRazorpayOrder(params: RazorpayOrderCreateParams): Promise<RazorpayOrderResponse> {
  return razorpayRequest<RazorpayOrderResponse>('POST', '/orders', params);
}

/**
 * Initiate a refund for a captured Razorpay payment.
 */
export async function createRazorpayRefund(
  razorpayPaymentId: string,
  params?: RazorpayRefundParams
): Promise<RazorpayRefundResponse> {
  return razorpayRequest<RazorpayRefundResponse>('POST', `/payments/${razorpayPaymentId}/refund`, params || {});
}
