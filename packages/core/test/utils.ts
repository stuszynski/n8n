import { Container } from 'typedi';
import { mock } from 'jest-mock-extended';
import { Duplex } from 'stream';
import type { DeepPartial } from 'ts-essentials';

export const mockInstance = <T>(
	constructor: new (...args: unknown[]) => T,
	data: DeepPartial<T> | undefined = undefined,
) => {
	const instance = mock<T>(data);
	Container.set(constructor, instance);
	return instance;
};

export function toStream(buffer: Buffer) {
	const d = new Duplex();
	d.push(buffer);
	d.push(null);

	return d;
}