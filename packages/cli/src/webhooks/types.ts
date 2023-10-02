import type { Request } from 'express';
import type { IDataObject, IHttpRequestMethods, INode, IWebhookDescription, Workflow } from 'n8n-workflow';

export type WebhookCORSRequest = Request & { method: 'OPTIONS' };

export type WebhookRequest = Request<{ path: string }> & { method: IHttpRequestMethods };

export type WaitingWebhookRequest = WebhookRequest & {
	params: WebhookRequest['path'] & { suffix?: string };
};

export interface WebhookResponseCallbackData {
	data?: IDataObject | IDataObject[];
	headers?: object;
	noWebhookResponse?: boolean;
	responseCode?: number;
}

export interface RegisteredWebhook {
	isDynamic: boolean;
	webhookPath: string;
	workflowId: string;
	startNode: INode;
	workflow: Workflow;
	description: IWebhookDescription;
}

export type RegisteredActiveWebhook = RegisteredWebhook;

export interface RegisteredTestWebhook extends RegisteredWebhook {
	sessionId: string;
	timeout: NodeJS.Timeout;
	destinationNode?: string;
}

export type RegisteredWaitingWebhook = RegisteredWebhook;
