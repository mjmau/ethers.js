"use strict";

import { Networkish } from "@ethersproject/networks";
import { defineReadOnly } from "@ethersproject/properties";

import { Logger } from "@ethersproject/logger";
import { version } from "./_version";
const logger = new Logger(version);

import { JsonRpcProvider } from "./json-rpc-provider";


// Exported Types
export type AsyncSendable = {
    isMetaMask?: boolean;
    host?: string;
    path?: string;
    sendAsync?: (request: any, callback: (error: any, response: any) => void) => void
    send?: (request: any, callback: (error: any, response: any) => void) => void
}

export class Web3Provider extends JsonRpcProvider {
    readonly provider: AsyncSendable;
    private _sendAsync: (request: any, callback: (error: any, response: any) => void) => void;

    constructor(web3Provider: AsyncSendable, network?: Networkish) {
        logger.checkNew(new.target, Web3Provider);

        // HTTP has a host; IPC has a path.
        super(web3Provider.host || web3Provider.path || "", network);

        if (web3Provider) {
            if (web3Provider.sendAsync) {
                this._sendAsync = web3Provider.sendAsync.bind(web3Provider);
            } else if (web3Provider.send) {
                this._sendAsync = web3Provider.send.bind(web3Provider);
            }
        }

        if (!this._sendAsync) {
            logger.throwArgumentError("invalid web3Provider", "web3Provider", web3Provider);
        }

        defineReadOnly(this, "provider", web3Provider);
    }

    send(method: string, params: Array<any>): Promise<any> {

        // Metamask complains about eth_sign (and on some versions hangs)
        if (method == "eth_sign" && this.provider.isMetaMask) {
            // https://github.com/ethereum/go-ethereum/wiki/Management-APIs#personal_sign
            method = "personal_sign";
            params = [ params[1], params[0] ];
        }

        return new Promise((resolve, reject) => {
            const request = {
                method: method,
                params: params,
                id: (this._nextId++),
                jsonrpc: "2.0"
            };

            this._sendAsync(request, function(error, result) {
                if (error) {
                    reject(error);
                    return;
                }

                if (result.error) {
                    // @TODO: not any
                    const error: any = new Error(result.error.message);
                    error.code = result.error.code;
                    error.data = result.error.data;
                    reject(error);
                    return;
                }

                resolve(result.result);
            });
        });
    }
}
