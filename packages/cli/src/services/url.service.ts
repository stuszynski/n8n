import { Service } from 'typedi';
import config from '@/config';

@Service()
export class URLService {
	private urls: {
		base: string;
		rest: string;
		editor: string;
		webhook: string;
		oauth1Callback: string;
		oauth2Callback: string;
	};

	// TODO: do this and webhookBaseUrl need to be separate
	get baseUrl() {
		return this.urls.base;
	}

	/** This is the base url for REST Api calls */
	get restBaseUrl() {
		return this.urls.rest;
	}

	/** This is the base url of the UI */
	get editorBaseUrl() {
		return this.urls.editor;
	}

	/** This is the base url for webhooks */
	get webhookBaseUrl() {
		return this.urls.webhook;
	}

	get oauth1CallbackUrl() {
		return this.urls.oauth1Callback;
	}

	get oauth2CallbackUrl() {
		return this.urls.oauth2Callback;
	}

	constructor() {
		this.generateUrls();
	}

	updateBaseUrl(webhookUrl: string) {
		config.set('baseUrl', webhookUrl);
		this.generateUrls();
	}

	generateUserInviteUrl(inviterId: string, inviteeId: string): string {
		return `${this.urls.editor}/signup?inviterId=${inviterId}&inviteeId=${inviteeId}`;
	}

	private generateUrls() {
		const baseUrl = this.endsInSlash(config.getEnv('baseUrl') || this.generateBaseUrl());
		const webhookBaseUrl = this.endsInSlash(config.getEnv('webhookBaseUrl') || baseUrl);
		const editorBaseUrl = this.stripSlash(config.getEnv('editorBaseUrl') || baseUrl);
		// TODO: should this use `webhookBaseUrl` ?
		const restBaseUrl = this.stripSlash(`${baseUrl}${config.getEnv('endpoints.rest')}`);

		this.urls = {
			base: baseUrl,
			rest: restBaseUrl,
			editor: editorBaseUrl,
			webhook: webhookBaseUrl,
			oauth1Callback: `${restBaseUrl}/oauth1-credential/callback`,
			oauth2Callback: `${restBaseUrl}/oauth2-credential/callback`,
		};
	}

	private endsInSlash(url: string) {
		return url.endsWith('/') ? url : `${url}/`;
	}

	private stripSlash(url: string) {
		return url.endsWith('/') ? url.slice(0, url.length - 1) : url;
	}

	private generateBaseUrl(): string {
		const protocol = config.getEnv('protocol');
		const host = config.getEnv('host');
		const port = config.getEnv('port');
		const path = config.getEnv('path');

		if ((protocol === 'http' && port === 80) || (protocol === 'https' && port === 443)) {
			return `${protocol}://${host}${path}`;
		}
		return `${protocol}://${host}:${port}${path}`;
	}
}
