use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    hash::Hash,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::{Pack, Sealed},
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct GameState {
    pub admin: Pubkey,                             // Admin pubkey
    pub high_scores: [(Pubkey, u64); 20],          // Top 20 scores (player, score)
    pub game_count: u64,                           // Total games played
    pub prize_pool: u64,                           // Accumulated prize pool in tokens
    pub token_account: Pubkey,                     // Program's token account
    pub cost_to_play: u64,                         // Cost in tokens to play
    pub min_time_seconds: u32,                     // Minimum playtime to prevent cheating
    pub active_sessions: Vec<(Pubkey, Hash, u64)>, // Active sessions (player, hash, start_time)
    pub is_initialized: bool,                      // Initialization flag
    pub game_name: String,                         // Name of the game
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct GameRegistry {
    pub games: Vec<(Pubkey, String)>, // List of (game_id, game_name)
}

impl Sealed for GameState {}
impl Pack for GameState {
    const LEN: usize = 1024 + 2048; // Rough estimate: adjust based on max size
    fn pack_into_slice(&self, dst: &mut [u8]) {
        let mut offset = 0;
        self.admin
            .serialize(&mut &mut dst[offset..offset + 32])
            .unwrap();
        offset += 32;
        for (pubkey, score) in self.high_scores.iter() {
            pubkey
                .serialize(&mut &mut dst[offset..offset + 32])
                .unwrap();
            offset += 32;
            score.serialize(&mut &mut dst[offset..offset + 8]).unwrap();
            offset += 8;
        }
        self.game_count
            .serialize(&mut &mut dst[offset..offset + 8])
            .unwrap();
        offset += 8;
        self.prize_pool
            .serialize(&mut &mut dst[offset..offset + 8])
            .unwrap();
        offset += 8;
        self.token_account
            .serialize(&mut &mut dst[offset..offset + 32])
            .unwrap();
        offset += 32;
        self.cost_to_play
            .serialize(&mut &mut dst[offset..offset + 8])
            .unwrap();
        offset += 8;
        self.min_time_seconds
            .serialize(&mut &mut dst[offset..offset + 4])
            .unwrap();
        offset += 4;
        let sessions_bytes = self.active_sessions.try_to_vec().unwrap();
        let sessions_len = sessions_bytes.len() as u32;
        sessions_len
            .serialize(&mut &mut dst[offset..offset + 4])
            .unwrap();
        offset += 4;
        sessions_bytes
            .serialize(&mut &mut dst[offset..offset + sessions_bytes.len()])
            .unwrap();
        offset += sessions_bytes.len();
        self.is_initialized
            .serialize(&mut &mut dst[offset..offset + 1])
            .unwrap();
        offset += 1;
        let name_bytes = self.game_name.as_bytes();
        let name_len = name_bytes.len() as u32;
        name_len
            .serialize(&mut &mut dst[offset..offset + 4])
            .unwrap();
        offset += 4;
        name_bytes
            .serialize(&mut &mut dst[offset..offset + name_bytes.len()])
            .unwrap();
    }

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let mut offset = 0;
        let admin = Pubkey::new(&src[offset..offset + 32]);
        offset += 32;
        let mut high_scores = [(Pubkey::default(), 0); 20];
        for i in 0..20 {
            let pubkey = Pubkey::new(&src[offset..offset + 32]);
            offset += 32;
            let score = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
            offset += 8;
            high_scores[i] = (pubkey, score);
        }
        let game_count = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let prize_pool = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let token_account = Pubkey::new(&src[offset..offset + 32]);
        offset += 32;
        let cost_to_play = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let min_time_seconds = u32::from_le_bytes(src[offset..offset + 4].try_into().unwrap());
        offset += 4;
        let sessions_len = u32::from_le_bytes(src[offset..offset + 4].try_into().unwrap());
        offset += 4;
        let active_sessions: Vec<(Pubkey, Hash, u64)> = if sessions_len > 0 {
            let sessions_data = &src[offset..offset + sessions_len as usize];
            offset += sessions_len as usize;
            Vec::<(Pubkey, Hash, u64)>::try_from_slice(sessions_data)?
        } else {
            Vec::new()
        };
        let is_initialized = src[offset] != 0;
        offset += 1;
        let name_len = u32::from_le_bytes(src[offset..offset + 4].try_into().unwrap());
        offset += 4;
        let game_name = String::from_utf8(src[offset..offset + name_len as usize].to_vec())
            .map_err(|_| ProgramError::InvalidAccountData)?;

        Ok(GameState {
            admin,
            high_scores,
            game_count,
            prize_pool,
            token_account,
            cost_to_play,
            min_time_seconds,
            active_sessions,
            is_initialized,
            game_name,
        })
    }
}

