import config from '@/config';
import { URLService } from '@/services/url.service';

describe('URLService', () => {
	const defaultConfig = config.get();

	beforeEach(() => {
		config.load(defaultConfig);
	});

	test('default urls', () => {
		assertURLs();
	});

	test('when host, port, and protocol are set', () => {
		config.set('host', 'example.com');
		config.set('protocol', 'https');
		config.set('port', 1234);

		assertURLs({
			baseUrl: 'https://example.com:1234/',
			editorBaseUrl: 'https://example.com:1234',
			restBaseUrl: 'https://example.com:1234/rest',
			webhookBaseUrl: 'https://example.com:1234/',
			oauth1CallbackUrl: 'https://example.com:1234/rest/oauth1-credential/callback',
			oauth2CallbackUrl: 'https://example.com:1234/rest/oauth2-credential/callback',
		});
	});

	test('when N8N_BASE_URL is set', () => {
		config.set('baseUrl', 'https://custom.n8n/');

		assertURLs({
			baseUrl: 'https://custom.n8n/',
			editorBaseUrl: 'https://custom.n8n',
			restBaseUrl: 'https://custom.n8n/rest',
			webhookBaseUrl: 'https://custom.n8n/',
			oauth1CallbackUrl: 'https://custom.n8n/rest/oauth1-credential/callback',
			oauth2CallbackUrl: 'https://custom.n8n/rest/oauth2-credential/callback',
		});
	});

	test('when N8N_EDITOR_BASE_URL is set', () => {
		config.set('editorBaseUrl', 'https://ui.example');

		assertURLs({
			editorBaseUrl: 'https://ui.example',
		});
	});

	test('when WEBHOOK_URL is set', () => {
		config.set('webhookBaseUrl', 'https://webhooks.example');

		assertURLs({
			webhookBaseUrl: 'https://webhooks.example/',
		});
	});

	test('when N8N_ENDPOINT_REST is set', () => {
		config.set('endpoints.rest', 'api');

		assertURLs({
			restBaseUrl: 'http://localhost:5678/api',
			oauth1CallbackUrl: 'http://localhost:5678/api/oauth1-credential/callback',
			oauth2CallbackUrl: 'http://localhost:5678/api/oauth2-credential/callback',
		});
	});

	interface AssertionData {
		baseUrl: string;
		editorBaseUrl: string;
		restBaseUrl: string;
		webhookBaseUrl: string;
		oauth1CallbackUrl: string;
		oauth2CallbackUrl: string;
	}

	const defaults: AssertionData = {
		baseUrl: 'http://localhost:5678/',
		editorBaseUrl: 'http://localhost:5678',
		restBaseUrl: 'http://localhost:5678/rest',
		webhookBaseUrl: 'http://localhost:5678/',
		oauth1CallbackUrl: 'http://localhost:5678/rest/oauth1-credential/callback',
		oauth2CallbackUrl: 'http://localhost:5678/rest/oauth2-credential/callback',
	};

	const assertURLs = (data: Partial<AssertionData> = {}) => {
		const service = new URLService();
		expect({
			baseUrl: service.baseUrl,
			editorBaseUrl: service.editorBaseUrl,
			restBaseUrl: service.restBaseUrl,
			webhookBaseUrl: service.webhookBaseUrl,
			oauth1CallbackUrl: service.oauth1CallbackUrl,
			oauth2CallbackUrl: service.oauth2CallbackUrl,
		}).toEqual({ ...defaults, ...data });
	};
});
