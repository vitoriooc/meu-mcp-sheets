const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { google } = require("googleapis");
const express = require("express");

const app = express();
let transport;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

const server = new Server({
  name: "google-sheets-server",
  version: "1.0.0",
}, {
  capabilities: { tools: {} },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "read_sheet",
    description: "Lê dados de uma planilha do Google Sheets",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string" },
        range: { type: "string", description: "Ex: Folha1!A1:Z100" },
      },
      required: ["spreadsheetId", "range"],
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "read_sheet") {
    const { spreadsheetId, range } = request.params.arguments;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return { content: [{ type: "text", text: JSON.stringify(response.data.values) }] };
  }
});

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
