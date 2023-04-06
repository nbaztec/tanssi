import { describeSuite, expect, beforeAll, Web3, Signer } from "@moonwall/cli";
import { CHARLETH_ADDRESS, BALTATHAR_ADDRESS, alith, setupLogger,generateKeyringPair } from "@moonwall/util";
import { WebSocketProvider, parseEther, formatEther } from "ethers";
import { BN } from "@polkadot/util";
import { ApiPromise, Keyring } from "@polkadot/api";

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

describeSuite({
  id: "D01",
  title: "Dev test suite",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    let api: WebSocketProvider;
    let w3;
    let polkadotJs: ApiPromise;
    const anotherLogger = setupLogger("anotherLogger");

    beforeAll(() => {
      polkadotJs = context.polkadotJs();
    });

    it({
      id: "E01",
      title: "Checking that launched node can create blocks",
      test: async function () {
        const block = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        await context.createBlock();

        const block2 = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        log(`Original block #${block}, new block #${block2}`);
        expect(block2).to.be.greaterThan(block);
      },
    });

    it({
      id: "E02",
      title: "Checking that substrate txns possible",
      timeout: 20000,
      test: async function () {
        const keyring = new Keyring({ type: 'sr25519' });
        const alice = keyring.addFromUri('//Alice', { name: 'Alice default' });
        const bob = keyring.addFromUri('//Bob', { name: 'Bob default' });


        const balanceBefore = (await polkadotJs.query.system.account(bob.address)).data.free;
        await polkadotJs.tx.balances
          .transfer(bob.address, 1000)
          .signAndSend(alice);

        await context.createBlock();
        const balanceAfter = (await polkadotJs.query.system.account(bob.address)).data.free;
        log(
          `Baltathar account balance before ${formatEther(
            balanceBefore.toBigInt()
          )} DEV, balance after ${formatEther(balanceAfter.toBigInt())} DEV`
        );
        expect(balanceBefore.lt(balanceAfter)).to.be.true;
      },
    });

  },
});