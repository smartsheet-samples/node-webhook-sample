# node-webhook-sample
This sample node application demonstrates how to create a Shartsheet webhook and handle callback events.

Smartsheet webhook documentation is here [http://smartsheet-platform.github.io/api-docs/#webhooks](http://smartsheet-platform.github.io/api-docs/#webhooks)

## Installation
Make sure you have [Node.js](http://nodejs.org/) installed.

For code clarity, this sample uses _async_ and _await_ so requires node.js version 7.6 or later.

```sh
git clone git@github.com:smartsheet-samples/node-webhook-sample.git # or clone your own fork
cd node-webhook
npm install
```

## Determining the callback url
Webhooks are HTTP callbacks from Smartsheet servers to your code. So your web application must be accesible from the
public internet. An easy way to achieve this in a development environment is with the tool [ngrok](https://ngrok.com/).

After installing, start ngrok with the command `ngrok http 3000`. In the resulting screen, note the https forwarding url
which will look something like `https://fbc72a6b.ngrok.io`.
Update the `config.json` file with this value.

Leave ngrok running. If you restart ngrok, you will get a different callback url and will need to update config.json and
restart this applicaion.

## Configuration
Create a test sheet to monitor. Every change to that sheet will result in a webhook callback. Determine the sheet id, 
visible in the sheet properties dialog.

Update the `config.json` file with:
* Your Smartsheet [access token](http://smartsheet-platform.github.io/api-docs/#authentication-and-access-tokens)
* The id of the sheet you wish to monitor

## Running
```sh 
node index.js
```
