import { Container } from 'typedi';
import { jsonParse } from 'n8n-workflow';
import { Logger } from '@/Logger';
import type { RedisServiceWorkerResponseObject } from '../redis/RedisServiceCommands';

export async function handleWorkerResponseMessage(messageString: string) {
	const workerResponse = jsonParse<RedisServiceWorkerResponseObject>(messageString);
	if (workerResponse) {
		const logger = Container.get(Logger);
		// TODO: Handle worker response
		logger.debug('Received worker response', workerResponse);
	}
	return workerResponse;
}
