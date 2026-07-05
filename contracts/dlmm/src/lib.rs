//! Stellar DLMM (Dynamic Liquidity Market Maker) — Soroban Smart Contract
//!
//! Implements discrete-bin AMM logic inspired by Meteora DLMM on Solana,
//! adapted for Stellar's Soroban execution environment.
//!
//! # Architecture
//!
//! Each pool contains:
//! - A set of *bins*, each with a constant price `P = 1.0001^bin_id`.
//! - Each bin holds reserves of tokenX and tokenY.
//! - Swaps traverse bins sequentially, filling each at its fixed price.
//! - Fees are dynamic: higher during volatile periods (see math::dynamic_fee).
//!
//! # Per-user positions (LP shares)
//!
//! Liquidity providers receive *shares* in each bin they deposit into. Shares
//! are minted proportional to the value added (measured in token Y terms) vs.
//! the bin's existing value. On removal, an LP redeems their shares for a
//! proportional slice of the bin's *current* reserves — which naturally
//! includes any swap fees the bin accrued while their liquidity sat there.
//! This means `remove_liquidity_bin` only ever returns the caller's own share,
//! never another LP's funds.
//!
//! # Storage layout (Soroban persistent storage, keyed by DataKey)
//!
//! Config              | PoolConfig struct
//! Active              | i32 (active bin ID)
//! LastTs              | u64 (Unix timestamp)
//! Bin(i32)            | BinReserves struct
//! AllBins             | Vec<i32> (every bin that has ever held liquidity)
//! Share(Address,i32)  | i128 (an LP's shares in a bin)
//! TotalShare(i32)     | i128 (total shares issued for a bin)
//! UserBins(Address)   | Vec<i32> (bins an LP has ever deposited into)
//!
//! # Security
//!
//! - All arithmetic uses i128 checked operations (panics = Soroban trap).
//! - Admin-only functions are protected by auth.
//! - Slippage protection on swap_exact_in_bin.
//! - Re-entrancy is not a concern on Soroban (single-threaded, no callbacks
//!   during contract execution).

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Vec,
};
use stellar_dlmm_math::{bin_price, compute_x_from_y, compute_y_from_x, dynamic_fee};

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// Persistent storage keys.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Active,
    LastTs,
    Bin(i32),
    AllBins,
    Share(Address, i32),
    TotalShare(i32),
    UserBins(Address),
}

/// Persistent pool configuration — written once at init, read on every call.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PoolConfig {
    /// Stellar asset contract address for token X (base token).
    pub token_x: Address,
    /// Stellar asset contract address for token Y (quote token, usually USDC).
    pub token_y: Address,
    /// Bin step in basis points (e.g. 25 = 0.25% price gap between bins).
    pub bin_step_bps: i128,
    /// Base swap fee in basis points before dynamic adjustment.
    pub base_fee_bps: i128,
    /// Contract administrator (can set fee, emergency-pause, etc.).
    pub admin: Address,
}

/// Per-bin reserves stored in contract persistent storage.
#[contracttype]
#[derive(Clone, Debug, Default)]
pub struct BinReserves {
    /// Amount of token X in this bin (SCALAR-scaled integer).
    pub reserve_x: i128,
    /// Amount of token Y in this bin (SCALAR-scaled integer).
    pub reserve_y: i128,
}

/// A bin plus its ID — returned by `get_bins` for the distribution chart.
#[contracttype]
#[derive(Clone, Debug)]
pub struct BinInfo {
    pub bin_id: i32,
    pub reserve_x: i128,
    pub reserve_y: i128,
}

/// A single LP position (one bin) — returned by `get_positions`.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PositionInfo {
    pub bin_id: i32,
    /// LP shares held by the user in this bin.
    pub shares: i128,
    /// Total shares issued for the bin (for pro-rata display).
    pub total_shares: i128,
    /// Token X currently claimable by the user (their pro-rata slice).
    pub amount_x: i128,
    /// Token Y currently claimable by the user (their pro-rata slice).
    pub amount_y: i128,
}

