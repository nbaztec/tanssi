import fs from "fs/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import jsonBg from "json-bigint";
import { containerChainGenesisDataToChainSpec } from "../util/genesis_data.ts";
import { NETWORK_YARGS_OPTIONS, getApiFor } from "./utils/network.js";
import { convertExponentials } from "@zombienet/utils";
const JSONbig = jsonBg({ useNativeBigInt: true });

yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .version("1.0.0")
  .command(
    `*`,
    "Registers a parachain",
    (yargs) => {
      return yargs
        .options({
            ...NETWORK_YARGS_OPTIONS,
            "output": {
                describe: "Output path of raw chainSpec file",
                type: "string",
            },
            "para-id": {
                describe: "Parachain id",
                type: "number",
            },
            "chain-type": {
                describe: "Chain type",
                type: "string",
            },
            "relay-chain": {
                describe: "Relay chain",
                type: "string",
            },
        })
        .demandOption(["output", "para-id", "chain-type", "relay-chain"]);
    },
    async (argv) => {
        const api = await getApiFor(argv);

        try {
            process.stdout.write(`Reading on-chain genesis data for parachain ${argv.paraId} ...`);
            const encoded = await api.query.registrar.paraGenesisData(argv.paraId) as any;
            if (encoded.isNone) {
                process.stdout.write(`❌ parachain not registered\n`);
                return;
            }
            process.stdout.write(`Done ✅\n`);
            const onChainGenesisData = await api.createType(
                "TpContainerChainGenesisDataContainerChainGenesisData",
                encoded.unwrap(),
            );
            const rawSpec = containerChainGenesisDataToChainSpec(onChainGenesisData, argv.paraId, argv.chainType, argv.relayChain);
            process.stdout.write(`Writing to: ${argv.output} ...`);
            await fs.writeFile(
              argv.output,
              convertExponentials(JSONbig.stringify(rawSpec, null, 3))
            );
            process.stdout.write(`Done ✅\n`);
        } finally {
            await api.disconnect();
        }
    }
  )
  .parse();