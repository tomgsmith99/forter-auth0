const axios = require('axios')
// Later-on we can move those to npm,
const ENUMS = {
    FORTER_DECISION: {
        DECLINE: 'DECLINE',
        APPROVE: 'APPROVE',
        VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
    },
    HEADERS_NAMES: {
        CONTENT_TYPE: 'Content-Type',
        AUTHORIZATION: 'Authorization'
    },
    HEADERS_VALUES: {
        APP_JSON: 'application/json',
        FORTER_API_VERSION: 'api-version'
    },
    HTTP_METHODS: {
        POST: 'post',
        PATCH: 'patch'
    },
    MESSAGES: {
        ACCESS_DENY: 'sorry, something went wrong.' // do we want to configure it?
    },
    GRANT_TYPES: {
        CLIENT_CREDENTIALS: 'client_credentials'
    },
    MOCK_IPS: {
        APPROVED: '0.0.0.1',
        DECLINE: '0.0.0.2',
        MFA: '0.0.0.4'
    },
    EVENT_TYPES: {
        SIGN_IN: 'login',
        SIGN_UP: 'signup'
    }
}

/**
 * Auth0 API Client
 */
class Auth0Client {
    constructor({AUTH0_TENANT, AUTH0_CLIENT_SECRET, AUTH0_CLIENT_ID}) {
        this.AUTH0_TENANT = AUTH0_TENANT;
        this.AUTH0_CLIENT_SECRET = AUTH0_CLIENT_SECRET;
        this.AUTH0_CLIENT_ID = AUTH0_CLIENT_ID;
    }

    /**
     * Get the access token from auth0
     * @returns {Promise<*>}
     */
    async getAccessToken() {
        const data = JSON.stringify({
            client_id: this.AUTH0_CLIENT_ID,
            client_secret: this.AUTH0_CLIENT_ID,
            audience: `${this.AUTH0_TENANT}/api/v2/`,
            grant_type: ENUMS.GRANT_TYPES.CLIENT_CREDENTIALS
        });
        return await axios.request({
            method: ENUMS.HTTP_METHODS.POST,
            url: `${this.AUTH0_TENANT}/oauth/token`,
            headers: {
                [ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON
            },
            data
        });
    }

    /**
     * Block user access given an accessToken and the accountId
     * @param encodedAccountId
     * @param accessToken
     * @returns {Promise<*>}
     */
    async blockedAccess({encodedAccountId, accessToken}) {
        const data = JSON.stringify({
            blocked: true
        });
        return await axios.request({
            method: ENUMS.HTTP_METHODS.PATCH,
            url: `${this.AUTH0_TENANT}/api/v2/users/${encodedAccountId}`,
            headers: {
                [ENUMS.HEADERS_NAMES.AUTHORIZATION]: `Bearer  ${accessToken}`,
                [ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON
            },
            data
        });
    }

    /**
     * Mock Forter Response Based on email in test mode
     * @param realIp
     * @param email
     * @returns {string|*}
     */
    static getTestIpByEmail(realIp, email) {
        if (email.includes('approve')) {
            return ENUMS.MOCK_IPS.APPROVED;
        }
        if (email.includes('decline')) {
            return ENUMS.MOCK_IPS.DECLINE;
        }
        if (email.includes('verify')) {
            return ENUMS.MOCK_IPS.MFA;
        }
        return realIp;
    }
}

/**
 * Forter API Client
 */
class ForterClient {
    constructor({FORTER_API_VERSION, FORTER_SITE_ID, FORTER_KEY}) {
        this.FORTER_API_VERSION = FORTER_API_VERSION
        this.forterBaseUrl = `https://${FORTER_SITE_ID}.api.forter-secure.com/v2/accounts`;
        this.auth = {
            username: FORTER_KEY
        };
    }
    // Core API
    /**
     * Get Forter Decision for Sign In
     * @param accountId
     * @param userAgent
     * @param forterTokenCookie
     * @param customerIP
     * @param eventType
     * @returns {Promise<*>}
     */
    async getDecisionForEvent({accountId, userAgent, forterTokenCookie, customerIP, eventType}) {
        const eventTime = Date.now();
        const data = JSON.stringify({
            accountId,
            connectionInformation: {
                customerIP,
                userAgent,
                forterTokenCookie
            },
            eventTime
        });
        return await axios.request({
            url: `${this.forterBaseUrl}/${eventType}/${accountId}`,
            method: ENUMS.HTTP_METHODS.POST,
            auth: this.auth,
            headers: {
                [ENUMS.HEADERS_NAMES.FORTER_API_VERSION]: this.FORTER_API_VERSION,
                [ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON
            },
            data
        });
    }

    // Helpers
    /**
     * Return true if this is the first time we see this user
     * @param event
     * @returns {boolean}
     */
    static isFirstEvent(event) {
        return event.stats.logins_count === 1;
    }
}

/**
 * Handler that will be called during the execution of a PostLogin flow.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 *
 * Requires Secrets:
 * ---- Auth0 ----
 * AUTH0_TENANT: TBD
 * AUTH0_CLIENT_SECRET: TBD
 * AUTH0_CLIENT_ID: TBD
 * ---- Forter ----
 * FORTER_API_VERSION: Forter API Version
 * FORTER_SITE_ID: Forter Site ID
 * FORTER_KEY: Forter Key
 * ---- General Variables ----
 * IS_TEST_MODE: TRUE ONLY if on testing mode
 *
 */
exports.onExecutePostLogin = async (event, api) => {
    // Extract general variables
    const {IS_TEST_MODE} = event.secrets;
    // Extract data from user & request
    const {accountId = user_id, email} = event.user;
    const {customerIP: ip, user_agent: userAgent, query: {forterToken: forterTokenCookie}} = event.request;
    // Format accountId and customerIp
    const encodedAccountId = encodeURI(accountId);
    const customerIP = IS_TEST_MODE ? Auth0Client.getTestIpByEmail(ip, email) : ip;
    // New API instances
    const forterClient = new ForterClient(event.secrets);
    const auth0Client = new Auth0Client(event.secrets);

    if (ForterClient.isFirstEvent(event)) {
        // Get sign-up decision from Forter
        const forterDecision = await forterClient.getDecisionForEvent({accountId, userAgent, forterTokenCookie, customerIP, eventType: ENUMS.EVENT_TYPES.SIGN_UP});
        if (forterDecision === ENUMS.FORTER_DECISION.DECLINE) {
            // 1. get an Auth0 access token
            const {data: {access_token: accessToken}} = await auth0Client.getAccessToken();
            // 2. Block user
            await auth0Client.blockedAccess({encodedAccountId, accessToken});
            // 3. Bounce the user's login attempt
            api.access.deny(ENUMS.MESSAGES.ACCESS_DENY);
        }
        // Otherwise?
        // MFA On signup ?
    } else {
        // Sing In
        const forterDecision = forterClient.getDecisionForEvent({accountId, userAgent, forterTokenCookie, customerIP, eventType: ENUMS.EVENT_TYPES.SIGN_IN});
        // Decline
        if (forterDecision === ENUMS.FORTER_DECISION.DECLINE) {
            api.access.deny(ENUMS.MESSAGES.ACCESS_DENY);
        }
        // MFA
        if (forterDecision === ENUMS.FORTER_DECISION.VERIFICATION_REQUIRED) {
            api.multifactor.enable("any");
        }
        // Otherwise -> Approve, continue as usual
    }
    // TODO: Handle error: send MFA?
    // TODO: Social?
    // TODO: Tests?
    // TODO: Fetch instead of axios?
}
