import crypto from 'crypto'
import qs from 'qs'
import { config } from '../config/config'

/**
 * Sort object keys alphabetically — required by VNPay for checksum calculation.
 */
function sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {}
    const keys = Object.keys(obj).map(k => encodeURIComponent(k)).sort()
    for (const key of keys) {
        const decodedKey = decodeURIComponent(key)
        // VNPay standard requires spaces to be URL encoded as '+'
        sorted[key] = encodeURIComponent(obj[decodedKey]).replace(/%20/g, '+')
    }
    return sorted
}

/**
 * Format a Date to VNPay's required format: yyyyMMddHHmmss (Asia/Ho_Chi_Minh timezone)
 */
function formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0')
    // Convert to Vietnam timezone (UTC+7)
    const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000)
    const year = vnDate.getUTCFullYear()
    const month = pad(vnDate.getUTCMonth() + 1)
    const day = pad(vnDate.getUTCDate())
    const hours = pad(vnDate.getUTCHours())
    const minutes = pad(vnDate.getUTCMinutes())
    const seconds = pad(vnDate.getUTCSeconds())
    return `${year}${month}${day}${hours}${minutes}${seconds}`
}

export interface CreateVnpayUrlParams {
    amount: number
    orderId: string
    orderInfo: string
    ipAddr: string
    bankCode?: string
    locale?: string
}

/**
 * Create a VNPay payment URL with HMAC-SHA512 secure hash.
 *
 * This generates a URL that redirects the user to VNPay's payment page (sandbox).
 * The amount is automatically multiplied by 100 as required by VNPay.
 */
export function createPaymentUrl(params: CreateVnpayUrlParams): string {
    const { tmnCode, hashSecret, url: vnpUrl, returnUrl } = config.vnpay

    if (!tmnCode || !hashSecret) {
        throw new Error('VNPAY_CONFIG_MISSING: VNP_TMN_CODE and VNP_HASH_SECRET must be set in .env')
    }

    const now = new Date()
    const createDate = formatDate(now)
    const expireDate = formatDate(new Date(now.getTime() + 15 * 60 * 1000)) // +15 minutes

    const vnpParams: Record<string, string> = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: tmnCode,
        vnp_Locale: params.locale || 'vn',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: params.orderId,
        vnp_OrderInfo: params.orderInfo,
        vnp_OrderType: 'other',
        vnp_Amount: (params.amount * 100).toString(),
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: params.ipAddr,
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate
    }

    if (params.bankCode) {
        vnpParams['vnp_BankCode'] = params.bankCode
    }

    const sorted = sortObject(vnpParams)
    const signData = qs.stringify(sorted, { encode: false })
    const hmac = crypto.createHmac('sha512', hashSecret)
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

    sorted['vnp_SecureHash'] = signed

    return vnpUrl + '?' + qs.stringify(sorted, { encode: false })
}

/**
 * Verify the secure hash from VNPay callback (IPN or Return URL).
 *
 * Extracts vnp_SecureHash, recomputes HMAC-SHA512, and compares.
 * Returns true if checksum is valid.
 */
export function verifySecureHash(query: Record<string, string>): boolean {
    const { hashSecret } = config.vnpay

    if (!hashSecret) {
        return false
    }

    const secureHash = query['vnp_SecureHash']
    if (!secureHash) {
        return false
    }

    // Remove hash fields before verification
    const params = { ...query }
    delete params['vnp_SecureHash']
    delete params['vnp_SecureHashType']

    const sorted = sortObject(params)
    const signData = qs.stringify(sorted, { encode: false })
    const hmac = crypto.createHmac('sha512', hashSecret)
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

    return secureHash === signed
}
