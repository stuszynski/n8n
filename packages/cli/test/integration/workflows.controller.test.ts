import express from 'express';

import * as utils from './shared/utils';
import * as testDb from './shared/testDb';
import { WorkflowEntity } from '../../src/databases/entities/WorkflowEntity';
import * as UserManagementHelpers from '../../src/UserManagement/UserManagementHelper';

import type { Role } from '../../src/databases/entities/Role';
import type { IPinData } from 'n8n-workflow';

jest.mock('../../src/telemetry');

let app: express.Application;
let testDbName = '';
let globalOwnerRole: Role;

// mock whether sharing is enabled or not
jest.spyOn(UserManagementHelpers, 'isSharingEnabled').mockReturnValue(false);

beforeAll(async () => {
	app = await utils.initTestServer({
		endpointGroups: ['workflows'],
		applyAuth: true,
	});
	const initResult = await testDb.init();
	testDbName = initResult.testDbName;

	globalOwnerRole = await testDb.getGlobalOwnerRole();

	utils.initTestLogger();
	utils.initTestTelemetry();
});

beforeEach(async () => {
	await testDb.truncate(['User', 'Workflow', 'SharedWorkflow'], testDbName);
});

afterAll(async () => {
	await testDb.terminate(testDbName);
});

test('POST /workflows should store pin data for node in workflow', async () => {
	const ownerShell = await testDb.createUserShell(globalOwnerRole);
	const authOwnerAgent = utils.createAgent(app, { auth: true, user: ownerShell });

	const workflow = makeWorkflow({ withPinData: true });

	const response = await authOwnerAgent.post('/workflows').send(workflow);

	expect(response.statusCode).toBe(200);

	const { pinData } = response.body.data as { pinData: IPinData };

	expect(pinData).toMatchObject(MOCK_PINDATA);
});

test('POST /workflows should set pin data to null if no pin data', async () => {
	const ownerShell = await testDb.createUserShell(globalOwnerRole);
	const authOwnerAgent = utils.createAgent(app, { auth: true, user: ownerShell });

	const workflow = makeWorkflow({ withPinData: false });

	const response = await authOwnerAgent.post('/workflows').send(workflow);

	expect(response.statusCode).toBe(200);

	const { pinData } = response.body.data as { pinData: IPinData };

	expect(pinData).toBeNull();
});

test('GET /workflows/:id should return pin data', async () => {
	const ownerShell = await testDb.createUserShell(globalOwnerRole);
	const authOwnerAgent = utils.createAgent(app, { auth: true, user: ownerShell });

	const workflow = makeWorkflow({ withPinData: true });

	const workflowCreationResponse = await authOwnerAgent.post('/workflows').send(workflow);

	const { id } = workflowCreationResponse.body.data as { id: string };

	const workflowRetrievalResponse = await authOwnerAgent.get(`/workflows/${id}`);

	expect(workflowRetrievalResponse.statusCode).toBe(200);

	const { pinData } = workflowRetrievalResponse.body.data as { pinData: IPinData };

	expect(pinData).toMatchObject(MOCK_PINDATA);
});

function makeWorkflow({ withPinData }: { withPinData: boolean }) {
	const workflow = new WorkflowEntity();

	workflow.name = 'My Workflow';
	workflow.active = false;
	workflow.connections = {};
	workflow.nodes = [
		{
			id: 'uuid-1234',
			name: 'Spotify',
			type: 'n8n-nodes-base.spotify',
			parameters: { resource: 'track', operation: 'get', id: '123' },
			typeVersion: 1,
			position: [740, 240],
		},
	];

	if (withPinData) {
		workflow.pinData = MOCK_PINDATA;
	}

	return workflow;
}

const MOCK_PINDATA = { Spotify: [{ json: { myKey: 'myValue' } }] };
