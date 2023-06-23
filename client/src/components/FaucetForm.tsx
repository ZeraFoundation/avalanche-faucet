import {useState, useEffect} from "react";
import {ethers} from "ethers";
import {ClipLoader} from "react-spinners";

import "./styles/FaucetForm.css";
import FooterBox from "./FooterBox";
import queryString from "query-string";
import {DropdownOption} from "./types";
import {connectAccount} from "./Metamask";
import {AxiosResponse} from "axios";

const FaucetForm = (props: any) => {
  const [chain, setChain] = useState<number | null>(null);
  const [token, setToken] = useState<number | null>(null);
  const [chainConfigs, setChainConfigs] = useState<any>([]);
  const [inputAddress, setInputAddress] = useState<string>("");
  const [address, setAddress] = useState<string | null>(null);
  const [faucetAddress, setFaucetAddress] = useState<string | null>(null);
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [tokenOptions, setTokenOptions] = useState<DropdownOption[]>([]);
  const [balance, setBalance] = useState<string>("0");
  const [shouldAllowSend, setShouldAllowSend] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingBalance, setIsFetchingBalance] =
    useState<AbortController | null>(null);
  const [sendTokenResponse, setSendTokenResponse] = useState<any>({
    txHash: null,
    message: null,
  });

  // Update chain configs
  useEffect(() => {
    updateChainConfigs();
    connectAccount(updateAddress, false);
  }, []);

  // Update balance whenver chain changes or after transaction is processed
  useEffect(() => {
    updateBalance();
  }, [chain, token, sendTokenResponse, chainConfigs]);

  // Make REQUEST button disabled if either address is not valid or balance is low
  useEffect(() => {
    if (address) {
      if (
        //@ts-ignore
        BigInt(balance) >
        calculateBaseUnit(
          chainConfigs[token!]?.DRIP_AMOUNT,
          chainConfigs[token!]?.DECIMALS,
        )
      ) {
        setShouldAllowSend(true);
        return;
      }
    }

    setShouldAllowSend(false);
  }, [address, balance]);

  useEffect(() => {
    updateFaucetAddress();
  }, [chain, chainConfigs]);

  useEffect(() => {
    let newOptions: DropdownOption[] = [];

    chainConfigs?.forEach((chain: any, i: number) => {
      let item = (
        <div className="select-dropdown">
          <img alt={chain.NAME[0]} src={chain.IMAGE} />
          {chain.NAME}

          {chain.CONTRACTADDRESS && (
            <span
              style={{
                color: "rgb(180, 180, 183)",
                fontSize: "10px",
                marginLeft: "5px",
              }}>
              {chainConfigs[chainToIndex(chain.HOSTID) || 0]?.NAME}
            </span>
          )}
        </div>
      );

      if (!chain.CONTRACTADDRESS) {
        newOptions.push({
          label: item,
          value: i,
          search: chain.NAME,
        });
      }
    });

    setOptions(newOptions);
    setChain(newOptions[0]?.value);
  }, [chainConfigs]);

  useEffect(() => {
    let newOptions: DropdownOption[] = [];

    chainConfigs?.forEach((chain: any, i: number) => {
      const {chain: ch} = getChainParams();

      let item = (
        <div className="select-dropdown">
          <img alt={chain.NAME[0]} src={chain.IMAGE} />

          {chain.ID == ch ? chain.TOKEN : chain.NAME}

          <span
            style={{
              color: "rgb(180, 180, 183)",
              fontSize: "10px",
              marginLeft: "5px",
            }}>
            {chain.CONTRACTADDRESS ? "ERC20" : "Native"}
          </span>
        </div>
      );

      if ((chain.CONTRACTADDRESS && chain.HOSTID == ch) || chain.ID == ch) {
        newOptions.push({
          label: item,
          value: i,
          search: chain.NAME,
        });
      }
    });

    setTokenOptions(newOptions);
    setToken(newOptions[0]?.value);
  }, [chainConfigs, chain]);

  const getConfigByTokenAndNetwork = (token: any, network: any): number => {
    let selectedConfig = 0;

    try {
      token = token?.toUpperCase();
      network = network?.toUpperCase();

      chainConfigs.forEach((chain: any, i: number): any => {
        if (chain.TOKEN == token && chain.HOSTID == network) {
          selectedConfig = i;
        }
      });
    } catch (err: any) {
      console.log(err);
    }

    return selectedConfig;
  };

  let totalTokens: boolean = tokenOptions?.length === 0;

  useEffect(() => {
    const query = queryString.parse(window.location.search);

    const {address, subnet, erc20} = query;

    const tokenIndex: number = getConfigByTokenAndNetwork(erc20, subnet);

    if (typeof address == "string") {
      updateAddress(address);
    }

    if (typeof subnet == "string") {
      setChain(chainToIndex(subnet));
      if (typeof erc20 == "string") {
        setToken(tokenIndex);
      }
    } else {
      setChain(0);
    }
  }, [window.location.search, options, totalTokens]);

  // API calls
  async function updateChainConfigs(): Promise<void> {
    const response: AxiosResponse = await props.axios.get(
      props.config.api.getChainConfigs,
    );
    setChainConfigs(response?.data?.configs);
  }

  function getChainParams(): {chain: string; erc20: string} {
    let params = {
      chain: chainConfigs[chain!]?.ID,
      erc20: chainConfigs[token!]?.ID,
    };
    return params;
  }

  async function updateBalance(): Promise<void> {
    // Abort pending requests
    const controller = new AbortController();
    if (isFetchingBalance) {
      isFetchingBalance.abort();
    }

    setIsFetchingBalance(controller);

    if ((chain || chain == 0) && chainConfigs.length > 0) {
      let {chain, erc20} = getChainParams();

      const response: AxiosResponse = await props.axios.get(
        props.config.api.getBalance,
        {
          params: {
            chain,
            erc20,
          },
          signal: controller.signal,
        },
      );

      if (response?.data?.balance || response?.data?.balance == 0) {
        setBalance(response?.data?.balance);
      }
    }
  }

  async function updateFaucetAddress(): Promise<void> {
    if ((chain || chain == 0) && chainConfigs.length > 0) {
      let {chain} = getChainParams();

      const response: AxiosResponse = await props.axios.get(
        props.config.api.faucetAddress,
        {
          params: {
            chain,
          },
        },
      );

      if (response?.data) {
        setFaucetAddress(response?.data?.address);
      }
    }
  }

  function calculateBaseUnit(
    amount: string = "0",
    decimals: number = 18,
  ): BigInt {
    for (let i = 0; i < decimals; i++) {
      amount += "0";
    }
    return BigInt(amount);
  }

  // function calculateLargestUnit(
  //   amount: string = "0",
  //   decimals: number = 18,
  // ): string {
  //   let base = "1";
  //   for (let i = 0; i < decimals; i++) {
  //     base += "0";
  //   }
  //   return (BigInt(amount) / BigInt(base)).toString();
  // }

  function chainToIndex(id: any): number | null {
    if (chainConfigs?.length > 0) {
      if (typeof id == "string") {
        id = id.toUpperCase();
      }
      let index: number = 0;
      chainConfigs.forEach((chain: any, i: number) => {
        if (id == chain.ID) {
          index = i;
        }
      });
      return index;
    } else {
      return null;
    }
  }

  function updateAddress(addr: any): void {
    setInputAddress(addr!);

    if (addr) {
      if (ethers.utils.isAddress(addr)) {
        setAddress(addr);
      } else {
        setAddress(null);
      }
    } else if (address != null) {
      setAddress(null);
    }
  }

  async function sendToken(): Promise<void> {
    if (!shouldAllowSend) {
      return;
    }
    let data: any;
    try {
      setIsLoading(true);

      let {chain, erc20} = getChainParams();

      const response = await props.axios.post(props.config.api.sendToken, {
        address,
        chain,
        erc20,
      });
      data = response?.data;
    } catch (err: any) {
      data = err?.response?.data || err;
    }

    setSendTokenResponse({
      txHash: data?.txHash,
      message: data?.message,
    });

    setIsLoading(false);
  }

  // const ChainDropdown = () => {
  //   if (!tokenOptions[0]?.label) {
  //     return null;
  //   }
  //   return <div className="chain-dropdown">{tokenOptions[0].label}</div>;
  // };

  // const TokenDropdown = () => {
  //   if (!tokenOptions[0]?.label) {
  //     return null;
  //   }

  //   return (
  //     <div style={{width: "100%"}}>
  //       <div className="chain-dropdown">{tokenOptions[0].label}</div>
  //     </div>
  //   );
  // };

  const back = (): void => {
    setSendTokenResponse({
      txHash: null,
      message: null,
    });
  };

  // const toString = (mins: number): string => {
  //   if (mins < 60) {
  //     return `${mins} minute${mins > 1 ? "s" : ""}`;
  //   } else {
  //     const hour = ~~(mins / 60);
  //     const minute = mins % 60;

  //     if (minute == 0) {
  //       return `${hour} hour${hour > 1 ? "s" : ""}`;
  //     } else {
  //       return `${hour} hour${hour > 1 ? "s" : ""} and ${minute} minute${
  //         minute > 1 ? "s" : ""
  //       }`;
  //     }
  //   }
  // };

  return (
    <div className="container">
      <div className="box">
        <h3 className="logo">
          <img src="/zera-text-logo-white.svg" />
        </h3>

        <div className="box-content">
          {/* <div className="box-header">
            <span>
              <span style={{color: "grey"}}>Network</span>
            </span>
            <ChainDropdown /> <br />
            <div>
              <div style={{width: "100%"}}>
                <span style={{color: "grey", fontSize: "12px", float: "right"}}>
                  Faucet balance:{" "}
                  {calculateLargestUnit(
                    balance,
                    chainConfigs[token!]?.DECIMALS,
                  )}{" "}
                  {chainConfigs[token!]?.TOKEN}
                </span>

                <span style={{color: "grey", fontSize: "12px"}}>Token</span>

                <TokenDropdown />
              </div>
            </div>
          </div> */}

          <div style={{display: sendTokenResponse?.txHash ? "none" : "block"}}>
            <p className="rate-limit-text">
              Please provide your wallet address to request test tokens.
              {/* Drops are limited to
              <span>
                {chainConfigs[token!]?.RATELIMIT?.MAX_LIMIT} request in{" "}
                {toString(chainConfigs[token!]?.RATELIMIT?.WINDOW_SIZE)}.
              </span> */}
            </p>

            <div className="address-input">
              <input
                placeholder="Hexadecimal Address (0x...)"
                value={inputAddress || ""}
                onChange={e => updateAddress(e.target.value)}
                autoFocus
              />

              <span
                className="connect-metamask"
                onClick={() => connectAccount(updateAddress)}>
                <img alt="metamask" src="/memtamask.webp" />
                Connect
              </span>
            </div>
            <span className="rate-limit-text" style={{color: "red"}}>
              {sendTokenResponse?.message}
            </span>

            <button
              className={
                shouldAllowSend ? "send-button" : "send-button-disabled"
              }
              onClick={sendToken}>
              {isLoading ? (
                <ClipLoader size="20px" speedMultiplier={0.3} color="403F40" />
              ) : (
                <span>
                  Request {chainConfigs[token || 0]?.DRIP_AMOUNT}{" "}
                  {chainConfigs[token || 0]?.TOKEN}
                </span>
              )}
            </button>

            <div className="beta-alert">
              <p>This is a testnet faucet. Funds are not real.</p>
            </div>
          </div>

          <div style={{display: sendTokenResponse?.txHash ? "block" : "none"}}>
            <p className="rate-limit-text">{sendTokenResponse?.message}</p>

            <div>
              <span className="bold-text">Transaction ID</span>
              <p className="rate-limit-text">
                <a
                  target={"_blank"}
                  href={
                    chainConfigs[token!]?.EXPLORER +
                    "/tx/" +
                    sendTokenResponse?.txHash
                  }
                  rel="noreferrer">
                  {sendTokenResponse?.txHash}
                </a>
              </p>
            </div>

            <button className="back-button" onClick={back}>
              Back
            </button>
          </div>
        </div>
      </div>

      <FooterBox
        chain={chain}
        token={token}
        chainConfigs={chainConfigs}
        chainToIndex={chainToIndex}
        faucetAddress={faucetAddress}
      />
    </div>
  );
};

export default FaucetForm;
