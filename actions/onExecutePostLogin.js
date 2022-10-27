const axios = require('axios')
// Later-on we can move those to np,
const ENUMS = {
    LOGIN_STATUS: {
        SUCCESS: 'SUCCESS'
    },
    FORTER_DECISION: {
        DECLINE: 'DECLINE',
        APPROVE: 'APPROVE',
        VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
    },
    HEADERS_NAMES: {
        CONTENT_TYPE: 'Content-Type',
        AUTHORIZATION: 'Authorization',
        FORTER_API_VERSION: 'api-version',
        FORTER_CLIENT: 'x-forter-client'
    },
    HEADERS_VALUES: {
        APP_JSON: 'application/json',
        AUTH0: 'auth0',
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
    },
    LOGIN_TYPES: {
        SOCIAL: 'SOCIAL',
        PASSWORD: 'PASSWORD',
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
        const {data: {access_token: accessToken}} = await axios.request({
            method: ENUMS.HTTP_METHODS.POST,
            url: `${this.AUTH0_TENANT}/oauth/token`,
            headers: {
                [ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON
            },
            data
        });
        return accessToken;
    }

    /**
     * Block user access given an accessToken and the accountId
     * @param accountId
     * @param accessToken
     * @returns {Promise<*>}
     */
    async blockedAccess({accountId, accessToken}) {
        const data = JSON.stringify({
            blocked: true
        });
        return await axios.request({
            method: ENUMS.HTTP_METHODS.PATCH,
            url: `${this.AUTH0_TENANT}/api/v2/users/${accountId}`,
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
     * Get Forter Decision for Sing Up event
     * @param accountId
     * @param userAgent
     * @param forterTokenCookie
     * @param customerIP
     * @param email
     * @returns forterDecision
     */
    async getSignUpDecision({accountId, userAgent, forterTokenCookie, customerIP, email}) {
        const eventTime = Date.now();
        const data = JSON.stringify({
            accountId,
            connectionInformation: {
                customerIP,
                userAgent,
                forterTokenCookie
            },
            eventTime,
        });

        const { data: { forterDecision } } = await axios.request({
            url: `${this.forterBaseUrl}/${ENUMS.EVENT_TYPES.SIGN_UP}/${accountId}`,
            method: ENUMS.HTTP_METHODS.POST,
            auth: this.auth,
            headers: {
                [ENUMS.HEADERS_NAMES.FORTER_API_VERSION]: `${this.FORTER_API_VERSION}`,
                [ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON,
                [ENUMS.HEADERS_NAMES.FORTER_CLIENT]: ENUMS.HEADERS_VALUES.AUTH0
            },
            data
        });
        return forterDecision;
    }

    /**
     * Get Forter Decision for Sing In event
     * @param accountId
     * @param userAgent
     * @param forterTokenCookie
     * @param customerIP
     * @param email
     * @param loginMethodType
     * @returns forterDecision
     */
    async getSignInDecision({accountId, userAgent, forterTokenCookie, customerIP, email, loginMethodType}) {
        const eventTime = Date.now();
        const data = JSON.stringify({
            accountId,
            loginStatus: ENUMS.LOGIN_STATUS.SUCCESS,
            loginMethodType,
            connectionInformation: {
                customerIP,
                userAgent,
                forterTokenCookie
            },
            eventTime,
        });

        const { data: { forterDecision } } = await axios.request({
            url: `${this.forterBaseUrl}/${ENUMS.EVENT_TYPES.SIGN_IN}/${accountId}`,
            method: ENUMS.HTTP_METHODS.POST,
            auth: this.auth,
            headers: {
                [ENUMS.HEADERS_NAMES.FORTER_API_VERSION]: `${this.FORTER_API_VERSION}`,
                [ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON,
                [ENUMS.HEADERS_NAMES.FORTER_CLIENT]: ENUMS.HEADERS_VALUES.AUTH0
            },
            data
        });
        return forterDecision;
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

    static getLoginMethodTypeFromEvent(event) {
        return event.authentication.methods[0].name === "federated" ? ENUMS.LOGIN_TYPES.SOCIAL : ENUMS.LOGIN_TYPES.PASSWORD;
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
 *
 */
exports.onExecutePostLogin = async (event, api) => {
    const {user_id, email} = event.user;
    const {customerIP: ip, user_agent: userAgent, query: {forterToken: forterTokenCookie}} = event.request;
    const forterClient = new ForterClient(event.secrets);
    const auth0Client = new Auth0Client(event.secrets);
    const accountId = encodeURI(user_id);
    const customerIP = Auth0Client.getTestIpByEmail(ip, email);

    if (ForterClient.isFirstEvent(event)) {
        // Sign up
        const forterDecision = await forterClient.getSignUpDecision({
            accountId,
            userAgent,
            forterTokenCookie,
            customerIP,
            email,
        });
        if (forterDecision === ENUMS.FORTER_DECISION.DECLINE) {
            const accessToken = await auth0Client.getAccessToken();
            await auth0Client.blockedAccess({accountId, accessToken});
            api.access.deny(ENUMS.MESSAGES.ACCESS_DENY);
        }
        // Otherwise -> continue
    } else {
        const loginMethodType = ForterClient.getLoginMethodTypeFromEvent(event);
        // Sing In
        const forterDecision = await forterClient.getSignInDecision({
            accountId,
            userAgent,
            forterTokenCookie,
            loginMethodType,
            customerIP,
            email
        });
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
}


// TODO: Error handling -> single rety with a short sleep, otherwise -> fallback based on merchant config - MFA DEFAULT
// TODO: ADD email VALUE !
// TODO: ADD in login Created date/Other analytical fields of the account
// TODO: Create a private Forter repo
// TODO: rename forterToken

// TODO: Switch to email instead of IP - DOR team
// TODO: Link to 'https://portal.forter.com/app/developer/settings/auth0' from the docs + change the fields to the auth0 + have screenshots/gif of how to do it
// TODO: HTML refactor
// TODO: ADD Forter JAVASCRIPT --> link to the portal - diff keys from sandbox and production need to explain

// TODO: ADD verifed email event
// TODO: Handle error: send MFA?
// TODO: adding Tests ?
