import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, heading, text, divider, copyable } from '@metamask/snaps-ui';
import { ethers } from "ethers"
import axios from 'axios'
import { getBIP44AddressKeyDeriver } from '@metamask/key-tree';

const getEoaAddress = async (): Promise<string> => {
  const provider = new ethers.providers.Web3Provider(ethereum as any);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
};

const getMessage = async (address: string, receiver: string, amount: string, token: string, chain: string, message: string) => {
  const request = await fetch("https://staging-api.fetcch.xyz/v1/transaction-request/generate-message", {
    method: "POST",
    body: JSON.stringify({
      "payer": address,
      "receiver": receiver,
      "amount": amount,
      "token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "payerChainType": "EVM",
      "chain": chain?.toString().toLowerCase() == "ethereum" ? 1 : 2,
      "message": message,
      "label": ""
  }),
  headers: {
    "Content-Type": "application/json",
    "secret-key": "4ff9ecc8-4537-4e2e-950d-0cefbd16f2a5"
  }
})

// console.log(request.text())

return JSON.parse(await request.text()).data.message
}

const createRequest = async (address: string, amount: string, token: string, chain: string, message: string, signature: string) => {
  const request = await fetch("https://staging-api.fetcch.xyz/v1/transaction-request", {
      method: "POST",
      body: JSON.stringify({
        "payer": address,
        "receiver": "0x026357f517D94456814F41E0EF673f50B8709098",
        "amount": amount,
        "token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "payerChainType": "EVM",
        "chain": chain?.toString().toLowerCase() == "ethereum" ? 1 : 2,
        "message": message,
        "label": "",
        "signature": signature
    }),
    headers: {
      "Content-Type": "application/json",
      "secret-key": "4ff9ecc8-4537-4e2e-950d-0cefbd16f2a5"
    }
  })

  // console.log(request.text())

  return JSON.parse(await request.text()).data
}

export const getRequests = async (wallet: ethers.Wallet) => {
  const req1 = await fetch("https://staging-api.fetcch.xyz/v1/authentication/generate-message", {
    method: "POST",
    body: JSON.stringify({
      owner: wallet.address,
    }),
    headers: {
      "Content-Type": "application/json",
      "secret-key": "4ff9ecc8-4537-4e2e-950d-0cefbd16f2a5"
    }
  })

  const res1 = await req1.json()

  const signature = await wallet.signMessage(res1.data.message)

  const req2 = await fetch("https://staging-api.fetcch.xyz/v1/authentication/", {
    method: "POST",
    body: JSON.stringify({
      owner: wallet.address,
      signature: signature,
      timestamp: res1.data.timestamp
    }),
    headers: {
      "Content-Type": "application/json",
      "secret-key": "4ff9ecc8-4537-4e2e-950d-0cefbd16f2a5"
    }
  })

  const res2 = await req2.json()

  const req3 = await fetch(`https://staging-api.fetcch.xyz/v1/transaction-request?receiver=${wallet.address}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${res2.data.accessToken}`,
      "secret-key": "4ff9ecc8-4537-4e2e-950d-0cefbd16f2a5"
    }
  })

  const res3 = await req3.json()

  return res3.data
}

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  const ethereumNodeKey = await snap.request({
    method: 'snap_getBip44Entropy',
    params: {
      coinType: 60,
    },
  });

  const deriveDogecoinAddress = await getBIP44AddressKeyDeriver(ethereumNodeKey);

  const privateKey = await deriveDogecoinAddress(0)
  const account = new ethers.Wallet(privateKey.privateKeyBytes as any)
  
  switch (request.method) {
    case 'read_payment_request':
      const requests: any[] = await getRequests(account)

      await snap.request({
        method: "snap_dialog",
        params: {
          type: "alert",
          content: panel([
            heading("Fetcch - Payment Requests"),
            divider(),
            ...requests.map(request => [
              text(`**ID**: ${request.id}`),
              text(`**Payer**: ${request.payer.ownerId ?? request.payer.owner}`),
              text(`**Receiver**: ${request.recevier.ownerId ?? request.recevier.owner}`),
              text(`**Token**: ${request.token}`),
              text(`**Blockchain**: ${request.chainId}`),
              text(`**Amount**: ${request.amount}`),
              text(`**Message**: ${request.message}`),
              divider()
            ]).flat()
          ])
        }
      })

      break
    case 'create_payment_request':
      // const address = await getEoaAddress()
      const address = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'prompt',
          content: panel([
            heading("Address Books"),
            text("powered by Fetcch"),
            // text(`${address}`)
          ]),
          placeholder: "Enter address or DID"
        },
      });

      const chain = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'prompt',
          content: panel([
            heading("Which blockchain you want to use?"),
            text("powered by Fetcch"),
            // text(`${address}`)
          ]),
          placeholder: "Enter token (ETHEREUM, POLYGON)"
        },
      });

      const token = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'prompt',
          content: panel([
            heading("What token you want?"),
            text("powered by Fetcch"),
            // text(`${address}`)
          ]),
          placeholder: "Enter token (USDC, USDT, ETH, MATIC)"
        },
      });

      const amount = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'prompt',
          content: panel([
            heading("What amount of token you want?"),
            text("powered by Fetcch"),
            // text(`${address}`)
          ]),
          placeholder: "Ex - 1"
        },
      });

      const message = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'prompt',
          content: panel([
            heading("Any message?"),
            text("powered by Fetcch"),
            // text(`${address}`)
          ]),
          placeholder: "Anything"
        },
      });

      const msg = await getMessage(address?.toString() as string, account.address, amount?.toString() as string, token?.toString() as string, chain?.toString() as string, message?.toString() as string)
      const signature = await account.signMessage(msg)

      // let request: string
      // try {
      let request = await createRequest(address?.toString() as string, amount?.toString() as string, token?.toString() as string, chain?.toString() as string, message?.toString() as string, signature)
      // } catch (e: any) {
      //   request = JSON.stringify(e)
      // }
      

      await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading("Transaction request created successfully"),
            text(`**Payer**: ${address}`),
            text(`**Receiver**: ${account.address}`),
            text(`**Token**: ${token}`),
            text(`**Blockchain**: ${chain}`),
            text(`**Amount**: ${amount}`),
            text(`**Message**: ${message}`),
            divider(),
            text(`${address} has received a notification in their wallet for this request or else you can share them this link`),
            copyable(`https://request.fetcch.xyz/${request.id}`)
          ]),
        },
      });
      
      break
    default:
      throw new Error('Method not found.');
  }
};
