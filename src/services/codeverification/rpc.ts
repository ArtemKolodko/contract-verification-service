import axios from 'axios';
import logger from '../../logger';
const log = logger.module('verification:rpc');

export const getSmartContractCode = async (chain, address, compiler): Promise<any> => {
  const explorerUrl =
    chain === 'mainnet' ? process.env.EXPLORER_API_MAINNET : process.env.EXPLORER_API_TESTNET;

  let bytecode, solidityVersion;

  try {
    const contract: any = await axios.get(`${explorerUrl}/shard/0/address/${address}/contract`);

    solidityVersion = contract.data.solidityVersion;

    const tx: any = await axios.get(
      `${explorerUrl}/shard/0/transaction/hash/${contract.data.transactionHash}`
    );

    bytecode = tx.data.input;
  } catch (e) {
    log.error('Error to fetch contract bytecode', { error: e });
    throw new Error('Contract not found');
  }

  if (solidityVersion !== compiler) {
    // throw new Error('Compiler versions do not match');
  }

  return bytecode;
};
