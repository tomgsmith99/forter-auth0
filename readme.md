# Forter + Auth0 Integration #

## Overview ##
This project enables you to easily include the power of Forter's [Trusted Identities]( https://www.forter.com/trusted-identities) in your Auth0 authentication flow.

Forter's Trusted Identities is the most effective way to prevent ATO attempts against your end-users.

Using an Auth0 Action, you can pause the authentication flow and ask Forter to evaluate the user context.

Based on its evaluation of the user context, Forter will recommend one of three actions:

* Approve (allow the user to continue authenticating without further action)
* Decline (do not allow the user to authenticate)
* Verify (challenge the user with a 2nd factor)

With the accuracy of Forter's AI-based decisions, you can greatly reduce the frequency of your MFA challenges, which of course reduces friction for your end-users.

You can thus reduce friction for your end-users while at the same time increase the confidence that successful authentications are not bad actors.

### Key Elements ###

There are several technical elements that make this combination of Auth0 and Forter especially powerful:

* The Auth0 `lock.js` library allows you to include Forter's js snippet on the front end to collect user context.
* Auth0 can host the login page, offloading that responsibility from your application.
* Auth0 Actions allows you to host the Forter + MFA logic in Auth0, again, offloading that responsibility from your application, but also giving you simple, direct access to the front-end user context and the Auth0 MFA engine.

## Prerequisites ##

* An Auth0 tenant, with MFA enabled if you want to use MFA.

* A Forter tenant with the /login API enabled

## Setup ##

### Front End ###

The front end of this solution uses the Auth0 hosted login page.

In your Auth0 tenant, go to Branding->Universal Login->Login.

Enable "customize login page" and select "lock" as the default template.

*Note: The Auth0 "New Universal Login" does not support this approach.*

In the `login.html` page included in this repo, replace the string `<!--FORTER JS SNIPPET HERE-->` with the js snippet from your Forter tenant.

Copy and paste the contents of login.html into the HTML window of your Auth0 Customize Login Page screen.

### Back End ###

In the `action.js` file included in this repo, add your `FORTER_TENANT_ID`.

Create a new action in your Auth0 tenant:

Actions->Library->Build Custom

Copy and paste the contents of `action.js` into the action screen.

In the Action, add a new secret:

`FORTER_KEY`

with the value of your Forter key.

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0_action_secrets.png)

And, add two NPM modules:

* axios
* qs

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0_action_modules.png)

Add the action to your login flow:

Flows->Login

## Testing - basic ##

To see if your flow works end-to-end, copy the "try" URL from you Auth0 tenant:

Authentication->Database

Left-click on the three-dot icon that corresponds to your user directory

Right-click on "Try"->Copy link address

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0_test_url.png)

Paste the address into a text editor. It should look something like this:

https://dev-g24c4sqy.us.auth0.com/authorize?client_id=Y6XeAuWM009riGuSmBAjQiKpJ6lovcQ6&response_type=code&connection=Username-Password-Authentication&prompt=login&scope=openid%20profile&redirect_uri=https://manage.auth0.com/tester/callback?connection=Username-Password-Authentication

You can use this URL as-is in an incognito window to test.

A successful authentication will result in a redirection to the Auth0 test site with an authorization code in the URL. (But you will see a "forbidden" on the page.)

If you want to use a different client_id and/or redirect_uri, you can update the values in the URL (assuming that you have set up the client_id and redirect_uri in the client.)

## Testing - basic ##

To test all of the possible outcomes from Forter, you can create three test users in Auth0 to correspond with the three possible outcomes:

APPROVE
VERIFICATION_REQUIRED
DECLINE

After you have created these users, add their alphanumeric user_ids to the Action, and uncomment the line that switches the value of the ip address from the real ip address to the test ip address:

`ip = user_ids[accountId]["ip"]`