/// Return value for swap operations.
#[contracttype]
#[derive(Clone, Debug)]
pub struct SwapResult {
    /// Actual amount of output token sent to the caller.
    pub amount_out: i128,
    /// Total fee collected across all bins (in input token units).
    pub fee_paid: i128,
    /// Number of bins traversed during the swap.
    pub bins_crossed: u32,
    /// Final active bin after the swap.
    pub final_bin: i32,
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

fn get_config(env: &Env) -> PoolConfig {
    env.storage()
        .persistent()
        .get(&DataKey::Config)
        .expect("pool not initialized")
}

fn get_active_bin(env: &Env) -> i32 {
    env.storage()
        .persistent()
        .get(&DataKey::Active)
        .unwrap_or(0i32)
}

fn get_bin(env: &Env, bin_id: i32) -> BinReserves {
    env.storage()
        .persistent()
        .get(&DataKey::Bin(bin_id))
        .unwrap_or_default()
}

fn set_bin(env: &Env, bin_id: i32, reserves: &BinReserves) {
    env.storage()
        .persistent()
        .set(&DataKey::Bin(bin_id), reserves);
}

fn get_last_trade_ts(env: &Env) -> u64 {
    env.storage()
        .persistent()
        .get(&DataKey::LastTs)
        .unwrap_or(0u64)
}

fn get_all_bins(env: &Env) -> Vec<i32> {
    env.storage()
        .persistent()
        .get(&DataKey::AllBins)
        .unwrap_or_else(|| Vec::new(env))
}

/// Record `bin_id` in the global bin registry if not already present.
fn track_bin(env: &Env, bin_id: i32) {
    let mut all = get_all_bins(env);
    if !all.iter().any(|b| b == bin_id) {
        all.push_back(bin_id);
        env.storage().persistent().set(&DataKey::AllBins, &all);
    }
}

fn get_share(env: &Env, user: &Address, bin_id: i32) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Share(user.clone(), bin_id))
        .unwrap_or(0i128)
}

fn set_share(env: &Env, user: &Address, bin_id: i32, shares: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::Share(user.clone(), bin_id), &shares);
}

fn get_total_share(env: &Env, bin_id: i32) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::TotalShare(bin_id))
        .unwrap_or(0i128)
}

fn set_total_share(env: &Env, bin_id: i32, shares: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::TotalShare(bin_id), &shares);
}

fn get_user_bins(env: &Env, user: &Address) -> Vec<i32> {
    env.storage()
        .persistent()
        .get(&DataKey::UserBins(user.clone()))
        .unwrap_or_else(|| Vec::new(env))
}

/// Record `bin_id` in the user's personal bin registry if not already present.
fn track_user_bin(env: &Env, user: &Address, bin_id: i32) {
    let mut bins = get_user_bins(env, user);
    if !bins.iter().any(|b| b == bin_id) {
        bins.push_back(bin_id);
        env.storage()
            .persistent()
            .set(&DataKey::UserBins(user.clone()), &bins);
    }
}

