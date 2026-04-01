const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { google } = require("googleapis");
const express = require("express");

const app = express();
app.use(express.json()); // Necessário para ler o corpo das mensagens
let transport;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
});

const sheets = google.sheets({ version: "v4", auth });

const server = new Server({
  name: "google-sheets-server",
  version: "1.1.0",
}, {
  capabilities: { tools: {} },
});

// LISTA DE FERRAMENTAS (Agora com Escrita!)
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_sheet",
      description: "Lê dados de uma planilha",
      inputSchema: {
        type: "object",
        properties: {
          spreadsheetId: { type: "string" },
          range: { type: "string", description: "Ex: Aba1!A1:Z100" },
        },
        required: ["spreadsheetId", "range"],
      },
    },
    {
      name: "append_row",
      description: "Adiciona uma nova linha de dados ao final da planilha",
      inputSchema: {
        type: "object",
        properties: {
          spreadsheetId: { type: "string" },
          range: { type: "string", description: "Nome da aba. Ex: 'Leads'" },
          values: { 
            type: "array", 
            items: { type: "string" },
            description: "Lista de valores para as colunas. Ex: ['Nome', 'Email', 'Telefone']"
          },
        },
        required: ["spreadsheetId", "range", "values"],
      },
    }
  ],
}));

// EXECUÇÃO DAS FERRAMENTAS
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "read_sheet") {
      const response = await sheets.spreadsheets.values.get({ 
        spreadsheetId: args.spreadsheetId, 
        range: args.range 
      });
      return { content: [{ type: "text", text: JSON.stringify(response.data.values || []) }] };
    }

    if (name === "append_row") {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [args.values] },
      });
      return { content: [{ type: "text", text: `Linha adicionada com sucesso!` }] };
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
  }
});

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (transport) await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor MCP v1.1 rodando na porta ${PORT}`));
