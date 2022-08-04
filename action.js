const axios = require('axios')

/**
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/

/********************************************/

exports.onExecutePostLogin = async (event, api) => {

  const FORTER_TENANT_ID = event.secrets.FORTER_TENANT_ID

  const forter_url_base = `https://${FORTER_TENANT_ID}.api.forter-secure.com/v2/accounts` 

  const accountId = event.user.user_id

  // accountId example = auth0|62eb11d417a992ea40acec3e
  // encode the accountId to use in URLs for API calls
  const encoded_account_id = encodeURI(accountId)

  const email = event.user.email

  // get either a fake ip address (for testing/debugging)
  // or use the user's real ip address
  const ip = get_ip(email, event.request.ip)

  let config, data, res

  /*****************************************/
  // is this the user's first login?
  // if yes, we know it's happened immediately after registration
  // so this is a registration flow

  if (event.stats.logins_count == 1) {
    // check with Forter to see if we need to mark the user record as "blocked"
    // and bounce the authn attempt

    data = JSON.stringify({
      "accountId": accountId,
      "connectionInformation": {
        "customerIP": ip,
        "userAgent": event.request.user_agent,
        "forterTokenCookie": event.request.query.forterToken
      },
      "eventTime": Date.now()
    })

    config = {
      auth: {
        username: event.secrets.FORTER_KEY
      },
      method: 'post',
      url: `${forter_url_base}/signup/${accountId}`,
      headers: { 
        'api-version': '2.36', 
        'Content-Type': 'application/json'
      },
      data: data
    }

    res = await axios.request(config)

    if (res.data.forterDecision == "DECLINE") {
      // we need to mark the user record as "block"
      // first, get an Auth0 access token

      data = JSON.stringify({
        "client_id": event.secrets.AUTH0_CLIENT_ID,
        "client_secret": event.secrets.AUTH0_CLIENT_SECRET,
        "audience": event.secrets.AUTH0_TENANT + '/api/v2/',
        "grant_type": "client_credentials"
      })

      config = {
        method: 'post',
        url: event.secrets.AUTH0_TENANT + '/oauth/token',
        headers: { 
          'Content-Type': 'application/json', 
        },
        data : data
      }

      res = await axios.request(config)

      const access_token = res.data.access_token

      /*****************************************/
      // call the Auth0 management API to block this user

      data = JSON.stringify({
        "blocked": true
      })

      config = {
        method: 'patch',
        url: event.secrets.AUTH0_TENANT + '/api/v2/users/' + encoded_account_id,
        headers: { 
          'Authorization': 'Bearer ' + access_token,
          'Content-Type': 'application/json'
        },
        data: data
      }

      res = await axios.request(config)

      /*****************************************/
      // bounce the user's login attempt

      api.access.deny("sorry, something went wrong.")

    }
  }
  else {
    // this is a regular login attempt
    // check with Forter to get a decision on the login attempt:
    // approve, decline, verify (MFA)

    data = JSON.stringify({
      "accountId": accountId,
      "connectionInformation": {
        "customerIP": ip,
        "userAgent": event.request.user_agent,
        "forterTokenCookie": event.request.query.forterToken
      },
      "loginMethodType": "PASSWORD",
      "loginStatus": "SUCCESS",
      "eventTime": Date.now()
    })

    config = {
      auth: {
        username: event.secrets.FORTER_KEY
      },
      method: 'post',
      url: `${forter_url_base}/login/${encoded_account_id}`,
      headers: { 
        'api-version': '2.36', 
        'Content-Type': 'application/json'
      },
      data: data
    }

    res = await axios.request(config)

    if (res.data.forterDecision == "APPROVE") {} // just for clarity

    else if (res.data.forterDecision == "DECLINE") {

      // you might want to block this user account at this point as well

      const reason = "something went wrong."

      api.access.deny(reason)
    }
    else if (res.data.forterDecision == "VERIFICATION_REQUIRED") {

      api.multifactor.enable("any")
    }
  }
}

function get_ip(email, real_ip) {

  if (email.includes('approve')) {
    return '0.0.0.1'
  }
  else if (email.includes('decline')) {
    return '0.0.0.2'
  }
  else if (email.includes('verify')) {
    return '0.0.0.4'
  }
  else {
    return real_ip
  }
}
