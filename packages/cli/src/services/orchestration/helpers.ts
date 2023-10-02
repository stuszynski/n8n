import { Container } from 'typedi';
import { jsonParse } from 'n8n-workflow';
import { Logger } from '@/Logger';
import type { RedisServiceCommandObject } from '../redis/RedisServiceCommands';
import { COMMAND_REDIS_CHANNEL } from '../redis/RedisServiceHelper';

export function messageToRedisServiceCommandObject(messageString: string) {
	if (!messageString) return;
	let message: RedisServiceCommandObject;
	try {
		message = jsonParse<RedisServiceCommandObject>(messageString);
	} catch {
		const logger = Container.get(Logger);
		logger.debug(
			`Received invalid message via channel ${COMMAND_REDIS_CHANNEL}: "${messageString}"`,
		);
		return;
	}
	return message;
}
