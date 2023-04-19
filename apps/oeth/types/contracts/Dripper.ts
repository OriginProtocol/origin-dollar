/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type {
  FunctionFragment,
  Result,
  EventFragment,
} from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
  PromiseOrValue,
} from "./common";

export interface DripperInterface extends utils.Interface {
  functions: {
    "availableFunds()": FunctionFragment;
    "claimGovernance()": FunctionFragment;
    "collect()": FunctionFragment;
    "collectAndRebase()": FunctionFragment;
    "drip()": FunctionFragment;
    "dripDuration()": FunctionFragment;
    "governor()": FunctionFragment;
    "isGovernor()": FunctionFragment;
    "setDripDuration(uint256)": FunctionFragment;
    "transferGovernance(address)": FunctionFragment;
    "transferToken(address,uint256)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "availableFunds"
      | "claimGovernance"
      | "collect"
      | "collectAndRebase"
      | "drip"
      | "dripDuration"
      | "governor"
      | "isGovernor"
      | "setDripDuration"
      | "transferGovernance"
      | "transferToken"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "availableFunds",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "claimGovernance",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "collect", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "collectAndRebase",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "drip", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "dripDuration",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "governor", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "isGovernor",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "setDripDuration",
    values: [PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "transferGovernance",
    values: [PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "transferToken",
    values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]
  ): string;

  decodeFunctionResult(
    functionFragment: "availableFunds",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "claimGovernance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "collect", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "collectAndRebase",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "drip", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "dripDuration",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "governor", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "isGovernor", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "setDripDuration",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferGovernance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferToken",
    data: BytesLike
  ): Result;

  events: {
    "GovernorshipTransferred(address,address)": EventFragment;
    "PendingGovernorshipTransfer(address,address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "GovernorshipTransferred"): EventFragment;
  getEvent(
    nameOrSignatureOrTopic: "PendingGovernorshipTransfer"
  ): EventFragment;
}

export interface GovernorshipTransferredEventObject {
  previousGovernor: string;
  newGovernor: string;
}
export type GovernorshipTransferredEvent = TypedEvent<
  [string, string],
  GovernorshipTransferredEventObject
>;

export type GovernorshipTransferredEventFilter =
  TypedEventFilter<GovernorshipTransferredEvent>;

export interface PendingGovernorshipTransferEventObject {
  previousGovernor: string;
  newGovernor: string;
}
export type PendingGovernorshipTransferEvent = TypedEvent<
  [string, string],
  PendingGovernorshipTransferEventObject
>;

export type PendingGovernorshipTransferEventFilter =
  TypedEventFilter<PendingGovernorshipTransferEvent>;

export interface Dripper extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: DripperInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    availableFunds(overrides?: CallOverrides): Promise<[BigNumber]>;

    claimGovernance(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    collect(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    collectAndRebase(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    drip(
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber] & { lastCollect: BigNumber; perBlock: BigNumber }
    >;

    dripDuration(overrides?: CallOverrides): Promise<[BigNumber]>;

    governor(overrides?: CallOverrides): Promise<[string]>;

    isGovernor(overrides?: CallOverrides): Promise<[boolean]>;

    setDripDuration(
      _durationSeconds: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    transferGovernance(
      _newGovernor: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    transferToken(
      _asset: PromiseOrValue<string>,
      _amount: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;
  };

  availableFunds(overrides?: CallOverrides): Promise<BigNumber>;

  claimGovernance(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  collect(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  collectAndRebase(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  drip(
    overrides?: CallOverrides
  ): Promise<
    [BigNumber, BigNumber] & { lastCollect: BigNumber; perBlock: BigNumber }
  >;

  dripDuration(overrides?: CallOverrides): Promise<BigNumber>;

  governor(overrides?: CallOverrides): Promise<string>;

  isGovernor(overrides?: CallOverrides): Promise<boolean>;

  setDripDuration(
    _durationSeconds: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  transferGovernance(
    _newGovernor: PromiseOrValue<string>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  transferToken(
    _asset: PromiseOrValue<string>,
    _amount: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  callStatic: {
    availableFunds(overrides?: CallOverrides): Promise<BigNumber>;

    claimGovernance(overrides?: CallOverrides): Promise<void>;

    collect(overrides?: CallOverrides): Promise<void>;

    collectAndRebase(overrides?: CallOverrides): Promise<void>;

    drip(
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber] & { lastCollect: BigNumber; perBlock: BigNumber }
    >;

    dripDuration(overrides?: CallOverrides): Promise<BigNumber>;

    governor(overrides?: CallOverrides): Promise<string>;

    isGovernor(overrides?: CallOverrides): Promise<boolean>;

    setDripDuration(
      _durationSeconds: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>;

    transferGovernance(
      _newGovernor: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<void>;

    transferToken(
      _asset: PromiseOrValue<string>,
      _amount: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {
    "GovernorshipTransferred(address,address)"(
      previousGovernor?: PromiseOrValue<string> | null,
      newGovernor?: PromiseOrValue<string> | null
    ): GovernorshipTransferredEventFilter;
    GovernorshipTransferred(
      previousGovernor?: PromiseOrValue<string> | null,
      newGovernor?: PromiseOrValue<string> | null
    ): GovernorshipTransferredEventFilter;

    "PendingGovernorshipTransfer(address,address)"(
      previousGovernor?: PromiseOrValue<string> | null,
      newGovernor?: PromiseOrValue<string> | null
    ): PendingGovernorshipTransferEventFilter;
    PendingGovernorshipTransfer(
      previousGovernor?: PromiseOrValue<string> | null,
      newGovernor?: PromiseOrValue<string> | null
    ): PendingGovernorshipTransferEventFilter;
  };

  estimateGas: {
    availableFunds(overrides?: CallOverrides): Promise<BigNumber>;

    claimGovernance(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    collect(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    collectAndRebase(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    drip(overrides?: CallOverrides): Promise<BigNumber>;

    dripDuration(overrides?: CallOverrides): Promise<BigNumber>;

    governor(overrides?: CallOverrides): Promise<BigNumber>;

    isGovernor(overrides?: CallOverrides): Promise<BigNumber>;

    setDripDuration(
      _durationSeconds: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    transferGovernance(
      _newGovernor: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    transferToken(
      _asset: PromiseOrValue<string>,
      _amount: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    availableFunds(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    claimGovernance(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    collect(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    collectAndRebase(
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    drip(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    dripDuration(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    governor(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    isGovernor(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    setDripDuration(
      _durationSeconds: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    transferGovernance(
      _newGovernor: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    transferToken(
      _asset: PromiseOrValue<string>,
      _amount: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
}
