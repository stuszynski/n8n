import { Service } from 'typedi';
import type { Application, Response } from 'express';
import type {
	INode,
	IWebhookData,
	IWorkflowExecuteAdditionalData,
	WorkflowActivateMode,
	WorkflowExecuteMode,
} from 'n8n-workflow';
import {
	NodeHelpers,
	Workflow,
	LoggerProxy as Logger,
	ErrorReporterProxy as ErrorReporter,
	WebhookPathAlreadyTakenError,
} from 'n8n-workflow';
import { NodeExecuteFunctions } from 'n8n-core';

import config from '@/config';
import { WorkflowRepository } from '@/databases/repositories';
import type { WorkflowEntity } from '@db/entities/WorkflowEntity';
import { NodeTypes } from '@/NodeTypes';
import { WebhookService } from '@/services/webhook.service';
import { NotFoundError } from '@/ResponseHelper';
import * as WorkflowExecuteAdditionalData from '@/WorkflowExecuteAdditionalData';
// import { webhookNotFoundErrorMessage } from '@/utils';
import { WorkflowsService } from '@/workflows/workflows.services';
import type { IWorkflowDb } from '@/Interfaces';

import { AbstractWebhooks } from './abstract.webhooks';
import type { RegisteredActiveWebhook, WebhookRequest, WebhookResponseCallbackData } from './types';

// const WEBHOOK_PROD_UNREGISTERED_HINT =
//	"The workflow must be active for a production URL to run successfully. You can activate the workflow using the toggle in the top-right of the editor. Note that unlike test URL calls, production URL calls aren't shown on the canvas (only in the executions list)";

@Service()
export class ActiveWebhooks extends AbstractWebhooks {
	private workflows: Map<string, Workflow> = new Map();

	private webhookData: Map<string, IWorkflowDb> = new Map();

	constructor(
		nodeTypes: NodeTypes,
		private webhookService: WebhookService,
		private workflowRepository: WorkflowRepository,
	) {
		super(nodeTypes);
	}

	override registerHandler(app: Application) {
		const prefix = config.getEnv('endpoints.webhook');
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		app.all(`/${prefix}/:path(*)`, this.handleRequest.bind(this));
	}

	async executeWebhook(
		webhook: RegisteredActiveWebhook,
		request: WebhookRequest,
		response: Response,
	): Promise<WebhookResponseCallbackData> {
		const method = request.method;
		const { webhookPath, workflowId, nodeName } = webhook;

		const workflow = this.workflows.get(workflowId);
		if (!workflow) {
			throw new NotFoundError(`Could not find workflow with id "${workflowId}"`);
		}

		const workflowData = this.webhookData.get(workflowId) as WorkflowEntity;
		const workflowOwnerId = workflowData.shared[0].userId;
		const additionalData = await WorkflowExecuteAdditionalData.getBase(workflowOwnerId);

		// Get the node which has the webhook defined to know where to start from and to get additional data
		const startNode = workflow.getNode(nodeName) as INode;
		const webhookData = NodeHelpers.getNodeWebhooks(workflow, startNode, additionalData).find(
			(w) => w.httpMethod === method && w.path === webhookPath,
		) as IWebhookData;

		return new Promise((resolve, reject) => {
			const executionMode = 'webhook';
			void this.startWebhookExecution(
				workflow,
				webhookData,
				workflowData,
				startNode,
				executionMode,
				undefined,
				undefined,
				undefined,
				request,
				response,
				(error: Error | null, data: object) => {
					if (error !== null) reject(error);
					else resolve(data);
				},
			);
		});
	}

