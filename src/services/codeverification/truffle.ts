import fs from 'fs';
import path from 'path';

import { execSync } from 'child_process';

type Value = {
  compiler: string;
  optimizer: string;
  optimizerTimes: string;
};

const truffleConfig = ({ compiler, optimizer = 'No', optimizerTimes = '0' }: Value): string => {
  if (['Yes', 'yes', true].includes(optimizer)) {
    return `
    module.exports = {
      compilers:{
        solc: {
          version: "${compiler}",
          settings: {
            optimizer:{
              enabled: ${['Yes', 'yes', true].includes(optimizer) ? true : false},
              runs: ${optimizerTimes}
            }
          }
        }
      }
    }`;
  } else {
    return `
    module.exports = {
      compilers:{
        solc: {
          version: "${compiler}"
        }
      }
    }`;
  }
};

const createConnfiguration = ({
  optimizer,
  optimizerTimes,
  libraries,
  constructorArguments,
  compiler,
  contractAddress,
}): void => {
  if (!compiler) {
    throw new Error('No Solidity version specified');
  }

  console.log('Creating truffle project....');
  execSync(`npx truffle init ${path.resolve(__dirname, contractAddress)}`);

  console.log('Creating truffle configuration');
  const config = truffleConfig({ compiler, optimizer, optimizerTimes });
  fs.writeFileSync(
    path.join(path.resolve(__dirname, contractAddress), 'truffle-config.js'),
    config
  );
};

const createSolFileFromSource = ({ sourceCode, contractAddress, contractName }) => {
  console.log('Creating sol file from source');
  try {
    fs.writeFileSync(
      path.join(path.resolve(__dirname, contractAddress), 'contracts', `${contractName}.sol`),
      sourceCode
    );

    fs.unlinkSync(
      path.join(path.resolve(__dirname, contractAddress), 'contracts', 'Migrations.sol')
    );
  } catch (e) {
    throw "Couldn't create sol files";
  }
};

export const installDependencies = ({ libraries, contractAddress }) => {
  if (libraries.length > 0) {
    const dependencies = libraries.toString().replace(/\,/g, ' ');
    console.log(dependencies);
    try {
      execSync(
        `pwd && cd ${path.resolve(__dirname, contractAddress)} && npm install ${dependencies}`
      );
    } catch (e) {
      throw 'Dependency issue';
    }
  }
};

export const compile = (directory: string) => {
  try {
    execSync(`cd ${path.resolve(__dirname, directory)} && truffle compile`);
  } catch (e) {
    throw 'compilation issue';
  }
};

type inputs = {
  compiler: string;
  optimizer: string;
  optimizerTimes: string;
  sourceCode: string;
  libraries: Array<string>;
  constructorArguments: string;
  contractAddress: string;
  contractName: string;
};

export default async ({
  compiler,
  optimizer,
  optimizerTimes,
  sourceCode,
  libraries,
  constructorArguments,
  contractAddress,
  contractName,
}: inputs) => {
  createConnfiguration({
    optimizer,
    optimizerTimes,
    libraries,
    constructorArguments,
    compiler,
    contractAddress,
  });

  console.log('Installing dependencies...');
  installDependencies({ libraries, contractAddress });

  console.log('Generating solidity file');
  createSolFileFromSource({ sourceCode, contractAddress, contractName });

  console.log('Compiling.....');
  compile(contractAddress);
};
