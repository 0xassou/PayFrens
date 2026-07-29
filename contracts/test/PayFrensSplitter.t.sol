// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PayFrensSplitter} from "../src/PayFrensSplitter.sol";
import {SafeERC20} from "../src/libraries/SafeERC20.sol";
import {FalseReturningToken, MockUSDC, NoReturnToken} from "./mocks/MockUSDC.sol";
import {Test} from "forge-std/Test.sol";

contract PayFrensSplitterTest is Test {
    PayFrensSplitter internal splitter;
    MockUSDC internal usdc;

    address internal treasury = address(0xFEE);
    address internal creator = address(0xC12A);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);
    address internal stranger = address(0x5747A);

    /// @dev 1 USDC, in base units.
    uint96 internal constant ONE = 1e6;

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
    event SplitFunded(uint256 indexed splitId, uint256 totalAmount);
    event Withdrawn(uint256 indexed splitId, address indexed creator, uint256 netAmount, uint256 feeAmount);
    event SplitCancelled(uint256 indexed splitId, uint256 amountRefundable);
    event RefundClaimed(uint256 indexed splitId, address indexed participant, uint256 amount);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public {
        usdc = new MockUSDC();
        splitter = new PayFrensSplitter(address(usdc), treasury);

        address[4] memory funded = [alice, bob, carol, creator];
        for (uint256 i; i < funded.length; ++i) {
            usdc.mint(funded[i], 1_000 * ONE);
            vm.prank(funded[i]);
            usdc.approve(address(splitter), type(uint256).max);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    function _trio() internal view returns (address[] memory p) {
        p = new address[](3);
        p[0] = alice;
        p[1] = bob;
        p[2] = carol;
    }

    /// @dev A 3-way even split of 30 USDC — 10 each.
    function _createEven30() internal returns (uint256 id) {
        vm.prank(creator);
        id = splitter.createEvenSplit("Dinner", _trio(), 30 * ONE, false);
    }

    function _payAll(uint256 id) internal {
        address[] memory p = _trio();
        for (uint256 i; i < p.length; ++i) {
            vm.prank(p[i]);
            splitter.pay(id);
        }
    }

    /*//////////////////////////////////////////////////////////////
                              DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

    function test_Deployment_SetsTokenOwnerAndTreasury() public view {
        assertEq(address(splitter.token()), address(usdc));
        assertEq(splitter.owner(), treasury);
        assertEq(splitter.treasury(), treasury);
        assertEq(splitter.splitCount(), 0);
        assertEq(splitter.WITHDRAWAL_FEE_BPS(), 50);
    }

    function test_Deployment_RevertsOnZeroToken() public {
        vm.expectRevert(PayFrensSplitter.ZeroAddress.selector);
        new PayFrensSplitter(address(0), treasury);
    }

    function test_Deployment_RevertsOnZeroOwner() public {
        vm.expectRevert(PayFrensSplitter.ZeroAddress.selector);
        new PayFrensSplitter(address(usdc), address(0));
    }

    function test_Deployment_RevertsWhenTokenIsNotAContract() public {
        vm.expectRevert(PayFrensSplitter.TokenNotAContract.selector);
        new PayFrensSplitter(address(0xDEAD), treasury);
    }

    /*//////////////////////////////////////////////////////////////
                           CREATING — NOMINAL
    //////////////////////////////////////////////////////////////*/

    function test_CreateEvenSplit_DividesEvenly() public {
        uint256 id = _createEven30();

        PayFrensSplitter.SplitView memory s = splitter.getSplit(id);
        assertEq(s.id, 0);
        assertEq(s.creator, creator);
        assertEq(s.title, "Dinner");
        assertEq(s.totalAmount, 30 * ONE);
        assertEq(s.amountPaid, 0);
        assertEq(s.participantCount, 3);
        assertEq(s.paidCount, 0);
        assertEq(uint8(s.status), uint8(PayFrensSplitter.SplitStatus.Open));
        assertEq(s.participants.length, 3);
        assertEq(s.shares[0], 10 * ONE);
        assertEq(s.shares[1], 10 * ONE);
        assertEq(s.shares[2], 10 * ONE);
        assertEq(splitter.splitCount(), 1);
    }

    /// @dev 100.000001 USDC over 3 people leaves 2 base units. They go to the
    ///      first two participants so the shares still add up exactly.
    function test_CreateEvenSplit_SpreadsRemainderAcrossFirstParticipants() public {
        uint96 total = 100_000_001;
        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Rent", _trio(), total, false);

        PayFrensSplitter.SplitView memory s = splitter.getSplit(id);
        assertEq(s.shares[0], 33_333_334);
        assertEq(s.shares[1], 33_333_334);
        assertEq(s.shares[2], 33_333_333);
        assertEq(s.shares[0] + s.shares[1] + s.shares[2], total);
        assertEq(s.totalAmount, total);
    }

    function test_CreateSplit_HonoursCustomShares() public {
        address[] memory p = _trio();
        uint96[] memory shares = new uint96[](3);
        shares[0] = 5 * ONE;
        shares[1] = 15 * ONE;
        shares[2] = 30 * ONE;

        vm.prank(creator);
        uint256 id = splitter.createSplit("Ski trip", p, shares, false);

        PayFrensSplitter.SplitView memory s = splitter.getSplit(id);
        assertEq(s.totalAmount, 50 * ONE);
        assertEq(s.shares[1], 15 * ONE);
        assertEq(splitter.amountOwed(id, carol), 30 * ONE);
    }

    function test_CreateSplit_EmitsSplitCreated() public {
        vm.expectEmit(true, true, false, true);
        emit SplitCreated(0, creator, 30 * ONE, 3, false, "Dinner");

        vm.prank(creator);
        splitter.createEvenSplit("Dinner", _trio(), 30 * ONE, false);
    }

    function test_CreateSplit_IdsIncrementIndependentlyPerCreator() public {
        _createEven30();

        vm.prank(alice);
        uint256 second = splitter.createEvenSplit("Brunch", _trio(), 9 * ONE, false);

        assertEq(second, 1);
        assertEq(splitter.splitCount(), 2);
        assertEq(splitter.splitsCreatedBy(creator).length, 1);
        assertEq(splitter.splitsCreatedBy(alice).length, 1);
    }

    function test_CreateSplit_CreatorMayAlsoBeAParticipant() public {
        address[] memory p = new address[](2);
        p[0] = creator;
        p[1] = alice;

        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Taxi", p, 20 * ONE, false);

        assertEq(splitter.amountOwed(id, creator), 10 * ONE);

        vm.prank(creator);
        splitter.pay(id);

        (, bool paid,) = splitter.getParticipant(id, creator);
        assertTrue(paid);
    }

    function test_CreateSplit_IndexesHistoryForCreatorAndParticipants() public {
        uint256 id = _createEven30();

        uint256[] memory created = splitter.splitsCreatedBy(creator);
        assertEq(created.length, 1);
        assertEq(created[0], id);

        uint256[] memory joined = splitter.splitsJoinedBy(alice);
        assertEq(joined.length, 1);
        assertEq(joined[0], id);

        assertEq(splitter.splitsJoinedBy(stranger).length, 0);
        assertEq(splitter.splitsCreatedCount(creator), 1);
        assertEq(splitter.splitsJoinedCount(bob), 1);
    }

    /// @dev "Run it back with the same group": read the roster off the old split
    ///      and hand it straight to a new one.
    function test_CreateSplit_RosterCanSeedAFollowUpSplit() public {
        uint256 first = _createEven30();
        address[] memory sameGroup = splitter.getParticipants(first);

        vm.prank(creator);
        uint256 second = splitter.createEvenSplit("Dinner, again", sameGroup, 60 * ONE, false);

        PayFrensSplitter.SplitView memory s = splitter.getSplit(second);
        assertEq(s.participants[0], alice);
        assertEq(s.participants[2], carol);
        assertEq(s.shares[0], 20 * ONE);
    }

    /*//////////////////////////////////////////////////////////////
                          CREATING — EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function test_CreateSplit_RevertsOnDuplicateParticipant() public {
        address[] memory p = new address[](2);
        p[0] = alice;
        p[1] = alice;

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.DuplicateParticipant.selector, alice));
        vm.prank(creator);
        splitter.createEvenSplit("Dupe", p, 10 * ONE, false);
    }

    function test_CreateSplit_RevertsOnZeroAddressParticipant() public {
        address[] memory p = new address[](2);
        p[0] = alice;
        p[1] = address(0);

        vm.expectRevert(PayFrensSplitter.ZeroAddress.selector);
        vm.prank(creator);
        splitter.createEvenSplit("Void", p, 10 * ONE, false);
    }

    function test_CreateSplit_RevertsOnEmptyParticipantList() public {
        address[] memory p = new address[](0);

        vm.expectRevert(PayFrensSplitter.NoParticipants.selector);
        vm.prank(creator);
        splitter.createEvenSplit("Nobody", p, 10 * ONE, false);
    }

    function test_CreateSplit_RevertsWhenSharesLengthDiffers() public {
        address[] memory p = _trio();
        uint96[] memory shares = new uint96[](2);
        shares[0] = ONE;
        shares[1] = ONE;

        vm.expectRevert(PayFrensSplitter.LengthMismatch.selector);
        vm.prank(creator);
        splitter.createSplit("Mismatch", p, shares, false);
    }

    function test_CreateSplit_RevertsOnZeroShare() public {
        address[] memory p = _trio();
        uint96[] memory shares = new uint96[](3);
        shares[0] = ONE;
        shares[1] = 0;
        shares[2] = ONE;

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.ZeroShare.selector, bob));
        vm.prank(creator);
        splitter.createSplit("Freeloader", p, shares, false);
    }

    /// @dev An even split can't give everyone at least one base unit if the
    ///      total is smaller than the group.
    function test_CreateEvenSplit_RevertsWhenTotalIsSmallerThanGroup() public {
        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.ZeroShare.selector, carol));
        vm.prank(creator);
        splitter.createEvenSplit("Dust", _trio(), 2, false);
    }

    function test_CreateSplit_RevertsAboveMaxParticipants() public {
        uint256 n = splitter.MAX_PARTICIPANTS() + 1;
        address[] memory p = new address[](n);
        for (uint256 i; i < n; ++i) {
            p[i] = address(uint160(i + 1));
        }

        vm.expectRevert(PayFrensSplitter.TooManyParticipants.selector);
        vm.prank(creator);
        splitter.createEvenSplit("Stadium", p, uint96(n) * ONE, false);
    }

    function test_CreateSplit_AcceptsExactlyMaxParticipants() public {
        uint256 n = splitter.MAX_PARTICIPANTS();
        address[] memory p = new address[](n);
        for (uint256 i; i < n; ++i) {
            p[i] = address(uint160(i + 1));
        }

        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Full house", p, uint96(n) * ONE, false);
        assertEq(splitter.getSplit(id).participantCount, n);
    }

    function test_CreateSplit_RevertsOnOverlongTitle() public {
        string memory long = new string(splitter.MAX_TITLE_BYTES() + 1);

        vm.expectRevert(PayFrensSplitter.TitleTooLong.selector);
        vm.prank(creator);
        splitter.createEvenSplit(long, _trio(), 3 * ONE, false);
    }

    function test_CreateSplit_RevertsWhenTotalOverflowsUint96() public {
        address[] memory p = new address[](2);
        p[0] = alice;
        p[1] = bob;

        uint96[] memory shares = new uint96[](2);
        shares[0] = type(uint96).max;
        shares[1] = 1;

        vm.expectRevert(PayFrensSplitter.TotalTooLarge.selector);
        vm.prank(creator);
        splitter.createSplit("Too big", p, shares, false);
    }

    /*//////////////////////////////////////////////////////////////
                            PAYING — NOMINAL
    //////////////////////////////////////////////////////////////*/

    function test_Pay_MovesExactShareAndTakesNoFee() public {
        uint256 id = _createEven30();

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        splitter.pay(id);

        // The participant is debited their share and not a base unit more —
        // the protocol fee never touches the people paying.
        assertEq(usdc.balanceOf(alice), aliceBefore - 10 * ONE);
        assertEq(usdc.balanceOf(address(splitter)), 10 * ONE);
        assertEq(usdc.balanceOf(treasury), 0);

        PayFrensSplitter.SplitView memory s = splitter.getSplit(id);
        assertEq(s.amountPaid, 10 * ONE);
        assertEq(s.paidCount, 1);
        assertTrue(s.paidFlags[0]);
        assertFalse(s.paidFlags[1]);
        assertEq(splitter.amountOwed(id, alice), 0);
        assertEq(splitter.amountOwed(id, bob), 10 * ONE);
    }

    function test_Pay_EmitsSharePaid() public {
        uint256 id = _createEven30();

        vm.expectEmit(true, true, true, true);
        emit SharePaid(id, alice, alice, 10 * ONE, 1, 3);

        vm.prank(alice);
        splitter.pay(id);
    }

    function test_Pay_EmitsSplitFundedOnTheLastShare() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.pay(id);
        vm.prank(bob);
        splitter.pay(id);

        vm.expectEmit(true, false, false, true);
        emit SplitFunded(id, 30 * ONE);

        vm.prank(carol);
        splitter.pay(id);

        assertTrue(splitter.isFullyPaid(id));
    }

    function test_Pay_DoesNotReportFundedEarly() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.pay(id);
        vm.prank(bob);
        splitter.pay(id);

        // Two of three: still short, so the "everyone has paid" push must not
        // fire and the creator must not be able to withdraw.
        assertFalse(splitter.isFullyPaid(id));
        assertEq(splitter.getSplit(id).paidCount, 2);
        assertEq(splitter.amountOwed(id, carol), 10 * ONE);
    }

    function test_PayFor_CreditsTheParticipantAndDebitsThePayer() public {
        uint256 id = _createEven30();

        uint256 creatorBefore = usdc.balanceOf(creator);
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.expectEmit(true, true, true, true);
        emit SharePaid(id, bob, creator, 10 * ONE, 1, 3);

        vm.prank(creator);
        splitter.payFor(id, bob);

        assertEq(usdc.balanceOf(creator), creatorBefore - 10 * ONE);
        assertEq(usdc.balanceOf(bob), bobBefore, "spotted friend pays nothing");

        (, bool paid,) = splitter.getParticipant(id, bob);
        assertTrue(paid);
    }

    /*//////////////////////////////////////////////////////////////
                          PAYING — EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function test_Pay_RevertsOnDoublePayment() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.pay(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.AlreadyPaid.selector, id, alice));
        vm.prank(alice);
        splitter.pay(id);
    }

    function test_PayFor_RevertsWhenTheShareIsAlreadySettled() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.pay(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.AlreadyPaid.selector, id, alice));
        vm.prank(creator);
        splitter.payFor(id, alice);
    }

    function test_Pay_RevertsForAnAddressNotInTheSplit() public {
        uint256 id = _createEven30();

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NotParticipant.selector, id, stranger));
        vm.prank(stranger);
        splitter.pay(id);
    }

    function test_PayFor_RevertsForAnAddressNotInTheSplit() public {
        uint256 id = _createEven30();

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NotParticipant.selector, id, stranger));
        vm.prank(creator);
        splitter.payFor(id, stranger);
    }

    function test_Pay_RevertsForAnUnknownSplitId() public {
        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.SplitDoesNotExist.selector, 42));
        vm.prank(alice);
        splitter.pay(42);
    }

    function test_Pay_RevertsAfterCancellation() public {
        uint256 id = _createEven30();

        vm.prank(creator);
        splitter.cancel(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.SplitNotOpen.selector, id));
        vm.prank(alice);
        splitter.pay(id);
    }

    function test_Pay_RevertsWithoutAllowance() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        usdc.approve(address(splitter), 0);

        vm.expectRevert(SafeERC20.TransferFromFailed.selector);
        vm.prank(alice);
        splitter.pay(id);
    }

    function test_Pay_RevertsWithoutBalance() public {
        address broke = address(0xB204E);
        address[] memory p = new address[](1);
        p[0] = broke;

        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Broke", p, 10 * ONE, false);

        vm.prank(broke);
        usdc.approve(address(splitter), type(uint256).max);

        vm.expectRevert(SafeERC20.TransferFromFailed.selector);
        vm.prank(broke);
        splitter.pay(id);
    }

    /// @dev A failed payment must leave no trace — the `paid` flag has to roll
    ///      back with the transfer, or the share would be marked settled for free.
    function test_Pay_LeavesNoStateBehindWhenTheTransferFails() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        usdc.approve(address(splitter), 0);

        vm.prank(alice);
        try splitter.pay(id) {
            revert("expected revert");
        } catch {}

        (, bool paid,) = splitter.getParticipant(id, alice);
        assertFalse(paid);
        assertEq(splitter.getSplit(id).amountPaid, 0);
        assertEq(splitter.getSplit(id).paidCount, 0);
    }

    /// @dev Two splits sharing the same participants must not bleed into each
    ///      other: paying one leaves the other untouched.
    function test_Pay_IsScopedToASingleSplit() public {
        uint256 first = _createEven30();
        vm.prank(creator);
        uint256 second = splitter.createEvenSplit("Drinks", _trio(), 60 * ONE, false);

        vm.prank(alice);
        splitter.pay(first);

        assertEq(splitter.amountOwed(first, alice), 0);
        assertEq(splitter.amountOwed(second, alice), 20 * ONE);
        assertEq(splitter.getSplit(second).amountPaid, 0);
    }

    /*//////////////////////////////////////////////////////////////
                         WITHDRAWING — NOMINAL
    //////////////////////////////////////////////////////////////*/

    function test_Withdraw_PaysCreatorNetAndTreasuryTheFee() public {
        uint256 id = _createEven30();
        _payAll(id);

        uint256 creatorBefore = usdc.balanceOf(creator);

        // 0.5% of 30 USDC = 0.15 USDC.
        uint256 expectedFee = 150_000;
        uint256 expectedNet = 30 * ONE - expectedFee;

        vm.expectEmit(true, true, false, true);
        emit Withdrawn(id, creator, expectedNet, expectedFee);

        vm.prank(creator);
        (uint256 net, uint256 fee) = splitter.withdraw(id);

        assertEq(fee, expectedFee);
        assertEq(net, expectedNet);
        assertEq(usdc.balanceOf(creator), creatorBefore + expectedNet);
        assertEq(usdc.balanceOf(treasury), expectedFee);
        assertEq(usdc.balanceOf(address(splitter)), 0, "contract fully drained");
        assertEq(splitter.getSplit(id).amountWithdrawn, 30 * ONE);
    }

    function test_QuoteWithdrawal_MatchesWhatWithdrawActuallyPays() public {
        uint256 id = _createEven30();
        _payAll(id);

        (uint256 quotedNet, uint256 quotedFee) = splitter.quoteWithdrawal(id);

        vm.prank(creator);
        (uint256 net, uint256 fee) = splitter.withdraw(id);

        assertEq(quotedNet, net);
        assertEq(quotedFee, fee);
        assertEq(quotedNet + quotedFee, 30 * ONE);
    }

    function test_PreviewFee_IsHalfAPercent() public view {
        (uint256 net, uint256 fee) = splitter.previewFee(1_000 * ONE);
        assertEq(fee, 5 * ONE);
        assertEq(net, 995 * ONE);
    }

    /// @dev Sub-200-base-unit withdrawals round the fee to zero. That is fine —
    ///      it must never round *up* and take more than 0.5%.
    function test_PreviewFee_RoundsDownAndNeverOvercharges() public view {
        (uint256 net, uint256 fee) = splitter.previewFee(199);
        assertEq(fee, 0);
        assertEq(net, 199);

        (, uint256 fee200) = splitter.previewFee(200);
        assertEq(fee200, 1);
    }

    function test_Withdraw_QuoteIsZeroBeforeAnybodyPays() public {
        uint256 id = _createEven30();
        (uint256 net, uint256 fee) = splitter.quoteWithdrawal(id);
        assertEq(net, 0);
        assertEq(fee, 0);
    }

    /*//////////////////////////////////////////////////////////////
                        WITHDRAWING — EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function test_Withdraw_RevertsBeforeEveryoneHasPaid() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.pay(id);

        vm.expectRevert(
            abi.encodeWithSelector(PayFrensSplitter.NotFullyPaid.selector, id, 10 * ONE, 30 * ONE)
        );
        vm.prank(creator);
        splitter.withdraw(id);
    }

    function test_Withdraw_RevertsForNonCreator() public {
        uint256 id = _createEven30();
        _payAll(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NotCreator.selector, id));
        vm.prank(alice);
        splitter.withdraw(id);
    }

    function test_Withdraw_RevertsOnSecondCall() public {
        uint256 id = _createEven30();
        _payAll(id);

        vm.prank(creator);
        splitter.withdraw(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NothingToWithdraw.selector, id));
        vm.prank(creator);
        splitter.withdraw(id);
    }

    function test_Withdraw_RevertsWhenNothingHasBeenPaid() public {
        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Empty", _trio(), 30 * ONE, true);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NothingToWithdraw.selector, id));
        vm.prank(creator);
        splitter.withdraw(id);
    }

    function test_Withdraw_RevertsForAnUnknownSplitId() public {
        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.SplitDoesNotExist.selector, 7));
        vm.prank(creator);
        splitter.withdraw(7);
    }

    function test_Withdraw_RevertsAfterCancellation() public {
        uint256 id = _createEven30();
        _payAll(id);

        vm.prank(creator);
        splitter.cancel(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.SplitNotOpen.selector, id));
        vm.prank(creator);
        splitter.withdraw(id);
    }

    /*//////////////////////////////////////////////////////////////
                          PARTIAL WITHDRAWAL
    //////////////////////////////////////////////////////////////*/

    function test_PartialWithdraw_LetsCreatorTakeWhatHasArrived() public {
        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Group gift", _trio(), 30 * ONE, true);

        vm.prank(alice);
        splitter.pay(id);

        uint256 creatorBefore = usdc.balanceOf(creator);

        vm.prank(creator);
        (uint256 net, uint256 fee) = splitter.withdraw(id);

        assertEq(fee, 50_000, "0.5% of 10 USDC");
        assertEq(net, 10 * ONE - 50_000);
        assertEq(usdc.balanceOf(creator), creatorBefore + net);
        assertEq(splitter.getSplit(id).amountWithdrawn, 10 * ONE);
    }

    /// @dev Withdrawing twice must charge the fee on each tranche once, never
    ///      twice on the same money.
    function test_PartialWithdraw_ChargesTheFeeOncePerTranche() public {
        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Group gift", _trio(), 30 * ONE, true);

        vm.prank(alice);
        splitter.pay(id);
        vm.prank(creator);
        splitter.withdraw(id);

        vm.prank(bob);
        splitter.pay(id);
        vm.prank(carol);
        splitter.pay(id);

        vm.prank(creator);
        (uint256 net, uint256 fee) = splitter.withdraw(id);

        assertEq(fee, 100_000, "0.5% of the remaining 20 USDC");
        assertEq(net, 20 * ONE - 100_000);

        // Total fee across both tranches is exactly 0.5% of 30 USDC.
        assertEq(usdc.balanceOf(treasury), 150_000);
        assertEq(usdc.balanceOf(address(splitter)), 0);
    }

    function test_PartialWithdraw_RevertsWhenTheTrancheIsEmpty() public {
        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Group gift", _trio(), 30 * ONE, true);

        vm.prank(alice);
        splitter.pay(id);
        vm.prank(creator);
        splitter.withdraw(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NothingToWithdraw.selector, id));
        vm.prank(creator);
        splitter.withdraw(id);
    }

    /*//////////////////////////////////////////////////////////////
                         CANCELLATION & REFUNDS
    //////////////////////////////////////////////////////////////*/

    function test_Cancel_OpensRefundsAndReturnsEveryCent() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.pay(id);
        vm.prank(bob);
        splitter.pay(id);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.expectEmit(true, false, false, true);
        emit SplitCancelled(id, 20 * ONE);
        vm.prank(creator);
        splitter.cancel(id);

        vm.expectEmit(true, true, false, true);
        emit RefundClaimed(id, alice, 10 * ONE);
        vm.prank(alice);
        uint256 refunded = splitter.claimRefund(id);

        // Refunds are fee-free: exactly what went in comes back out.
        assertEq(refunded, 10 * ONE);
        assertEq(usdc.balanceOf(alice), aliceBefore + 10 * ONE);
        assertEq(usdc.balanceOf(treasury), 0, "no fee on a refund");

        vm.prank(bob);
        splitter.claimRefund(id);
        assertEq(usdc.balanceOf(address(splitter)), 0);
        assertEq(splitter.getSplit(id).amountPaid, 0);
    }

    function test_Cancel_RevertsForNonCreator() public {
        uint256 id = _createEven30();

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NotCreator.selector, id));
        vm.prank(alice);
        splitter.cancel(id);
    }

    function test_Cancel_RevertsOnSecondCall() public {
        uint256 id = _createEven30();

        vm.prank(creator);
        splitter.cancel(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.SplitNotOpen.selector, id));
        vm.prank(creator);
        splitter.cancel(id);
    }

    /// @dev Once money has left, the split is settled — the creator cannot
    ///      cancel to claw back a refund from participants.
    function test_Cancel_RevertsAfterAnyWithdrawal() public {
        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Gift", _trio(), 30 * ONE, true);

        vm.prank(alice);
        splitter.pay(id);
        vm.prank(creator);
        splitter.withdraw(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.AlreadyWithdrawn.selector, id));
        vm.prank(creator);
        splitter.cancel(id);
    }

    function test_ClaimRefund_RevertsOnDoubleClaim() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.pay(id);
        vm.prank(creator);
        splitter.cancel(id);

        vm.prank(alice);
        splitter.claimRefund(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NothingToRefund.selector, id, alice));
        vm.prank(alice);
        splitter.claimRefund(id);
    }

    function test_ClaimRefund_RevertsForSomeoneWhoNeverPaid() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.pay(id);
        vm.prank(creator);
        splitter.cancel(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NothingToRefund.selector, id, bob));
        vm.prank(bob);
        splitter.claimRefund(id);
    }

    function test_ClaimRefund_RevertsForANonParticipant() public {
        uint256 id = _createEven30();

        vm.prank(creator);
        splitter.cancel(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NotParticipant.selector, id, stranger));
        vm.prank(stranger);
        splitter.claimRefund(id);
    }

    function test_ClaimRefund_RevertsWhileTheSplitIsStillOpen() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.pay(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.SplitNotCancelled.selector, id));
        vm.prank(alice);
        splitter.claimRefund(id);
    }

    /// @dev The spotted friend, not the payer, owns the refund. Alice fronts
    ///      Bob's share; on cancellation the money goes back to Bob, and Alice —
    ///      who is herself a participant but has not settled her own share — has
    ///      nothing to claim.
    function test_ClaimRefund_GoesToTheParticipantNotThePayer() public {
        uint256 id = _createEven30();

        vm.prank(alice);
        splitter.payFor(id, bob);

        vm.prank(creator);
        splitter.cancel(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NothingToRefund.selector, id, alice));
        vm.prank(alice);
        splitter.claimRefund(id);

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        splitter.claimRefund(id);
        assertEq(usdc.balanceOf(bob), bobBefore + 10 * ONE);
    }

    /// @dev And someone outside the split entirely is rejected earlier still.
    function test_ClaimRefund_RevertsForAnOutsidePayer() public {
        uint256 id = _createEven30();

        vm.prank(creator);
        splitter.payFor(id, bob);
        vm.prank(creator);
        splitter.cancel(id);

        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.NotParticipant.selector, id, creator));
        vm.prank(creator);
        splitter.claimRefund(id);
    }

    /*//////////////////////////////////////////////////////////////
                             ADMINISTRATION
    //////////////////////////////////////////////////////////////*/

    function test_SetTreasury_RedirectsFutureFees() public {
        address newTreasury = address(0x7E2);

        vm.expectEmit(true, true, false, false);
        emit TreasuryUpdated(treasury, newTreasury);
        vm.prank(treasury);
        splitter.setTreasury(newTreasury);

        assertEq(splitter.treasury(), newTreasury);

        uint256 id = _createEven30();
        _payAll(id);
        vm.prank(creator);
        splitter.withdraw(id);

        assertEq(usdc.balanceOf(newTreasury), 150_000);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_SetTreasury_RevertsForNonOwner() public {
        vm.expectRevert(PayFrensSplitter.Unauthorized.selector);
        vm.prank(alice);
        splitter.setTreasury(alice);
    }

    function test_SetTreasury_RevertsOnZeroAddress() public {
        vm.expectRevert(PayFrensSplitter.ZeroAddress.selector);
        vm.prank(treasury);
        splitter.setTreasury(address(0));
    }

    function test_TransferOwnership_RequiresTheNewOwnerToAccept() public {
        vm.prank(treasury);
        splitter.transferOwnership(alice);

        // Not owner yet.
        assertEq(splitter.owner(), treasury);
        assertEq(splitter.pendingOwner(), alice);

        vm.expectRevert(PayFrensSplitter.Unauthorized.selector);
        vm.prank(alice);
        splitter.setTreasury(alice);

        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(treasury, alice);
        vm.prank(alice);
        splitter.acceptOwnership();

        assertEq(splitter.owner(), alice);
        assertEq(splitter.pendingOwner(), address(0));
    }

    function test_AcceptOwnership_RevertsForAnyoneElse() public {
        vm.prank(treasury);
        splitter.transferOwnership(alice);

        vm.expectRevert(PayFrensSplitter.Unauthorized.selector);
        vm.prank(bob);
        splitter.acceptOwnership();
    }

    function test_TransferOwnership_RevertsForNonOwner() public {
        vm.expectRevert(PayFrensSplitter.Unauthorized.selector);
        vm.prank(alice);
        splitter.transferOwnership(alice);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function test_GetSplit_RevertsForAnUnknownId() public {
        vm.expectRevert(abi.encodeWithSelector(PayFrensSplitter.SplitDoesNotExist.selector, 99));
        splitter.getSplit(99);
    }

    function test_GetSplits_ReturnsABatch() public {
        uint256 first = _createEven30();
        vm.prank(alice);
        uint256 second = splitter.createEvenSplit("Brunch", _trio(), 9 * ONE, false);

        uint256[] memory ids = new uint256[](2);
        ids[0] = first;
        ids[1] = second;

        PayFrensSplitter.SplitView[] memory views = splitter.getSplits(ids);
        assertEq(views.length, 2);
        assertEq(views[0].creator, creator);
        assertEq(views[1].creator, alice);
        assertEq(views[1].totalAmount, 9 * ONE);
    }

    function test_IsFullyPaid_IsFalseForAnUnknownSplit() public view {
        assertFalse(splitter.isFullyPaid(1234));
    }

    function test_AmountOwed_IsZeroForANonParticipant() public {
        uint256 id = _createEven30();
        assertEq(splitter.amountOwed(id, stranger), 0);
    }

    /*//////////////////////////////////////////////////////////////
                              TOKEN SAFETY
    //////////////////////////////////////////////////////////////*/

    /// @dev A token that silently returns `false` must not be mistaken for a
    ///      successful payment.
    function test_SafeERC20_TreatsAFalseReturnAsFailure() public {
        FalseReturningToken bad = new FalseReturningToken();
        PayFrensSplitter s = new PayFrensSplitter(address(bad), treasury);

        address[] memory p = new address[](1);
        p[0] = alice;

        vm.prank(creator);
        uint256 id = s.createEvenSplit("Bad token", p, 10 * ONE, false);

        vm.expectRevert(SafeERC20.TransferFromFailed.selector);
        vm.prank(alice);
        s.pay(id);
    }

    /// @dev USDT-style tokens return nothing at all. That is still a success.
    function test_SafeERC20_AcceptsATokenThatReturnsNothing() public {
        NoReturnToken quiet = new NoReturnToken();
        PayFrensSplitter s = new PayFrensSplitter(address(quiet), treasury);

        quiet.mint(alice, 100 * ONE);
        vm.prank(alice);
        quiet.approve(address(s), type(uint256).max);

        address[] memory p = new address[](1);
        p[0] = alice;

        vm.prank(creator);
        uint256 id = s.createEvenSplit("Quiet token", p, 10 * ONE, false);

        vm.prank(alice);
        s.pay(id);

        assertEq(quiet.balanceOf(address(s)), 10 * ONE);
        assertTrue(s.isFullyPaid(id));
    }

    /*//////////////////////////////////////////////////////////////
                                 FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @dev However the money is divided, the creator plus the treasury always
    ///      receive exactly what the participants put in — the contract keeps
    ///      nothing, and conjures nothing.
    function testFuzz_WithdrawConservesValue(uint96 a, uint96 b, uint96 c) public {
        a = uint96(bound(a, 1, 1_000_000 * uint256(ONE)));
        b = uint96(bound(b, 1, 1_000_000 * uint256(ONE)));
        c = uint96(bound(c, 1, 1_000_000 * uint256(ONE)));

        address[] memory p = _trio();
        uint96[] memory shares = new uint96[](3);
        shares[0] = a;
        shares[1] = b;
        shares[2] = c;

        usdc.mint(alice, a);
        usdc.mint(bob, b);
        usdc.mint(carol, c);

        vm.prank(creator);
        uint256 id = splitter.createSplit("Fuzzed", p, shares, false);

        _payAll(id);

        uint256 total = uint256(a) + b + c;
        uint256 creatorBefore = usdc.balanceOf(creator);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(creator);
        (uint256 net, uint256 fee) = splitter.withdraw(id);

        assertEq(net + fee, total, "nothing stranded");
        assertEq(usdc.balanceOf(creator) - creatorBefore, net);
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, fee);
        assertEq(usdc.balanceOf(address(splitter)), 0);
    }

    /// @dev The fee is never more than 0.5%, at any size.
    function testFuzz_FeeNeverExceedsHalfAPercent(uint96 gross) public view {
        (uint256 net, uint256 fee) = splitter.previewFee(gross);
        assertEq(net + fee, gross);
        assertLe(fee * splitter.BPS_DENOMINATOR(), uint256(gross) * splitter.WITHDRAWAL_FEE_BPS());
    }

    /// @dev An even split always adds back up to the requested total, whatever
    ///      the remainder is.
    function testFuzz_EvenSplitSharesSumToTotal(uint96 total, uint8 count) public {
        uint256 n = bound(count, 1, splitter.MAX_PARTICIPANTS());
        total = uint96(bound(total, n, type(uint96).max));

        address[] memory p = new address[](n);
        for (uint256 i; i < n; ++i) {
            p[i] = address(uint160(i + 1));
        }

        vm.prank(creator);
        uint256 id = splitter.createEvenSplit("Fuzzed even", p, total, false);

        PayFrensSplitter.SplitView memory s = splitter.getSplit(id);

        uint256 sum;
        for (uint256 i; i < n; ++i) {
            assertGt(s.shares[i], 0, "every participant owes something");
            sum += s.shares[i];
        }
        assertEq(sum, total);
        assertEq(s.totalAmount, total);
    }
}
