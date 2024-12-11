import { VersionedTransaction, Keypair, SystemProgram, Transaction, Connection, ComputeBudgetProgram, TransactionInstruction, TransactionMessage, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js"
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AnchorProvider } from "@coral-xyz/anchor";
import { openAsBlob } from "fs";
import base58 from "bs58"
import { DESCRIPTION, FILE, PRIVATE_KEY, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT, TELEGRAM, TOKEN_CREATE_ON, TOKEN_NAME, TOKEN_SHOW_NAME, TOKEN_SYMBOL, TWITTER, WEBSITE, SWAP_AMOUNT } from "./constants"
import { readJson, saveDataToFile, sleep } from "./utils"
import { PumpFunSDK } from "./src/pumpfun";
import { jitoWithAxios } from "./src/jitoWithAxios";


const commitment = "confirmed"
const connection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment
})

const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))

const versionedTxs: VersionedTransaction[] = []
const mintKp = Keypair.generate()

const mintAddress = mintKp.publicKey

let sdk = new PumpFunSDK(new AnchorProvider(connection, new NodeWallet(new Keypair()), { commitment }));

const mode = "JITO_MODE"


const main = async () => {
    console.log("======================= Bot start ========================")

    try {

        console.log("======================== Token Create =========================")

        console.log(await connection.getBalance(mainKp.publicKey) / 10 ** 9, "SOL in main keypair")

        saveDataToFile([base58.encode(mintKp.secretKey)], "mint.json")

        let tokenCreationIxs = await createTokenTx()


        if (!tokenCreationIxs) {
            console.log("creation instruction not retrieved")
            return
        }

        const ixs: TransactionInstruction[] = [
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 70_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 })
        ]

        ixs.push(
            tokenCreationIxs,
        ),

            console.log(`Token contract link: https://solscan.io/token/${mintAddress}`)

        const tokenCreateRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
            return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
                console.log({ getLatestBlockhashError })
                return null
            })
        }))?.blockhash;
        if (!tokenCreateRecentBlockhash) return { Err: "Failed to prepare transaction" }

        const tokenCreateTransaction = new VersionedTransaction(
            new TransactionMessage({
                payerKey: mainKp.publicKey,
                recentBlockhash: tokenCreateRecentBlockhash,
                instructions: ixs,
            }).compileToV0Message()
        );

        tokenCreateTransaction.sign([mainKp, mintKp])
        console.log(await connection.simulateTransaction(tokenCreateTransaction, { sigVerify: true }))
        versionedTxs.push(tokenCreateTransaction)

    } catch (error) {
        console.log("Token mint error");
    }

    for (let i = 0; i < 3; i++) {
        const buyerKp = Keypair.generate();
        saveDataToFile([base58.encode(buyerKp.secretKey)], "data2.json")
        console.log("buyer=============>", base58.encode(buyerKp.secretKey));


        try {
            console.log("============================= Buyer airdrop start ==========================");

            const mainKpBalance = (await connection.getBalance(mainKp.publicKey)) / LAMPORTS_PER_SOL;
            console.log("mainKp Balance:", mainKpBalance);
            const ixs: TransactionInstruction[] = [
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 7_000 }),
                ComputeBudgetProgram.setComputeUnitLimit({ units: 15_000 })
            ]
            // const solAmountLamports = solAmount!.raw.toNumber(); // Convert to lamports
            // console.log(solAmount!.raw.toString())
            const solAmountLamports = 0.002 * 10 ** 9; // Convert to lamports
            console.log("airdrop amount", solAmountLamports)

            ixs.push(
                SystemProgram.transfer({
                    fromPubkey: mainKp.publicKey,  // Sender's public key
                    toPubkey: buyerKp.publicKey,  // Buyer's public key
                    lamports: (solAmountLamports + 0.005 * 10 ** 9),
                }))

            const airdropRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
                return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
                    console.log({ getLatestBlockhashError })
                    return null
                })
            }))?.blockhash;
            if (!airdropRecentBlockhash) return { Err: "Failed to prepare transaction" }

            const solAirdropTransaction = new VersionedTransaction(
                new TransactionMessage({
                    payerKey: mainKp.publicKey,
                    recentBlockhash: airdropRecentBlockhash,
                    instructions: ixs,
                }).compileToV0Message()
            );
            solAirdropTransaction.sign([mainKp])
            console.log(await connection.simulateTransaction(solAirdropTransaction, { sigVerify: true }))
            versionedTxs.push(solAirdropTransaction)
        } catch (error) {
            console.log("==================== Aridrop failed =====================")

        }

        try {
            console.log("============= Buyer buy token =================")
            // token account rent is 0.00203SOL



            console.log("Buyer keypair :", buyerKp.publicKey.toBase58());
            const buyerBalance = (await connection.getBalance(buyerKp.publicKey)) / LAMPORTS_PER_SOL
            console.log("buyer keypair balance : ", buyerBalance)


            const tokenBuyix = await makeBuyIx(buyerKp, Math.floor(SWAP_AMOUNT * 10 ** 9))


            if (!tokenBuyix) {
                console.log("Token buy instruction not retrieved")
                return
            }

            const ixs: TransactionInstruction[] = [
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 70_000 }),
                ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 })
            ]
            ixs.push(...tokenBuyix);

            const buyRecentBlockhash = (await connection.getLatestBlockhash().catch(async () => {
                return await connection.getLatestBlockhash().catch(getLatestBlockhashError => {
                    console.log({ getLatestBlockhashError })
                    return null
                })
            }))?.blockhash;

            if (!buyRecentBlockhash) return { Err: "Failed to prepare transaction" }

            const tokenBuyTransaction = new VersionedTransaction(
                new TransactionMessage({
                    payerKey: buyerKp.publicKey,
                    recentBlockhash: buyRecentBlockhash,
                    instructions: ixs,
                }).compileToV0Message()
            );

            tokenBuyTransaction.sign([buyerKp])
            console.log(await connection.simulateTransaction(tokenBuyTransaction, { sigVerify: true }))
            versionedTxs.push(tokenBuyTransaction)
        } catch (error) {
            console.log("================ Token buy fail ==============")
            console.log("Error in buy ", error)
        }


    }



    if (mode == "JITO_MODE") {
        console.log("======================== Sell and Buy ========================")
        let result;
        while (1) {
            result = await jitoWithAxios(versionedTxs, mainKp)
            if (result.confirmed) {
                console.log("Bundle signature: ", result.jitoTxsignature)
                break;
            }
        }
    } else {
        for (let i = 0; i < versionedTxs.length; i++) {
            const latestBlockhash = await connection.getLatestBlockhash()
            const sig = await connection.sendRawTransaction(versionedTxs[i].serialize())
            const confirmation = await connection.confirmTransaction({
                signature: sig,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                blockhash: latestBlockhash.blockhash,
            },
                "confirmed"
            )

            if (confirmation.value.err) {
                console.log("Confrimtaion error")
            } else {
                console.log(`transaction: https://solscan.io/tx/${sig} `);
            }
        }
    }


}

