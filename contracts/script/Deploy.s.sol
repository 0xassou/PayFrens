// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PayFrensSplitter} from "../src/PayFrensSplitter.sol";
import {Script, console2} from "forge-std/Script.sol";

/// @notice Deploys PayFrensSplitter against the right USDC for whichever chain
///         the script is broadcasting to.
///
/// ```
/// forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
/// ```
contract Deploy is Script {
    /// @dev Native (Circle-issued) USDC on Base mainnet.
    address internal constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    /// @dev Circle test USDC on Base Sepolia.
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    uint256 internal constant CHAIN_BASE = 8453;
    uint256 internal constant CHAIN_BASE_SEPOLIA = 84532;

    error UnsupportedChain(uint256 chainId);

    function run() external returns (PayFrensSplitter splitter) {
        address usdc = usdcFor(block.chainid);
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();
        splitter = new PayFrensSplitter(usdc, treasury);
        vm.stopBroadcast();

        console2.log("PayFrensSplitter:", address(splitter));
        console2.log("USDC:            ", usdc);
        console2.log("owner / treasury:", treasury);
        console2.log("chain id:        ", block.chainid);
    }

    function usdcFor(uint256 chainId) public pure returns (address) {
        if (chainId == CHAIN_BASE) return USDC_BASE;
        if (chainId == CHAIN_BASE_SEPOLIA) return USDC_BASE_SEPOLIA;
        revert UnsupportedChain(chainId);
    }
}
