import type { EntityManager, FindOptionsWhere } from 'typeorm';
import { In } from 'typeorm';
import type { IUserSettings } from 'n8n-workflow';
import * as Db from '@/Db';
import { User } from '@db/entities/User';

export class UserService {
	static async get(where: FindOptionsWhere<User>): Promise<User | null> {
		return Db.collections.User.findOne({
			relations: ['globalRole'],
			where,
		});
	}

	static async getByIds(transaction: EntityManager, ids: string[]) {
		return transaction.find(User, { where: { id: In(ids) } });
	}

	static async updateUserSettings(id: string, userSettings: Partial<IUserSettings>) {
		const { settings: currentSettings } = await Db.collections.User.findOneOrFail({
			where: { id },
		});
		return Db.collections.User.update(id, { settings: { ...currentSettings, ...userSettings } });
	}
}
