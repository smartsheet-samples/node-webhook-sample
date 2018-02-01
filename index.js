let ssClient;           // Smartsheet JS client object

// Dependent libraries
const express = require("express");
const app = express();

const bodyParser = require("body-parser");
app.use(bodyParser.json());

const ssSdk = require("smartsheet");

// Initialize client SDK
function initializeSmartsheetClient(token, logLevel) {
    ssClient = ssSdk.createClient({
        // If token is falsy, value will be read from SMARTSHEET_ACCESS_TOKEN environment variable
        accessToken: token,
        logLevel: logLevel
    });
}

// Check that we can access the sheet
async function probeSheet(targetSheetId) {
    console.log(`Checking for sheet id: ${targetSheetId}`);
    const getSheetOptions = {
        id: targetSheetId,
        queryParameters: { pageSize: 1 } // Only return first row to reduce payload
    };
    const sheetResponse = await ssClient.sheets.getSheet(getSheetOptions);
    console.log(`Found sheet: "${sheetResponse.name}" at ${sheetResponse.permalink}`);
}

/*
* A webhook only needs to be created once.
* But hooks will be disabled if validation or callbacks fail.
* This method looks for an existing matching hook to reuse, else creates a new one.
*/
async function initializeHook(targetSheetId, hookName, callbackUrl) {
    try {
        let webhook = null;

        // Get *all* my hooks
        const listHooksResponse = await ssClient.webhooks.listWebhooks({
            includeAll: true
        });
        console.log(`Found ${listHooksResponse.totalCount} hooks owned by user`);

        // Check for hooks on this sheet, for this app, and url
        for (const hook of listHooksResponse.data) {
            if (hook.scopeObjectId === targetSheetId &&
                hook.name === hookName &&
                hook.callbackUrl === callbackUrl
            ) {
                webhook = hook;
                console.log(`Found matching hook with id: ${webhook.id}`);
                break;
            }
        }

        if (!webhook) {
            // Can't use any existing hook - create a new one
            const options = {
                body: {
                    name: hookName,
                    callbackUrl,
                    scope: "sheet",
                    scopeObjectId: targetSheetId,
                    events: ["*.*"],
                    version: 1
                }
            };

            const createResponse = await ssClient.webhooks.createWebhook(options);
            webhook = createResponse.result;

            console.log(`Created new hook: ${webhook.id}`);
        }

        // Make sure webhook is enabled and pointing to our current url
        const options = {
            webhookId: webhook.id,
            callbackUrl: callbackUrl,
            body: { enabled: true }
        };

        const updateResponse = await ssClient.webhooks.updateWebhook(options);
        const updatedWebhook = updateResponse.result;
        console.log(`Hook enabled: ${updatedWebhook.enabled}, status: ${updatedWebhook.status}`);
    } catch (err) {
        console.error(err);
    }
}


// This method receives the webhook callbacks from Smartsheet
app.post("/", async (req, res) => {
    try {
        const body = req.body;

        // Callback could be due to validation, status change, or actual sheet change events
        if (body.challenge) {
            console.log("Received verification callback");
            // Verify we are listening by echoing challenge value
            res.status(200)
                .json({ smartsheetHookResponse: body.challenge });
        } else if (body.events) {
            console.log(`Received event callback with ${body.events.length} events`);
            res.status(200);

            // Note that the callback response must be received within a few seconds.
            // If you are doing complex processing, you may need to queue up pending work.
            await processEvents(body);
        } else if (body.newWebHookStatus) {
            console.log(`Received status callback, new status: ${body.newWebHookStatus}`);
            res.status(200);
        } else {
            console.log(`Received unknown callback: ${body}`);
            res.status(200);
        }
    } catch (error) {
        console.log(error);
        res.status(500);
    }
});

/*
* Process callback events
* This sample implementation only logs to the console.
* Your implementation might make updates or send data to another system.
* Beware of infinite loops if you make modifications to the same sheet
*/
async function processEvents(callbackData) {
    if (callbackData.scope !== "sheet") {
        return;
    }

    // This sample handles each event individually.
    // Some changes (e.g. column rename) could impact a large number of cells.
    // A complete implementation should consolidate related events and/or cache intermediate data
    for (const event of callbackData.events) {
        // This sample only considers cell changes
        if (event.objectType === "cell") {
            console.log(`Cell changed, row id: ${event.rowId}, column id ${event.columnId}`);

            // Since event data is "thin", we need to read from the sheet to get updated values.
            const options = {
                id: callbackData.scopeObjectId,             // Get sheet id from callback
                queryParameters: {
                    rowIds: event.rowId.toString(),         // Just read one row
                    columnIds: event.columnId.toString()    // Just read one column
                }
            };
            const response = await ssClient.sheets.getSheet(options);
            const row = response.rows[0];
            const cell = row.cells[0];
            const column = response.columns.find(c => c.id === cell.columnId);
            console.log(`**** New cell value "${cell.displayValue}" in column "${column.title}", row number ${row.rowNumber}`);
        }
    }
}

// main
(async () => {
    try {
        // TODO: Edit config.json to set desired sheet id and API token
        const config = require("./config.json");

        initializeSmartsheetClient(config.accessToken, config.logLevel);

        // Sanity check: make sure we can access the sheet
        await probeSheet(config.sheetId);

        app.listen(3000, () =>
            console.log("Node-webhook-sample app listening on port 3000"));

        await initializeHook(config.sheetId, config.webhookName, config.callbackUrl);
    } catch (err) {
        console.error(err);
    }
})();