	/** Adds all the webhooks of the workflow */
	async addWorkflowWebhooks(
		workflow: Workflow,
		workflowData: IWorkflowDb,
		additionalData: IWorkflowExecuteAdditionalData,
		mode: WorkflowExecuteMode,
		activation: WorkflowActivateMode,
	): Promise<void> {
		const webhooks = this.getWorkflowWebhooks(workflow, additionalData, undefined, true);
		for (const webhookData of webhooks) {
			const node = workflow.getNode(webhookData.node) as INode;
			node.name = webhookData.node;

			const path = webhookData.path;

			const webhook = this.webhookService.createWebhook({
				workflowId: webhookData.workflowId,
				webhookPath: path,
				node: node.name,
				method: webhookData.httpMethod,
			});

			if (webhook.webhookPath.startsWith('/')) {
				webhook.webhookPath = webhook.webhookPath.slice(1);
			}
			if (webhook.webhookPath.endsWith('/')) {
				webhook.webhookPath = webhook.webhookPath.slice(0, -1);
			}

			if ((path.startsWith(':') || path.includes('/:')) && node.webhookId) {
				webhook.webhookId = node.webhookId;
				webhook.pathLength = webhook.webhookPath.split('/').length;
			}

			try {
				// TODO: this should happen in a transaction, that way we don't need to manually remove this in `catch`
				await this.webhookService.storeWebhook(webhook);
				await workflow.createWebhookIfNotExists(
					webhookData,
					NodeExecuteFunctions,
					mode,
					activation,
					false,
				);
			} catch (error) {
				if (
					activation === 'init' &&
					config.getEnv('endpoints.skipWebhooksDeregistrationOnShutdown') &&
					(error as Error).name === 'QueryFailedError'
				) {
					// When skipWebhooksDeregistrationOnShutdown is enabled,
					// n8n does not remove the registered webhooks on exit.
					// This means that further initializations will always fail
					// when inserting to database. This is why we ignore this error
					// as it's expected to happen.

					continue;
				}

				try {
					await this.removeWorkflowWebhooks(workflow.id);
				} catch (error1) {
					ErrorReporter.error(error1);
					Logger.error(
						`Could not remove webhooks of workflow "${workflow.id}" because of error: "${
							(error1 as Error).message
						}"`,
					);
				}

				// if it's a workflow from the the insert
				// TODO check if there is standard error code for duplicate key violation that works
				// with all databases
				if ((error as Error).name === 'QueryFailedError') {
					throw new WebhookPathAlreadyTakenError(webhook.node);
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				} else if (error.detail) {
					// it's a error running the webhook methods (checkExists, create)
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
					error.message = error.detail;
				}

				throw error;
			}

			this.registerWebhook(webhook);
		}

		this.workflows.set(workflow.id, workflow);
		this.webhookData.set(workflow.id, workflowData);

		await this.webhookService.populateCache();
		await WorkflowsService.saveStaticData(workflow);
	}

	/** Remove all the webhooks of the workflow */
	async removeWorkflowWebhooks(workflowId: string): Promise<void> {
		const workflowData = await this.workflowRepository.findOne({
			where: { id: workflowId },
			relations: ['shared', 'shared.user', 'shared.user.globalRole'],
		});

		if (workflowData === null) {
			throw new Error(`Could not find workflow with id "${workflowId}"`);
		}

		const workflow = new Workflow({
			id: workflowId,
			name: workflowData.name,
			nodes: workflowData.nodes,
			connections: workflowData.connections,
			active: workflowData.active,
			nodeTypes: this.nodeTypes,
			staticData: workflowData.staticData,
			settings: workflowData.settings,
		});

		const mode = 'internal';

		const additionalData = await WorkflowExecuteAdditionalData.getBase(
			workflowData.shared[0].user.id,
		);

		const webhooks = this.getWorkflowWebhooks(workflow, additionalData, undefined, true);

		for (const webhookData of webhooks) {
			await workflow.deleteWebhook(webhookData, NodeExecuteFunctions, mode, 'update', false);
		}

		await WorkflowsService.saveStaticData(workflow);

		await this.webhookService.deleteWorkflowWebhooks(workflowId);
		// TODO: remove from this.registeredWebhooks
	}
}
