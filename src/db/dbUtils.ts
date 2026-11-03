import { logger } from '../lib/logger.js'

/**
 * Shared helpers for classifying and retrying transient database failures.
 *
 * Neon's serverless driver performs a plain HTTPS fetch per query, so network
 * blips surface as thrown errors instead of slow queries. These helpers let
 * both the migration runner (db/migrate.ts) and the runtime app share the same
 * retry policy.
 */

type PgErrorLike = { code?: string; message?: string; cause?: unknown }

/** Error codes/messages that indicate a transient failure (safe to retry). */
const RETRYABLE =
	/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up/i

/**
 * Flattens an error (and its nested `cause` chain, which is where the pg /
 * neon driver often hides the real message) into a single searchable string.
 */
export function errorText(error: unknown): string {
	if (!(error instanceof Error)) return String(error)
	const cause = (error as PgErrorLike).cause
	const causeText =
		cause instanceof Error
			? `${cause.message} ${(cause as PgErrorLike).code ?? ''}`
			: String(cause ?? '')
	return `${error.message} ${causeText}`
}

/** True when the error looks transient and the operation can be retried. */
export function isRetryable(error: unknown): boolean {
	return RETRYABLE.test(errorText(error))
}

/**
 * True when the (possibly nested) error is Postgres `unique_violation` (23505).
 * We match on the SQLSTATE code instead of grepping the message — driver
 * wrappers frequently re-wrap and text matching silently misses.
 */
export function isUniqueViolation(error: unknown): boolean {
	let current: unknown = error
	while (current instanceof Error || (current !== null && typeof current === 'object')) {
		const candidate = current as PgErrorLike
		if (candidate.code === '23505') return true
		current = candidate.cause
		if (current === undefined || current === null) break
	}
	return false
}

/**
 * Runs `fn` with a small retry budget for transient network errors.
 * Non-retryable errors are re-thrown immediately on the first attempt.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	maxAttempts = 3,
	baseDelayMs = 500,
): Promise<T> {
	let lastError: unknown

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error
			if (attempt === maxAttempts || !isRetryable(error)) {
				throw error
			}
			const delay = baseDelayMs * attempt
			logger.warn(
				`DB call failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`,
			)
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
	}

	throw lastError
}