/// Value of a bin denominated in token Y units, at the bin's fixed price.
fn bin_value_in_y(bin: &BinReserves, price: i128) -> i128 {
    bin.reserve_y + compute_y_from_x(bin.reserve_x, price)
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct DlmmContract;

#[contractimpl]
impl DlmmContract {
    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /// Initialise a new DLMM pool.  Can only be called once.
    pub fn initialize(
        env: Env,
        admin: Address,
        token_x: Address,
        token_y: Address,
        bin_step_bps: i128,
        base_fee_bps: i128,
        active_bin_id: i32,
    ) {
        admin.require_auth();
        assert!(
            !env.storage().persistent().has(&DataKey::Config),
            "already initialized"
        );
        assert!(
            bin_step_bps >= 1 && bin_step_bps <= 500,
            "bin_step_bps out of range"
        );
        assert!(
            base_fee_bps >= 1 && base_fee_bps <= 100,
            "base_fee_bps out of range"
        );

        let config = PoolConfig {
            token_x,
            token_y,
            bin_step_bps,
            base_fee_bps,
            admin,
        };
        env.storage().persistent().set(&DataKey::Config, &config);
        env.storage().persistent().set(&DataKey::Active, &active_bin_id);
        env.storage()
            .persistent()
            .set(&DataKey::LastTs, &env.ledger().timestamp());
    }

    // -----------------------------------------------------------------------
    // Liquidity management
    // -----------------------------------------------------------------------

    /// Add liquidity to a specific bin, minting LP shares to the caller.
    ///
    /// For bins above the active bin, only token X should be deposited (Y = 0).
    /// For bins below the active bin, only token Y should be deposited (X = 0).
    /// For the active bin itself, both tokens can be deposited.
    pub fn add_liquidity_bin(
        env: Env,
        caller: Address,
        bin_id: i32,
        amount_x: i128,
        amount_y: i128,
    ) {
        caller.require_auth();
        assert!(amount_x >= 0 && amount_y >= 0, "negative amounts");
        assert!(amount_x > 0 || amount_y > 0, "zero deposit");

        let config = get_config(&env);
        let active_bin = get_active_bin(&env);

        // Enforce one-sided deposits for off-active bins.
        if bin_id > active_bin {
            assert!(amount_y == 0, "only token_x allowed above active bin");
        } else if bin_id < active_bin {
            assert!(amount_x == 0, "only token_y allowed below active bin");
        }

        // Pull tokens from caller.
        if amount_x > 0 {
            token::Client::new(&env, &config.token_x).transfer(
                &caller,
                &env.current_contract_address(),
                &amount_x,
            );
        }
        if amount_y > 0 {
            token::Client::new(&env, &config.token_y).transfer(
                &caller,
                &env.current_contract_address(),
                &amount_y,
            );
        }

        // Value the deposit and the bin (in token Y terms) to mint shares.
        let price = bin_price(config.bin_step_bps, bin_id as i128);
        let mut bin = get_bin(&env, bin_id);
        let bin_value_before = bin_value_in_y(&bin, price);
        let deposit_value = amount_y + compute_y_from_x(amount_x, price);

        let total_shares_before = get_total_share(&env, bin_id);
        let shares_minted = if total_shares_before == 0 || bin_value_before == 0 {
            deposit_value
        } else {
            deposit_value
                .checked_mul(total_shares_before)
                .expect("overflow shares")
                / bin_value_before
        };
        assert!(shares_minted > 0, "deposit too small");

        // Update bin reserves.
        bin.reserve_x = bin.reserve_x.checked_add(amount_x).expect("overflow x");
        bin.reserve_y = bin.reserve_y.checked_add(amount_y).expect("overflow y");
        set_bin(&env, bin_id, &bin);

        // Update share accounting.
        set_total_share(&env, bin_id, total_shares_before + shares_minted);
        set_share(
            &env,
            &caller,
            bin_id,
            get_share(&env, &caller, bin_id) + shares_minted,
        );

        track_bin(&env, bin_id);
        track_user_bin(&env, &caller, bin_id);

        env.events().publish(
            (symbol_short!("ADD_LIQ"), bin_id),
            (caller, amount_x, amount_y, shares_minted),
        );
    }

    /// Remove the caller's entire position in a bin, returning their pro-rata
    /// slice of the bin's current reserves (including accrued swap fees).
    pub fn remove_liquidity_bin(env: Env, caller: Address, bin_id: i32) {
        caller.require_auth();
        let config = get_config(&env);

        let user_shares = get_share(&env, &caller, bin_id);
        assert!(user_shares > 0, "no position in bin");

        let total_shares = get_total_share(&env, bin_id);
        assert!(total_shares > 0, "no shares issued");

        let mut bin = get_bin(&env, bin_id);
        let x_out = bin
            .reserve_x
            .checked_mul(user_shares)
            .expect("overflow x_out")
            / total_shares;
        let y_out = bin
            .reserve_y
            .checked_mul(user_shares)
            .expect("overflow y_out")
            / total_shares;

        // Update reserves & share accounting first (checks-effects-interactions).
        bin.reserve_x -= x_out;
        bin.reserve_y -= y_out;
        set_bin(&env, bin_id, &bin);
        set_total_share(&env, bin_id, total_shares - user_shares);
        set_share(&env, &caller, bin_id, 0);

        // Return tokens to caller.
        if x_out > 0 {
            token::Client::new(&env, &config.token_x).transfer(
                &env.current_contract_address(),
                &caller,
                &x_out,
            );
        }
        if y_out > 0 {
            token::Client::new(&env, &config.token_y).transfer(
                &env.current_contract_address(),
                &caller,
                &y_out,
            );
        }

        env.events().publish(
            (symbol_short!("REM_LIQ"), bin_id),
            (caller, x_out, y_out, user_shares),
        );
    }

    // -----------------------------------------------------------------------
    // Swap
    // -----------------------------------------------------------------------

    /// Swap an exact amount of token X for token Y (or vice versa),
    /// traversing bins from the active bin outward until `amount_in` is consumed.
    pub fn swap_exact_in_bin(
        env: Env,
        caller: Address,
        x_to_y: bool,
        amount_in: i128,
        min_amount_out: i128,
    ) -> SwapResult {
        caller.require_auth();
        assert!(amount_in > 0, "zero amount_in");

        let config = get_config(&env);
        let now = env.ledger().timestamp();
        let seconds_since = (now - get_last_trade_ts(&env)) as i128;
        let fee_bps = dynamic_fee(config.base_fee_bps, seconds_since);

        let mut active_bin = get_active_bin(&env);
        let mut remaining = amount_in;
        let mut total_out: i128 = 0;
        let mut total_fee: i128 = 0;
        let mut bins_crossed: u32 = 0;

        // Step direction: buying Y (x_to_y=true) → move right (higher bins).
        // Selling Y (x_to_y=false) → move left (lower bins).
        let step: i32 = if x_to_y { 1 } else { -1 };

        // Traverse up to 50 bins to cap CPU budget.
        for _ in 0..50 {
            if remaining == 0 {
                break;
            }

            let mut bin = get_bin(&env, active_bin);
            let price = bin_price(config.bin_step_bps, active_bin as i128);

            // Capacity of this bin (how much input it can absorb).
            let (bin_capacity, out_available) = if x_to_y {
                let cap = compute_x_from_y(bin.reserve_y, price);
                (cap, bin.reserve_y)
            } else {
                let cap = compute_y_from_x(bin.reserve_x, price);
                (cap, bin.reserve_x)
            };

            if bin_capacity == 0 {
                active_bin += step;
                continue;
            }

            let consumed = remaining.min(bin_capacity);
            let fee = consumed * fee_bps / 10_000;
            let consumed_after_fee = consumed - fee;

            let out = if x_to_y {
                compute_y_from_x(consumed_after_fee, price).min(out_available)
            } else {
                compute_x_from_y(consumed_after_fee, price).min(out_available)
            };

            // Update bin reserves. Fees stay in the bin (accrue to LPs).
            if x_to_y {
                bin.reserve_x = bin.reserve_x.checked_add(consumed).expect("overflow");
                bin.reserve_y = bin.reserve_y.checked_sub(out).expect("underflow");
            } else {
                bin.reserve_y = bin.reserve_y.checked_add(consumed).expect("overflow");
                bin.reserve_x = bin.reserve_x.checked_sub(out).expect("underflow");
            }
            set_bin(&env, active_bin, &bin);

            total_out = total_out.checked_add(out).expect("overflow out");
            total_fee = total_fee.checked_add(fee).expect("overflow fee");
            remaining -= consumed;
            bins_crossed += 1;

            if consumed >= bin_capacity {
                active_bin += step;
            }
        }

        assert!(total_out >= min_amount_out, "slippage: insufficient output");

        // Pull input token from caller.
        let input_token = if x_to_y { &config.token_x } else { &config.token_y };
        let spent = amount_in - remaining;
        token::Client::new(&env, input_token).transfer(
            &caller,
            &env.current_contract_address(),
            &spent,
        );

        // Push output token to caller.
        let output_token = if x_to_y { &config.token_y } else { &config.token_x };
        token::Client::new(&env, output_token).transfer(
            &env.current_contract_address(),
            &caller,
            &total_out,
        );

        env.storage().persistent().set(&DataKey::Active, &active_bin);
        env.storage().persistent().set(&DataKey::LastTs, &now);

        env.events().publish(
            (symbol_short!("SWAP"), x_to_y),
            (caller, spent, total_out, total_fee),
        );

        SwapResult {
            amount_out: total_out,
            fee_paid: total_fee,
            bins_crossed,
            final_bin: active_bin,
        }
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    /// Return the current active bin ID.
    pub fn get_active_bin(env: Env) -> i32 {
        get_active_bin(&env)
    }

    /// Return reserves for a specific bin.
    pub fn get_bin_reserves(env: Env, bin_id: i32) -> BinReserves {
        get_bin(&env, bin_id)
    }

    /// Return every bin that currently holds liquidity, with its reserves.
    pub fn get_bins(env: Env) -> Vec<BinInfo> {
        let all = get_all_bins(&env);
        let mut out: Vec<BinInfo> = Vec::new(&env);
        for bin_id in all.iter() {
            let bin = get_bin(&env, bin_id);
            if bin.reserve_x > 0 || bin.reserve_y > 0 {
                out.push_back(BinInfo {
                    bin_id,
                    reserve_x: bin.reserve_x,
                    reserve_y: bin.reserve_y,
                });
            }
        }
        out
    }

    /// Return all active LP positions for `user` across every bin.
    pub fn get_positions(env: Env, user: Address) -> Vec<PositionInfo> {
        let bins = get_user_bins(&env, &user);
        let mut out: Vec<PositionInfo> = Vec::new(&env);
        for bin_id in bins.iter() {
            let shares = get_share(&env, &user, bin_id);
            if shares <= 0 {
                continue;
            }
            let total_shares = get_total_share(&env, bin_id);
            let bin = get_bin(&env, bin_id);
            let (amount_x, amount_y) = if total_shares > 0 {
                (
                    bin.reserve_x.checked_mul(shares).expect("overflow") / total_shares,
                    bin.reserve_y.checked_mul(shares).expect("overflow") / total_shares,
                )
            } else {
                (0, 0)
            };
            out.push_back(PositionInfo {
                bin_id,
                shares,
                total_shares,
                amount_x,
                amount_y,
            });
        }
        out
    }

    /// Return a single LP position (caller's shares & claimable amounts) in a bin.
    pub fn get_position(env: Env, user: Address, bin_id: i32) -> PositionInfo {
        let shares = get_share(&env, &user, bin_id);
        let total_shares = get_total_share(&env, bin_id);
        let bin = get_bin(&env, bin_id);
        let (amount_x, amount_y) = if total_shares > 0 && shares > 0 {
            (
                bin.reserve_x.checked_mul(shares).expect("overflow") / total_shares,
                bin.reserve_y.checked_mul(shares).expect("overflow") / total_shares,
            )
        } else {
            (0, 0)
        };
        PositionInfo {
            bin_id,
            shares,
            total_shares,
            amount_x,
            amount_y,
        }
    }

    /// Return pool configuration.
    pub fn get_config(env: Env) -> PoolConfig {
        get_config(&env)
    }

    /// Simulate a swap without state changes (read-only).
    pub fn simulate_swap(env: Env, x_to_y: bool, amount_in: i128) -> SwapResult {
        let config = get_config(&env);
        let now = env.ledger().timestamp();
        let seconds_since = (now - get_last_trade_ts(&env)) as i128;
        let fee_bps = dynamic_fee(config.base_fee_bps, seconds_since);

        let mut active_bin = get_active_bin(&env);
        let mut remaining = amount_in;
        let mut total_out: i128 = 0;
        let mut total_fee: i128 = 0;
        let mut bins_crossed: u32 = 0;
        let step: i32 = if x_to_y { 1 } else { -1 };

        for _ in 0..50 {
            if remaining == 0 {
                break;
            }
            let bin = get_bin(&env, active_bin);
            let price = bin_price(config.bin_step_bps, active_bin as i128);

            let (bin_capacity, out_available) = if x_to_y {
                (compute_x_from_y(bin.reserve_y, price), bin.reserve_y)
            } else {
                (compute_y_from_x(bin.reserve_x, price), bin.reserve_x)
            };

            if bin_capacity == 0 {
                active_bin += step;
                continue;
            }

            let consumed = remaining.min(bin_capacity);
            let fee = consumed * fee_bps / 10_000;
            let out = if x_to_y {
                compute_y_from_x(consumed - fee, price).min(out_available)
            } else {
                compute_x_from_y(consumed - fee, price).min(out_available)
            };

            total_out += out;
            total_fee += fee;
            remaining -= consumed;
            bins_crossed += 1;

            if consumed >= bin_capacity {
                active_bin += step;
            }
        }

        SwapResult {
            amount_out: total_out,
            fee_paid: total_fee,
            bins_crossed,
            final_bin: active_bin,
        }
    }
}
