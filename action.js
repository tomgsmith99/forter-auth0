const axios = require('axios')

/**
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/

/********************************************/

const FORTER_TENANT_ID = "{{FORTER_TENANT_ID}}"

// TEST USERS
const user_ids = {
  "{{user_id}}": { // approve
    "ip": "0.0.0.1"
  },
  "{{user_id}}": { // verify
    "ip": "0.0.0.4"
  },
  "{{user_id}}": { // decline
    "ip": "0.0.0.2"
  }
}

/********************************************/

exports.onExecutePostLogin = async (event, api) => {

  const accountId = event.user.identities[0].user_id

  const forter_url = `https://${FORTER_TENANT_ID}.api.forter-secure.com/v2/accounts/login/${accountId}` 

  let ip = event.request.ip

  console.log("the user's real ip address is: " + ip)

  // uncomment this line to test with the test users
  // ip = user_ids[accountId]["ip"]

  const data = JSON.stringify({
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

  const config = {
    auth: {
      username: event.secrets.FORTER_KEY // make sure you store your Forter key in a safe place.
    },
    method: 'post',
    url: forter_url,
    headers: { 
      'api-version': '2.36', 
      'Content-Type': 'application/json'
    },
    data: data
  }

  const res = await axios.request(config)

  console.dir(res)

  /********************************************/

  if (res.data.forterDecision == "APPROVE") {} // just for clarity
  else if (res.data.forterDecision == "DECLINE") {

    const reason = "something went wrong."

    api.access.deny(reason)
  }
  else if (res.data.forterDecision == "VERIFICATION_REQUIRED") {

    api.multifactor.enable("any")
  }
};