impl Sealed for GameRegistry {}
impl Pack for GameRegistry {
    const LEN: usize = 4096; // Fixed size for simplicity
    fn pack_into_slice(&self, dst: &mut [u8]) {
        let mut offset = 0;
        let game_count = self.games.len() as u32;
        game_count
            .serialize(&mut &mut dst[offset..offset + 4])
            .unwrap();
        offset += 4;
        for (game_id, game_name) in &self.games {
            game_id
                .serialize(&mut &mut dst[offset..offset + 32])
                .unwrap();
            offset += 32;
            let name_bytes = game_name.as_bytes();
            let name_len = name_bytes.len() as u32;
            name_len
                .serialize(&mut &mut dst[offset..offset + 4])
                .unwrap();
            offset += 4;
            name_bytes
                .serialize(&mut &mut dst[offset..offset + name_bytes.len()])
                .unwrap();
            offset += name_bytes.len();
        }
    }

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let mut offset = 0;
        let game_count = u32::from_le_bytes(src[offset..offset + 4].try_into().unwrap());
        offset += 4;
        let mut games = Vec::with_capacity(game_count as usize);
        for _ in 0..game_count {
            let game_id = Pubkey::new(&src[offset..offset + 32]);
            offset += 32;
            let name_len = u32::from_le_bytes(src[offset..offset + 4].try_into().unwrap());
            offset += 4;
            let game_name = String::from_utf8(src[offset..offset + name_len as usize].to_vec())
                .map_err(|_| ProgramError::InvalidAccountData)?;
            offset += name_len as usize;
            games.push((game_id, game_name));
        }
        Ok(GameRegistry { games })
    }
}

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let payer = next_account_info(accounts_iter)?; // Player or admin
    let game_state_acc = next_account_info(accounts_iter)?; // Game state account
    let token_acc = next_account_info(accounts_iter)?; // Program's token account
    let _cos_acc = next_account_info(accounts_iter)?; // Unused COS account (placeholder)
    let registry_acc = next_account_info(accounts_iter)?; // Game registry account
    let system_program = next_account_info(accounts_iter)?; // System program
    let clock = next_account_info(accounts_iter)?; // Clock sysvar
    let token_program = next_account_info(accounts_iter)?; // SPL Token program
    let payer_token_acc = next_account_info(accounts_iter)?; // Payer's token account

    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    match instruction_data[0] {
        0 => {
            // Initialize
            if instruction_data.len() < 69 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let admin = Pubkey::new(&instruction_data[1..33]);
            let token_account = Pubkey::new(&instruction_data[33..65]);
            let name_len = u32::from_le_bytes(instruction_data[65..69].try_into().unwrap());
            let game_name =
                String::from_utf8(instruction_data[69..69 + name_len as usize].to_vec())
                    .map_err(|_| ProgramError::InvalidInstructionData)?;

            if game_state_acc.data.borrow().len() > 0 {
                return Err(ProgramError::AccountAlreadyInitialized);
            }

            let rent = Rent::get()?;
            let space = GameState::LEN;
            let lamports = rent.minimum_balance(space);
            invoke_signed(
                &system_instruction::create_account(
                    payer.key,
                    game_state_acc.key,
                    lamports,
                    space as u64,
                    program_id,
                ),
                &[
                    payer.clone(),
                    game_state_acc.clone(),
                    system_program.clone(),
                ],
                &[],
            )?;

            let game_state = GameState {
                admin,
                high_scores: [(Pubkey::default(), 0); 20],
                game_count: 0,
                prize_pool: 0,
                token_account,
                cost_to_play: 0,
                min_time_seconds: 60,
                active_sessions: Vec::new(),
                is_initialized: true,
                game_name,
            };
            GameState::pack(game_state, &mut game_state_acc.data.borrow_mut())?;
            msg!("Initialized game: {}", game_name);
            Ok(())
        }
        1 => {
            // StartGame
            let mut game_state = GameState::unpack(&game_state_acc.data.borrow())?;
            if !game_state.is_initialized {
                return Err(ProgramError::UninitializedAccount);
            }

            // Transfer tokens if cost_to_play > 0
            if game_state.cost_to_play > 0 {
                invoke(
                    &spl_token::instruction::transfer(
                        token_program.key,
                        payer_token_acc.key,
                        token_acc.key,
                        payer.key,
                        &[],
                        game_state.cost_to_play,
                    )?,
                    &[
                        payer_token_acc.clone(),
                        token_acc.clone(),
                        payer.clone(),
                        token_program.clone(),
                    ],
                )?;
                game_state.prize_pool = game_state
                    .prize_pool
                    .checked_add(game_state.cost_to_play)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
            }

            let clock = Clock::get()?;
            let hash = Hash::new_unique();
            game_state
                .active_sessions
                .push((*payer.key, hash, clock.unix_timestamp as u64));
            game_state.game_count = game_state
                .game_count
                .checked_add(1)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            GameState::pack(game_state, &mut game_state_acc.data.borrow_mut())?;
            msg!("Game started for player: {}", payer.key);
            Ok(())
        }
        2 => {
            // SubmitScore
            if instruction_data.len() < 41 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let score = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let hash = Hash::new(&instruction_data[9..41]);

            let mut game_state = GameState::unpack(&game_state_acc.data.borrow())?;
            if !game_state.is_initialized {
                return Err(ProgramError::UninitializedAccount);
            }

            let session_idx = game_state
                .active_sessions
                .iter()
                .position(|(pk, h, _)| *pk == *payer.key && *h == hash);
            if let Some(idx) = session_idx {
                let (_, _, start_time) = game_state.active_sessions[idx];
                let clock = Clock::get()?;
                let elapsed = (clock.unix_timestamp as u64)
                    .checked_sub(start_time)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
                if elapsed < game_state.min_time_seconds as u64 {
                    return Err(ProgramError::InvalidArgument);
                }
                game_state.active_sessions.remove(idx);
            } else {
                return Err(ProgramError::InvalidArgument);
            }

            let mut scores = game_state.high_scores.to_vec();
            scores.push((*payer.key, score));
            scores.sort_by(|a, b| b.1.cmp(&a.1));
            game_state.high_scores = scores[..20].try_into().unwrap_or_default();
            GameState::pack(game_state, &mut game_state_acc.data.borrow_mut())?;
            msg!("Score submitted: {} for player {}", score, payer.key);
            Ok(())
        }
        3 => {
            // UpdateCost
            if instruction_data.len() < 9 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let new_cost = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());

            let mut game_state = GameState::unpack(&game_state_acc.data.borrow())?;
            if !game_state.is_initialized {
                return Err(ProgramError::UninitializedAccount);
            }
            if *payer.key != game_state.admin {
                return Err(ProgramError::Unauthorized);
            }

            game_state.cost_to_play = new_cost;
            GameState::pack(game_state, &mut game_state_acc.data.borrow_mut())?;
            msg!("Cost updated to: {}", new_cost);
            Ok(())
        }
        4 => {
            // AddGame
            if instruction_data.len() < 37 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let game_id = Pubkey::new(&instruction_data[1..33]);
            let name_len = u32::from_le_bytes(instruction_data[33..37].try_into().unwrap());
            let game_name =
                String::from_utf8(instruction_data[37..37 + name_len as usize].to_vec())
                    .map_err(|_| ProgramError::InvalidInstructionData)?;

            let mut registry = GameRegistry::unpack(&registry_acc.data.borrow())?;
            if !registry.games.is_empty() && registry.games[0].0 != *payer.key {
                return Err(ProgramError::Unauthorized);
            }

            registry.games.push((game_id, game_name.clone()));
            GameRegistry::pack(registry, &mut registry_acc.data.borrow_mut())?;
            msg!("Game added: {}", game_name);
            Ok(())
        }
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
