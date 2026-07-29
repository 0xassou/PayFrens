// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";

/// @title PayFrensSplitter
/// @notice A singleton registry of USDC bill splits.
///
/// One person creates a split, names the participants and what each of them
/// owes, and every participant pays their own share directly into this
/// contract. Once the split is funded the creator withdraws the proceeds, minus
/// a 0.5% protocol fee.
///
/// @dev Design decisions worth knowing before you read the code:
///
/// - **One contract for every split.** A split is a row in `_splits`, not a
///   freshly deployed contract. Creating one costs a handful of storage writes
///   instead of a deployment, and — because the token allowance is granted to
///   this address — a participant who has approved once never approves again,
///   no matter how many splits they end up in.
///
/// - **Funds are never pooled logically.** `amountPaid` and `amountWithdrawn`
///   are tracked per split, and every path that moves money is bounded by the
///   split it belongs to. One split can never spend another's balance.
///
/// - **The fee is charged once, on the way out.** Participants transfer exactly
///   their share. `WITHDRAWAL_FEE_BPS` is applied only in `withdraw`, so the
///   people paying a bill never lose a cent to the protocol — the person
///   collecting does.
///
/// - **Refunds are fee-free.** If a split is cancelled, participants get back
///   exactly what they put in.
contract PayFrensSplitter {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    enum SplitStatus {
        /// @dev Not a real state — a zeroed struct reads as `None`, which is
        ///      how `_requireExists` tells a missing split from a real one.
        None,
        /// @dev Accepting payments.
        Open,
        /// @dev Creator called `cancel`. No more payments; refunds are open.
        Cancelled
    }

    struct Split {
        address creator;
        uint96 totalAmount;
        uint96 amountPaid;
        uint96 amountWithdrawn;
        uint32 createdAt;
        uint16 participantCount;
        uint16 paidCount;
        bool allowPartialWithdraw;
        SplitStatus status;
        string title;
    }

    struct Participant {
        /// @dev Non-zero share doubles as "this address is in the split".
        uint96 share;
        bool paid;
        bool refunded;
    }

    /// @notice Flattened view of a split, for the UI and for subgraph-less reads.
    struct SplitView {
        uint256 id;
        address creator;
        string title;
        uint256 totalAmount;
        uint256 amountPaid;
        uint256 amountWithdrawn;
        uint256 createdAt;
        uint256 participantCount;
        uint256 paidCount;
        bool allowPartialWithdraw;
        SplitStatus status;
        address[] participants;
        uint256[] shares;
        bool[] paidFlags;
    }

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Protocol fee taken at withdrawal, in basis points. 50 = 0.5%.
    uint256 public constant WITHDRAWAL_FEE_BPS = 50;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Upper bound on group size, so that creating a split and reading
    ///         it back always fit comfortably in a block.
    uint256 public constant MAX_PARTICIPANTS = 100;

    /// @notice Upper bound on the title, in bytes.
    uint256 public constant MAX_TITLE_BYTES = 128;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The one token this contract will ever move. USDC on Base.
    IERC20 public immutable token;

    /// @notice Contract owner. Controls `treasury` and ownership itself.
    address public owner;

    /// @notice Pending owner in the two-step handover. Zero when none.
    address public pendingOwner;

    /// @notice Where withdrawal fees are sent. Starts equal to `owner`.
    address public treasury;

    /// @notice Number of splits ever created; also the next split id.
    uint256 public splitCount;

    mapping(uint256 splitId => Split) private _splits;
    mapping(uint256 splitId => address[]) private _participantList;
    mapping(uint256 splitId => mapping(address => Participant)) private _participants;

    /// @dev Kept onchain so the history screen and "same group again" work
    ///      without an indexer. Costs one write per participant per split.
    mapping(address => uint256[]) private _createdSplits;
    mapping(address => uint256[]) private _joinedSplits;

    uint256 private _reentrancyLock = 1;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event SplitCreated(
        uint256 indexed splitId,
        address indexed creator,
        uint256 totalAmount,
        uint256 participantCount,
        bool allowPartialWithdraw,
        string title
    );

    event SharePaid(
        uint256 indexed splitId,
        address indexed participant,
        address indexed payer,
        uint256 amount,
        uint256 paidCount,
        uint256 participantCount
    );

    /// @notice Emitted the moment the last outstanding share lands. This is the
    ///         hook the mini-app listens on to push "everyone has paid".
    event SplitFunded(uint256 indexed splitId, uint256 totalAmount);

    event Withdrawn(uint256 indexed splitId, address indexed creator, uint256 netAmount, uint256 feeAmount);

    event SplitCancelled(uint256 indexed splitId, uint256 amountRefundable);

    event RefundClaimed(uint256 indexed splitId, address indexed participant, uint256 amount);

    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error Unauthorized();
    error ZeroAddress();
    error TokenNotAContract();
    error NoParticipants();
    error TooManyParticipants();
    error LengthMismatch();
    error DuplicateParticipant(address participant);
    error ZeroShare(address participant);
    error TotalTooLarge();
    error TitleTooLong();
    error SplitDoesNotExist(uint256 splitId);
    error SplitNotOpen(uint256 splitId);
    error SplitNotCancelled(uint256 splitId);
    error NotCreator(uint256 splitId);
    error NotParticipant(uint256 splitId, address account);
    error AlreadyPaid(uint256 splitId, address participant);
    error NotFullyPaid(uint256 splitId, uint256 amountPaid, uint256 totalAmount);
    error NothingToWithdraw(uint256 splitId);
    error AlreadyWithdrawn(uint256 splitId);
    error NothingToRefund(uint256 splitId, address participant);
    error Reentrancy();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyLock != 1) revert Reentrancy();
        _reentrancyLock = 2;
        _;
        _reentrancyLock = 1;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param token_ USDC on the target chain.
    /// @param owner_ Contract owner. Also the initial fee treasury.
    constructor(address token_, address owner_) {
        if (token_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        if (token_.code.length == 0) revert TokenNotAContract();

        token = IERC20(token_);
        owner = owner_;
        treasury = owner_;

        emit OwnershipTransferred(address(0), owner_);
        emit TreasuryUpdated(address(0), owner_);
    }

    /*//////////////////////////////////////////////////////////////
                             CREATING SPLITS
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a split where each participant owes a specific amount.
    /// @param title Human-readable label, e.g. "Dinner at Septime".
    /// @param participants Addresses that owe money. Must be unique and non-zero.
    /// @param shares What each participant owes, in USDC base units (6 dp).
    /// @param allowPartialWithdraw If true the creator may withdraw whatever has
    ///        arrived before everyone has paid. If false — the default the UI
    ///        uses for a bill — `withdraw` reverts until the split is funded.
    /// @return splitId Id of the new split.
    function createSplit(
        string calldata title,
        address[] calldata participants,
        uint96[] calldata shares,
        bool allowPartialWithdraw
    ) external returns (uint256 splitId) {
        if (participants.length != shares.length) revert LengthMismatch();
        return _createSplit(title, participants, shares, allowPartialWithdraw);
    }

    /// @notice Create a split that divides `totalAmount` evenly.
    /// @dev Integer division leaves a remainder of at most `participants.length - 1`
    ///      base units (millionths of a dollar). Those units are handed out one
    ///      each to the participants at the front of the list, so the shares add
    ///      up to `totalAmount` exactly and no dust is stranded.
    /// @param totalAmount Total to divide, in USDC base units.
    function createEvenSplit(
        string calldata title,
        address[] calldata participants,
        uint96 totalAmount,
        bool allowPartialWithdraw
    ) external returns (uint256 splitId) {
        uint256 n = participants.length;
        if (n == 0) revert NoParticipants();
        if (n > MAX_PARTICIPANTS) revert TooManyParticipants();
        if (totalAmount < n) revert ZeroShare(participants[n - 1]);

        uint96[] memory shares = new uint96[](n);
        // Dividing a uint96 by a positive integer cannot exceed a uint96.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint96 base = uint96(totalAmount / n);
        uint256 remainder = totalAmount % n;

        for (uint256 i; i < n; ++i) {
            shares[i] = i < remainder ? base + 1 : base;
        }

        return _createSplit(title, participants, shares, allowPartialWithdraw);
    }

    function _createSplit(
        string calldata title,
        address[] calldata participants,
        uint96[] memory shares,
        bool allowPartialWithdraw
    ) private returns (uint256 splitId) {
        if (participants.length == 0) revert NoParticipants();
        if (participants.length > MAX_PARTICIPANTS) revert TooManyParticipants();
        if (bytes(title).length > MAX_TITLE_BYTES) revert TitleTooLong();

        splitId = splitCount++;

        uint256 total = _registerParticipants(splitId, participants, shares);
        if (total > type(uint96).max) revert TotalTooLarge();

        // Scoped so the storage pointer is off the stack before the event.
        {
            Split storage split = _splits[splitId];
            split.creator = msg.sender;
            // Bounded by the `TotalTooLarge` check immediately above.
            // forge-lint: disable-next-line(unsafe-typecast)
            split.totalAmount = uint96(total);
            split.createdAt = uint32(block.timestamp);
            split.participantCount = uint16(participants.length);
            split.allowPartialWithdraw = allowPartialWithdraw;
            split.status = SplitStatus.Open;
            split.title = title;
        }

        _createdSplits[msg.sender].push(splitId);

        emit SplitCreated(splitId, msg.sender, total, participants.length, allowPartialWithdraw, title);
    }

    /// @dev Writes the roster and returns the sum of the shares. Split out of
    ///      `_createSplit` to keep both frames within the EVM's reachable stack.
    function _registerParticipants(uint256 splitId, address[] calldata participants, uint96[] memory shares)
        private
        returns (uint256 total)
    {
        address[] storage list = _participantList[splitId];
        mapping(address => Participant) storage byAddress = _participants[splitId];

        for (uint256 i; i < participants.length; ++i) {
            address account = participants[i];
            uint96 share = shares[i];

            if (account == address(0)) revert ZeroAddress();
            if (share == 0) revert ZeroShare(account);
            if (byAddress[account].share != 0) revert DuplicateParticipant(account);

            byAddress[account].share = share;
            list.push(account);
            _joinedSplits[account].push(splitId);

            total += share;
        }
    }

    /*//////////////////////////////////////////////////////////////
                                 PAYING
    //////////////////////////////////////////////////////////////*/

    /// @notice Pay your own share. The one-tap path in the mini-app.
    /// @dev Requires a prior USDC approval to this contract.
    function pay(uint256 splitId) external {
        _pay(splitId, msg.sender);
    }

    /// @notice Pay someone else's share — "I'll spot you". The USDC comes out of
    ///         `msg.sender`, and the share is credited to `participant`, who is
    ///         the one entitled to a refund if the split is later cancelled.
    function payFor(uint256 splitId, address participant) external {
        _pay(splitId, participant);
    }

    function _pay(uint256 splitId, address participant) private nonReentrant {
        Split storage split = _splits[splitId];
        _requireExists(split, splitId);
        if (split.status != SplitStatus.Open) revert SplitNotOpen(splitId);

        Participant storage entry = _participants[splitId][participant];
        uint96 share = entry.share;
        if (share == 0) revert NotParticipant(splitId, participant);
        if (entry.paid) revert AlreadyPaid(splitId, participant);

        entry.paid = true;

        uint96 amountPaid = split.amountPaid + share;
        uint16 paidCount = split.paidCount + 1;
        split.amountPaid = amountPaid;
        split.paidCount = paidCount;

        token.safeTransferFrom(msg.sender, address(this), share);

        emit SharePaid(splitId, participant, msg.sender, share, paidCount, split.participantCount);

        if (paidCount == split.participantCount) {
            emit SplitFunded(splitId, split.totalAmount);
        }
    }

    /*//////////////////////////////////////////////////////////////
                              WITHDRAWING
    //////////////////////////////////////////////////////////////*/

    /// @notice What the creator would receive and what the protocol would take,
    ///         if `withdraw` were called right now.
    /// @dev The UI calls this before showing the confirm sheet, so the fee is on
    ///      screen before anybody signs anything.
    /// @return net Amount that reaches the creator.
    /// @return fee Amount that reaches the treasury.
    function quoteWithdrawal(uint256 splitId) external view returns (uint256 net, uint256 fee) {
        Split storage split = _splits[splitId];
        _requireExists(split, splitId);
        return _quote(split.amountPaid - split.amountWithdrawn);
    }

    /// @notice Fee and net for an arbitrary gross amount. Pure helper for the UI.
    function previewFee(uint256 grossAmount) external pure returns (uint256 net, uint256 fee) {
        return _quote(grossAmount);
    }

    function _quote(uint256 gross) private pure returns (uint256 net, uint256 fee) {
        fee = (gross * WITHDRAWAL_FEE_BPS) / BPS_DENOMINATOR;
        net = gross - fee;
    }

    /// @notice Creator pulls out everything collected so far.
    /// @dev Reverts unless the split is fully paid, unless it was created with
    ///      `allowPartialWithdraw`. The 0.5% fee is applied here and only here.
    function withdraw(uint256 splitId) external nonReentrant returns (uint256 net, uint256 fee) {
        Split storage split = _splits[splitId];
        _requireExists(split, splitId);
        if (msg.sender != split.creator) revert NotCreator(splitId);
        if (split.status != SplitStatus.Open) revert SplitNotOpen(splitId);

        uint96 amountPaid = split.amountPaid;
        uint96 available = amountPaid - split.amountWithdrawn;
        if (available == 0) revert NothingToWithdraw(splitId);

        if (amountPaid < split.totalAmount) {
            if (!split.allowPartialWithdraw) {
                revert NotFullyPaid(splitId, amountPaid, split.totalAmount);
            }
        }

        split.amountWithdrawn = amountPaid;

        (net, fee) = _quote(available);

        if (fee != 0) token.safeTransfer(treasury, fee);
        token.safeTransfer(split.creator, net);

        emit Withdrawn(splitId, split.creator, net, fee);
    }

    /*//////////////////////////////////////////////////////////////
                           CANCELLING & REFUNDS
    //////////////////////////////////////////////////////////////*/

    /// @notice Creator calls off a split. Payments stop; everyone who already
    ///         paid can claim a full, fee-free refund.
    /// @dev Only possible while nothing has been withdrawn — once the creator
    ///      has taken money out, the split is settled and cannot be unwound.
    function cancel(uint256 splitId) external {
        Split storage split = _splits[splitId];
        _requireExists(split, splitId);
        if (msg.sender != split.creator) revert NotCreator(splitId);
        if (split.status != SplitStatus.Open) revert SplitNotOpen(splitId);
        if (split.amountWithdrawn != 0) revert AlreadyWithdrawn(splitId);

        split.status = SplitStatus.Cancelled;

        emit SplitCancelled(splitId, split.amountPaid);
    }

    /// @notice Take back what you paid into a cancelled split.
    function claimRefund(uint256 splitId) external nonReentrant returns (uint256 amount) {
        Split storage split = _splits[splitId];
        _requireExists(split, splitId);
        if (split.status != SplitStatus.Cancelled) revert SplitNotCancelled(splitId);

        Participant storage entry = _participants[splitId][msg.sender];
        if (entry.share == 0) revert NotParticipant(splitId, msg.sender);
        if (!entry.paid || entry.refunded) revert NothingToRefund(splitId, msg.sender);

        entry.refunded = true;
        amount = entry.share;

        // `amount` was read out of a uint96 field, so it round-trips exactly.
        // forge-lint: disable-next-line(unsafe-typecast)
        split.amountPaid -= uint96(amount);
        split.paidCount -= 1;

        token.safeTransfer(msg.sender, amount);

        emit RefundClaimed(splitId, msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice Everything the split screen needs, in one call.
    function getSplit(uint256 splitId) external view returns (SplitView memory view_) {
        Split storage split = _splits[splitId];
        _requireExists(split, splitId);

        address[] storage list = _participantList[splitId];
        uint256 n = list.length;

        uint256[] memory shares = new uint256[](n);
        bool[] memory paidFlags = new bool[](n);
        address[] memory participants = new address[](n);

        mapping(address => Participant) storage byAddress = _participants[splitId];
        for (uint256 i; i < n; ++i) {
            address account = list[i];
            participants[i] = account;
            shares[i] = byAddress[account].share;
            paidFlags[i] = byAddress[account].paid;
        }

        view_ = SplitView({
            id: splitId,
            creator: split.creator,
            title: split.title,
            totalAmount: split.totalAmount,
            amountPaid: split.amountPaid,
            amountWithdrawn: split.amountWithdrawn,
            createdAt: split.createdAt,
            participantCount: split.participantCount,
            paidCount: split.paidCount,
            allowPartialWithdraw: split.allowPartialWithdraw,
            status: split.status,
            participants: participants,
            shares: shares,
            paidFlags: paidFlags
        });
    }

    /// @notice Batch version of `getSplit`, for the history screen.
    function getSplits(uint256[] calldata splitIds) external view returns (SplitView[] memory out) {
        out = new SplitView[](splitIds.length);
        for (uint256 i; i < splitIds.length; ++i) {
            out[i] = this.getSplit(splitIds[i]);
        }
    }

    /// @notice The participant roster, in creation order.
    /// @dev Feeds "run it back with the same group" — read the list, pass it
    ///      straight into `createEvenSplit`.
    function getParticipants(uint256 splitId) external view returns (address[] memory) {
        return _participantList[splitId];
    }

    function getParticipant(uint256 splitId, address account)
        external
        view
        returns (uint256 share, bool paid, bool refunded)
    {
        Participant storage entry = _participants[splitId][account];
        return (entry.share, entry.paid, entry.refunded);
    }

    /// @notice True when every participant has paid.
    function isFullyPaid(uint256 splitId) external view returns (bool) {
        Split storage split = _splits[splitId];
        return split.status != SplitStatus.None && split.amountPaid >= split.totalAmount;
    }

    /// @notice What `account` still owes on this split. Zero if they have paid,
    ///         or are not in it.
    function amountOwed(uint256 splitId, address account) external view returns (uint256) {
        Participant storage entry = _participants[splitId][account];
        return entry.paid ? 0 : entry.share;
    }

    /// @notice Ids of splits `account` created, newest last.
    function splitsCreatedBy(address account) external view returns (uint256[] memory) {
        return _createdSplits[account];
    }

    /// @notice Ids of splits `account` was invited to, newest last.
    function splitsJoinedBy(address account) external view returns (uint256[] memory) {
        return _joinedSplits[account];
    }

    function splitsCreatedCount(address account) external view returns (uint256) {
        return _createdSplits[account].length;
    }

    function splitsJoinedCount(address account) external view returns (uint256) {
        return _joinedSplits[account].length;
    }

    function _requireExists(Split storage split, uint256 splitId) private view {
        if (split.status == SplitStatus.None) revert SplitDoesNotExist(splitId);
    }

    /*//////////////////////////////////////////////////////////////
                              ADMINISTRATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Point the withdrawal fee at a different address.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Begin handing over ownership. `newOwner` must call `acceptOwnership`.
    /// @dev Two-step on purpose: a fat-fingered address cannot brick the fee
    ///      controls, because an address that never accepts never becomes owner.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Complete the handover started by `transferOwnership`.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
}
