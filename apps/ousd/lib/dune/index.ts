import Redis from "ioredis";
import { DuneError } from "./error";
import { QueryParameter } from "./queryParameter";
import {
  ExecutionState,
  ExecutionResponse,
  GetStatusResponse,
  ResultsResponse,
} from "./types";
export { toChartData } from "./utils";

console.debug = function () {};

export const jobsLookup = {
  apy: {
    queryId: 2352075,
    expiresAfter: 86400,
  },
  totalSupplyOUSD: {
    queryId: 2352077,
    expiresAfter: 86400,
  },
  protocolRevenue: {
    queryId: 2352079,
    expiresAfter: 86400,
  },
  totalSupplyBreakdown: {
    queryId: 2352080,
    expiresAfter: 86400,
  },
  ousdSupplyRelativeEthereum: {
    queryId: 2352081,
    expiresAfter: 86400,
  },
  ousdTradingVolume: {
    queryId: 2352082,
    expiresAfter: 86400,
  },
};

const BASE_URL = "https://api.dune.com/api/v1";

const TERMINAL_STATES = [
  ExecutionState.CANCELLED,
  ExecutionState.COMPLETED,
  ExecutionState.FAILED,
];

const logPrefix = "dune-client:";

const sleep = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const CACHE_READY_STATE = "ready";

class DuneClient {
  apiKey: string;

  cacheClient;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    if (process.env.REDIS_URL) {
      this.cacheClient = new Redis(process.env.REDIS_URL, {
        tls: {
          rejectUnauthorized: false,
        },
        connectTimeout: 10000,
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 5) return null;
          return Math.min(times * 500, 2000);
        },
      });

      this.cacheClient.on("ready", function () {
        console.log("Cache connected for DUNE API");
      });
    }
  }

  private async _checkCache<T>(key) {
    try {
      return JSON.parse(await this.cacheClient.get(key));
    } catch (error) {
      console.error(
        logPrefix,
        `caught unhandled response error ${JSON.stringify(error)}`
      );
      return null;
    }
  }

  private async _handleResponse<T>(
    responsePromise: Promise<Response>
  ): Promise<T> {
    const apiResponse = await responsePromise
      .then((response) => {
        if (!response.ok) {
          console.error(
            logPrefix,
            `response error ${response.status} - ${response.statusText}`
          );
        }
        return response.json();
      })
      .catch((error) => {
        console.error(
          logPrefix,
          `caught unhandled response error ${JSON.stringify(error)}`
        );
        throw error;
      });

    if (apiResponse.error) {
      console.error(
        logPrefix,
        `error contained in response ${JSON.stringify(apiResponse)}`
      );
      if (apiResponse.error instanceof Object) {
        throw new DuneError(apiResponse.error.type);
      } else {
        throw new DuneError(apiResponse.error);
      }
    }

    return apiResponse;
  }

  private async _get<T>(url: string): Promise<T> {
    console.debug(logPrefix, `GET received input url=${url}`);
    const response = fetch(url, {
      method: "GET",
      headers: {
        "x-dune-api-key": this.apiKey,
      },
    });
    return this._handleResponse<T>(response);
  }

  private async _post<T>(url: string, params?: QueryParameter[]): Promise<T> {
    console.debug(
      logPrefix,
      `POST received input url=${url}, params=${JSON.stringify(params)}`
    );
    // Transform Query Parameter list into "dict"
    const reducedParams = params?.reduce<Record<string, string>>(
      (acc, { name, value }) => ({ ...acc, [name]: value }),
      {}
    );

    const response = fetch(url, {
      method: "POST",
      body: JSON.stringify({ query_parameters: reducedParams || {} }),
      headers: {
        "x-dune-api-key": this.apiKey,
      },
    });
    return this._handleResponse<T>(response);
  }

  async execute(
    queryID: number,
    parameters?: QueryParameter[]
  ): Promise<ExecutionResponse> {
    const response = await this._post<ExecutionResponse>(
      `${BASE_URL}/query/${queryID}/execute`,
      parameters
    );
    console.debug(logPrefix, `execute response ${JSON.stringify(response)}`);
    return response as ExecutionResponse;
  }

  async getStatus(jobID: string): Promise<GetStatusResponse> {
    const response: GetStatusResponse = await this._get(
      `${BASE_URL}/execution/${jobID}/status`
    );
    console.debug(logPrefix, `get_status response ${JSON.stringify(response)}`);
    return response as GetStatusResponse;
  }

  async getResult(jobID: string): Promise<ResultsResponse> {
    const key = `${BASE_URL}/execution/${jobID}/results`;
    const response: ResultsResponse = await this._get(key);
    console.debug(logPrefix, `get_result response ${JSON.stringify(response)}`);
    return response as ResultsResponse;
  }

  async cancelExecution(jobID: string): Promise<boolean> {
    const { success }: { success: boolean } = await this._post(
      `${BASE_URL}/execution/${jobID}/cancel`
    );
    return success;
  }

  async refresh(
    queryID: number,
    parameters?: QueryParameter[],
    pingFrequency: number = 5,
    cacheExpiration: number = 21600
  ): Promise<ResultsResponse> {
    console.info(
      logPrefix,
      `refreshing query https://dune.com/queries/${queryID} with parameters ${JSON.stringify(
        parameters
      )}`
    );
    const data = await this._checkCache(String(queryID));
    if (data) {
      return data as ResultsResponse;
    } else {
      const { execution_id: jobID } = await this.execute(queryID, parameters);
      let { state } = await this.getStatus(jobID);
      while (!TERMINAL_STATES.includes(state)) {
        console.info(
          logPrefix,
          `waiting for query execution ${jobID} to complete: current state ${state}`
        );
        await sleep(pingFrequency);
        state = (await this.getStatus(jobID)).state;
      }
      if (state === ExecutionState.COMPLETED) {
        const result = await this.getResult(jobID);
        // Store in cache by jobID and `cacheExpiration`
        if (this.cacheClient.status === CACHE_READY_STATE) {
          const cachedResultSet = JSON.stringify(result);
          await this.cacheClient.set(
            String(queryID),
            cachedResultSet,
            "EX",
            cacheExpiration
          );
          console.log(
            logPrefix,
            `get_result cached response for ${queryID}: ${cacheExpiration} seconds`
          );
        }
        return result;
      } else {
        const message = `refresh (execution ${jobID}) yields incomplete terminal state ${state}`;
        console.error(logPrefix, message);
        throw new DuneError(message);
      }
    }
  }
}

export default DuneClient;
