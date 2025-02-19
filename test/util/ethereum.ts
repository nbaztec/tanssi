

import { Signer, ethers } from "ethers";
import { alith, BALTATHAR_ADDRESS, TransactionOptions, customWeb3Request } from "@moonwall/util";
import { DevModeContext, MoonwallContext, EthTransactionType } from "@moonwall/cli";
import { ALITH_PRIVATE_KEY, CHARLETH_ADDRESS } from "@moonwall/util";
import { FMT_BYTES, FMT_NUMBER } from "web3";

const debug = require("debug")("test:transaction");

export const createTransaction = async (
    context: DevModeContext,
    options: TransactionOptions,
    txType?: EthTransactionType
  ): Promise<string> => {
    const defaultTxnStyle = MoonwallContext.getContext()!.defaultEthTxnStyle;
  
    const isLegacy = txType
      ? txType === "Legacy"
      : defaultTxnStyle
      ? defaultTxnStyle === "Legacy"
      : true;
  
    const isEip2930 = txType
      ? txType === "EIP2930"
      : defaultTxnStyle
      ? defaultTxnStyle === "EIP2930"
      : true;
  
    const isEip1559 = txType
      ? txType === "EIP1559"
      : defaultTxnStyle
      ? defaultTxnStyle === "EIP1559"
      : true;
  
    // a transaction shouldn't have both Legacy and EIP1559 fields
    if (options.gasPrice && options.maxFeePerGas) {
      throw new Error(`txn has both gasPrice and maxFeePerGas!`);
    }
    if (options.gasPrice && options.maxPriorityFeePerGas) {
      throw new Error(`txn has both gasPrice and maxPriorityFeePerGas!`);
    }
  
    // convert any bigints to hex
    if (typeof options.gasPrice === "bigint") {
      options.gasPrice = "0x" + options.gasPrice.toString(16);
    }
    if (typeof options.maxFeePerGas === "bigint") {
      options.maxFeePerGas = "0x" + options.maxFeePerGas.toString(16);
    }
    if (typeof options.maxPriorityFeePerGas === "bigint") {
      options.maxPriorityFeePerGas = "0x" + options.maxPriorityFeePerGas.toString(16);
    }
  
    let maxFeePerGas;
    let maxPriorityFeePerGas;
    if (options.gasPrice) {
      maxFeePerGas = options.gasPrice;
      maxPriorityFeePerGas = options.gasPrice;
    } else {
      maxFeePerGas =
        options.maxFeePerGas || (await context.ethersSigner().provider?.getFeeData())!.gasPrice;
      maxPriorityFeePerGas = options.maxPriorityFeePerGas || 0;
    }
  
    const gasPrice =
      options.gasPrice !== undefined
        ? options.gasPrice
        : "0x" +
          (await context.web3().eth.getGasPrice({ number: FMT_NUMBER.HEX, bytes: FMT_BYTES.HEX }));
    const value = options.value !== undefined ? options.value : "0x00";
    const from = options.from || alith.address;
    const privateKey = options.privateKey !== undefined ? options.privateKey : ALITH_PRIVATE_KEY;
  
    // Allows to retrieve potential errors
    let error = "";
    const estimatedGas = await context
      .web3()
      .eth.estimateGas({
        from: from,
        to: options.to,
        data: options.data,
      })
      .catch((e) => {
        error = e;
        return options.gas || 12_500_000;
      });
  
    let warning = "";
    if (options.gas && options.gas < estimatedGas) {
      warning = `Provided gas ${options.gas} is lower than estimated gas ${estimatedGas}`;
    }
    // Instead of hardcoding the gas limit, we estimate the gas
    const gas = options.gas || estimatedGas;
  
    const accessList = options.accessList || [];
    const nonce =
      options.nonce != null
        ? options.nonce
        : await context.web3().eth.getTransactionCount(from, "pending");
    // : await context.ethersSigner().provider!.getTransactionCount(from, "pending");
  
    let data, rawTransaction;
    const provider = context.ethersSigner().provider!;
    // const provider = context.web3().provider
    // const newSigner = new ethers.Wallet(privateKey, provider);
    if (isLegacy) {
      data = {
        from,
        to: options.to,
        value: value && value.toString(),
        gasPrice,
        gas,
        nonce: nonce,
        data: options.data,
      };
      // rawTransaction = await newSigner.signTransaction(data);
      // rawTransaction = await context.web3().eth.signTransaction(data);
      const tx = await context.web3().eth.accounts.signTransaction(data as any, privateKey);
      rawTransaction = tx.rawTransaction;
    } else {
      const signer = new ethers.Wallet(privateKey, context.ethersSigner().provider!);
      const chainId = (await provider.getNetwork()).chainId;
      // const chainId = await context.web3().eth.getChainId()
      if (isEip2930) {
        data = {
          from,
          to: options.to,
          value: value && value.toString(),
          gasPrice,
          gasLimit: gas,
          nonce: nonce,
          data: options.data,
          accessList,
          chainId,
          type: 1,
        };
      } else {
        if (!isEip1559) {
          throw new Error("Unknown transaction type!");
        }
  
        data = {
          from,
          to: options.to,
          value: value && value.toString(),
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit: gas,
          nonce: nonce,
          data: options.data,
          accessList,
          chainId,
          type: 2,
        };
      }
      // rawTransaction = await newSigner.signTransaction(data as TransactionRequest);
      rawTransaction = await signer.signTransaction(data as any);
    }
  
    debug(
      `TransactionDetails` +
        (data.to
          ? `to: ${data.to.substr(0, 5) + "..." + data.to.substr(data.to.length - 3)}, `
          : "") +
        (data.value ? `value: ${data.value.toString()}, ` : "") +
        (data.gasPrice ? `gasPrice: ${data.gasPrice.toString()}, ` : "") +
        (data.maxFeePerGas ? `maxFeePerGas: ${data.maxFeePerGas.toString()}, ` : "") +
        (data.maxPriorityFeePerGas
          ? `maxPriorityFeePerGas: ${data.maxPriorityFeePerGas.toString()}, `
          : "") +
        (data.accessList ? `accessList: ${data.accessList.toString()}, ` : "") +
        (data.gas ? `gas: ${data.gas.toString()}, ` : "") +
        (data.nonce ? `nonce: ${data.nonce.toString()}, ` : "") +
        (!data.data
          ? ""
          : `data: ${
              data.data.length < 50
                ? data.data
                : data.data.substr(0, 5) + "..." + data.data.substr(data.data.length - 3)
            }, `) +
        (error ? `ERROR: ${error.toString()}, ` : "") +
        (warning ? `WARN: ${warning.toString()}, ` : "")
    );
    return rawTransaction;
  };
  
  export const createTransfer = async (
    context: DevModeContext,
    to: string,
    value: number | string | BigInt,
    options: TransactionOptions = ALITH_TRANSACTION_TEMPLATE
  ): Promise<string> => {
    return await createTransaction(context, {
      ...options,
      value: value.toString(),
      to,
    });
  };

  export const TRANSACTION_TEMPLATE: TransactionOptions = {
    // nonce: null,
    gas: 500_000,
    value: "0x00",
  };
  
  export const ALITH_TRANSACTION_TEMPLATE: TransactionOptions = {
    ...TRANSACTION_TEMPLATE,
    from: alith.address,
    privateKey: ALITH_PRIVATE_KEY,
  };
  
/// Await for a promise resolution while we wait for the tx hash to be included
/// This will tipically be waiting for new blocks
export async function waitUntilEthTxIncluded(promise, web3, txHash)  {
  while ((await customWeb3Request(web3, "eth_getTransactionByHash", [
    txHash,
  ])).result.blockNumber== null) {  
    await promise();
  }
}