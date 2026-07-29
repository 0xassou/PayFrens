// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "../interfaces/IERC20.sol";

/// @title SafeERC20
/// @notice Wraps `transfer` and `transferFrom` so that both well-behaved tokens
///         (which return a bool) and older ones (which return nothing) are
///         handled, and so a `false` return is treated as a failure rather than
///         being silently ignored.
/// @dev PayFrens only ever moves USDC, which does return a bool. The wrapper is
///      here so that a future deployment against a differently-behaved
///      stablecoin cannot fail open.
library SafeERC20 {
    error TransferFailed();
    error TransferFromFailed();

    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        (bool ok, bytes memory ret) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory ret) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFromFailed();
    }
}
