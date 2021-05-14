const ENS = require("@ensdomains/ensjs").default;
const Web3 = require("web3");
const sha3 = require("web3-utils").sha3;
const utils = require("web3-utils");
const { hash } = require("eth-ens-namehash");
const BN = require("bn.js");
const EthRegistrarSubdomainRegistrar = require("./contracts/EthRegistrarSubdomainRegistrar");

const ENS_ADDRESS = "0xd8532Db4d846424Bc1D0D9b08AB45EEf31b6c00F";
const NODE_URL = "https://api.s0.b.hmny.io";

const DOMAIN_NAME = "crazy";

const ETH_GAS_LIMIT = 6721900;
const HMY_USER_PRIVATE_KEY = "XXX";

const web3 = new Web3(NODE_URL);
// or init with Metamask / OneWallet
let hmyUserAccount = web3.eth.accounts.privateKeyToAccount(
  HMY_USER_PRIVATE_KEY
);
web3.eth.accounts.wallet.add(hmyUserAccount);
web3.eth.defaultAccount = hmyUserAccount.address;
hmyUserAccount = hmyUserAccount.address;

const provider = new Web3.providers.HttpProvider(NODE_URL);

const ens = new ENS({ provider, ensAddress: ENS_ADDRESS });

const test = async () => {
  console.log("");
  // check resolver address
  const resolverAddress = await ens.name("resolver.one").getAddress();
  console.log("resolver.one ", resolverAddress);

  const subdomainRegisterAddress = await ens.name("crazy.one").getAddress();

  console.log(
    "subdomainRegisterAddress (crazy.one): ",
    subdomainRegisterAddress
  );

  console.log("");

  // init subdomainRegisterContract
  const subdomainRegistrar = new web3.eth.Contract(
    EthRegistrarSubdomainRegistrar.abi,
    subdomainRegisterAddress
  );

  const REFERRER_ADDRESS = await subdomainRegistrar.methods
    .referralAddress("crazy")
    .call();

  const subdomain = "tes1-1234567";
  const duration = 31536000; // 1 year

  //check subdomain to free
  let available = await subdomainRegistrar.methods
    .available(hash(`${subdomain}.crazy.one`))
    .call();

  console.log("available", available);

  if (!available) {
    return;
  }

  const rentPrice = await subdomainRegistrar.methods
    .rentPrice(subdomain, duration)
    .call();

  console.log(
    `rentPrice for "${subdomain}.crazy.one" to 1 year: `,
    Number(rentPrice) / 1e18,
    " ONE"
  );

  console.log(
    "User balance before: ",
    (await web3.eth.getBalance(hmyUserAccount)) / 1e18
  );
  console.log(
    "Referrer balance before: ",
    (await web3.eth.getBalance(REFERRER_ADDRESS)) / 1e18
  );

  console.log("");
  console.log("------- Start register: ", subdomain);
  console.log("");

  const tx = await subdomainRegistrar.methods
    .register(
      sha3(DOMAIN_NAME),
      subdomain,
      hmyUserAccount,
      duration,
      "twitter Name 12345",
      resolverAddress
    )
    .send({
      from: hmyUserAccount,
      value: utils.toBN(rentPrice),
      gas: ETH_GAS_LIMIT,
      gasPrice: new BN(await web3.eth.getGasPrice()).mul(new BN(1)),
    });

  console.log("TX STATUS: ", tx.status, tx.transactionHash);

  await getLogs(tx.transactionHash);

  const res = await subdomainRegistrar.methods
    ._setTwitterURI(hash(`${subdomain}.crazy.one`), "new_twitter_name")
    .send({
      from: hmyUserAccount,
      gas: ETH_GAS_LIMIT,
      gasPrice: new BN(await web3.eth.getGasPrice()).mul(new BN(1)),
    });

  console.log("");
  console.log("-------------- CHECK SUBDOMAIN INFO ----------");
  console.log("");

  subdomainAddress = await ens.name(subdomain + ".crazy.one").getAddress();
  console.log(
    `Address: ${subdomain}.crazy.one`,
    subdomainAddress,
    subdomainAddress === hmyUserAccount
  );

  const subdomainOwner = await ens.name(subdomain + ".crazy.one").getOwner();
  console.log(
    `Owner: ${subdomain}.crazy.one`,
    subdomainOwner,
    subdomainOwner === hmyUserAccount
  );

  console.log(
    "Twitter name: ",
    await subdomainRegistrar.methods
      .twitter(hash(`${subdomain}.crazy.one`))
      .call()
  );

  console.log(
    "User balance after: ",
    (await web3.eth.getBalance(hmyUserAccount)) / 1e18
  );
  console.log(
    "Referrer balance after: ",
    (await web3.eth.getBalance(REFERRER_ADDRESS)) / 1e18
  );

  console.log(
    "date Expires",
    new Date(
      Number(
        await subdomainRegistrar.methods
          .nameExpires(hash(`${subdomain}.crazy.one`))
          .call()
      ) * 1000
    )
  );
};

test();

const getLogs = async (txHash) => {
  const receipt = await web3.eth.getTransactionReceipt(txHash);

  receipt.logs.forEach(async (log) => {
    try {
      const decoded = web3.eth.abi.decodeLog(
        [
          {
            indexed: true,
            name: "label",
            type: "bytes32",
          },
          {
            indexed: false,
            name: "subdomain",
            type: "string",
          },
          {
            indexed: true,
            name: "owner",
            type: "address",
          },
          {
            indexed: false,
            name: "price",
            type: "uint256",
          },
        ],
        log.data,
        log.topics.slice(1)
      );

      console.log(decoded);

      // 1 - check domain:
      console.log(
        "Check domain: ",
        sha3("crazy"),
        decoded.label === sha3("crazy")
      );

      // 2 - check contract:
      const subdomainRegisterAddress = await ens.name("crazy.one").getAddress();
      console.log(
        "Check contract: ",
        receipt.to.toLowerCase() ===
          subdomainRegisterAddress.toString().toLowerCase()
      );
    } catch (e) {}
  });
};

// getLogs("0x9af094f433bd6eea580e8a2dd810b12833b46a9f77a9002c101741722bc3a2e2");