// create token instructions
const createTokenTx = async () => {
    try {

        const tokenInfo = {
            name: TOKEN_NAME,
            symbol: TOKEN_SYMBOL,
            description: DESCRIPTION,
            showName: TOKEN_SHOW_NAME,
            createOn: TOKEN_CREATE_ON,
            twitter: TWITTER,
            telegram: TELEGRAM,
            website: WEBSITE,
            file: await openAsBlob(FILE),
        };

        let tokenMetadata = await sdk.createTokenMetadata(tokenInfo);

        if (tokenMetadata.metadataUri) {
            let createIx = await sdk.getCreateInstructions(
                mainKp.publicKey,
                tokenInfo.name,
                tokenInfo.symbol,
                tokenMetadata.metadataUri,
                mintKp
            );

            return createIx;
        } else {
            console.log("================ TokenMEtadata error ===============")
            return
        }
    } catch (error) {

        console.error(error)
    }

}

// make buy instructions
const makeBuyIx = async (kp: Keypair, buyAmount: number) => {
    let buyIx = await sdk.getBuyInstructionsBySolAmount(
        kp.publicKey,
        mintAddress,
        BigInt(buyAmount),
        BigInt(10000000),
        commitment
    );
    console.log("Buyamount:", buyAmount);

    return buyIx
}


main()