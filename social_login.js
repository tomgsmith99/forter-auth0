const axios = require('axios')

/**
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {

  console.dir(event)

  const data = JSON.stringify(event)

  const config = {
    method: 'post',
    url: "https://webhook.site/a45e333d-f7f5-4029-85a4-8370691677f2",
    headers: { 
      'Content-Type': 'application/json'
    },
    data: data
  }

  const res = await axios.request(config)

  console.dir(res)

  api.multifactor.enable("any")

};



/**
* Handler that will be invoked when this action is resuming after an external redirect. If your
* onExecutePostLogin function does not perform a redirect, this function can be safely ignored.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
// exports.onContinuePostLogin = async (event, api) => {
// };
