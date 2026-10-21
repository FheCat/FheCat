// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FHE, ebool, euint64, externalEuint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title FheLaunchToken: one token, two modes
/// @notice A plain ERC-20 whose holders can also keep a shielded balance, encrypted with Fhenix FHE.
///
/// The public side is an ordinary ERC-20 (wallets, explorers, DEXes). Shielding moves an amount
/// from the public balance into the holder's encrypted balance; from there it can be sent to anyone
/// without the amount ever showing on-chain. Unshielding is two steps: the holder asks for an
/// encrypted amount to come out, the CoFHE threshold network decrypts that one amount, and anyone
/// can then publish the decryption with its proof to credit the public balance.
///
/// A shielded transfer that asks for more than the sender holds moves nothing: the contract cannot
/// know (and must not reveal) that it failed, so it moves an encrypted zero instead.
contract FheLaunchToken is ERC20 {
    /// @notice The launchpad that minted the supply; the only one allowed to credit shielded balances directly.
    address public immutable launchpad;

    mapping(address => euint64) private _shielded;

    struct Unshield {
        address to;
        euint64 amount;
        bool done;
    }

    /// @notice Pending and finished unshield requests.
    mapping(uint256 => Unshield) public unshields;
    uint256 public unshieldCount;

    event Shielded(address indexed account, uint256 amount);
    event ShieldedTransfer(address indexed from, address indexed to);
    event UnshieldRequested(uint256 indexed id, address indexed account, bytes32 amountHandle);
    event Unshielded(uint256 indexed id, address indexed account, uint256 amount);

    error NotLaunchpad();
    error AmountTooLarge();
    error UnknownUnshield(uint256 id);
    error AlreadyUnshielded(uint256 id);
    error InvalidDecryptionProof(uint256 id);

    constructor(string memory name_, string memory symbol_, uint256 supply, address launchpad_) ERC20(name_, symbol_) {
        launchpad = launchpad_;
        _mint(launchpad_, supply);
    }

    /// @notice 6 decimals, so every balance fits the 64-bit encrypted integers FHE works on.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice The ciphertext of an account's shielded balance (0 until it first holds one).
    ///         Only the account (and this contract) may decrypt it.
    function shieldedBalanceOf(address account) external view returns (bytes32) {
        return euint64.unwrap(_shielded[account]);
    }

    /// @notice Move `amount` of your public balance into your shielded balance.
    function shield(uint256 amount) external {
        if (amount > type(uint64).max) revert AmountTooLarge();
        _burn(msg.sender, amount);
        _credit(msg.sender, FHE.asEuint64(amount));
        emit Shielded(msg.sender, amount);
    }

    /// @notice The launchpad pays a buyer's tokens straight into their shielded balance.
    function shieldFor(address to, uint256 amount) external {
        if (msg.sender != launchpad) revert NotLaunchpad();
        if (amount > type(uint64).max) revert AmountTooLarge();
        _burn(msg.sender, amount);
        _credit(to, FHE.asEuint64(amount));
        emit Shielded(to, amount);
    }

    /// @notice Send an encrypted amount from your shielded balance to `to`'s. Nobody sees how much.
    function transferShielded(address to, externalEuint64 amount, bytes calldata proof) external {
        euint64 moved = _debit(msg.sender, FHE.asEuint64(amount, proof));
        _credit(to, moved);
        emit ShieldedTransfer(msg.sender, to);
    }

    /// @notice Ask for an encrypted amount to come out of your shielded balance. It is taken out now
    ///         (an encrypted zero if you hold less) and made decryptable, so `finishUnshield` can
    ///         credit it to your public balance.
    function unshield(externalEuint64 amount, bytes calldata proof) external returns (uint256 id) {
        euint64 out = _debit(msg.sender, FHE.asEuint64(amount, proof));
        FHE.allowPublic(out);
        id = ++unshieldCount;
        unshields[id] = Unshield({to: msg.sender, amount: out, done: false});
        emit UnshieldRequested(id, msg.sender, euint64.unwrap(out));
    }

    /// @notice Publish an unshield's decrypted amount with the threshold network's proof. Anyone can.
    function finishUnshield(uint256 id, uint64 amount, bytes calldata signature) external {
        Unshield storage u = unshields[id];
        if (u.to == address(0)) revert UnknownUnshield(id);
        if (u.done) revert AlreadyUnshielded(id);
        if (!FHE.verifyDecryptResultSafe(u.amount, amount, signature)) revert InvalidDecryptionProof(id);
        u.done = true;
        _mint(u.to, amount);
        emit Unshielded(id, u.to, amount);
    }

    /// @dev Takes `amount` from `from`'s shielded balance, or nothing if that is more than it holds.
    function _debit(address from, euint64 amount) private returns (euint64 moved) {
        euint64 balance = _balanceOrZero(from);
        ebool enough = FHE.lte(amount, balance);
        moved = FHE.select(enough, amount, FHE.asEuint64(0));
        euint64 left = FHE.sub(balance, moved);
        _store(from, left);
        FHE.allowThis(moved);
    }

    function _credit(address to, euint64 amount) private {
        _store(to, FHE.add(_balanceOrZero(to), amount));
    }

    function _store(address account, euint64 balance) private {
        FHE.allowThis(balance);
        FHE.allow(balance, account);
        _shielded[account] = balance;
    }

    function _balanceOrZero(address account) private returns (euint64) {
        euint64 balance = _shielded[account];
        return FHE.isInitialized(balance) ? balance : FHE.asEuint64(0);
    }
}
