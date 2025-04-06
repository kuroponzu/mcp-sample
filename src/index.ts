import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod"

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

const server = new McpServer({
  name: "weather",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  }
});

async function makeNWSRequest<T>(url: string): Promise<T|null>{
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json"
  };

  try{
    const response = await fetch(url, { headers });
    if(!response.ok){
      throw new Error(`HTTP error! status ${response.status}`)
    }
    return(await response.json()) as T;
  } catch (error) {
    console.error("Error making NES request", error)
    return null
  }
}

interface AlertFeature{
  properties: {
    event?: string,
    areaDesc?: string,
    severity?: string,
    status?: string,
    headline?: string,
  };
}

function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "Unknown"}`,
    "---"
  ].join("\n")
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}


server.tool(
  "get-alerts",
  "Get weather alerts for a state",
  {
    state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
  },
  async({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

    if(!alertsData){
      return {
        content: [
          {
            type: "text",
            text: "Failed"
          }
        ]
      }
    };

    const features = alertsData.features || [];
    if (features.length === 0){
      return{
        content: [
          {
            type: "text",
            text: "No active alerts"
          }
        ]
      }
    }
    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;

    return {
      content:[
        {
          type: "text",
          text: alertsText
        }
      ]
    }
  }
)

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
